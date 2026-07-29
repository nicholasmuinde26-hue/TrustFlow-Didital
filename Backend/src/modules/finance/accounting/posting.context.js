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
 * Responsibilities
 * ----------------
 * ✓ Normalize accounting inputs
 * ✓ Encapsulate posting metadata
 * ✓ Provide immutable context
 * ✓ Prevent accidental mutation
 *
 * ============================================================================
 */

import { randomUUID } from "crypto";

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

        this.transactionType = transactionType;

        this.amount = amount;

        this.currency = currency;

        this.chama = chama;

        this.member = member;

        this.payment = payment;

        this.payout = payout;

        this.obligation = obligation;

        this.provider = provider;

        this.providerReference = providerReference;

        this.externalReference = externalReference;

        this.reference = reference;

        this.narration = narration;

        this.metadata = metadata;

        this.actor = actor;

        this.initiatedAt = initiatedAt;

        this.correlationId = correlationId;

        Object.freeze(this);
    }

    /**
     * ------------------------------------------------------------
     * Serialize
     * ------------------------------------------------------------
     */

    toJSON() {

        return {

            transactionType: this.transactionType,

            amount: this.amount,

            currency: this.currency,

            chama: this.chama,

            member: this.member,

            payment: this.payment,

            payout: this.payout,

            obligation: this.obligation,

            provider: this.provider,

            providerReference: this.providerReference,

            externalReference: this.externalReference,

            reference: this.reference,

            narration: this.narration,

            metadata: this.metadata,

            actor: this.actor,

            initiatedAt: this.initiatedAt,

            correlationId: this.correlationId

        };

    }

}