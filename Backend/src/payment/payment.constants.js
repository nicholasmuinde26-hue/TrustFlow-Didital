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
    AIRTEL: "airtel",
    BANK: "bank",
    WALLET: "wallet",
    STRIPE: "stripe",
    FLUTTERWAVE: "flutterwave",
    MANUAL: "manual"
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