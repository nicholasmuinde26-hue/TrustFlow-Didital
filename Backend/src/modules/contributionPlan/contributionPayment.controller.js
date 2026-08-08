/**
 * ============================================================================
 * CONTRIBUTION PAYMENT CONTROLLER
 * ============================================================================
 *
 * HTTP boundary for contribution payments.
 *
 * Responsibilities
 * ----------------
 * ✓ Receive payment requests
 * ✓ Validate request data
 * ✓ Call payment service
 * ✓ Return API responses
 *
 * DOES NOT
 * --------
 * ✗ Process payments
 * ✗ Create journals
 * ✗ Create ledger entries
 * ✗ Update accounts
 *
 * ============================================================================
 */


import contributionPaymentService
    from "./contributionPayment.service.js";



class ContributionPaymentController {



    /**
     * ============================================================
     * CREATE PAYMENT
     * ============================================================
     *
     * POST /contributions/payments
     *
     */


    async createPayment(req, res, next) {


        try {


            const {

                obligationId,

                amount,

                paymentMethod


            } = req.body;






            /**
             * Basic validation
             */


            if (!obligationId) {


                return res.status(400).json({

                    success:false,

                    message:
                        "Contribution obligation is required."

                });


            }




            if (!amount || Number(amount) <= 0) {


                return res.status(400).json({

                    success:false,

                    message:
                        "Valid payment amount is required."

                });


            }






            /**
             * Process business transaction
             */


            const result =
                await contributionPaymentService
                    .processPayment({

                        obligationId,

                        amount:

                            Number(amount),


                        paymentMethod:


                            paymentMethod || "cash",

                        createdBy:

                            req.user._id


                    });






            return res.status(201).json({

                success:true,

                message:
                    "Contribution payment completed.",


                data:
                    result


            });



        }

        catch(error) {


            next(error);


        }


    }






    /**
     * ============================================================
     * HANDLE PAYMENT CALLBACK
     * ============================================================
     *
     * Used by payment providers like M-Pesa.
     *
     */


    async paymentCallback(req, res, next) {


        try {



            const callbackData =
                req.body;





            /**
             *
             * Payment provider verification
             *
             * should happen here:
             *
             * - signature validation
             * - transaction lookup
             * - duplicate check
             *
             */






            const result =
                await contributionPaymentService
                    .processPayment({

                        obligationId:
                            callbackData.obligationId,


                        amount:
                            callbackData.amount,


                        paymentMethod:
                            "MPESA"


                    });






            return res.status(200).json({

                success:true,

                message:
                    "Payment callback processed.",


                data:
                    result


            });



        }

        catch(error) {


            next(error);


        }


    }



}



export default new ContributionPaymentController();
