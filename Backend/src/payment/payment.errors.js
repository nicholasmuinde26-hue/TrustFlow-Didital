export class PaymentError extends Error {
    constructor(message, code = "PAYMENT_ERROR") {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
    }
}

export class ProviderNotFoundError extends PaymentError {
    constructor(provider) {
        super(
            `Payment provider "${provider}" not found.`,
            "PROVIDER_NOT_FOUND"
        );
    }
}

export class PaymentValidationError extends PaymentError {
    constructor(message) {
        super(message, "VALIDATION_ERROR");
    }
}

export class DuplicatePaymentError extends PaymentError {
    constructor(reference) {
        super(
            `Duplicate payment detected (${reference}).`,
            "DUPLICATE_PAYMENT"
        );
    }
}

export class PaymentAlreadyCompletedError extends PaymentError {
    constructor() {
        super(
            "Payment has already been completed.",
            "PAYMENT_ALREADY_COMPLETED"
        );
    }
}

export class ProviderCallbackError extends PaymentError {
    constructor(message) {
        super(message, "PROVIDER_CALLBACK_ERROR");
    }
}