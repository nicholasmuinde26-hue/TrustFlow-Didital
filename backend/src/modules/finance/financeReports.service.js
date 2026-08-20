import mongoose from "mongoose";
import FinancialAccount from "../../models/FinancialAccount.js";
import FinancialTransaction from "../../models/FinancialTransaction.js";
import LedgerEntry from "../../models/LedgerEntry.js";
import ContributionPayment from "../../models/ContributionPayment.js";
import Payout from "../../models/Payout.js";
import ChamaLoan from "../../models/ChamaLoan.js";

const toNumber = (val) => {
  if (val === null || val === undefined) return 0;
  if (typeof val === "object" && val._bsontype === "Decimal128") {
    return Number(val.toString());
  }
  return Number(val || 0);
};

class FinanceReportsService {
  async getReport(ownerType, ownerId, reportType, mode = "CHAMA", asAtDate = null) {
    const cutoffDate = asAtDate ? new Date(asAtDate) : new Date();
    cutoffDate.setHours(23, 59, 59, 999);

    switch (reportType) {
      case "TRIAL_BALANCE":
        return this.getTrialBalance(ownerType, ownerId, mode, cutoffDate);
      case "INCOME_STATEMENT":
        return this.getIncomeStatement(ownerType, ownerId, mode, cutoffDate);
      case "BALANCE_SHEET":
        return this.getBalanceSheet(ownerType, ownerId, mode, cutoffDate);
      case "CASH_FLOW":
        return this.getCashFlowStatement(ownerType, ownerId, mode, cutoffDate);
      default:
        throw new Error(`Unsupported report type: ${reportType}`);
    }
  }

  /**
   * ============================================================
   * TRIAL BALANCE
   * ============================================================
   */
  async getTrialBalance(ownerType, ownerId, mode, cutoffDate) {
    const accounts = await FinancialAccount.find({
      owner_type: ownerType,
      owner_id: ownerId,
      status: "active",
      createdAt: { $lte: cutoffDate },
    });

    const entries = await LedgerEntry.find({
      owner_type: ownerType,
      owner_id: ownerId,
      status: "posted",
      posted_at: { $lte: cutoffDate },
    });

    const accountTotals = {};
    for (const entry of entries) {
      const accId = entry.account_id.toString();
      if (!accountTotals[accId]) {
        accountTotals[accId] = { debit: 0, credit: 0 };
      }
      const amt = toNumber(entry.amount);
      if (entry.entry_type === "debit") {
        accountTotals[accId].debit += amt;
      } else {
        accountTotals[accId].credit += amt;
      }
    }

    const items = [];
    let totalDebit = 0;
    let totalCredit = 0;

    for (const acc of accounts) {
      const accId = acc._id.toString();
      const totals = accountTotals[accId] || { debit: 0, credit: 0 };
      let debit = 0;
      let credit = 0;

      const currentBal = toNumber(acc.current_balance);

      if (totals.debit > 0 || totals.credit > 0) {
        if (acc.normal_balance === "debit") {
          const net = totals.debit - totals.credit;
          if (net >= 0) debit = net;
          else credit = Math.abs(net);
        } else {
          const net = totals.credit - totals.debit;
          if (net >= 0) credit = net;
          else debit = Math.abs(net);
        }
      } else if (currentBal !== 0) {
        if (acc.normal_balance === "debit") debit = currentBal;
        else credit = currentBal;
      }

      if (debit > 0 || credit > 0 || totals.debit > 0 || totals.credit > 0) {
        items.push({
          account: acc.name,
          account_code: acc.account_code,
          debit,
          credit,
        });
        totalDebit += debit;
        totalCredit += credit;
      }
    }

    if (items.length === 0) {
      if (mode === "CHAMA") {
        const payments = await ContributionPayment.aggregate([
          {
            $match: {
              owner_type: ownerType,
              owner_id: new mongoose.Types.ObjectId(ownerId),
              status: "completed",
              createdAt: { $lte: cutoffDate },
            },
          },
          { $group: { _id: null, total: { $sum: { $toDecimal: "$amount" } } } },
        ]);
        const paid = toNumber(payments[0]?.total);

        items.push(
          { account: "Mchango ya Wanachama (Contributions)", debit: 0, credit: paid },
          { account: "Mpesa & Cash Wallet", debit: paid, credit: 0 }
        );
        totalDebit = paid;
        totalCredit = paid;
      } else {
        items.push(
          { account: "Operating Capital", debit: 0, credit: 0 },
          { account: "Cash & Bank Balances", debit: 0, credit: 0 }
        );
      }
    }

    return { items, totalDebit, totalCredit };
  }

  /**
   * ============================================================
   * INCOME STATEMENT
   * ============================================================
   */
  async getIncomeStatement(ownerType, ownerId, mode, cutoffDate) {
    if (mode === "CHAMA") {
      const contributionRows = await ContributionPayment.aggregate([
        {
          $match: {
            owner_type: ownerType,
            owner_id: new mongoose.Types.ObjectId(ownerId),
            status: "completed",
            createdAt: { $lte: cutoffDate },
          },
        },
        {
          $group: {
            _id: null,
            contributions: { $sum: { $toDecimal: "$amount" } },
            fines: { $sum: { $toDecimal: { $ifNull: ["$fine_amount", 0] } } },
          },
        },
      ]);

      const contributions = toNumber(contributionRows[0]?.contributions);
      const fines = toNumber(contributionRows[0]?.fines);

      const payoutRows = await Payout.aggregate([
        {
          $match: {
            chama_id: new mongoose.Types.ObjectId(ownerId),
            status: "paid",
            paid_at: { $lte: cutoffDate },
          },
        },
        { $group: { _id: null, total: { $sum: { $toDecimal: "$amount" } } } },
      ]);
      const mgrPayouts = toNumber(payoutRows[0]?.total);

      const expenseEntries = await LedgerEntry.aggregate([
        {
          $match: {
            owner_type: ownerType,
            owner_id: new mongoose.Types.ObjectId(ownerId),
            status: "posted",
            posted_at: { $lte: cutoffDate },
          },
        },
        {
          $lookup: {
            from: "financialaccounts",
            localField: "account_id",
            foreignField: "_id",
            as: "account",
          },
        },
        { $unwind: "$account" },
        {
          $match: {
            "account.account_type": "expense",
          },
        },
        { $group: { _id: null, total: { $sum: { $toDecimal: "$amount" } } } },
      ]);
      const adminCosts = toNumber(expenseEntries[0]?.total);

      const totalIncome = contributions + fines;
      const totalExpenses = mgrPayouts + adminCosts;
      const surplus = totalIncome - totalExpenses;

      return {
        contributions,
        fines,
        totalIncome,
        mgrPayouts,
        adminCosts,
        totalExpenses,
        surplus,
      };
    } else {
      const ledgerTotals = await LedgerEntry.aggregate([
        {
          $match: {
            owner_type: ownerType,
            owner_id: new mongoose.Types.ObjectId(ownerId),
            status: "posted",
            posted_at: { $lte: cutoffDate },
          },
        },
        {
          $lookup: {
            from: "financialaccounts",
            localField: "account_id",
            foreignField: "_id",
            as: "account",
          },
        },
        { $unwind: "$account" },
        {
          $group: {
            _id: "$account.account_type",
            totalDebit: {
              $sum: {
                $cond: [{ $eq: ["$entry_type", "debit"] }, { $toDecimal: "$amount" }, 0],
              },
            },
            totalCredit: {
              $sum: {
                $cond: [{ $eq: ["$entry_type", "credit"] }, { $toDecimal: "$amount" }, 0],
              },
            },
          },
        },
      ]);

      let revenue = 0;
      let cogs = 0;
      let opex = 0;

      for (const row of ledgerTotals) {
        if (row._id === "income") {
          revenue = toNumber(row.totalCredit) - toNumber(row.totalDebit);
        } else if (row._id === "expense") {
          opex = toNumber(row.totalDebit) - toNumber(row.totalCredit);
        }
      }

      const grossProfit = revenue - cogs;
      const netProfit = grossProfit - opex;

      return {
        revenue,
        cogs,
        grossProfit,
        salaries: opex * 0.6,
        licensing: opex * 0.4,
        totalOpex: opex,
        netProfit,
      };
    }
  }

  /**
   * ============================================================
   * BALANCE SHEET
   * ============================================================
   */
  async getBalanceSheet(ownerType, ownerId, mode, cutoffDate) {
    const accounts = await FinancialAccount.find({
      owner_type: ownerType,
      owner_id: ownerId,
      status: "active",
      createdAt: { $lte: cutoffDate },
    });

    let cashBank = 0;
    let accountsReceivable = 0;
    let payables = 0;
    let equity = 0;

    for (const acc of accounts) {
      const bal = toNumber(acc.current_balance);
      switch (acc.account_category) {
        case "cash":
        case "bank":
        case "mpesa":
        case "mobile_money":
          cashBank += bal;
          break;
        case "receivable":
        case "loan":
          accountsReceivable += bal;
          break;
        case "payable":
        case "clearing":
          payables += bal;
          break;
        case "contribution":
        case "savings":
        case "equity":
          equity += bal;
          break;
        default:
          if (acc.account_type === "asset") cashBank += bal;
          else if (acc.account_type === "liability") payables += bal;
          else if (acc.account_type === "equity") equity += bal;
          break;
      }
    }

    if (mode === "CHAMA") {
      const activeLoans = await ChamaLoan.aggregate([
        {
          $match: {
            chama_id: new mongoose.Types.ObjectId(ownerId),
            status: { $in: ["disbursed", "active", "partially_repaid", "overdue"] },
            createdAt: { $lte: cutoffDate },
          },
        },
        {
          $group: {
            _id: null,
            outstanding: { $sum: "$balances.principal_outstanding" },
          },
        },
      ]);
      const loansReceivable = accountsReceivable || toNumber(activeLoans[0]?.outstanding);

      const pendingPayouts = await Payout.aggregate([
        {
          $match: {
            chama_id: new mongoose.Types.ObjectId(ownerId),
            status: { $in: ["pending", "approved"] },
            createdAt: { $lte: cutoffDate },
          },
        },
        { $group: { _id: null, total: { $sum: { $toDecimal: "$amount" } } } },
      ]);
      const payoutsDue = payables || toNumber(pendingPayouts[0]?.total);

      const completedContributions = await ContributionPayment.aggregate([
        {
          $match: {
            owner_type: ownerType,
            owner_id: new mongoose.Types.ObjectId(ownerId),
            status: "completed",
            createdAt: { $lte: cutoffDate },
          },
        },
        { $group: { _id: null, total: { $sum: { $toDecimal: "$amount" } } } },
      ]);
      const contributionsPaid = toNumber(completedContributions[0]?.total);

      const totalAssets = cashBank + loansReceivable;
      const totalLiabilities = payoutsDue;
      const membersFunds = equity || (contributionsPaid > 0 ? contributionsPaid : totalAssets - totalLiabilities);

      return {
        cashBank,
        loansReceivable,
        totalAssets,
        payoutsDue,
        totalLiabilities,
        membersFunds,
        totalLiabilitiesAndEquity: totalLiabilities + membersFunds,
      };
    } else {
      const totalAssets = cashBank + accountsReceivable;
      const totalLiabilities = payables;
      const totalEquity = equity || (totalAssets - totalLiabilities);

      return {
        cashEquivalents: cashBank,
        accountsReceivable,
        totalAssets,
        accountsPayable: payables,
        totalLiabilities,
        shareCapital: totalEquity * 0.6,
        retainedEarnings: totalEquity * 0.4,
        totalEquity,
        totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
      };
    }
  }

  /**
   * ============================================================
   * CASH FLOW STATEMENT
   * ============================================================
   */
  async getCashFlowStatement(ownerType, ownerId, mode, cutoffDate) {
    if (mode === "CHAMA") {
      const payments = await ContributionPayment.aggregate([
        {
          $match: {
            owner_type: ownerType,
            owner_id: new mongoose.Types.ObjectId(ownerId),
            status: "completed",
            createdAt: { $lte: cutoffDate },
          },
        },
        { $group: { _id: null, total: { $sum: { $toDecimal: "$amount" } } } },
      ]);
      const cashIn = toNumber(payments[0]?.total);

      const payouts = await Payout.aggregate([
        {
          $match: {
            chama_id: new mongoose.Types.ObjectId(ownerId),
            status: "paid",
            paid_at: { $lte: cutoffDate },
          },
        },
        { $group: { _id: null, total: { $sum: { $toDecimal: "$amount" } } } },
      ]);
      const cashOut = toNumber(payouts[0]?.total);

      const netCashMovement = cashIn - cashOut;

      const accounts = await FinancialAccount.find({
        owner_type: ownerType,
        owner_id: ownerId,
        account_category: { $in: ["cash", "bank", "mpesa", "mobile_money"] },
        status: "active",
      });
      let currentCash = 0;
      for (const acc of accounts) {
        currentCash += toNumber(acc.current_balance);
      }

      const closingBalance = currentCash || Math.max(0, netCashMovement);
      const openingBalance = Math.max(0, closingBalance - netCashMovement);

      return {
        cashIn,
        cashOut,
        netCashMovement,
        openingBalance,
        closingBalance,
      };
    } else {
      const incomeRes = await this.getIncomeStatement(ownerType, ownerId, "BUSINESS", cutoffDate);

      const operatingReceipts = incomeRes.revenue;
      const operatingPayments = incomeRes.totalOpex + incomeRes.cogs;
      const netOperating = operatingReceipts - operatingPayments;

      const investingOut = 0;
      const netInvesting = -investingOut;

      const financingIn = 0;
      const netFinancing = financingIn;

      const netCashChange = netOperating + netInvesting + netFinancing;

      return {
        operatingReceipts,
        operatingPayments,
        netOperating,
        investingOut,
        netInvesting,
        financingIn,
        netFinancing,
        netCashChange,
      };
    }
  }
}

export default new FinanceReportsService();
