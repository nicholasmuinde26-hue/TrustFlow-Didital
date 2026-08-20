/**
 * ============================================================================
 * POSTING CONTEXT
 * ============================================================================
 *
 * Immutable input object for the Accounting Engine.
 *
 * Every financial operation
 * (Contribution, Loan, Payout, Refund, Wallet, Escrow)
 * is converted into a PostingContext before entering
 * the accounting pipeline.
 *
 * ============================================================================
 */

import { randomUUID } from "crypto";
import { toDecimal } from "../../shared/decimal.js"; // Use your decimal helper

export default class PostingContext {

    constructor({
        transactionType,
        amount,
        currency = "KES",
        chama,
        member = null,
        payment = null,
        payout = null,
        obligation = null,
        provider = null,
        providerReference = null,
        externalReference = null,
        reference = null,
        narration = null,
        metadata = {},
        actor = null,
        initiatedAt = new Date(),
        correlationId = randomUUID()
    }) {

        // 1. VALIDATION: Fail fast if critical fields missing
        if (!transactionType) throw new Error("PostingContext: transactionType is required");
        if (amount === undefined || amount === null) throw new Error("PostingContext: amount is required");
        if (!chama) throw new Error("PostingContext: chama is required");

        this.transactionType = String(transactionType).toUpperCase(); // CONTRIBUTION, PAYOUT, LOAN_DISBURSEMENT
        this.amount = toDecimal(amount); // 2. CRITICAL: Always store as Decimal to avoid float errors
        this.currency = String(currency).toUpperCase();
        this.chama = chama; // { _id, name }
        this.member = member; // { _id, user_id }
        this.payment = payment; // { _id, reference }
        this.payout = payout;
        this.obligation = obligation;
        this.provider = provider; // 'mpesa', 'bank', 'cash'
        this.providerReference = providerReference; // CheckoutRequestID
        this.externalReference = externalReference; // MpesaReceiptNumber
        this.reference = reference; // Internal ref: CONTRIB-123
        this.narration = narration || `${this.transactionType} for ${chama.name}`;
        this.metadata = Object.freeze({ ...metadata }); // freeze nested too
        this.actor = actor; // { _id, name } who initiated
        this.initiatedAt = initiatedAt instanceof Date ? initiatedAt : new Date(initiatedAt);
        this.correlationId = correlationId;

        Object.freeze(this); // Shallow freeze. Prevents mutation
    }

    /**
     * Helper: Get amount as Number for display only. Never for math
     */
    get amountNumber() {
        return Number(this.amount.toString());
    }

    /**
     * Helper: Get amount as string for DB
     */
    get amountString() {
        return this.amount.toString();
    }

    /**
     * ------------------------------------------------------------
     * Serialize for logs / DB
     * ------------------------------------------------------------
     */
    toJSON() {
        return {
            transactionType: this.transactionType,
            amount: this.amountString, // send as string
            currency: this.currency,
            chama: this.chama?._id || this.chama,
            member: this.member?._id || this.member,
            payment: this.payment?._id || this.payment,
            payout: this.payout?._id || this.payout,
            obligation: this.obligation?._id || this.obligation,
            provider: this.provider,
            providerReference: this.providerReference,
            externalReference: this.externalReference,
            reference: this.reference,
            narration: this.narration,
            metadata: this.metadata,
            actor: this.actor?._id || this.actor,
            initiatedAt: this.initiatedAt,
            correlationId: this.correlationId
        };
    }
}