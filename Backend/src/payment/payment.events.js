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

import { PAYMENT_EVENTS }
from "./payment.constants.js";

class PaymentEventFactory {

    /**
     * Create a standardized payment event.
     */
    static create(type, context, payload = {}) {

        return {

            id: randomUUID(),

            type,

            version: "1.0",

            occurredAt: new Date(),

            correlationId:
                context.correlationId,

            payment: {

                id:
                    context.payment.id,

                amount:
                    context.payment.amount,

                currency:
                    context.payment.currency,

                status:
                    context.payment.status

            },

            provider: {

                name:
                    context.provider.name,

                metadata:
                    context.provider.metadata

            },

            participant: {

                memberId:
                    context.participant.memberId,

                phoneNumber:
                    context.participant.phoneNumber

            },

            obligation: {

                id:
                    context.obligation.id

            },

            actor: {

                userId:
                    context.actor.userId

            },

            metadata:
                context.metadata,

            payload

        };

    }

}

export default PaymentEventFactory;