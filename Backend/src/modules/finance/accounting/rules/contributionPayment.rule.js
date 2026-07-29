/**
 * ============================================================================
 * CONTRIBUTION PAYMENT ACCOUNTING RULE
 * ============================================================================
 *
 * Converts a contribution payment business event into accounting instructions.
 *
 * Responsibilities
 * ----------------
 * ✓ Identify accounts involved
 * ✓ Define accounting effect
 * ✓ Build posting instructions
 *
 * DOES NOT
 * --------
 * ✗ Create journals
 * ✗ Create ledger entries
 * ✗ Update balances
 * ✗ Modify contribution records
 *
 * Flow
 * ----
 *
 * Contribution Payment
 *
 *          |
 *          v
 *
 * Contribution Rule
 *
 *          |
 *          v
 *
 * Posting Context
 *
 *          |
 *          v
 *
 * Accounting Engine
 *
 * ============================================================================
 */


import FinancialAccount from "../../../../models/FinancialAccount.js";


class ContributionPaymentRule {


    /**
     * ============================================================
     * RESOLVE ACCOUNTS
     * ============================================================
     *
     * Determines which financial accounts participate.
     *
     * Example:
     *
     * Cash Account
     *       |
     *       | Debit
     *       |
     * Contribution Income
     *       |
     *       | Credit
     *
     */


    async resolveAccounts(context) {

        const {
            owner_type,
            owner_id
        } = context;

        const cashAccount =
            await FinancialAccount.findOne({

                owner_type,

                owner_id,

                account_code: "CASH"

            });

        const contributionIncomeAccount =
            await FinancialAccount.findOne({

                owner_type,

                owner_id,

                account_code: "CONTRIBUTION_INCOME"

            });


        if (!cashAccount) {

            throw new Error(
                "Cash account not configured."
            );

        }



        if (!contributionIncomeAccount) {

            throw new Error(
                "Contribution income account not configured."
            );

        }



        return {


            debitAccount:
                cashAccount._id,


            creditAccount:
                contributionIncomeAccount._id


        };


    }





    /**
     * ============================================================
     * BUILD POSTING INSTRUCTIONS
     * ============================================================
     */


    async build(context) {


        const accounts =
            await this.resolveAccounts(context);



        return {

            transactionType:
                "CONTRIBUTION_PAYMENT",

            referenceType:
                "CONTRIBUTION_PAYMENT",

            referenceId:
                context.referenceId,

            organization:
                context.organization,

            entries: [

                {

                    account_id:
                        accounts.debitAccount,


                    entryType:
                        "DEBIT",


                    amount:
                        context.amount

                },


                {

                    account_id:
                        accounts.creditAccount,


                    entryType:
                        "CREDIT",


                    amount:
                        context.amount

                }


            ],



            metadata: {


                member:
                    context.metadata.member,


                contributionPlan:
                    context.metadata.contributionPlan


            }


        };


    }


}



export default new ContributionPaymentRule();