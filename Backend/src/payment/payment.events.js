import { randomUUID } from "crypto";
import { PAYMENT_EVENTS } from "./payment.constants.js";
import { toDecimal } from "../shared/decimal.js";

class PaymentEventFactory {

    static create(type, context = {}, payload = {}) {
        const payment = context.payment || {};
        const meta = context.metadata || {};

        // Always normalize amount to Decimal string for event bus
        const amount = payment.amount ?? context.amount;
        const normalizedAmount = amount ? toDecimal(amount).toFixed(2) : null;

        return {
            id: randomUUID(),
            type,
            version: "1.1",
            occurredAt: new Date(),
            correlationId: context.correlationId || payment.correlationId || payment.idempotencyKey || null,
            source: "PaymentService",

            payment: {
                id: payment.id || payment._id || null,
                reference: payment.reference || payment.idempotencyKey || null,
                amount: normalizedAmount,
                currency: payment.currency || context.currency || "KES",
                status: payment.status || context.status || null,
                productType: payment.productType || meta.productType || context.type || null,
                paymentMethod: payment.paymentMethod || payment.method || meta.paymentMethod || context.paymentMethod || null
            },

            context: {
                chamaId: payment.chamaId || meta.chamaId || context.ownerId || null,
                workspaceId: payment.workspaceId || meta.workspaceId || null,
                contributionGroupId: meta.contributionGroupId || null
            },

            provider: {
                name: typeof context.provider === "string" 
                    ? context.provider 
                    : (context.provider?.name || context.provider?.providerName || payment.provider || context.paymentMethod || null),
                metadata: context.providerData || context.provider?.metadata || payment.providerData || null
            },

            participant: {
                memberId: context.participant?.memberId || context.participant?.id || payment.metadata?.memberId || null,
                phoneNumber: context.participant?.phoneNumber || payment.phoneNumber || null
            },

            obligation: {
                id: context.obligation?.id || context.obligation?._id || meta.obligationId || null,
                type: meta.obligationType || null
            },

            actor: {
                userId: context.actor?.userId || context.actor?.id || payment.payerId || context.userId || null,
                role: context.actor?.role || null
            },

            metadata: {
                ...meta,
                productType: payment.productType || meta.productType || context.type || null,
                providerData: context.providerData || null
            },

            payload
        };
    }
}

export default PaymentEventFactory;