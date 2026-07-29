/**
 * ============================================================================
 * PAYMENT CONTEXT
 * ============================================================================
 *
 * Builds the canonical payment context shared across the Payment Engine.
 *
 * The context is enriched as the payment flows through:
 * Controller → Payment Service → Provider → Store →
 * ContributionPayment Service → Finance Engine.
 *
 * ============================================================================
 */

export default class PaymentContext {

    constructor(payload = {}) {

        this.payment = {
            id: payload.paymentId ?? null,
            amount: payload.amount,
            currency: payload.currency ?? "KES",
            status: payload.status ?? "pending",
            type: payload.type ?? "contribution"
        };

        this.provider = {
            name: payload.provider,
            metadata: {}
        };

        this.participant = {
            memberId: payload.memberId,
            phoneNumber: payload.phoneNumber
        };

        this.obligation = {
            id: payload.obligationId
        };

        this.actor = {
            userId: payload.createdBy
        };

        this.metadata = payload.metadata ?? {};

        this.session = payload.session ?? null;

        this.timestamps = {
            createdAt: new Date()
        };
    }

    setPayment(payment) {
        this.payment = { ...this.payment, ...payment };
        return this;
    }

    setProviderMetadata(metadata) {
        this.provider.metadata = {
            ...this.provider.metadata,
            ...metadata
        };
        return this;
    }

    setSession(session) {
        this.session = session;
        return this;
    }

    toJSON() {
        return {
            payment: this.payment,
            provider: this.provider,
            participant: this.participant,
            obligation: this.obligation,
            actor: this.actor,
            metadata: this.metadata,
            timestamps: this.timestamps
        };
    }
}