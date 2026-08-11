/**
 * ============================================================================
 * PAYMENT DOMAIN EVENTS v1.1
 * ============================================================================
 *
 * Every payment lifecycle action emits a standardized domain event.
 *
 * These events are consumed by:
 *
 *  • Audit Engine
 *  • Notification Engine  
 *  • Finance Engine
 *  • Reporting Engine
 *  • Reconciliation Jobs
 *  • WebSocket Gateway
 *
 * The contract must remain stable. Only add fields, never remove.
 *
 * ============================================================================
 */

import { randomUUID } from "crypto";
import { PAYMENT_EVENTS } from "./payment.constants.js";

class PaymentEventFactory {

    /**
     * Create a standardized payment event.
     * @param {string} type - PAYMENT_EVENTS.COMPLETED etc
     * @param {object} context - { payment, provider, participant, obligation, actor, metadata }
     * @param {object} payload - raw provider payload for audit
     */
    static create(type, context = {}, payload = {}) {

        const payment = context.payment || {};
        const meta = context.metadata || {};

        return {

            id: randomUUID(),

            type,

            version: "1.1", // bumped for productType

            occurredAt: new Date(),

            correlationId: context.correlationId || payment.correlationId || null,

            source: "PaymentService", // who emitted this

            // Core payment fields
            payment: {
                id: payment.id || payment._id || null,
                reference: payment.reference || payment.idempotencyKey || null,
                amount: payment.amount || null,
                currency: payment.currency || "KES",
                status: payment.status || null,
                productType: payment.productType || meta.productType || null, // CRITICAL for finance routing
                paymentMethod: payment.paymentMethod || meta.paymentMethod || null
            },

            // Who paid and where
            context: {
                chamaId: payment.chamaId || meta.chamaId || null,
                workspaceId: payment.workspaceId || meta.workspaceId || null,
                contributionGroupId: meta.contributionGroupId || null
            },

            provider: {
                name: typeof context.provider === "string" 
                    ? context.provider 
                    : (context.provider?.name || context.provider?.providerName || payment.provider || null),
                metadata: context.providerData || context.provider?.metadata || payment.providerData || null
            },

            participant: {
                memberId: context.participant?.memberId || context.participant?.id || payment.metadata?.memberId || null,
                phoneNumber: context.participant?.phoneNumber || payment.phoneNumber || null
            },

            obligation: {
                id: context.obligation?.id || context.obligation?._id || meta.obligationId || null,
                type: meta.obligationType || null // 'CONTRIBUTION_OBLIGATION' | 'LOAN_INSTALLMENT' etc
            },

            actor: {
                userId: context.actor?.userId || context.actor?.id || payment.payerId || null,
                role: context.actor?.role || null
            },

            // Pass-through for rules. Finance engine reads this
            metadata: {
                ...meta,
                productType: payment.productType || meta.productType || null,
                providerData: context.providerData || null
            },

            // Raw payload from provider for reconciliation
            payload

        };
    }

}

export default PaymentEventFactory;