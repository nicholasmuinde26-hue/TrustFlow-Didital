import { PaymentValidationError } from "./payment.errors.js";

export function validateInitiateRequest(context) {

    if (!context.payment.amount || context.payment.amount <= 0) {
        throw new PaymentValidationError(
            "Payment amount must be greater than zero."
        );
    }

    if (!context.provider.name) {
        throw new PaymentValidationError(
            "Payment provider is required."
        );
    }

    if (!context.participant.phoneNumber) {
        throw new PaymentValidationError(
            "Phone number is required."
        );
    }

    return true;
}

export function validateCompletion(context) {

    if (!context.payment.id) {
        throw new PaymentValidationError(
            "Payment ID is required."
        );
    }

    return true;
}