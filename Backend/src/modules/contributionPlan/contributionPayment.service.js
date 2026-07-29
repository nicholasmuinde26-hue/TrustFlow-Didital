/**
 * ============================================================================
 * CONTRIBUTION PAYMENT SERVICE
 * ============================================================================
 *
 * Business orchestration layer for contribution payments.
 *
 * Responsibilities
 * ----------------
 *
 * ✓ Validate payments
 * ✓ Create payment records
 * ✓ Call Accounting Engine
 * ✓ Update obligations
 * ✓ Maintain payment lifecycle
 *
 *
 * DOES NOT
 * --------
 *
 * ✗ Create journals
 * ✗ Create ledger entries
 * ✗ Update account balances
 * ✗ Decide debit/credit
 *
 * ============================================================================
 */


import mongoose from "mongoose";


import ContributionPayment
    from "../../models/ContributionPayment.js";


import contributionObligationService
    from "./contributionObligation.service.js";


import accountingService
    from "../finance/accounting/accounting.service.js";


import {
    toDecimal,
    isMoneyPositive
}
from "../../shared/decimal.js";





const PAYMENT_STATUS = {

    PROCESSING:
        "PROCESSING",

    COMPLETED:
        "COMPLETED",

    FAILED:
        "FAILED"

};





const DEFAULT_CURRENCY = "KES";





class ContributionPaymentService {



    /**
     * ============================================================
     * PROCESS CONTRIBUTION PAYMENT
     * ============================================================
     */


    async processPayment(
        data,
        existingSession = null
    ){


        const ownsSession =
            !existingSession;



        const session =
            existingSession ||
            await mongoose.startSession();



        try {


            if(ownsSession){

                session.startTransaction();

            }





            const obligation =
                await contributionObligationService.findById(
                    data.obligationId,
                    session
                );



            if(!obligation){

                throw new Error(
                    "Contribution obligation not found."
                );

            }





            const amount =
                toDecimal(
                    data.amount
                );



            if(
                !isMoneyPositive(amount)
            ){

                throw new Error(
                    "Payment amount must be greater than zero."
                );

            }






            /**
             * Create payment record
             */


            const [
                payment
            ] =
            await ContributionPayment.create(
                [
                    {

                        owner_type:
                            obligation.owner_type,


                        owner_id:
                            obligation.owner_id,


                        member_id:
                            obligation.member_id,


                        obligation_id:
                            obligation._id,


                        amount:
                            amount.toString(),


                        currency:
                            DEFAULT_CURRENCY,


                        payment_method:
                            data.paymentMethod,


                        status:
                            PAYMENT_STATUS.PROCESSING


                    }
                ],
                {
                    session
                }
            );






            /**
             * Accounting context
             */


            const accountingResult =

                await accountingService.post(
 
                    {
 
                        owner_type:
                            obligation.owner_type,
 
 
                        owner_id:
                            obligation.owner_id,
 
 
                        referenceType:
                            "CONTRIBUTION_PAYMENT",
 
 
                        referenceId:
                            payment._id,
 
 
                        amount,
 
 
                        currency:
                            DEFAULT_CURRENCY,
 
 
                        source_type:
                            "ContributionPayment",
 
 
                        source_id:
                            payment._id,
 
 
                        metadata: {
 
 
                            member_id:
                                obligation.member_id,
 
 
                            obligation_id:
                                obligation._id,
 
 
                            contribution_plan_id:
                                obligation.plan_id,
 
 
                            payment_method:
                                data.paymentMethod
 
 
                        }


                    },

                    session

                );







            /**
             * Update obligation
             */


            await contributionObligationService.recordPayment(

                obligation._id,

                amount,

                session

            );







            /**
             * Complete payment
             */


            payment.status =
                PAYMENT_STATUS.COMPLETED;



            payment.journal_id =
                accountingResult.journalId;



            await payment.save({
                session
            });






            if(ownsSession){

                await session.commitTransaction();

            }



            return {


                payment,


                accounting:
                    accountingResult


            };



        }
        catch(error){


            if(
                ownsSession &&
                session.inTransaction()
            ){

                await session.abortTransaction();

            }


            throw error;


        }
        finally{


            if(ownsSession){

                await session.endSession();

            }


        }


    }

}





// ============================================================
// GET OWNER CONTRIBUTION PAYMENTS
// ============================================================


export const getOwnerContributionPayments =
async ({
    owner_type,
    owner_id,
    session=null
})=>{


    return ContributionPayment.find({

        owner_type,

        owner_id

    })

    .populate({

        path:
            "member_id",

        select:
            "role status user_id",

        populate:{

            path:
                "user_id",

            select:
                "name phone"

        }

    })

    .sort({

        createdAt:-1

    })

    .session(session);


};








// ============================================================
// RECONCILE OBLIGATION PAYMENTS
// ============================================================


export const reconcileContributionObligationPayments =
async ({
    obligationId,
    session=null
})=>{


    const payments =

        await ContributionPayment.find({

            obligation_id:
                obligationId,


            status:
                PAYMENT_STATUS.COMPLETED


        })

        .session(session);





    const totalPaid =

        payments.reduce(

            (sum,payment)=>

                sum.add(
                    toDecimal(
                        payment.amount
                    )
                ),

            toDecimal(0)

        );





    return {


        obligationId,


        totalPaid:
            totalPaid.toString(),


        paymentCount:
            payments.length,


        payments


    };


};






export default new ContributionPaymentService();