export const PAYMENT_STATUS = Object.freeze({
    PENDING: "pending",
    PROCESSING: "processing",
    COMPLETED: "completed",
    FAILED: "failed",
    CANCELLED: "cancelled",
    REFUNDED: "refunded"
});

export const PAYMENT_PROVIDER = Object.freeze({
    MPESA: "mpesa",
    // Unprompted Paybill payments (C2B). Money has already landed by the
    // time this provider is invoked - see mpesaC2b.provider.js - so it
    // settles the PaymentIntent/Payment immediately, same idea as CASH.
    MPESA_C2B: "mpesa_c2b",
    AIRTEL: "airtel",
    BANK: "bank",
    WALLET: "wallet",
    STRIPE: "stripe",
    FLUTTERWAVE: "flutterwave",
    CASH: "cash"
});

export const PAYMENT_TYPE = Object.freeze({
    CONTRIBUTION: "contribution",
    LOAN: "loan",
    PENALTY: "penalty",
    REGISTRATION: "registration",
    WALLET_TOPUP: "wallet_topup"
});

export const PAYMENT_EVENTS = Object.freeze({
    CREATED: "payment.created",
    INITIATED: "payment.initiated",
    COMPLETED: "payment.completed",
    FAILED: "payment.failed",
    CANCELLED: "payment.cancelled",
    REFUNDED: "payment.refunded"
});

export const CURRENCY = Object.freeze({
    KES: "KES"
});