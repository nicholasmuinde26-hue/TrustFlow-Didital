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
        "pending",

    COMPLETED:
        "completed",

    FAILED:
        "failed"

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





            const paymentMethod = ({ manual: 'cash', cash: 'cash', bank: 'bank', mpesa: 'mpesa' })[String(data.paymentMethod || 'cash').toLowerCase()];
            if (!paymentMethod) throw new Error('Unsupported payment method. Use cash, bank, or mpesa.');

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

                        plan_id:
                            obligation.plan_id,

                        owner_type:
                            obligation.owner_type,


                        owner_id:
                            obligation.owner_id,


                        participant_type:
                            obligation.participant_type,

                        participant_id:
                            obligation.participant_id,


                        obligation_id:
                            obligation._id,


                        amount:
                            amount.toString(),


                        currency:
                            DEFAULT_CURRENCY,


                        payment_method: paymentMethod,

                        channel_type: paymentMethod === "bank" ? "bank_transfer" : paymentMethod,

                        processing_mode:
                            data.processingMode || "manual",

                        payment_provider: paymentMethod,

                        provider_payment_id:
                            data.providerPaymentId || null,

                        external_reference:
                            data.externalReference || null,


                        status:
                            PAYMENT_STATUS.PROCESSING,

                        created_by:
                            data.createdBy,

                        recorded_by:
                            data.createdBy


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
 
 
                            participant_id:
                                obligation.participant_id,
 
 
                            obligation_id:
                                obligation._id,
 
 
                            contribution_plan_id:
                                obligation.plan_id,
 
 
                            payment_method: paymentMethod
 
 
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

            // An MGR payout can be created only after every obligation in the
            // round is settled. This runs after commit so a failed payout check
            // never rolls back a valid member contribution.
            if (obligation.owner_type === 'Chama') {
                const { maybeCreateMgrPayoutForChama } = await import('../chama/chamaFinance.service.js');
                await maybeCreateMgrPayoutForChama(String(obligation.owner_id), data.createdBy).catch(() => null);
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
