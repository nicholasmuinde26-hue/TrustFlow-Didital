/**
 * ============================================================================
 * PAYMENT STORE
 * ============================================================================
 */

import mongoose from "mongoose"; // ADD
import ContributionPayment from "../../models/ContributionPayment.js";
import PaymentIntent from "../../models/PaymentIntent.js";
import PaymentMapper from "./payment.mapper.js";
import paymentStateMachine from "../payment.state-machine.js";
import { PAYMENT_STATUS } from "../payment.constants.js";
import { DuplicatePaymentError, PaymentNotFoundError, PaymentAlreadyCompletedError } from "../payment.errors.js";

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === "ReplicaSetWithPrimary" || topology?.description?.type === "Sharded";
};

const getOpts = (session) => {
  return canUseTransactions() && session? { session } : {}; // <-- KEY FIX
};

class PaymentStore {

    async createPending(context, session = null) {
        const opts = getOpts(session);

        const paymentDocument = PaymentMapper.toContributionPaymentDocument(context);
        const intentDocument = PaymentMapper.toPaymentIntentDocument(context);

        const payment = await ContributionPayment.create([paymentDocument], opts);

        intentDocument.payment = payment[0]._id;
        const intent = await PaymentIntent.create([intentDocument], opts);

        payment[0].paymentIntent = intent[0]._id;
        await payment[0].save(opts); // <-- use opts

        return payment[0];
    }

    async findById(id, session = null) { // ADD session param
        const opts = getOpts(session);
        return ContributionPayment.findById(id, null, opts);
    }

    async findByReference(reference, session = null) {
        const opts = getOpts(session);
        return ContributionPayment.findOne({ reference }, null, opts);
    }

    async findByCheckoutRequestId(checkoutRequestId, session = null) {
        const opts = getOpts(session);
        return ContributionPayment.findOne({ "provider.checkoutRequestId": checkoutRequestId }, null, opts);
    }

    async findByMerchantRequestId(merchantRequestId, session = null) {
        const opts = getOpts(session);
        return ContributionPayment.findOne({ "provider.merchantRequestId": merchantRequestId }, null, opts);
    }

    async findByProviderReference(providerReference, session = null) {
        const opts = getOpts(session);
        return ContributionPayment.findOne({ "provider.providerReference": providerReference }, null, opts);
    }

    async attachProviderMetadata(paymentId, providerResponse, session = null) {
        const opts = getOpts(session);
        const payment = await this.findById(paymentId, session);
        if (!payment) throw new PaymentNotFoundError();

        payment.provider = {...payment.provider,...PaymentMapper.toProviderMetadata(providerResponse) };
        await payment.save(opts); // <-- use opts
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

    async markCompleted(paymentId, providerData, session = null) {
        const opts = getOpts(session);
        const payment = await this.findById(paymentId, session);
        if (!payment) throw new PaymentNotFoundError();
        if (payment.status === PAYMENT_STATUS.COMPLETED) throw new PaymentAlreadyCompletedError();

        paymentStateMachine.transition(payment, PAYMENT_STATUS.COMPLETED);
        payment.provider = {...payment.provider,...PaymentMapper.toProviderMetadata(providerData) };
        payment.completedAt = new Date();
        await payment.save(opts); // <-- use opts
        return payment;
    }

    async markFailed(paymentId, reason, session = null) {
        const opts = getOpts(session);
        const payment = await this.findById(paymentId, session);
        if (!payment) throw new PaymentNotFoundError();

        paymentStateMachine.transition(payment, PAYMENT_STATUS.FAILED);
        payment.failureReason = reason;
        await payment.save(opts);
        return payment;
    }

    async markCancelled(paymentId, reason, session = null) {
        const opts = getOpts(session);
        const payment = await this.findById(paymentId, session);
        if (!payment) throw new PaymentNotFoundError();

        paymentStateMachine.transition(payment, PAYMENT_STATUS.CANCELLED);
        payment.cancelReason = reason;
        await payment.save(opts);
        return payment;
    }

    async exists(paymentId, session = null) {
        const opts = getOpts(session);
        return ContributionPayment.exists({ _id: paymentId }, opts);
    }

    async existsByProviderReference(reference, session = null) {
        const opts = getOpts(session);
        return ContributionPayment.exists({ "provider.providerReference": reference }, opts);
    }

    async isCompleted(paymentId, session = null) { // ADD session param
        const payment = await this.findById(paymentId, session);
        if (!payment) return false;
        return payment.status === PAYMENT_STATUS.COMPLETED;
    }
}

export default new PaymentStore();