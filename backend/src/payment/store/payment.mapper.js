/**
 * ============================================================================
 * PAYMENT MAPPER
 * ============================================================================
 *
 * Pure transformation. No DB, no logic, no providers.
 * Maps: PaymentContext <-> Mongo Docs <-> Provider <-> API
 * ============================================================================
 */

import { PAYMENT_STATUS } from "../payment.constants.js";

class PaymentMapper {

    /**
     * --------------------------------------------------------
     * Context -> ContributionPayment Document
     * --------------------------------------------------------
     */
    static toContributionPaymentDocument(context, paymentIntentId = null) {
        return {
            // LINKS
            obligation_id: context.obligationId,
            plan_id: context.planId,
            payment_intent_id: paymentIntentId, // NEW: link to intent
            
            // OWNER / PARTICIPANT
            owner_type: 'Chama', // or derive from context if you have groups
            owner_id: context.chamaId,
            participant_type: context.participantType,
            participant_id: context.participantId,

            // PAYMENT CORE
            payment_direction: 'inbound',
            amount: context.amount, // Decimal128
            currency: context.currency,
            payment_method: context.provider, // mpesa, cash, bank
            channel_type: context.provider === 'mpesa' ? 'mpesa' : 'other',
            processing_mode: 'automated',
            payment_provider: context.provider,
            
            // REFERENCES
            reference: context.reference,
            status: PAYMENT_STATUS.PENDING,

            // INSTRUMENT SNAPSHOT
            payment_instrument: {
                instrument_type: context.provider === 'mpesa' ? 'phone_number' : 'other',
                phone_number: context.phoneNumber || null,
                provider: context.provider
            },

            // AUDIT
            created_by: context.actorId,
            initiated_at: context.createdAt,
            paid_at: context.createdAt, // will be updated on complete
            metadata: context.metadata || {},
            notes: `Payment initiated via ${context.provider}`
        };
    }

    /**
     * --------------------------------------------------------
     * Context -> PaymentIntent Document
     * --------------------------------------------------------
     */
    static toPaymentIntentDocument(context) {
        return {
            owner_type: 'Chama',
            owner_id: context.chamaId,
            participant_id: context.participantId,
            obligation_id: context.obligationId,
            
            amount: context.amountString, // PaymentIntent uses string
            currency: context.currency,
            payment_method: context.provider,
            phone_number: context.phoneNumber,
            
            reference: context.reference,
            correlation_id: context.correlationId,
            status: PAYMENT_STATUS.PENDING,
            provider: context.provider,
            metadata: context.metadata || {}
        };
    }

    /**
     * --------------------------------------------------------
     * Provider Response -> Metadata for DB
     * --------------------------------------------------------
     */
    static toProviderMetadata(response = {}) {
        return {
            providerReference: response.checkoutRequestId,
            checkoutRequestId: response.checkoutRequestId,
            merchantRequestId: response.merchantRequestId,
            externalReference: response.mpesaReceiptNumber, // maps to external_reference
            receiptNumber: response.mpesaReceiptNumber,
            transactionDate: response.transactionDate,
            raw: response.raw || response
        };
    }

    /**
     * --------------------------------------------------------
     * Mongo Document -> Domain
     * --------------------------------------------------------
     */
    static toDomain(document) {
        if (!document) return null;

        return {
            id: document._id,
            paymentIntentId: document.payment_intent_id,
            obligationId: document.obligation_id,
            planId: document.plan_id,
            ownerId: document.owner_id,
            participantId: document.participant_id,
            amount: document.amount, // Decimal128
            currency: document.currency,
            provider: document.payment_provider,
            paymentMethod: document.payment_method,
            reference: document.reference,
            status: document.status,
            externalReference: document.external_reference,
            providerPaymentId: document.provider_payment_id,
            metadata: document.metadata,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
            completedAt: document.completed_at
        };
    }

    /**
     * --------------------------------------------------------
     * Domain -> API Result
     * --------------------------------------------------------
     */
    static toPaymentResult(payment) {
        return {
            success: payment.status === 'completed',
            paymentId: payment.id,
            paymentIntentId: payment.paymentIntentId,
            reference: payment.reference,
            status: payment.status,
            provider: payment.provider,
            amount: payment.amount?.toString(),
            currency: payment.currency,
            externalReference: payment.externalReference,
            metadata: payment.metadata,
            createdAt: payment.createdAt
        };
    }

    /**
     * --------------------------------------------------------
     * Domain -> Event Payload
     * --------------------------------------------------------
     */
    static toEvent(payment) {
        return {
            paymentId: payment.id,
            paymentIntentId: payment.paymentIntentId,
            provider: payment.provider,
            amount: payment.amount?.toString(),
            currency: payment.currency,
            status: payment.status,
            participantId: payment.participantId,
            obligationId: payment.obligationId,
            reference: payment.reference,
            occurredAt: new Date()
        };
    }
}

export default PaymentMapper;