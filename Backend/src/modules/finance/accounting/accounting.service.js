/**
 * ============================================================================
 * ACCOUNTING SERVICE
 * ============================================================================
 *
 * Central coordinator for accounting operations.
 *
 * Responsibilities
 * ----------------
 * ✓ Receive business posting requests
 * ✓ Resolve accounting rules
 * ✓ Build accounting entries
 * ✓ Validate accounting instructions
 * ✓ Execute posting pipeline
 *
 * DOES NOT
 * --------
 * ✗ Know contribution logic
 * ✗ Know loan logic
 * ✗ Know payout logic
 * ✗ Modify account balances directly
 *
 * ============================================================================
 */
import contributionPaymentRule
    from "./rules/contributionPayment.rule.js";


import payoutRule
    from "./rules/payout.rule.js";


import accountingValidator
    from "./accounting.validator.js";


import journalService
    from "./journal.service.js";


import ledgerService
    from "./ledger.service.js";


import financeAccountService
    from "../financeAccount.service.js";

import financeTransactionService
    from "../financeTransaction.service.js";

class AccountingService {



    constructor(){


        this.rules = {


            CONTRIBUTION_PAYMENT:

                contributionPaymentRule,



            PAYOUT_OBLIGATION:

                payoutRule,



            PAYOUT_SETTLEMENT:

                payoutRule,



            PAYOUT_CANCELLATION:

                payoutRule


        };


    }






    /**
     * ============================================================
     * POST ACCOUNTING EVENT
     * ============================================================
     */


    async post(
        context
    ){



        const {

            referenceType,

            transactionType,

            session = null


        } = context;





        const rule =

            this.getRule(
                referenceType || transactionType
            );






        /**
         * Build accounting instructions
         */


        const posting =

            await rule.build(
                context
            );







        /**
         * Validate debit / credit structure
         */


        accountingValidator.validate(
            posting
        );








        /**
         * Create Transaction Header
         */

        const transaction =

            await financeTransactionService.create(

                context,

                session

            );


        /**
         * Create Journal
         */

        const journal =

            await journalService.create(

                posting,

                transaction,

                session

            );


        /**
         * Create Ledger Entries
         */

        const ledgerEntries =

            await ledgerService.createEntries(

                journal,

                transaction,

                posting.entries,

                session

            );







        /**
         * Update balances
         */


        await financeAccountService.applyEntries(

            ledgerEntries,

            session

        );

        const postedJournal =
            await journalService.markPosted(
                journal._id,
                session
            );

        return {

        success: true,

        journalId:
            postedJournal._id,

        transactionId:
            postedJournal.transaction || null,

        ledgerEntries

        };


    }









    /**
     * ============================================================
     * GET ACCOUNTING RULE
     * ============================================================
     */


    getRule(
        type
    ){



        const rule =

            this.rules[type];





        if(!rule){


            throw new Error(

                `No accounting rule registered for ${type}`

            );


        }





        return rule;



    }





}




export default new AccountingService();