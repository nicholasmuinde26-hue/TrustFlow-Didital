/**
 * ============================================================================
 * PAYMENT STORE
 * ============================================================================
 * Only DB access. No business logic.
 */

import crypto from "node:crypto";
import mongoose from "mongoose";
import ContributionPayment from "../../models/ContributionPayment.js";
import PaymentIntent from "../../models/PaymentIntent.js";
import PaymentMapper from "./payment.mapper.js";
import paymentStateMachine from "../payment.state-machine.js";
import { PAYMENT_STATUS } from "../payment.constants.js";
import { DuplicatePaymentError, PaymentNotFoundError, PaymentAlreadyCompletedError } from "../payment.errors.js";
import { toDecimal } from "../../shared/decimal.js";

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === "ReplicaSetWithPrimary" || topology?.description?.type === "Sharded";
};

const getOpts = (session) => canUseTransactions() && session? { session } : {};

// HELPER: convert to Mongoose Decimal128
const toMongooseDecimal = (val) => {
    const dec = toDecimal(val);
    return mongoose.Types.Decimal128.fromString(dec.toString());
};

class PaymentStore {

    async createBoth(context, session = null) {
        const opts = getOpts(session);
        const providerName = context.provider.name;
        const idemKey = context.idempotencyKey || context.idempotency_key || crypto.randomUUID();

        const intentDoc = {
            owner_type: "Chama",
            owner_id: context.chamaId,
            type: context.type,
            amount: toMongooseDecimal(context.amount),
            currency: context.currency,
            provider: providerName,
            payment_method: providerName,
            status: PAYMENT_STATUS.PENDING,
            reference: context.reference,
            display_reference: context.displayReference,
            idempotency_key: idemKey,
            participant_id: context.participantId,
            participant_type: context.participantType,
            obligation_id: context.obligationId,
            plan_id: context.planId,
            created_by: context.actorId,
            metadata: context.metadata || {}
        };
        const [intent] = await PaymentIntent.create([intentDoc], opts);

        const paymentDoc = {
            owner_type: "Chama",
            owner_id: context.chamaId,
            type: context.type,
            amount: toMongooseDecimal(context.amount),
            currency: context.currency,
            status: PAYMENT_STATUS.PENDING,
            reference: context.reference,
            external_reference: context.reference, // FIX: set to reference, never null
            payment_intent_id: intent._id,
            participant_id: context.participantId,
            participant_type: context.participantType,
            obligation_id: context.obligationId,
            plan_id: context.planId,
            payment_method: providerName,
            channel_type: providerName === 'mpesa'? 'mpesa' : 'card',
            payment_instrument: { phone_number: context.phoneNumber },
            created_by: context.actorId,
            idempotency_key: idemKey,
            metadata: context.metadata || {}
        };
        const [payment] = await ContributionPayment.create([paymentDoc], opts);

        return { intent, payment };
    }

    async findById(id, session = null) { const opts = getOpts(session); return ContributionPayment.findById(id, null, opts); }
    async findByReference(reference, session = null) { const opts = getOpts(session); return ContributionPayment.findOne({ reference }, null, opts); }
    async findByPaymentIntentId(paymentIntentId, session = null) { const opts = getOpts(session); return ContributionPayment.findOne({ payment_intent_id: paymentIntentId }, null, opts); }
    async findByCheckoutRequestId(checkoutRequestId, session = null) { const opts = getOpts(session); return ContributionPayment.findOne({ provider_payment_id: checkoutRequestId }, null, opts); }
    async findByExternalReference(externalReference, session = null) { const opts = getOpts(session); return ContributionPayment.findOne({ external_reference: externalReference }, null, opts); }

    async attachProviderMetadata(paymentId, providerResponse, session = null) {
        const opts = getOpts(session);
        const payment = await this.findById(paymentId, session);
        if (!payment) throw new PaymentNotFoundError();
        payment.provider_payment_id = providerResponse.checkoutRequestId || payment.provider_payment_id;
        payment.external_reference = providerResponse.mpesaReceiptNumber || payment.external_reference;
        payment.payment_instrument = {...payment.payment_instrument, phone_number: providerResponse.phoneNumber || payment.payment_instrument?.phone_number };
        await payment.save(opts);
        return payment;
    }

    async markProcessing(paymentId, session = null) {
        const opts = getOpts(session);
        const payment = await this.findById(paymentId, session);
        if (!payment) throw new PaymentNotFoundError();
        paymentStateMachine.transition(payment, PAYMENT_STATUS.PROCESSING);
        await payment.save(opts);
        return payment;
    }

    async markCompletedByIntentId(paymentIntentId, providerData, session = null) {
        const opts = getOpts(session);
        const payment = await this.findByPaymentIntentId(paymentIntentId, session);
        if (!payment) throw new PaymentNotFoundError(`No ContributionPayment found for intent ${paymentIntentId}`);
        if (payment.status === PAYMENT_STATUS.COMPLETED) throw new PaymentAlreadyCompletedError();

        paymentStateMachine.transition(payment, PAYMENT_STATUS.COMPLETED);
        payment.provider_payment_id = providerData.checkoutRequestId;

        // FIX: Only update external_reference if MPesa gave us a real receipt number
        if (providerData.mpesaReceiptNumber) {
            payment.external_reference = providerData.mpesaReceiptNumber;
        }

        payment.completed_at = new Date();
        payment.status = PAYMENT_STATUS.COMPLETED;
        await payment.save(opts);
        return payment;
    }

    async markCompleted(paymentId, providerData, session = null) {
        const opts = getOpts(session);
        const payment = await this.findById(paymentId, session);
        if (!payment) throw new PaymentNotFoundError();
        if (payment.status === PAYMENT_STATUS.COMPLETED) throw new PaymentAlreadyCompletedError();

        paymentStateMachine.transition(payment, PAYMENT_STATUS.COMPLETED);
        payment.provider_payment_id = providerData.checkoutRequestId;

        // FIX: Only update if we have receipt
        if (providerData.mpesaReceiptNumber) {
            payment.external_reference = providerData.mpesaReceiptNumber;
        }

        payment.completed_at = new Date();
        payment.status = PAYMENT_STATUS.COMPLETED;
        await payment.save(opts);
        return payment;
    }

    async markFailedByIntentId(paymentIntentId, reason, session = null) {
        const opts = getOpts(session);
        const payment = await this.findByPaymentIntentId(paymentIntentId, session);
        if (!payment) throw new PaymentNotFoundError();
        paymentStateMachine.transition(payment, PAYMENT_STATUS.FAILED);
        payment.failure_message = reason;
        payment.failed_at = new Date();
        payment.status = PAYMENT_STATUS.FAILED;
        await payment.save(opts);
        return payment;
    }

    async markCancelledByIntentId(paymentIntentId, reason, session = null) {
        const opts = getOpts(session);
        const payment = await this.findByPaymentIntentId(paymentIntentId, session);
        if (!payment) throw new PaymentNotFoundError();
        paymentStateMachine.transition(payment, PAYMENT_STATUS.CANCELLED);
        payment.notes = reason;
        payment.status = PAYMENT_STATUS.CANCELLED;
        await payment.save(opts);
        return payment;
    }

    async markFailed(paymentId, reason, session = null) {
        const opts = getOpts(session);
        const payment = await this.findById(paymentId, session);
        if (!payment) throw new PaymentNotFoundError();
        paymentStateMachine.transition(payment, PAYMENT_STATUS.FAILED);
        payment.failure_message = reason;
        payment.failed_at = new Date();
        payment.status = PAYMENT_STATUS.FAILED;
        await payment.save(opts);
        return payment;
    }

    async markCancelled(paymentId, reason, session = null) {
        const opts = getOpts(session);
        const payment = await this.findById(paymentId, session);
        if (!payment) throw new PaymentNotFoundError();
        paymentStateMachine.transition(payment, PAYMENT_STATUS.CANCELLED);
        payment.notes = reason;
        payment.status = PAYMENT_STATUS.CANCELLED;
        await payment.save(opts);
        return payment;
    }

    async exists(paymentId, session = null) { const opts = getOpts(session); return ContributionPayment.exists({ _id: paymentId }, opts); }
    async existsByExternalReference(reference, session = null) { const opts = getOpts(session); return ContributionPayment.exists({ external_reference: reference }, opts); }
    async isCompleted(paymentId, session = null) { const payment = await this.findById(paymentId, session); if (!payment) return false; return payment.status === PAYMENT_STATUS.COMPLETED; }
}

export default new PaymentStore();