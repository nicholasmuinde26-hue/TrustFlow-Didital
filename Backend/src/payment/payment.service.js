import mongoose from "mongoose";
import PaymentContext from "./payment.context.js";
import PaymentStore from "./store/payment.store.js";
import providerRegistry from "./providers/provider.registry.js";
import { validateInitiatePayment, validateCallback, validateQuery } from "./payment.validators.js";
import contributionPaymentService from "../modules/contributionPlan/contributionPayment.service.js";
import PaymentEventFactory from "./events/payment.events.js";
import paymentEventBus from "./events/payment.event.bus.js";
import { PAYMENT_EVENTS, PAYMENT_STATUS } from "./payment.constants.js";

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === "ReplicaSetWithPrimary" || topology?.description?.type === "Sharded";
};

const withSession = async (fn) => {
  const useTx = canUseTransactions();
  console.log(`MongoDB ${useTx ? 'ReplicaSet' : 'Standalone'} detected. ${useTx ? 'Using' : 'Retrying without'} transactions`);
  
  const session = useTx ? await mongoose.startSession() : null;
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

// Cache for M-Pesa queries
const queryCache = new Map();

class PaymentService {
    async initiate(payload) {
        return withSession(async (session) => {
            const context = new PaymentContext(payload);
            validateInitiatePayment(context);
            const provider = providerRegistry.get(context.provider.name);
            const payment = await PaymentStore.createPending(context, session);
            const providerResponse = await provider.initiate({ ...context, paymentId: payment.id });
            await PaymentStore.attachProviderMetadata(payment.id, providerResponse, session);
            return { success: true, payment, providerResponse };
        });
    }

    async processCallback(callbackPayload) {
        return withSession(async (session) => {
            validateCallback(callbackPayload);
            const provider = providerRegistry.get(callbackPayload.provider);
            const callback = await provider.processCallback(callbackPayload);
            const completed = await PaymentStore.isCompleted(callback.paymentId, session);
            if (completed) return { success: true, duplicate: true };

            const status = callback.status || (callback.success ? PAYMENT_STATUS.COMPLETED : PAYMENT_STATUS.FAILED);
            let payment;

            if (status === PAYMENT_STATUS.COMPLETED) {
                payment = await PaymentStore.markCompleted(callback.paymentId, callback.providerData, session);
                await contributionPaymentService.completeContributionPayment({ payment, callback }, session);
            } else if (status === PAYMENT_STATUS.CANCELLED) {
                payment = await PaymentStore.markCancelled(callback.paymentId, callback.reason || "Cancelled", session);
            } else {
                payment = await PaymentStore.markFailed(callback.paymentId, callback.reason || "Failed", session);
            }

            if (status === PAYMENT_STATUS.COMPLETED) {
                paymentEventBus.emit(PAYMENT_EVENTS.COMPLETED, PaymentEventFactory.create(PAYMENT_EVENTS.COMPLETED, {
                    payment, provider: callback.provider, actor: callback.actor, 
                    participant: callback.participant, obligation: callback.obligation, metadata: callback.metadata
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
                if (error?.response?.status === 429) {
                    await new Promise(r => setTimeout(r, 5000 * (attempts + 1)));
                    attempts++;
                    continue;
                }
                throw error;
            }
        }
        throw new Error("M-Pesa API rate limit reached. Please wait before retrying.");
    }

    async cancel(paymentId, reason) { return PaymentStore.markCancelled(paymentId, reason); }
    async fail(paymentId, reason) { return PaymentStore.markFailed(paymentId, reason); }
}

export default new PaymentService();