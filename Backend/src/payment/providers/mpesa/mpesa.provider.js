/**
 * ============================================================================
 * MPESA PAYMENT PROVIDER
 * ============================================================================
 *
 * Responsibilities
 * ----------------
 * • Initiate STK Push
 * • Parse Callback
 * • Query Payment
 * • Normalize Daraja responses
 *
 * DOES NOT
 * --------
 * ✗ Update MongoDB
 * ✗ Call Finance Engine
 * ✗ Emit Events
 * ✗ Know ContributionPayment
 *
 * ============================================================================
 */

import ProviderInterface
from "../provider.interface.js";

import mpesaService
from "./mpesa.service.js";

class MpesaProvider extends ProviderInterface {

    /**
     * --------------------------------------------------------
     * Provider Name
     * --------------------------------------------------------
     */

    getName() {

        return "MPESA";

    }

    /**
     * --------------------------------------------------------
     * Initiate STK Push
     * --------------------------------------------------------
     */

    async initiate(context) {

        const response =
            await mpesaService.initiateSTKPush({

                phoneNumber:
                    context.participant.phoneNumber,

                amount:
                    context.payment.amount,

                reference:
                    context.payment.reference,

                accountReference:
                    context.payment.reference,

                description:
                    context.payment.description

            });

        return {

            providerReference:
                response.CheckoutRequestID,

            checkoutRequestId:
                response.CheckoutRequestID,

            merchantRequestId:
                response.MerchantRequestID,

            raw:
                response

        };

    }

    /**
     * --------------------------------------------------------
     * Callback
     * --------------------------------------------------------
     */

    async processCallback(callback) {

        const result =
            mpesaService.parseCallback(callback);

        return {

            paymentId:
                result.paymentId,

            provider: {

                name: "MPESA"

            },

            providerData: {

                providerReference:
                    result.checkoutRequestId,

                checkoutRequestId:
                    result.checkoutRequestId,

                merchantRequestId:
                    result.merchantRequestId,

                receiptNumber:
                    result.receiptNumber,

                transactionDate:
                    result.transactionDate

            },

            metadata:
                result.raw

        };

    }

    /**
     * --------------------------------------------------------
     * Query
     * --------------------------------------------------------
     */

    async query(payload) {

        const result =
            await mpesaService.querySTKStatus(

                payload.checkoutRequestId

            );

        return {

            status:
                result.ResultCode,

            description:
                result.ResultDesc,

            raw:
                result

        };

    }

}

export default new MpesaProvider();