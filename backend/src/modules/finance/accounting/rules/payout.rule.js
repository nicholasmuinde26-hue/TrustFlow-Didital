/**
 * ============================================================================
 * PAYOUT ACCOUNTING RULE
 * ============================================================================
 *
 * Converts payout business events into accounting instructions.
 *
 * Supported events:
 *
 * PAYOUT_OBLIGATION
 *
 *      DR MEMBER_CONTRIBUTIONS
 *      CR PAYOUT_CLEARING
 *
 *
 * PAYOUT_SETTLEMENT
 *
 *      DR PAYOUT_CLEARING
 *      CR CASH/BANK/MPESA
 *
 *
 * PAYOUT_CANCELLATION
 *
 *      DR PAYOUT_CLEARING
 *      CR MEMBER_CONTRIBUTIONS
 *
 *
 * DOES NOT:
 *
 * ✗ Query FinancialAccount
 * ✗ Modify balances
 * ✗ Create journals
 *
 * ============================================================================
 */



import {
    ACCOUNT_CODES,
    ENTRY_TYPES
}
from "../accounting.constants.js";





class PayoutRule {



    /**
     * =========================================================================
     * BUILD ACCOUNTING POSTING
     * =========================================================================
     */


    async build(context){



        switch(context.referenceType){


            case "PAYOUT_OBLIGATION":

                return this.buildObligation(
                    context
                );



            case "PAYOUT_SETTLEMENT":

                return this.buildSettlement(
                    context
                );



            case "PAYOUT_CANCELLATION":

                return this.buildCancellation(
                    context
                );



            default:


                throw new Error(

                    `Unsupported payout event ${context.referenceType}`

                );


        }


    }







    /**
     * =========================================================================
     * PAYOUT RECOGNITION
     * =========================================================================
     *
     * Chama now owes member money.
     *
     * DR Member Contributions
     * CR Payout Clearing
     *
     * =========================================================================
     */


    buildObligation(context){
        return {
            transactionType:
                "PAYOUT_OBLIGATION",
            description:
                context.description ||
                "Payout obligation created",
            chama:
                context.chama || context.owner_id || context.ownerId || context.chamaId,
            member:
                context.member || context.memberId || context.created_by,
            amount:
                context.amount,
            currency:
                context.currency || "KES",
            entries:[



                {

                    accountCode:
                        ACCOUNT_CODES.MEMBER_CONTRIBUTIONS,


                    entryType:
                        ENTRY_TYPES.DEBIT,


                    amount:
                        context.amount

                },




                {

                    accountCode:
                        ACCOUNT_CODES.PAYOUT_CLEARING,


                    entryType:
                        ENTRY_TYPES.CREDIT,


                    amount:
                        context.amount


                }


            ]


        };


    }








    /**
     * =========================================================================
     * PAYOUT SETTLEMENT
     * =========================================================================
     *
     * Treasurer confirms money was sent.
     *
     * DR Payout Clearing
     * CR Cash/Bank/Mpesa
     *
     * =========================================================================
     */


    buildSettlement(context){
        const assetAccount =
            this.resolveDisbursementAccount(
                context.disbursement_method ||
                context.metadata?.disbursement_method
            );

        return {
            transactionType:
                "PAYOUT_SETTLEMENT",
            description:
                context.description ||
                "Payout settlement",
            chama:
                context.chama || context.owner_id || context.ownerId || context.chamaId,
            member:
                context.member || context.memberId || context.created_by,
            amount:
                context.amount,
            currency:
                context.currency || "KES",
            entries:[


                {

                    accountCode:
                        ACCOUNT_CODES.PAYOUT_CLEARING,


                    entryType:
                        ENTRY_TYPES.DEBIT,


                    amount:
                        context.amount


                },



                {


                    accountCode:
                        assetAccount,


                    entryType:
                        ENTRY_TYPES.CREDIT,


                    amount:
                        context.amount


                }


            ]


        };


    }









    /**
     * =========================================================================
     * PAYOUT CANCELLATION
     * =========================================================================
     *
     * Reverse obligation.
     *
     * DR Payout Clearing
     * CR Member Contributions
     *
     * =========================================================================
     */


    buildCancellation(context){
        return {
            transactionType:
                "PAYOUT_CANCELLATION",
            description:
                context.description ||
                "Payout cancelled",
            chama:
                context.chama || context.owner_id || context.ownerId || context.chamaId,
            member:
                context.member || context.memberId || context.created_by,
            amount:
                context.amount,
            currency:
                context.currency || "KES",
            entries:[



                {

                    accountCode:
                        ACCOUNT_CODES.PAYOUT_CLEARING,


                    entryType:
                        ENTRY_TYPES.DEBIT,


                    amount:
                        context.amount


                },



                {


                    accountCode:
                        ACCOUNT_CODES.MEMBER_CONTRIBUTIONS,


                    entryType:
                        ENTRY_TYPES.CREDIT,


                    amount:
                        context.amount


                }


            ]


        };


    }









    /**
     * =========================================================================
     * PAYMENT METHOD → ACCOUNT CODE
     * =========================================================================
     */


    resolveDisbursementAccount(
        method
    ){



        const accounts = {


            cash:
                ACCOUNT_CODES.CASH,


            bank:
                ACCOUNT_CODES.BANK,


            mpesa:
                ACCOUNT_CODES.MPESA_CLEARING


        };



        const account =
            accounts[method];



        if(!account){


            throw new Error(

                `Unsupported payout disbursement method ${method}`

            );


        }



        return account;



    }



}



export default new PayoutRule();