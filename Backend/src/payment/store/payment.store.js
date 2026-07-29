/**
 * ============================================================================
 * PAYMENT STORE
 * ============================================================================
 *
 * Transaction-aware persistence gateway.
 *
 * Responsibilities
 * ----------------
 * • Persist Contribution Payments
 * • Persist Payment Intents
 * • Provider metadata
 * • Idempotency
 * • State persistence
 * • MongoDB transactions
 *
 * DOES NOT
 * --------
 * ✗ Call M-Pesa
 * ✗ Run Finance Engine
 * ✗ Validate requests
 * ✗ Execute business rules
 *
 * ============================================================================
 */

import ContributionPayment from "../../models/ContributionPayment.js";
import PaymentIntent from "../../models/PaymentIntent.js";

import PaymentMapper from "./payment.mapper.js";
import paymentStateMachine from "../payment.state-machine.js";

import {
    PAYMENT_STATUS
} from "../payment.constants.js";

import {
    DuplicatePaymentError,
    PaymentNotFoundError,
    PaymentAlreadyCompletedError
} from "../payment.errors.js";

class PaymentStore {

    /**
     * ========================================================
     * CREATE PENDING PAYMENT
     * ========================================================
     */
    async createPending(context, session = null) {

        const paymentDocument =
            PaymentMapper.toContributionPaymentDocument(context);

        const intentDocument =
            PaymentMapper.toPaymentIntentDocument(context);

        const payment = await ContributionPayment.create(
            [paymentDocument],
            { session }
        );

        intentDocument.payment = payment[0]._id;

        const intent = await PaymentIntent.create(
            [intentDocument],
            { session }
        );

        payment[0].paymentIntent = intent[0]._id;

        await payment[0].save({ session });

        return payment[0];

    }

    /**
     * ========================================================
     * FINDERS
     * ========================================================
     */

    async findById(id) {

        return ContributionPayment.findById(id);

    }

    async findByReference(reference) {

        return ContributionPayment.findOne({
            reference
        });

    }

    async findByCheckoutRequestId(checkoutRequestId) {

        return ContributionPayment.findOne({
            "provider.checkoutRequestId":
                checkoutRequestId
        });

    }

    async findByMerchantRequestId(merchantRequestId) {

        return ContributionPayment.findOne({
            "provider.merchantRequestId":
                merchantRequestId
        });

    }

    async findByProviderReference(providerReference) {

        return ContributionPayment.findOne({
            "provider.providerReference":
                providerReference
        });

    }

    /**
     * ========================================================
     * PROVIDER METADATA
     * ========================================================
     */

    async attachProviderMetadata(
        paymentId,
        providerResponse,
        session = null
    ) {

        const payment =
            await this.findById(paymentId);

        if (!payment)
            throw new PaymentNotFoundError();

        payment.provider = {

            ...payment.provider,

            ...PaymentMapper.toProviderMetadata(
                providerResponse
            )

        };

        await payment.save({ session });

        return payment;

    }

    /**
     * ========================================================
     * MARK PROCESSING
     * ========================================================
     */

    async markProcessing(
        paymentId,
        session = null
    ) {

        const payment =
            await this.findById(paymentId);

        if (!payment)
            throw new PaymentNotFoundError();

        paymentStateMachine.transition(

            payment,

            PAYMENT_STATUS.PROCESSING

        );

        await payment.save({ session });

        return payment;

    }

    /**
     * ========================================================
     * MARK COMPLETED
     * ========================================================
     */

    async markCompleted(
        paymentId,
        providerData,
        session = null
    ) {

        const payment =
            await this.findById(paymentId);

        if (!payment)
            throw new PaymentNotFoundError();

        if (payment.status === PAYMENT_STATUS.COMPLETED)
            throw new PaymentAlreadyCompletedError();

        paymentStateMachine.transition(

            payment,

            PAYMENT_STATUS.COMPLETED

        );

        payment.provider = {

            ...payment.provider,

            ...PaymentMapper.toProviderMetadata(
                providerData
            )

        };

        payment.completedAt = new Date();

        await payment.save({ session });

        return payment;

    }

    /**
     * ========================================================
     * MARK FAILED
     * ========================================================
     */

    async markFailed(
        paymentId,
        reason,
        session = null
    ) {

        const payment =
            await this.findById(paymentId);

        if (!payment)
            throw new PaymentNotFoundError();

        paymentStateMachine.transition(

            payment,

            PAYMENT_STATUS.FAILED

        );

        payment.failureReason = reason;

        await payment.save({ session });

        return payment;

    }

    /**
     * ========================================================
     * MARK CANCELLED
     * ========================================================
     */

    async markCancelled(
        paymentId,
        reason,
        session = null
    ) {

        const payment =
            await this.findById(paymentId);

        if (!payment)
            throw new PaymentNotFoundError();

        paymentStateMachine.transition(

            payment,

            PAYMENT_STATUS.CANCELLED

        );

        payment.cancelReason = reason;

        await payment.save({ session });

        return payment;

    }

    /**
     * ========================================================
     * IDEMPOTENCY
     * ========================================================
     */

    async exists(paymentId) {

        return ContributionPayment.exists({
            _id: paymentId
        });

    }

    async existsByProviderReference(reference) {

        return ContributionPayment.exists({

            "provider.providerReference":
                reference

        });

    }

    async isCompleted(paymentId) {

        const payment =
            await this.findById(paymentId);

        if (!payment)
            return false;

        return payment.status === PAYMENT_STATUS.COMPLETED;

    }

}

export default new PaymentStore();