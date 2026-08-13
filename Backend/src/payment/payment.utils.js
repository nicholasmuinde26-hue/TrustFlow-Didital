/**
 * ============================================================================
 * PAYMENT VALIDATORS
 * ============================================================================
 */

import { PaymentValidationError } from "./payment.errors.js";
import { 
  validatePaymentAmount, 
  validatePaymentMethodProvider,
  normalizeKenyanPhoneNumber 
} from "./payment.utils.js"; // USE THIS

export function validateInitiatePayment(context) {
    if (!context) {
        throw new PaymentValidationError("Payment context is missing.");
    }

    const rawAmount = context.payment?.amount ?? context.amount;
    if (rawAmount === undefined || rawAmount === null) {
        throw new PaymentValidationError("Payment amount is required.");
    }

    // FIX: use the util that already handles Decimal128
    const amount = validatePaymentAmount(rawAmount); 

    const { payment_method, provider } = validatePaymentMethodProvider({
        payment_method: context.payment?.method ?? context.paymentMethod,
        provider: context.provider?.name
    });

    // FIX: normalize phone for mpesa
    if (payment_method === 'mpesa') {
        const phone = context.participant?.phoneNumber;
        if (!phone) throw new PaymentValidationError("Phone number is required for M-Pesa payments.");
        context.participant.phoneNumber = normalizeKenyanPhoneNumber(phone);
    }

    // Mutate context so downstream gets clean data
    if (context.payment) {
        context.payment.amount = amount;
        context.payment.method = payment_method;
    } else {
        context.amount = amount;
        context.paymentMethod = payment_method;
    }
    context.provider.name = provider;

    return true;
}

export const validateInitiateRequest = validateInitiatePayment;
export function validateCallback(callbackPayload) { /* ... */ }
export function validateQuery(payload) { /* ... */ }
export function validateCompletion(context) { /* ... */ }