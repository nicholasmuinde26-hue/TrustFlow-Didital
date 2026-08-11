import mongoose from "mongoose";
import PaymentContext from "./payment.context.js";
import PaymentStore from "./store/payment.store.js";
import providerRegistry from "./providers/provider.registry.js";
import { validateInitiatePayment, validateCallback, validateQuery } from "./payment.validators.js";
import PaymentEventFactory from "./payment.events.js";
import paymentEventBus from "./payment.event.bus.js";
import { PAYMENT_EVENTS, PAYMENT_STATUS } from "./payment.constants.js";
import PaymentIntent from "../models/PaymentIntent.js";

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === "ReplicaSetWithPrimary" || topology?.description?.type === "Sharded";
};

const withSession = async (fn) => {
  const useTx = canUseTransactions();
  console.log(`MongoDB ${useTx? 'ReplicaSet' : 'Standalone'} detected. ${useTx? 'Using' : 'Retrying without'} transactions`);

  const session = useTx? await mongoose.startSession() : null;
  if (session) session.startTransaction();

  try {
    const result = await fn(session);
    if (session) await session.commitTransaction();
    return result;
  } catch (error) {
    if (session) await session.abortTransaction();
    throw error;
  } finally {
    if (session) session.endSession();
  }
};

const queryCache = new Map();

class PaymentService {
    async initiate(payload) {
        return withSession(async (session) => {
            const context = new PaymentContext(payload);
            validateInitiatePayment(context);
            const provider = providerRegistry.get(context.provider.name);
            const payment = await PaymentStore.createPending(context, session);
            const providerResponse = await provider.initiate({...context, paymentId: payment.id });
            await PaymentStore.attachProviderMetadata(payment.id, providerResponse, session);
            return { success: true, payment, providerResponse };
        });
    }

    async processCallback(callbackPayload) {
        return withSession(async (session) => {
            validateCallback(callbackPayload);
            const provider = providerRegistry.get(callbackPayload.provider);
            const callback = await provider.processCallback(callbackPayload);
            
            // FIX 1: Resolve paymentId from checkoutRequestId if needed
            let paymentId = callbackPayload.paymentId || callback.paymentId;
            if (!paymentId && callback.checkoutRequestId) {
              const intent = await PaymentIntent.findOne({ provider_request_id: callback.checkoutRequestId }).session(session);
              if (!intent) {
                console.warn(`[payment.service] No PaymentIntent found for checkoutRequestId: ${callback.checkoutRequestId}. Skipping.`);
                return { success: false, skipped: true, reason: 'PaymentIntent not found' };
              }
              paymentId = intent._id;
            }
            if (!paymentId) throw new Error('paymentId is required to process callback');

            // FIX 2: Check if already completed
            const existing = await PaymentIntent.findById(paymentId).session(session).lean();
            if (!existing) {
              console.warn(`[payment.service] PaymentIntent ${paymentId} not found. Skipping.`);
              return { success: false, skipped: true, reason: 'PaymentIntent not found' };
            }
            if (existing.status === PAYMENT_STATUS.COMPLETED) {
              return { success: true, duplicate: true, payment: existing };
            }

            const status = callback.status || (callback.success? PAYMENT_STATUS.COMPLETED : PAYMENT_STATUS.FAILED);
            let payment;

            if (status === PAYMENT_STATUS.COMPLETED) {
                payment = await PaymentStore.markCompleted(paymentId, callback.providerData, session);

                // Product-specific handlers
                if (payment.productType === 'CONTRIBUTION') {
                  const contributionPaymentService = (await import("../modules/contributionPlan/contributionPayment.service.js")).default;
                  await contributionPaymentService.completeContributionPayment({ payment, callback }, session);
                }
                // Add MGR, SAVINGS, LOAN later

            } else if (status === PAYMENT_STATUS.CANCELLED) {
                payment = await PaymentStore.markCancelled(paymentId, callback.reason || "Cancelled", session);
            } else {
                payment = await PaymentStore.markFailed(paymentId, callback.reason || "Failed", session);
            }

            // Emit event AFTER DB commit
            if (status === PAYMENT_STATUS.COMPLETED && payment) {
                paymentEventBus.emit(PAYMENT_EVENTS.COMPLETED, PaymentEventFactory.create(PAYMENT_EVENTS.COMPLETED, {
                    payment, 
                    provider: callback.provider, 
                    actor: { userId: payment.payerId || callback.actor?.userId },
                    participant: { 
                      memberId: payment.metadata?.participantId || callback.participant?.memberId, 
                      phoneNumber: payment.metadata?.phoneNumber || callback.participant?.phoneNumber 
                    },
                    obligation: { id: payment.metadata?.obligationId || callback.obligation?.id }, 
                    metadata: {
                      ...payment.metadata,
                      productType: payment.productType,
                      providerData: callback.providerData
                    }
                }));
            }
            return { success: status === PAYMENT_STATUS.COMPLETED, payment, status };
        });
    }

    async query(payload) {
        validateQuery(payload);
        const cacheKey = payload.paymentId || payload.checkoutRequestId;
        const cached = queryCache.get(cacheKey);
        if (cached && Date.now() - cached.ts < 10000) return cached.data;

        const provider = providerRegistry.get(payload.provider);
        let attempts = 0;
        while (attempts < 3) {
            try {
                const result = await provider.query(payload);
                queryCache.set(cacheKey, { data: result, ts: Date.now() });
                return result;
            } catch (error) {
                if (error?.statusCode === 429 || error?.message?.includes('socket hang up')) {
                    const delay = 5000 * (attempts + 1);
                    console.warn(`[payment.service] Query throttled. Retrying in ${delay}ms`);
                    await new Promise(r => setTimeout(r, delay));
                    attempts++;
                    continue;
                }
                throw error;
            }
        }
        throw new Error("M-Pesa API rate limit reached. Please wait before retrying.");
    }

    async cancel(paymentId, reason) { 
      const res = await PaymentStore.markCancelled(paymentId, reason);
      return res || { success: false, reason: 'Payment not found' };
    }
    
    async fail(paymentId, reason) { 
      const res = await PaymentStore.markFailed(paymentId, reason);
      return res || { success: false, reason: 'Payment not found' };
    }
}

export default new PaymentService();