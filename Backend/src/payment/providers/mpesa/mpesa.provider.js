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

import ProviderInterface from "../provider.interface.js";
import mpesaService from "./mpesa.service.js";

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
     * context = {
     *   participant: { phoneNumber },
     *   payment: { amount, reference, displayReference, description }
     * }
     */
    async initiate(context) {
        const response = await mpesaService.initiateStkPush({
            phoneNumber: context.participant.phoneNumber,
            amount: context.payment.amount,
            accountReference: context.payment.reference, // unique for DB
            displayReference: context.payment.displayReference || context.payment.reference, // what shows on M-Pesa
            transactionDescription: context.payment.description
        });

        return {
            success: response.success,
            providerReference: response.checkoutRequestId,
            checkoutRequestId: response.checkoutRequestId,
            merchantRequestId: response.merchantRequestId,
            customerMessage: response.customerMessage,
            mocked: response.mocked,
            raw: response.rawResponse
        };
    }

    /**
     * --------------------------------------------------------
     * Callback
     * --------------------------------------------------------
     */
    async processCallback(callback) {
        const result = mpesaService.parseStkCallback(callback);

        return {
            checkoutRequestId: result.checkoutRequestId,
            merchantRequestId: result.merchantRequestId,
            success: result.success,
            resultCode: result.resultCode,
            resultDescription: result.resultDescription,
            amount: result.amount,
            receiptNumber: result.mpesaReceiptNumber,
            transactionDate: result.transactionDate,
            phoneNumber: result.phoneNumber,
            providerData: {
                provider: "MPESA",
                providerReference: result.checkoutRequestId,
                checkoutRequestId: result.checkoutRequestId,
                merchantRequestId: result.merchantRequestId,
                receiptNumber: result.mpesaReceiptNumber,
                transactionDate: result.transactionDate
            },
            metadata: result.rawCallback
        };
    }

    /**
     * --------------------------------------------------------
     * Query
     * --------------------------------------------------------
     */
    async query(payload) {
        const result = await mpesaService.queryStkPush({
            checkoutRequestId: payload.checkoutRequestId
        });

        const mapped = mpesaService.mapResultCode(result.resultCode);

        return {
            status: mapped.paymentStatus, // 'completed' | 'failed' | 'pending' | 'cancelled'
            resultCode: result.resultCode,
            description: result.resultDescription,
            retryable: mapped.retryable,
            reason: mapped.reason,
            raw: result.rawResponse
        };
    }

}

export default new MpesaProvider();