/**
 * ============================================================================
 * PAYMENT VALIDATORS
 * ============================================================================
 */

import { PaymentValidationError } from "./payment.errors.js";

/**
 * Validate payment initiation payload & context.
 */
export function validateInitiatePayment(context) {
    if (!context) {
        throw new PaymentValidationError("Payment context is missing.");
    }

    if (!context.payment?.amount || Number(context.payment.amount) <= 0) {
        throw new PaymentValidationError("Payment amount must be greater than zero.");
    }

    if (!context.provider?.name) {
        throw new PaymentValidationError("Payment provider is required.");
    }

    // FIX: Only require phone number for MPESA
    if (context.provider.name.toLowerCase() === 'mpesa') {
        if (!context.participant?.phoneNumber) {
            throw new PaymentValidationError("Phone number is required for M-Pesa payments.");
        }
    }

    return true;
}

// Backwards-compatibility alias matching original function name
export const validateInitiateRequest = validateInitiatePayment;

/**
 * Validate incoming webhooks or provider callbacks.
 */
export function validateCallback(callbackPayload) {
    if (!callbackPayload) {
        throw new PaymentValidationError("Callback payload is missing.");
    }

    if (!callbackPayload.provider) {
        throw new PaymentValidationError("Callback provider identifier is required.");
    }

    return true;
}

/**
 * Validate transaction query parameters.
 */
export function validateQuery(payload) {
    if (!payload) {
        throw new PaymentValidationError("Query payload is missing.");
    }

    if (!payload.provider) {
        throw new PaymentValidationError("Query provider is required.");
    }

    return true;
}

/**
 * Validate payment completion structures.
 */
export function validateCompletion(context) {
    if (!context) {
        throw new PaymentValidationError("Completion context is missing.");
    }

    if (!context.payment?.id && !context.payment?._id) {
        throw new PaymentValidationError("Payment ID is required.");
    }

    return true;
}