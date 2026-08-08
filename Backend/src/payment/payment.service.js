/**
 * ============================================================================
 * PAYMENT ENGINE
 * ============================================================================
 *
 * The Payment Engine orchestrates the complete payment lifecycle.
 *
 * Responsibilities
 * ----------------
 * ✓ Build payment context
 * ✓ Validate requests
 * ✓ Resolve payment provider
 * ✓ Coordinate persistence
 * ✓ Manage MongoDB transactions
 * ✓ Trigger contribution completion
 * ✓ Emit payment events
 *
 * DOES NOT
 * --------
 * ✗ Talk directly to M-Pesa
 * ✗ Talk directly to MongoDB models
 * ✗ Calculate financial postings
 * ✗ Perform ledger updates
 *
 * ============================================================================
 */

import mongoose from "mongoose";

import PaymentContext from "./payment.context.js";
import PaymentStore from "./store/payment.store.js";

import providerRegistry from "./providers/provider.registry.js";

import {
    validateInitiatePayment,
    validateCallback,
    validateQuery
} from "./payment.validators.js";

import contributionPaymentService
    from "../modules/contributionPlan/contributionPayment.service.js";

import PaymentEventFactory
    from "./events/payment.events.js";

import paymentEventBus
    from "./events/payment.event.bus.js";

import {
    PAYMENT_EVENTS,
    PAYMENT_STATUS
} from "./payment.constants.js";

class PaymentService {

    /**
     * =====================================================
     * INITIATE PAYMENT
     * =====================================================
     */

    async initiate(payload) {

        const session = await mongoose.startSession();

        session.startTransaction();

        try {

            const context =
                new PaymentContext(payload);

            validateInitiatePayment(context);

            const provider =
                providerRegistry.get(
                    context.provider.name
                );

            const payment =
                await PaymentStore.createPending(
                    context,
                    session
                );

            const providerResponse =
                await provider.initiate({

                    ...context,

                    paymentId: payment.id

                });

            await PaymentStore.attachProviderMetadata(

                payment.id,

                providerResponse,

                session

            );

            await session.commitTransaction();

            return {

                success: true,

                payment,

                providerResponse

            };

        } catch (error) {

            await session.abortTransaction();

            throw error;

        } finally {

            session.endSession();

        }

    }

    /**
     * =====================================================
     * PROCESS CALLBACK
     * =====================================================
     */

    async processCallback(callbackPayload) {

        const session =
            await mongoose.startSession();

        session.startTransaction();

        try {

            validateCallback(callbackPayload);

            const provider =
                providerRegistry.get(
                    callbackPayload.provider
                );

            /**
             * Normalize callback
             */
            const callback =
                await provider.processCallback(
                    callbackPayload
                );

            /**
             * Idempotency
             */
            const completed =
                await PaymentStore.isCompleted(
                    callback.paymentId
                );

            if (completed) {

                await session.commitTransaction();

                return {

                    success: true,

                    duplicate: true

                };

            }

            // Determine status from the normalized callback object
            const status =
                callback.status ||
                (callback.success ? PAYMENT_STATUS.COMPLETED : PAYMENT_STATUS.FAILED);

            let payment;

            if (status === PAYMENT_STATUS.COMPLETED) {
                /**
                 * Persist payment state as completed
                 */
                payment =
                    await PaymentStore.markCompleted(
                        callback.paymentId,
                        callback.providerData,
                        session
                    );

                /**
                 * Finance Engine
                 */
                await contributionPaymentService.completeContributionPayment(
                    {
                          payment,
                          callback
                    },
                    session
                );

            } else if (status === PAYMENT_STATUS.CANCELLED) {
                /**
                 * Persist payment state as cancelled
                 */
                payment =
                    await PaymentStore.markCancelled(
                          callback.paymentId,
                          callback.reason || "Transaction cancelled by user",
                          session
                );

            } else {
                /**
                 * Persist payment state as failed
                 */
                payment =
                    await PaymentStore.markFailed(
                          callback.paymentId,
                          callback.reason || "Transaction failed",
                          session
                );
            }

            await session.commitTransaction();

            /**
             * Emit AFTER commit (Only for completed status)
             */
            if (status === PAYMENT_STATUS.COMPLETED) {
                paymentEventBus.emit(
                    PAYMENT_EVENTS.COMPLETED,
                    PaymentEventFactory.create(
                          PAYMENT_EVENTS.COMPLETED,
                          {
                              payment,
                              provider: callback.provider,
                              actor: callback.actor,
                              participant: callback.participant,
                              obligation: callback.obligation,
                              metadata: callback.metadata
                        }
                  )
              );
            }

            return {

                success: status === PAYMENT_STATUS.COMPLETED,

                payment,

                status

            };

        }

        catch (error) {

            await session.abortTransaction();

            throw error;

        }

        finally {

            session.endSession();

        }

    }

    /**
     * =====================================================
     * QUERY PAYMENT
     * =====================================================
     */

    async query(payload) {

        validateQuery(payload);

        const provider =
            providerRegistry.get(
                payload.provider
            );

        return provider.query(payload);

    }

    /**
     * =====================================================
     * CANCEL
     * =====================================================
     */

    async cancel(paymentId, reason) {

        return PaymentStore.markCancelled(
            paymentId,
            reason
        );

    }

    /**
     * =====================================================
     * FAIL
     * =====================================================
     */

    async fail(paymentId, reason) {

        return PaymentStore.markFailed(
            paymentId,
            reason
        );

    }

}

export default new PaymentService();