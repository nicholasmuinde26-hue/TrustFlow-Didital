/**
 * ============================================================================
 * PAYMENT CONTEXT
 * ============================================================================
 *
 * Immutable canonical object for the Payment Engine.
 * This is what we pass through: Controller -> Service -> Provider -> Store -> Finance
 * ============================================================================
 */

import crypto from "node:crypto";
import { toDecimal } from "../shared/decimal.js";

export default class PaymentContext {

    constructor({
        amount,
        currency = "KES",
        type = "contribution",
        
        // OWNER / OBLIGATION - these were missing
        chamaId,
        obligationId,
        planId = null,
        
        // PARTICIPANT
        participantId,
        participantType = "ChamaMembership",
        phoneNumber,
        
        // ACTOR / PROVIDER
        actorId,
        provider = "mpesa",
        
        // IDS for updates
        paymentId = null,
        paymentIntentId = null,
        
        // OTHER
        status = "pending",
        reference = null,
        displayReference = null,
        correlationId = crypto.randomUUID(),
        metadata = {},
        session = null
    }) {

        // VALIDATION - fail fast
        if (!amount) throw new Error("PaymentContext: amount is required");
        if (!chamaId) throw new Error("PaymentContext: chamaId is required");
        if (!obligationId) throw new Error("PaymentContext: obligationId is required");
        if (!participantId) throw new Error("PaymentContext: participantId is required");
        if (!actorId) throw new Error("PaymentContext: actorId is required");

        // CORE PAYMENT DATA
        this.paymentId = paymentId; // ContributionPayment._id after creation
        this.paymentIntentId = paymentIntentId; // PaymentIntent._id
        this.amount = toDecimal(amount); // Always Decimal to avoid float errors
        this.currency = String(currency).toUpperCase();
        this.type = String(type).toLowerCase();
        this.status = String(status).toLowerCase();
        this.reference = reference || `PAY-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        this.displayReference = displayReference || this.reference;
        this.correlationId = correlationId;

        // OWNER / OBLIGATION - Flat fields so Mapper can access easily
        this.chamaId = chamaId;
        this.obligationId = obligationId;
        this.planId = planId;

        // PARTICIPANT
        this.participantId = participantId;
        this.participantType = participantType;
        this.phoneNumber = phoneNumber;

        // ACTOR / PROVIDER
        this.actorId = actorId;
        this.provider = provider;

        // TECHNICAL
        this.metadata = Object.freeze({ ...metadata });
        this.session = session;
        this.createdAt = new Date();

        Object.freeze(this); // Prevent mutation
    }

    /**
     * Get amount as string for DB
     */
    get amountString() {
        return this.amount.toString();
    }

    /**
     * Get amount as number for display
     */
    get amountNumber() {
        return Number(this.amount.toString());
    }

    setPayment(payment) {
        return new PaymentContext({
            ...this,
            paymentId: payment._id || payment.id || this.paymentId,
            paymentIntentId: payment.payment_intent_id || this.paymentIntentId,
            status: payment.status || this.status
        });
    }

    setProviderMetadata(metadata) {
        return new PaymentContext({
            ...this,
            metadata: { ...this.metadata, ...metadata }
        });
    }

    setSession(session) {
        return new PaymentContext({ ...this, session });
    }

    toJSON() {
        return {
            paymentId: this.paymentId,
            paymentIntentId: this.paymentIntentId,
            amount: this.amountString,
            currency: this.currency,
            type: this.type,
            status: this.status,
            reference: this.reference,
            displayReference: this.displayReference,
            correlationId: this.correlationId,
            chamaId: this.chamaId,
            obligationId: this.obligationId,
            planId: this.planId,
            participantId: this.participantId,
            participantType: this.participantType,
            phoneNumber: this.phoneNumber,
            actorId: this.actorId,
            provider: this.provider,
            metadata: this.metadata,
            createdAt: this.createdAt
        };
    }
}