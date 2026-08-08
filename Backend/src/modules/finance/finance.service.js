import FinancialAccount from "../../models/FinancialAccount.js";
import FinancialTransaction from "../../models/FinancialTransaction.js";
import LedgerEntry from "../../models/LedgerEntry.js";
import ContributionPayment from "../../models/ContributionPayment.js";

class FinanceService {

    async getSummary(ownerType, ownerId) {

        const accounts = await FinancialAccount.find({
            owner_type: ownerType,
            owner_id: ownerId,
        });

        const transactions =
            await FinancialTransaction.countDocuments({
                owner_type: ownerType,
                owner_id: ownerId,
                status: "posted",
            });

        let cash = 0;
        let contributions = 0;
        let loans = 0;
        let payouts = 0;

        for (const account of accounts) {

            const balance =
                Number(account.current_balance);

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

        // Completed contribution records are the business source of truth for
        // member payments (standard contributions, savings and MGR rounds).
        // This keeps the dashboard accurate even when a workspace's chart of
        // accounts uses a custom contribution account code.
        const contributionRows = await ContributionPayment.aggregate([
            { $match: { owner_type: ownerType, owner_id: ownerId, status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        const completedContributions = Number(contributionRows[0]?.total?.toString?.() || contributionRows[0]?.total || 0);

        return {

            cash_balance: cash,

            total_contributions: completedContributions || contributions,

            outstanding_loans: loans,

            pending_payouts: payouts,

            total_transactions: transactions

        };

    }

    async getAccounts(ownerType, ownerId) {

        return FinancialAccount.find({

            owner_type: ownerType,

            owner_id: ownerId

        }).sort({

            account_code: 1

        });

    }

    async getTransactions(ownerType, ownerId) {

        return FinancialTransaction.find({

            owner_type: ownerType,

            owner_id: ownerId

        })

            .sort({

                createdAt: -1

            })

            .limit(100);

    }

    async getLedger(ownerType, ownerId) {

        return LedgerEntry.find({

            owner_type: ownerType,

            owner_id: ownerId

        })

            .populate("account_id")

            .sort({

                createdAt: -1

            })

            .limit(200);

    }

}

export default new FinanceService();
