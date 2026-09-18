import mongoose from "mongoose";

import FinancialAccount from "../../models/FinancialAccount.js";
import FinancialTransaction from "../../models/FinancialTransaction.js";
import LedgerEntry from "../../models/LedgerEntry.js";
import ContributionPayment from "../../models/ContributionPayment.js";

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  const topologyType = topology?.description?.type;

  return (
    topologyType === "ReplicaSetWithPrimary" ||
    topologyType === "Sharded"
  );
};

const getOpts = (session) => {
  return canUseTransactions() && session
    ? { session }
    : {};
};

// Safely convert Decimal128 / numbers to JavaScript number
const toNumber = (val) => {
  if (val === null || val === undefined) {
    return 0;
  }

  if (
    typeof val === "object" &&
    val._bsontype === "Decimal128"
  ) {
    return Number(val.toString());
  }

  return Number(val || 0);
};

// Transaction types that represent money leaving the chama's wallet
// (as opposed to fees/penalties which are income). Used for both the
// "cash_out" summary figure and the weekly income-vs-expense trend, so
// the two stay in agreement about what counts as an outflow.
const OUTFLOW_TRANSACTION_TYPES = [
  "payout",
  "payout_settlement",
  "loan_disbursement",
  "withdrawal",
  "customer_payout",
  "expense",
];

const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfNextMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 1);

// Monday-anchored start of the ISO week containing `d`.
const startOfWeek = (d) => {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
};

class FinanceService {
  /**
   * ============================================================
   * FINANCE SUMMARY
   * ============================================================
   */
  async getSummary(ownerType, ownerId, session = null) {
    const opts = getOpts(session);

    const accounts = await FinancialAccount.find(
      {
        owner_type: ownerType,
        owner_id: ownerId,
        status: "active",
      },
      null,
      opts
    );

    const transactions =
      await FinancialTransaction.countDocuments(
        {
          owner_type: ownerType,
          owner_id: ownerId,
          status: "posted",
        },
        opts
      );

    let cash = 0;
    let contributions = 0;
    let savings = 0;
    let loans = 0;
    let payouts = 0;
    let assets = 0;
    let liabilities = 0;
    let equity = 0;

    for (const account of accounts) {
      const balance = toNumber(account.current_balance);

      switch (account.account_type) {
        case "asset":
          assets += balance;
          break;
        case "liability":
          liabilities += balance;
          break;
        case "equity":
          equity += balance;
          break;
        default:
          break;
      }

      switch (account.account_code) {
        case "CASH":
        case "BANK":
        case "MPESA_CLEARING":
          cash += balance;
          break;

        case "MEMBER_CONTRIBUTIONS":
          contributions += balance;
          break;

        case "MEMBER_SAVINGS":
          savings += balance;
          break;

        case "LOAN_RECEIVABLE":
          loans += balance;
          break;

        case "PAYOUT_CLEARING":
          payouts += balance;
          break;

        default:
          break;
      }
    }

    const monthStart = startOfMonth();
    const monthEnd = startOfNextMonth();
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

    // CASH IN — completed member contribution payments received this
    // calendar month. Mirrors the "This Month Income" KPI card so the
    // two never disagree.
    const cashInRows = await ContributionPayment.aggregate(
      [
        {
          $match: {
            owner_type: ownerType,
            owner_id: ownerObjectId,
            status: "completed",
            paid_at: { $gte: monthStart, $lt: monthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: { $toDecimal: "$amount" } } } },
      ],
      opts
    );
    const cashIn = toNumber(cashInRows[0]?.total);

    // CASH OUT — posted outflow transactions (payouts, disbursements,
    // withdrawals, expenses) this calendar month.
    const cashOutRows = await FinancialTransaction.aggregate(
      [
        {
          $match: {
            owner_type: ownerType,
            owner_id: ownerObjectId,
            status: "posted",
            transaction_type: { $in: OUTFLOW_TRANSACTION_TYPES },
            createdAt: { $gte: monthStart, $lt: monthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: { $toDecimal: "$amount" } } } },
      ],
      opts
    );
    const cashOut = toNumber(cashOutRows[0]?.total);

    // FAILED / PENDING — a quick read on payments needing attention,
    // feeding the overview's Action Center.
    const failedTransactions = await ContributionPayment.countDocuments(
      {
        owner_type: ownerType,
        owner_id: ownerId,
        status: "failed",
        paid_at: { $gte: monthStart, $lt: monthEnd },
      },
      opts
    );

    const pendingTransactions = await ContributionPayment.countDocuments(
      {
        owner_type: ownerType,
        owner_id: ownerId,
        status: { $in: ["pending", "processing"] },
      },
      opts
    );

    const ledgerEntryCount = await LedgerEntry.countDocuments(
      { owner_type: ownerType, owner_id: ownerId, status: "posted" },
      opts
    );

    /**
     * Get completed contribution payments.
     *
     * IMPORTANT:
     * $group must be completely closed before the
     * aggregation array is closed.
     */
    const contributionRows =
      await ContributionPayment.aggregate(
        [
          {
            $match: {
              owner_type: ownerType,
              owner_id: new mongoose.Types.ObjectId(ownerId),
              status: "completed",
            },
          },
          {
            $group: {
              _id: null,
              total: {
                $sum: {
                  $toDecimal: "$amount",
                },
              },
            },
          },
        ],
        opts
      );

    const completedContributions = toNumber(
      contributionRows[0]?.total
    );

    return {
      cash_balance: cash,
      savings_balance: savings,

      total_contributions:
        completedContributions || contributions,

      outstanding_loans: loans,
      pending_payouts: payouts,
      total_transactions: transactions,

      cash_in: cashIn,
      cash_out: cashOut,
      assets,
      liabilities,
      equity,
      accounts: accounts.length,
      ledger_entries: ledgerEntryCount,
      failed_transactions: failedTransactions,
      pending_transactions: pendingTransactions,
    };
  }

  /**
   * ============================================================
   * WEEKLY INCOME VS EXPENSE TREND
   * ============================================================
   *
   * Real week-by-week totals for the last `weeks` calendar weeks
   * (Monday-anchored, current partial week included), used by the
   * Overview page's Income vs Expenses chart. Kept as its own method
   * rather than folded into getSummary() so pages that don't render
   * the chart never pay for it.
   */
  async getWeeklyTrend(ownerType, ownerId, { weeks = 5, session = null } = {}) {
    const opts = getOpts(session);
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

    const currentWeekStart = startOfWeek(new Date());
    const points = [];

    for (let i = weeks - 1; i >= 0; i -= 1) {
      const weekStart = new Date(currentWeekStart);
      weekStart.setDate(weekStart.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const [incomeRows, expenseRows] = await Promise.all([
        ContributionPayment.aggregate(
          [
            {
              $match: {
                owner_type: ownerType,
                owner_id: ownerObjectId,
                status: "completed",
                paid_at: { $gte: weekStart, $lt: weekEnd },
              },
            },
            { $group: { _id: null, total: { $sum: { $toDecimal: "$amount" } } } },
          ],
          opts
        ),
        FinancialTransaction.aggregate(
          [
            {
              $match: {
                owner_type: ownerType,
                owner_id: ownerObjectId,
                status: "posted",
                transaction_type: { $in: OUTFLOW_TRANSACTION_TYPES },
                createdAt: { $gte: weekStart, $lt: weekEnd },
              },
            },
            { $group: { _id: null, total: { $sum: { $toDecimal: "$amount" } } } },
          ],
          opts
        ),
      ]);

      points.push({
        week_start: weekStart.toISOString(),
        label: `W${weeks - i}`,
        income: toNumber(incomeRows[0]?.total),
        expense: toNumber(expenseRows[0]?.total),
      });
    }

    return { weeks: points };
  }

  /**
   * ============================================================
   * FINANCIAL ACCOUNTS
   * ============================================================
   */
  async getAccounts(ownerType, ownerId, session = null) {
    const opts = getOpts(session);

    return FinancialAccount.find(
      {
        owner_type: ownerType,
        owner_id: ownerId,
      },
      null,
      opts
    ).sort({
      account_code: 1,
    });
  }

  /**
   * ============================================================
   * FINANCIAL TRANSACTIONS
   * ============================================================
   *
   * `membershipId` scopes the result down to only the transactions
   * that trace back to that member's own contribution payments -
   * used for the plain-member "own" view (see finance.controller.js).
   * Leaving it unset returns the chama's full transaction book, for
   * roles with the 'all' scope (officials only).
   */
  async getTransactions(
    ownerType,
    ownerId,
    { membershipId = null, session = null } = {}
  ) {
    const opts = getOpts(session);

    const query = {
      owner_type: ownerType,
      owner_id: ownerId,
    };

    if (membershipId) {
      const myPayments = await ContributionPayment.find(
        {
          owner_type: ownerType,
          owner_id: ownerId,
          participant_type: "ChamaMembership",
          participant_id: membershipId,
          financial_transaction_id: { $ne: null },
        },
        { financial_transaction_id: 1 },
        opts
      );

      query._id = {
        $in: myPayments.map((p) => p.financial_transaction_id).filter(Boolean),
      };
    }

    return FinancialTransaction.find(query, null, opts)
      .sort({
        createdAt: -1,
      })
      .limit(100);
  }

  /**
   * ============================================================
   * MEMBER (OWN) FINANCE SUMMARY
   * ============================================================
   *
   * A plain member's "Your Balance & Recent Activity" view - always
   * scoped to their own membership, regardless of role. Deliberately
   * separate from getSummary() above (the chama-wide totals), so a
   * member's own contribution history is never confused with, or
   * silently mixed into, the chama's shared wallet figures.
   */
  async getMemberSummary(ownerType, ownerId, membershipId, session = null) {
    const opts = getOpts(session);

    const contributionRows = await ContributionPayment.aggregate(
      [
        {
          $match: {
            owner_type: ownerType,
            owner_id: new mongoose.Types.ObjectId(ownerId),
            participant_type: "ChamaMembership",
            participant_id: new mongoose.Types.ObjectId(membershipId),
            status: "completed",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $toDecimal: "$amount" } },
            count: { $sum: 1 },
          },
        },
      ],
      opts
    );

    const myTotalContributions = toNumber(contributionRows[0]?.total);
    const myPaymentCount = contributionRows[0]?.count || 0;

    const recentPayments = await ContributionPayment.find(
      {
        owner_type: ownerType,
        owner_id: ownerId,
        participant_type: "ChamaMembership",
        participant_id: membershipId,
      },
      null,
      opts
    )
      .sort({ paid_at: -1, createdAt: -1 })
      .limit(10);

    return {
      my_total_contributions: myTotalContributions,
      my_payment_count: myPaymentCount,
      my_recent_activity: recentPayments.map((p) => ({
        id: p._id,
        amount: toNumber(p.amount),
        status: p.status,
        method: p.payment_method,
        reference: p.reference,
        paid_at: p.paid_at,
      })),
    };
  }

  /**
   * ============================================================
   * LEDGER
   * ============================================================
   */
  async getLedger(ownerType, ownerId, session = null) {
    const opts = getOpts(session);

    // Populate transaction_id (not just account_id) so callers can tell
    // WHAT KIND of money movement each entry belongs to - savings deposit,
    // MGR contribution, chama-internal contribution, loan, etc. Without
    // this, every row looks like an anonymous debit/credit and there's no
    // way to trace a payment back to the product it belongs to. Sorted
    // newest-first (chronological, most recent on top) so activity can be
    // followed in the order it actually happened.
    return LedgerEntry.find(
      {
        owner_type: ownerType,
        owner_id: ownerId,
      },
      null,
      opts
    )
      .populate("account_id")
      .populate({
        path: "transaction_id",
        select: "transaction_type reference description status createdAt",
      })
      .sort({
        createdAt: -1,
      })
      .limit(200);
  }
  /**
   * ============================================================
   * RECENT PAYMENTS (for workspace-wide "just completed" polling)
   * ============================================================
   *
   * Used by the finance dashboard's payment watcher to detect payments
   * that reached a final status (completed/failed/reversed/cancelled)
   * recently — including ones initiated by OTHER members — so the
   * dashboard/ledger refresh without a manual reload.
   */
  async getRecentPayments(
    ownerType,
    ownerId,
    { sinceMs = 2 * 60 * 1000, membershipId = null } = {},
    session = null
  ) {
    const opts = getOpts(session);
    const since = new Date(Date.now() - sinceMs);

    const query = {
      owner_type: ownerType,
      owner_id: ownerId,
      status: { $in: ["completed", "failed", "reversed", "cancelled"] },
      updatedAt: { $gte: since },
    };

    // A plain member's watcher should only ever surface toasts about
    // THEIR OWN payments settling - not every other member's contribution
    // amounts and references flowing across the chama. Officials (scope
    // 'all', membershipId left null by the controller) keep seeing every
    // member's activity, which is what makes this useful as a live
    // finance-dashboard feed for them.
    if (membershipId) {
      query.participant_type = "ChamaMembership";
      query.participant_id = membershipId;
    }

    const payments = await ContributionPayment.find(query, null, opts)
      .sort({ updatedAt: -1 })
      .limit(50);

    return payments.map((p) => ({
      id: p._id,
      status: p.status,
      amount: toNumber(p.amount),
      currency: p.currency,
      reference: p.reference,
      receipt_reference: p.external_reference,
      failure_reason: p.failure_message,
      updated_at: p.updatedAt,
    }));
  }

}

export default new FinanceService();