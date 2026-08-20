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

    for (const account of accounts) {
      const balance = toNumber(account.current_balance);

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
    };
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
   */
  async getTransactions(
    ownerType,
    ownerId,
    session = null
  ) {
    const opts = getOpts(session);

    return FinancialTransaction.find(
      {
        owner_type: ownerType,
        owner_id: ownerId,
      },
      null,
      opts
    )
      .sort({
        createdAt: -1,
      })
      .limit(100);
  }

  /**
   * ============================================================
   * LEDGER
   * ============================================================
   */
  async getLedger(ownerType, ownerId, session = null) {
    const opts = getOpts(session);

    return LedgerEntry.find(
      {
        owner_type: ownerType,
        owner_id: ownerId,
      },
      null,
      opts
    )
      .populate("account_id")
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
  async getRecentPayments(ownerType, ownerId, { sinceMs = 2 * 60 * 1000 } = {}, session = null) {
    const opts = getOpts(session);
    const since = new Date(Date.now() - sinceMs);

    const payments = await ContributionPayment.find(
      {
        owner_type: ownerType,
        owner_id: ownerId,
        status: { $in: ["completed", "failed", "reversed", "cancelled"] },
        updatedAt: { $gte: since },
      },
      null,
      opts
    )
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