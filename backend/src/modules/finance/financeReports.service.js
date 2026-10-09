import mongoose from "mongoose";
import FinancialAccount from "../../models/FinancialAccount.js";
import FinancialTransaction from "../../models/FinancialTransaction.js";
import LedgerEntry from "../../models/LedgerEntry.js";
import ContributionPlan from "../../models/ContributionPlan.js";
import ChamaLoan from "../../models/ChamaLoan.js";
import ChamaAsset from "../../models/ChamaAsset.js";
import AppError from "../../utils/AppError.js";
import {
  isBusinessFundAccount,
  BUSINESS_FUND_ACCOUNT_CODES,
  PROFIT_WALLET_PAYABLE_CODE,
} from "./accounting/businessFunds.constants.js";
import { checkGlBalance } from "./accounting/glBalance.service.js";
import { parseReportPeriod } from "./reportPeriod.js";
import { toScaled } from "../yearEnd/yearEnd.calc.js";
import {
  balancesFromTotals,
  buildTrialBalance,
  buildBalanceSheet,
  buildIncomeStatement,
  buildBusinessIncome,
  buildBusinessFundStatement,
  num,
  buildCashFlow,
  buildReceiptsPayments,
} from "./reportCalc.js";

/**
 * ============================================================================
 * FINANCE REPORTS
 * ============================================================================
 * Every number comes from posted ledger entries (see reportCalc.js), summed as
 * exact decimals. The reports no longer read ContributionPayment, Payout or
 * ChamaLoan to fill in figures: those tables can disagree with the ledger, and
 * a report that quietly prefers one over the other hides the disagreement.
 * ChamaLoan is still read once, as a CHECK on the balance sheet's loans line.
 *
 * Each report returns the same keys the screens already read, plus:
 *   period     what was applied ({ from, to })
 *   integrity  { ledgerBalanced, orphanEntries, driftAccounts, pendingTransactions,
 *                loans?, externalReconciliation }
 *   warnings   plain-language problems found, empty when none
 * ============================================================================
 */

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const ledgerMatch = (ownerType, ownerId) => ({ owner_type: ownerType, owner_id: oid(ownerId), status: "posted" });
const dateRange = (from, to) => ({ posted_at: from ? { $gte: from, $lte: to } : { $lte: to } });

// Sum of every posted entry per account and side. $toDecimal keeps the sum exact
// whether amounts were stored as Decimal128 or as plain numbers.
const sumByAccountAndSide = async (match) => {
  const rows = await LedgerEntry.aggregate([
    { $match: match },
    { $group: { _id: { a: "$account_id", t: "$entry_type" }, total: { $sum: { $toDecimal: "$amount" } } } },
  ]);
  return rows.map((r) => ({ account_id: r._id.a, entry_type: r._id.t, total: r.total }));
};

// Same, split by the type of the transaction that produced the entry.
const sumMovements = async (match) => {
  const rows = await LedgerEntry.aggregate([
    { $match: match },
    { $lookup: { from: FinancialTransaction.collection.name, localField: "transaction_id", foreignField: "_id", as: "tx" } },
    {
      $group: {
        _id: { a: "$account_id", t: "$entry_type", tx: { $arrayElemAt: ["$tx.transaction_type", 0] } },
        total: { $sum: { $toDecimal: "$amount" } },
      },
    },
  ]);
  return rows.map((r) => ({ account_id: r._id.a, entry_type: r._id.t, tx_type: r._id.tx || null, total: r.total }));
};

// Whole transactions in the window that touched at least one of the given accounts,
// each with all of its legs. The receipts & payments statement needs the legs of one
// transaction together, to say what a cash movement was for.
const transactionsTouching = async (match, accountIds) => {
  if (!accountIds.length) return [];
  const rows = await LedgerEntry.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$transaction_id",
        legs: { $push: { account_id: "$account_id", entry_type: "$entry_type", total: { $toDecimal: "$amount" } } },
      },
    },
    { $match: { "legs.account_id": { $in: accountIds } } },
    { $lookup: { from: FinancialTransaction.collection.name, localField: "_id", foreignField: "_id", as: "tx" } },
    { $project: { tx_type: { $arrayElemAt: ["$tx.transaction_type", 0] }, legs: 1 } },
  ]);
  return rows.map((r) => ({ tx_type: r.tx_type || null, legs: r.legs }));
};

// Entries that point at an account which is no longer in the chart. They would
// otherwise vanish from every report silently.
const orphanTotals = (accounts, totals) => {
  const known = new Set(accounts.map((a) => String(a._id)));
  return totals.filter((t) => !known.has(String(t.account_id)));
};

const loadAccounts = (ownerType, ownerId) =>
  FinancialAccount.find({ owner_type: ownerType, owner_id: ownerId }).lean();

// ---------------------------------------------------------------------------
// FUND SCOPE
// ---------------------------------------------------------------------------
// Money earned by chama-owned businesses and properties is kept in its own fund
// (see accounting/businessFunds.constants.js) and must not appear in the chama's
// pooled statements. Every report runs over one scope:
//   "chama"     (default) pooled member money: everything EXCEPT the business fund
//   "business"  only the business fund
//   "all"       the whole ledger (used by the trial balance, which is a ledger check)
// `extra` is merged into the ledger match so sums only see that scope's accounts.
// "chama" uses $nin rather than $in so entries on a deleted account still surface as orphans.
const SCOPES = ["chama", "business", "all"];
export const normalizeScope = (value) => {
  const v = String(value || "chama").toLowerCase();
  return SCOPES.includes(v) ? v : "chama";
};

const loadScope = async (ownerType, ownerId, scope) => {
  const all = await loadAccounts(ownerType, ownerId);
  const business = all.filter(isBusinessFundAccount);
  const businessIds = business.map((a) => a._id);
  if (scope === "all") return { accounts: all, extra: {} };
  if (scope === "business") return { accounts: business, extra: { account_id: { $in: businessIds } } };
  return {
    accounts: all.filter((a) => !isBusinessFundAccount(a)),
    extra: businessIds.length ? { account_id: { $nin: businessIds } } : {},
  };
};

// How many transactions are still pending (so not in the ledger yet).
const countPending = (ownerType, ownerId, to) =>
  FinancialTransaction.countDocuments({ owner_type: ownerType, owner_id: ownerId, status: "pending", createdAt: { $lte: to } });

const isCurrent = (to) => to.getTime() >= Date.now() - 24 * 60 * 60 * 1000;

// current_balance is a running figure as of NOW, so it can only be compared with
// a ledger sum that also runs up to now.
const findDrift = (accounts, balances, to) => {
  if (!isCurrent(to)) return null;
  const out = [];
  for (const a of accounts) {
    const stored = toScaled(a.current_balance ?? 0);
    const ledger = balances.get(String(a._id)) ?? 0n;
    if (stored !== ledger) out.push({ account: a.name, account_code: a.account_code, stored: Number(stored) / 1e6, ledger: Number(ledger) / 1e6 });
  }
  return out;
};

const buildIntegrity = async ({ ownerType, ownerId, accounts, totals, to, balanced, includePending = true }) => {
  const warnings = [];
  const orphans = orphanTotals(accounts, totals);
  if (orphans.length) warnings.push(`${orphans.length} ledger line group(s) point at accounts that no longer exist, so they are missing from this report.`);

  const { balances } = balancesFromTotals(accounts, totals);
  const drift = findDrift(accounts, balances, to);
  if (drift && drift.length) warnings.push(`${drift.length} account(s) have a stored balance that differs from the ledger.`);

  // The pending count is for the whole workspace. The business statements leave it out so
  // an unrelated pending member contribution does not show up as a warning on business figures.
  const pending = includePending ? await countPending(ownerType, ownerId, to) : 0;
  if (pending > 0) warnings.push(`${pending} transaction(s) are still pending and are not in these figures.`);

  if (balanced === false) warnings.push("The ledger does not balance (total debits differ from total credits).");

  return {
    integrity: {
      ledgerBalanced: balanced,
      orphanEntries: orphans.length,
      driftAccounts: drift,
      pendingTransactions: pending,
      // Not compared with M-Pesa or bank statements yet; saying so beats implying it was.
      externalReconciliation: { checked: false },
    },
    warnings,
  };
};

class FinanceReportsService {
  /**
   * `period` is either the legacy single as-at date (string / Date / null) or
   * a { from, to } object. See reportPeriod.js for how dates are read.
   *
   * INCOME_STATEMENT, CASH_FLOW and RECEIPTS_PAYMENTS are flows over a window and honour `from`.
   * TRIAL_BALANCE and BALANCE_SHEET are positions as at `to` and ignore it.
   * The returned `period` shows what was actually applied.
   */
  async getReport(ownerType, ownerId, reportType, mode = "CHAMA", period = null, scopeInput = "chama") {
    const scope = normalizeScope(scopeInput);
    const isWindow = period !== null && typeof period === "object" && !(period instanceof Date);
    const { from, to } = parseReportPeriod(isWindow ? period : { asAtDate: period });

    let data;
    let appliedFrom = null;
    switch (reportType) {
      case "TRIAL_BALANCE":
        // A trial balance is the ledger's own integrity check, so it always covers every
        // account, whatever the scope. Splitting it would hide cross-fund entries.
        data = await this.getTrialBalance(ownerType, ownerId, mode, to);
        break;
      case "INCOME_STATEMENT":
        data = scope === "business"
          ? await this.getBusinessFundIncomeStatement(ownerType, ownerId, to, from)
          : await this.getIncomeStatement(ownerType, ownerId, mode, to, from, scope);
        appliedFrom = from;
        break;
      case "BALANCE_SHEET":
        data = scope === "business"
          ? await this.getBusinessFundBalanceSheet(ownerType, ownerId, to)
          : await this.getBalanceSheet(ownerType, ownerId, mode, to, scope);
        break;
      case "CASH_FLOW":
        data = await this.getCashFlowStatement(ownerType, ownerId, mode, to, from, scope);
        appliedFrom = from;
        break;
      case "RECEIPTS_PAYMENTS":
        if (scope === "business") {
          throw new AppError("Receipts and payments are not available for the business fund. Use the cash flow, which covers the same money.", 400);
        }
        data = await this.getReceiptsPayments(ownerType, ownerId, to, from, scope);
        appliedFrom = from;
        break;
      default:
        throw new Error(`Unsupported report type: ${reportType}`);
    }
    return { ...data, scope, period: { from: appliedFrom, to } };
  }

  /** TRIAL BALANCE */
  async getTrialBalance(ownerType, ownerId, mode, cutoffDate) {
    // Not filtered by account status: a closed or inactive account still holds
    // the postings made while it was open, and the General Ledger shows them.
    const accounts = await loadAccounts(ownerType, ownerId);
    const totals = await sumByAccountAndSide({ ...ledgerMatch(ownerType, ownerId), ...dateRange(null, cutoffDate) });

    const tb = buildTrialBalance(accounts, totals);
    const { _scaled, ...report } = tb;

    // Independent cross-check against the raw ledger. glBalance sums ALL postings,
    // so it can only be compared with a report that also runs to now.
    let ledgerCheck = null;
    if (isCurrent(cutoffDate)) {
      try {
        const gl = await checkGlBalance(ownerType, ownerId);
        const matches = Math.abs(report.totalDebit - gl.totalDebits) < 0.01 && Math.abs(report.totalCredit - gl.totalCredits) < 0.01;
        ledgerCheck = { ledgerTotalDebits: gl.totalDebits, ledgerTotalCredits: gl.totalCredits, matchesLedger: matches };
      } catch {
        ledgerCheck = { matchesLedger: null, error: "Could not cross-check against the general ledger" };
      }
    }

    const { integrity, warnings } = await buildIntegrity({
      ownerType, ownerId, accounts, totals, to: cutoffDate, balanced: report.balanced,
    });
    if (ledgerCheck?.matchesLedger === false) {
      warnings.push(`This report shows KES ${report.totalDebit} debits / KES ${report.totalCredit} credits, but the General Ledger shows KES ${ledgerCheck.ledgerTotalDebits} / KES ${ledgerCheck.ledgerTotalCredits}.`);
    }
    if (!report.balanced) {
      warnings.unshift(`Unbalanced: debits (KES ${report.totalDebit}) do not equal credits (KES ${report.totalCredit}), a difference of KES ${Math.abs(report.difference)}.`);
    }

    return {
      ...report,
      fullyBalanced: report.balanced && ledgerCheck?.matchesLedger !== false,
      ledgerCheck,
      integrity,
      warnings,
      warning: warnings[0] || null, // the screens show one message
    };
  }

  /** INCOME STATEMENT */
  async getIncomeStatement(ownerType, ownerId, mode, cutoffDate, fromDate = null, scope = "chama") {
    const { accounts, extra } = await loadScope(ownerType, ownerId, scope);
    const base = { ...ledgerMatch(ownerType, ownerId), ...extra };
    const movements = await sumMovements({ ...base, ...dateRange(fromDate, cutoffDate) });
    const totals = await sumByAccountAndSide({ ...base, ...dateRange(null, cutoffDate) });
    const { integrity, warnings } = await buildIntegrity({ ownerType, ownerId, accounts, totals, to: cutoffDate, balanced: undefined });

    if (mode === "CHAMA") {
      // Contributions into a fine or fee plan are reported as fines / fees.
      const plans = await ContributionPlan.find({ owner_type: ownerType, owner_id: ownerId, ledger_account_id: { $ne: null } })
        .select("behavior ledger_account_id").lean();
      const behaviorByAccountId = new Map(plans.map((p) => [String(p.ledger_account_id), p.behavior]));
      return { ...buildIncomeStatement(accounts, movements, { behaviorByAccountId }), integrity, warnings };
    }
    return { ...buildBusinessIncome(accounts, movements), integrity, warnings };
  }

  /** BALANCE SHEET */
  async getBalanceSheet(ownerType, ownerId, mode, cutoffDate, scope = "chama") {
    // Balances are rebuilt from the ledger as at the cut-off. They are NOT read from
    // each account's current_balance, which is today's figure whatever date was asked for.
    const { accounts, extra } = await loadScope(ownerType, ownerId, scope);
    const totals = await sumByAccountAndSide({ ...ledgerMatch(ownerType, ownerId), ...extra, ...dateRange(null, cutoffDate) });
    const bs = buildBalanceSheet(accounts, totals);
    const { integrity, warnings } = await buildIntegrity({
      ownerType, ownerId, accounts, totals, to: cutoffDate, balanced: undefined,
    });
    if (!bs.balanced) warnings.unshift(`The balance sheet is out by KES ${Math.abs(bs.difference)}: assets do not equal liabilities plus funds.`);

    if (mode === "CHAMA") {
      // Check the loans line against the loan sub-ledger. The ledger figure is what is
      // reported either way; a mismatch is flagged, not silently swapped in.
      const sub = await ChamaLoan.aggregate([
        {
          $match: {
            chama_id: oid(ownerId),
            status: { $in: ["disbursed", "active", "partially_repaid", "overdue"] },
            createdAt: { $lte: cutoffDate },
          },
        },
        { $group: { _id: null, outstanding: { $sum: "$balances.principal_outstanding" } } },
      ]);
      const subledger = Math.round((sub[0]?.outstanding || 0) * 100) / 100;
      if (isCurrent(cutoffDate)) {
        const matches = Math.abs(subledger - bs.receivables) < 0.01;
        integrity.loans = { ledger: bs.receivables, subledger, matches };
        if (!matches) warnings.push(`Loans on the balance sheet (KES ${bs.receivables}) differ from the loan records (KES ${subledger}).`);
      }

      const breakdown = [...bs.memberFundLines];
      if (bs.accumulatedSurplus !== 0) breakdown.push({ account: "Accumulated surplus", account_code: null, parent_account_code: null, balance: bs.accumulatedSurplus });

      return {
        cashBank: bs.cashBank,
        loansReceivable: bs.receivables,
        otherAssets: bs.otherAssets,
        otherAssetLines: bs.otherAssetLines,
        totalAssets: bs.totalAssets,
        payoutsDue: bs.totalLiabilities,
        liabilityLines: bs.liabilityLines,
        totalLiabilities: bs.totalLiabilities,
        membersFunds: bs.totalFunds,
        membersFundsBreakdown: breakdown,
        totalLiabilitiesAndEquity: bs.totalLiabilitiesAndFunds,
        difference: bs.difference,
        balanced: bs.balanced,
        integrity,
        warnings,
      };
    }

    return {
      cashEquivalents: bs.cashBank,
      accountsReceivable: bs.receivables,
      otherAssets: bs.otherAssets,
      totalAssets: bs.totalAssets,
      accountsPayable: bs.totalLiabilities,
      totalLiabilities: bs.totalLiabilities,
      shareCapital: bs.memberFunds,
      retainedEarnings: bs.accumulatedSurplus,
      totalEquity: bs.totalFunds,
      equityBreakdown: bs.memberFundLines,
      totalLiabilitiesAndEquity: bs.totalLiabilitiesAndFunds,
      difference: bs.difference,
      balanced: bs.balanced,
      integrity,
      warnings,
    };
  }

  /** CASH FLOW */
  async getCashFlowStatement(ownerType, ownerId, mode, cutoffDate, fromDate = null, scope = "chama") {
    const { accounts, extra } = await loadScope(ownerType, ownerId, scope);
    const base = { ...ledgerMatch(ownerType, ownerId), ...extra };
    const before = fromDate
      ? await sumByAccountAndSide({ ...base, posted_at: { $lt: fromDate } })
      : [];
    const movements = await sumMovements({ ...base, ...dateRange(fromDate, cutoffDate) });
    const totals = await sumByAccountAndSide({ ...base, ...dateRange(null, cutoffDate) });
    const { integrity, warnings } = await buildIntegrity({ ownerType, ownerId, accounts, totals, to: cutoffDate, balanced: undefined });

    const cf = buildCashFlow(accounts, before, movements);
    if (mode === "CHAMA") return { ...cf, integrity, warnings };

    // Business view: receipts and payments as they happened in cash. They are not yet
    // classified as operating / investing / financing, so everything shows as operating.
    return {
      operatingReceipts: cf.cashIn,
      operatingPayments: cf.cashOut,
      netOperating: cf.netCashMovement,
      investingOut: 0,
      netInvesting: 0,
      financingIn: 0,
      netFinancing: 0,
      netCashChange: cf.netCashMovement,
      openingBalance: cf.openingBalance,
      closingBalance: cf.closingBalance,
      lines: cf.lines,
      classified: false,
      integrity,
      warnings,
    };
  }

  /**
   * RECEIPTS & PAYMENTS: cash at the start, every receipt and payment by purpose,
   * cash at the end. See buildReceiptsPayments in reportCalc.js.
   */
  async getReceiptsPayments(ownerType, ownerId, cutoffDate, fromDate = null, scope = "chama") {
    const { accounts, extra } = await loadScope(ownerType, ownerId, scope);
    const cashIds = accounts
      .filter((a) => a.account_type === "asset" && ["cash", "bank", "mpesa", "mobile_money"].includes(a.account_category))
      .map((a) => a._id);

    const base = { ...ledgerMatch(ownerType, ownerId), ...extra };
    const [txs, openingTotals, closingTotals, plans] = await Promise.all([
      transactionsTouching({ ...base, ...dateRange(fromDate, cutoffDate) }, cashIds),
      fromDate ? sumByAccountAndSide({ ...base, posted_at: { $lt: fromDate } }) : [],
      sumByAccountAndSide({ ...base, ...dateRange(null, cutoffDate) }),
      ContributionPlan.find({ owner_type: ownerType, owner_id: ownerId, ledger_account_id: { $ne: null } })
        .select("name behavior ledger_account_id").lean(),
    ]);

    const behaviorByAccountId = new Map(plans.map((p) => [String(p.ledger_account_id), p.behavior]));
    const planNameByAccountId = new Map(plans.map((p) => [String(p.ledger_account_id), p.name]));
    const report = buildReceiptsPayments(accounts, txs, { openingTotals, closingTotals, behaviorByAccountId, planNameByAccountId });

    const { integrity, warnings } = await buildIntegrity({
      ownerType, ownerId, accounts, totals: closingTotals, to: cutoffDate, balanced: undefined,
    });
    if (!report.reconciles) {
      warnings.unshift(`Receipts and payments do not add up to the cash held: the ledger shows KES ${report.closingBalance} but the transactions explain KES ${(Math.round((report.openingBalance + report.netMovement) * 100) / 100).toFixed(2)}, a difference of KES ${Math.abs(report.difference)}.`);
    }
    return { ...report, integrity, warnings };
  }

  // =========================================================================
  // BUSINESS & PROPERTY FUND
  // =========================================================================
  // Income from chama-owned businesses and properties, kept apart from member money.
  // See accounting/businessFunds.constants.js for what is in the fund and why.

  /** Chama assets by the suffix used in their ASI_ / ASE_ account codes. */
  async _assetsBySuffix(chamaId) {
    const assets = await ChamaAsset.find({ chama_id: chamaId }).select("name asset_type status").lean();
    return new Map(
      assets.map((a) => [String(a._id).slice(-10).toUpperCase(), { assetId: String(a._id), name: a.name, type: a.asset_type || null, status: a.status || null }])
    );
  }

  async _businessFundLedger(ownerType, ownerId, cutoffDate, fromDate = null) {
    const { accounts, extra } = await loadScope(ownerType, ownerId, "business");
    const base = { ...ledgerMatch(ownerType, ownerId), ...extra };
    const [movements, totals] = await Promise.all([
      fromDate !== undefined ? sumMovements({ ...base, ...dateRange(fromDate, cutoffDate) }) : [],
      sumByAccountAndSide({ ...base, ...dateRange(null, cutoffDate) }),
    ]);
    return { accounts, movements, totals };
  }

  /** INCOME STATEMENT for the business fund: revenue, expenses, profit, profit paid out, by asset. */
  async getBusinessFundIncomeStatement(ownerType, ownerId, cutoffDate, fromDate = null) {
    const { accounts, movements, totals } = await this._businessFundLedger(ownerType, ownerId, cutoffDate, fromDate);
    const statement = buildBusinessFundStatement(accounts, movements);
    const names = ownerType === "Chama" ? await this._assetsBySuffix(ownerId) : new Map();
    const { integrity, warnings } = await buildIntegrity({
      ownerType, ownerId, accounts, totals, to: cutoffDate, balanced: undefined, includePending: false,
    });
    const byAsset = statement.byAsset
      .map((row) => ({ ...row, ...(names.get(row.assetKey) || { assetId: null, name: `Asset ${row.assetKey}`, type: null, status: null }) }))
      .sort((a, b) => b.revenue - a.revenue);
    return {
      revenue: statement.revenue,
      totalIncome: statement.revenue,
      totalExpenses: statement.totalExpenses,
      netProfit: statement.netProfit,
      surplus: statement.netProfit,
      distributed: statement.distributed,
      retained: statement.retained,
      byAsset,
      integrity,
      warnings,
    };
  }

  /** BALANCE SHEET for the business fund: what it holds, what it owes members, what it has retained. */
  async getBusinessFundBalanceSheet(ownerType, ownerId, cutoffDate) {
    const { accounts, totals } = await this._businessFundLedger(ownerType, ownerId, cutoffDate, undefined);
    const bs = buildBalanceSheet(accounts, totals);
    const { balances } = balancesFromTotals(accounts, totals);
    const balanceOf = (a) => num(balances.get(String(a._id)) ?? 0n);

    const holdings = accounts
      .filter((a) => BUSINESS_FUND_ACCOUNT_CODES.includes(a.account_code))
      .map((a) => ({ account: a.name, account_code: a.account_code, balance: balanceOf(a) }))
      .filter((h) => h.balance !== 0);

    const { integrity, warnings } = await buildIntegrity({
      ownerType, ownerId, accounts, totals, to: cutoffDate, balanced: undefined, includePending: false,
    });
    if (!bs.balanced) warnings.unshift(`The business fund balance sheet is out by KES ${Math.abs(bs.difference)}: assets do not equal what is owed plus retained profit. If business income was recorded before the business funds were separated, run the separation script.`);
    const overdrawn = bs.cashBank < 0;
    if (overdrawn) warnings.unshift(`The business fund is overdrawn by KES ${Math.abs(bs.cashBank)}: costs were paid that income has not yet covered. Fund it from the treasury or record the missing income.`);

    return {
      cashBank: bs.cashBank,
      holdings,
      totalAssets: bs.totalAssets,
      owedToMembers: bs.totalLiabilities,
      liabilityLines: bs.liabilityLines,
      retainedProfit: bs.accumulatedSurplus,
      totalFunds: bs.totalFunds,
      totalLiabilitiesAndFunds: bs.totalLiabilitiesAndFunds,
      difference: bs.difference,
      balanced: bs.balanced,
      overdrawn,
      integrity,
      warnings,
    };
  }

  /**
   * One call for the Business & Property page: the fund balance, what each business or
   * property has earned in the window, and what each one still holds. Everything is read
   * from the business fund's ledger accounts, so it cannot include member money.
   */
  async getBusinessFundsOverview(chamaId, period = {}) {
    const ownerType = "Chama";
    const { from, to } = parseReportPeriod(period || {});
    const { accounts, totals } = await this._businessFundLedger(ownerType, chamaId, to, undefined);
    const { previewSeparation } = await import("./businessFundsSeparation.service.js");
    const [statement, sheet, names, separation] = await Promise.all([
      this.getBusinessFundIncomeStatement(ownerType, chamaId, to, from),
      this.getBusinessFundBalanceSheet(ownerType, chamaId, to),
      this._assetsBySuffix(chamaId),
      previewSeparation(chamaId),
    ]);

    // What each asset currently holds in the fund: income less costs less profit already
    // paid out or credited to members, over all time up to `to`. Together with the amount
    // owed to members it adds up to the fund balance.
    const { balances } = balancesFromTotals(accounts, totals);
    const held = new Map();
    for (const a of accounts) {
      const m = /^AS([IE])_(.+)$/.exec(String(a.account_code || ""));
      if (!m) continue;
      const bal = Number(balances.get(String(a._id)) ?? 0n) / 1e6;
      held.set(m[2], (held.get(m[2]) ?? 0) + (m[1] === "I" ? bal : -bal));
    }

    const period_rows = new Map(statement.byAsset.map((r) => [r.assetKey, r]));
    const keys = new Set([...period_rows.keys(), ...held.keys()]);
    const assets = [...keys]
      .map((key) => {
        const row = period_rows.get(key);
        const meta = names.get(key) || { assetId: null, name: `Asset ${key}`, type: null, status: null };
        return {
          ...meta,
          income: row?.revenue ?? 0,
          expenses: row?.expenses ?? 0,
          netProfit: row?.netProfit ?? 0,
          distributed: row?.distributed ?? 0,
          balance: Math.round((held.get(key) ?? 0) * 100) / 100,
        };
      })
      .sort((a, b) => b.income - a.income || b.balance - a.balance);

    return {
      period: { from, to },
      balance: sheet.cashBank,
      holdings: sheet.holdings,
      owedToMembers: sheet.owedToMembers,
      retainedProfit: sheet.retainedProfit,
      overdrawn: sheet.overdrawn,
      // > 0: earlier business income still counted in the chama balance (see the dashboard notice).
      separationPending: separation.pending,
      income: statement.revenue,
      expenses: statement.totalExpenses,
      netProfit: statement.netProfit,
      distributed: statement.distributed,
      retained: statement.retained,
      assets,
      warnings: [...new Set([...(statement.warnings || []), ...(sheet.warnings || [])])],
    };
  }
}

export default new FinanceReportsService();
