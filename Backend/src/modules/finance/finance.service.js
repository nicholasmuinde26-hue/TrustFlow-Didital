import mongoose from "mongoose";
import FinancialAccount from "../../models/FinancialAccount.js";
import FinancialTransaction from "../../models/FinancialTransaction.js";
import LedgerEntry from "../../models/LedgerEntry.js";
import ContributionPayment from "../../models/ContributionPayment.js";

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === "ReplicaSetWithPrimary" || topology?.description?.type === "Sharded";
};
const getOpts = (session) => canUseTransactions() && session ? { session } : {};

// HELPER: safely convert Decimal128 to number
const toNumber = (val) => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'object' && val._bsontype === 'Decimal128') {
    return Number(val.toString());
  }
  return Number(val || 0);
};

class FinanceService {

    async getSummary(ownerType, ownerId, session = null) {
        const opts = getOpts(session);

        const accounts = await FinancialAccount.find({
            owner_type: ownerType,
            owner_id: ownerId,
            status: 'active' // only count active accounts
        }, null, opts);

        const transactions = await FinancialTransaction.countDocuments({
            owner_type: ownerType,
            owner_id: ownerId,
            status: "posted",
        }, opts);

        let cash = 0;
        let contributions = 0;
        let loans = 0;
        let payouts = 0;

        for (const account of accounts) {
            const balance = toNumber(account.current_balance); // FIX HERE
            switch (account.account_code) {
                case "CASH":
                case "BANK":
                case "MPESA_CLEARING":
                    cash += balance;
                    break;
                case "MEMBER_CONTRIBUTIONS":
                    contributions += balance;
                    break;
                case "LOANS_RECEIVABLE":
                    loans += balance;
                    break;
                case "PAYOUT_CLEARING":
                    payouts += balance;
                    break;
            }
        }

        const contributionRows = await ContributionPayment.aggregate([
            { $match: { owner_type: ownerType, owner_id: new mongoose.Types.ObjectId(ownerId), status: 'completed' } },
            { $group: { _id: null, total: { $sum: { $toDecimal: "$amount" } } } }, // FIX: cast to decimal
        ], opts);

        const completedContributions = toNumber(contributionRows[0]?.total); // FIX HERE

        return {
            cash_balance: cash,
            total_contributions: completedContributions || contributions,
            outstanding_loans: loans,
            pending_payouts: payouts,
            total_transactions: transactions
        };
    }

    async getAccounts(ownerType, ownerId, session = null) {
        const opts = getOpts(session);
        return FinancialAccount.find({
            owner_type: ownerType,
            owner_id: ownerId
        }, null, opts).sort({ account_code: 1 });
    }

    async getTransactions(ownerType, ownerId, session = null) {
        const opts = getOpts(session);
        return FinancialTransaction.find({
            owner_type: ownerType,
            owner_id: ownerId
        }, null, opts)
       .sort({ createdAt: -1 })
       .limit(100);
    }

    async getLedger(ownerType, ownerId, session = null) {
        const opts = getOpts(session);
        return LedgerEntry.find({
            owner_type: ownerType,
            owner_id: ownerId
        }, null, opts)
       .populate("account_id")
       .sort({ createdAt: -1 })
       .limit(200);
    }
}

export default new FinanceService();