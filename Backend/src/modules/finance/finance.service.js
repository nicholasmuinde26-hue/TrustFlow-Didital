import mongoose from "mongoose"; // ADD
import FinancialAccount from "../../models/FinancialAccount.js";
import FinancialTransaction from "../../models/FinancialTransaction.js";
import LedgerEntry from "../../models/LedgerEntry.js";
import ContributionPayment from "../../models/ContributionPayment.js";

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === "ReplicaSetWithPrimary" || topology?.description?.type === "Sharded";
};
const getOpts = (session) => canUseTransactions() && session? { session } : {};

class FinanceService {

    async getSummary(ownerType, ownerId, session = null) { // ADD session
        const opts = getOpts(session);

        const accounts = await FinancialAccount.find({
            owner_type: ownerType,
            owner_id: ownerId,
        }, null, opts); // ADD opts

        const transactions = await FinancialTransaction.countDocuments({
            owner_type: ownerType,
            owner_id: ownerId,
            status: "posted",
        }, opts); // ADD opts

        let cash = 0;
        let contributions = 0;
        let loans = 0;
        let payouts = 0;

        for (const account of accounts) {
            const balance = Number(account.current_balance);
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
            { $match: { owner_type: ownerType, owner_id: ownerId, status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ], opts); // ADD opts

        const completedContributions = Number(contributionRows[0]?.total?.toString?.() || contributionRows[0]?.total || 0);

        return {
            cash_balance: cash,
            total_contributions: completedContributions || contributions,
            outstanding_loans: loans,
            pending_payouts: payouts,
            total_transactions: transactions
        };
    }

    async getAccounts(ownerType, ownerId, session = null) { // ADD session
        const opts = getOpts(session);
        return FinancialAccount.find({
            owner_type: ownerType,
            owner_id: ownerId
        }, null, opts).sort({ account_code: 1 });
    }

    async getTransactions(ownerType, ownerId, session = null) { // ADD session
        const opts = getOpts(session);
        return FinancialTransaction.find({
            owner_type: ownerType,
            owner_id: ownerId
        }, null, opts)
       .sort({ createdAt: -1 })
       .limit(100);
    }

    async getLedger(ownerType, ownerId, session = null) { // ADD session
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