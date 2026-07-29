/**
 * ============================================================================
 * PAYMENT MAPPER
 * ============================================================================
 *
 * Maps between:
 *
 *  • PaymentContext
 *  • Mongo Documents
 *  • Provider Responses
 *  • Domain Events
 *  • API Responses
 *
 * This class MUST NOT:
 *
 * ❌ Query MongoDB
 * ❌ Save documents
 * ❌ Contain business logic
 * ❌ Call providers
 *
 * It only transforms objects.
 *
 * ============================================================================
 */

import { PAYMENT_STATUS } from "../payment.constants.js";

class PaymentMapper {

    /**
     * --------------------------------------------------------
     * Context -> ContributionPayment Document
     * --------------------------------------------------------
     */
    static toContributionPaymentDocument(context) {

        return {

            obligation: context.obligation.id,

            member: context.participant.memberId,

            chama: context.chama.id,

            contributionGroup: context.group.id,

            amount: context.payment.amount,

            currency: context.payment.currency,

            provider: context.provider.name,

            paymentMethod: context.provider.method,

            reference: context.payment.reference,

            status: PAYMENT_STATUS.PENDING,

            metadata: context.metadata || {}

        };

    }

    /**
     * --------------------------------------------------------
     * Context -> PaymentIntent
     * --------------------------------------------------------
     */
    static toPaymentIntentDocument(context) {

        return {

            paymentReference: context.payment.reference,

            provider: context.provider.name,

            amount: context.payment.amount,

            currency: context.payment.currency,

            status: PAYMENT_STATUS.PENDING,

            metadata: context.metadata || {}

        };

    }

    /**
     * --------------------------------------------------------
     * Provider Response
     * --------------------------------------------------------
     */
    static toProviderMetadata(response = {}) {

        return {

            providerReference:
                response.providerReference,

            checkoutRequestId:
                response.checkoutRequestId,

            merchantRequestId:
                response.merchantRequestId,

            receiptNumber:
                response.receiptNumber,

            transactionDate:
                response.transactionDate,

            raw:
                response.raw || response

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

            id: document.id,

            obligationId:
                document.obligation,

            memberId:
                document.member,

            amount:
                document.amount,

            currency:
                document.currency,

            provider:
                document.provider,

            paymentMethod:
                document.paymentMethod,

            reference:
                document.reference,

            status:
                document.status,

            metadata:
                document.metadata,

            createdAt:
                document.createdAt,

            updatedAt:
                document.updatedAt

        };

    }

    /**
     * --------------------------------------------------------
     * Domain -> API Result
     * --------------------------------------------------------
     */
    static toPaymentResult(payment) {

        return {

            success: true,

            paymentId:
                payment.id,

            reference:
                payment.reference,

            status:
                payment.status,

            provider:
                payment.provider,

            amount:
                payment.amount,

            currency:
                payment.currency,

            metadata:
                payment.metadata,

            createdAt:
                payment.createdAt

        };

    }

    /**
     * --------------------------------------------------------
     * Domain -> Event Payload
     * --------------------------------------------------------
     */
    static toEvent(payment) {

        return {

            paymentId:
                payment.id,

            provider:
                payment.provider,

            amount:
                payment.amount,

            currency:
                payment.currency,

            status:
                payment.status,

            memberId:
                payment.memberId,

            obligationId:
                payment.obligationId,

            occurredAt:
                new Date()

        };

    }

}

export default PaymentMapper;