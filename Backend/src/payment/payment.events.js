/**
 * ============================================================================
 * PAYMENT DOMAIN EVENTS
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
 * The contract must remain stable.
 *
 * ============================================================================
 */

import { randomUUID } from "crypto";
import { PAYMENT_EVENTS } from "./payment.constants.js";

class PaymentEventFactory {

    /**
     * Create a standardized payment event.
     */
    static create(type, context = {}, payload = {}) {

        return {

            id: randomUUID(),

            type,

            version: "1.0",

            occurredAt: new Date(),

            correlationId: context.correlationId || null,

            payment: {
                id: context.payment?.id || context.payment?._id || null,
                amount: context.payment?.amount || null,
                currency: context.payment?.currency || null,
                status: context.payment?.status || null
            },

            provider: {
                name: typeof context.provider === "string" 
                    ? context.provider 
                    : (context.provider?.name || context.provider?.providerName || null),
                metadata: context.provider?.metadata || context.providerData || null
            },

            participant: {
                memberId: context.participant?.memberId || context.participant?.id || null,
                phoneNumber: context.participant?.phoneNumber || null
            },

            obligation: {
                id: context.obligation?.id || context.obligation?._id || null
            },

            actor: {
                userId: context.actor?.userId || context.actor?.id || null
            },

            metadata: context.metadata || {},

            payload

        };

    }

}

export default PaymentEventFactory;