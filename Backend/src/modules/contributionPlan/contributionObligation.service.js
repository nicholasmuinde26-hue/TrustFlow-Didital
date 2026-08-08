/**
 * ============================================================================
 * CONTRIBUTION OBLIGATION SERVICE
 * ============================================================================
 *
 * Manages contribution obligations.
 *
 * Responsibilities
 * ----------------
 * ✓ Create obligations
 * ✓ Track expected contributions
 * ✓ Track paid amounts
 * ✓ Calculate outstanding balances
 * ✓ Update obligation status
 *
 * DOES NOT
 * --------
 * ✗ Handle payments
 * ✗ Create accounting entries
 * ✗ Update financial accounts
 * ✗ Know debit/credit rules
 *
 * ============================================================================
 */


import ContributionObligation
    from "../../models/ContributionObligation.js";



class ContributionObligationService {



    /**
     * ============================================================
     * CREATE OBLIGATION
     * ============================================================
     */


    async create(data, session = null) {


        const obligation =
            await ContributionObligation.create(
                [
                    {

                        ...data

                    }
                ],
                {
                    session
                }
            );


        return obligation[0];

    }






    /**
     * ============================================================
     * FIND OBLIGATION
     * ============================================================
     */


    async findById(id) {


        return ContributionObligation.findById(id);


    }







    /**
     * ============================================================
     * RECORD PAYMENT EFFECT
     * ============================================================
     *
     * Important:
     *
     * This DOES NOT process money.
     *
     * Money was already handled by:
     *
     * Accounting Engine
     *
     * This only updates business state.
     *
     */


    async recordPayment(
        obligationId,
        amount,
        session = null
    ) {



        const obligation =
            await ContributionObligation
                .findById(obligationId)
                .session(session);



        if (!obligation) {

            throw new Error(
                "Contribution obligation not found."
            );

        }





        const paidAmount = Number(obligation.paid_amount?.toString() || 0) + Number(amount);
        obligation.paid_amount = paidAmount;





        if (
            paidAmount >=
            Number(obligation.expected_amount?.toString() || 0)
        ) {


            obligation.status =
                "paid";


        }

        else {


            obligation.status =
                "partially_paid";


        }





        await obligation.save({
            session
        });



        return obligation;


    }






    /**
     * ============================================================
     * GET OUTSTANDING BALANCE
     * ============================================================
     */


    calculateOutstanding(obligation) {


        return Math.max(

            Number(obligation.expected_amount || 0) -
            Number(obligation.paid_amount || 0),

            0

        );


    }






    /**
     * ============================================================
     * MARK AS OVERDUE
     * ============================================================
     */


    async markOverdue(
        obligationId
    ) {


        return ContributionObligation.findByIdAndUpdate(

            obligationId,

            {

                status:
                    "overdue"

            },

            {
                new:true
            }

        );


    }



}



export default new ContributionObligationService();
