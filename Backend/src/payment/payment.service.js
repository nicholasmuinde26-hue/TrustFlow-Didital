import mongoose from "mongoose";
import PaymentContext from "./payment.context.js";
import PaymentStore from "./store/payment.store.js";
import providerRegistry from "./providers/provider.registry.js";
import { validateInitiatePayment, validateCallback, validateQuery } from "./payment.validators.js";
import PaymentEventFactory from "./payment.events.js"; 
import paymentEventBus from "./payment.event.bus.js"; 
import { PAYMENT_EVENTS, PAYMENT_STATUS, PAYMENT_PROVIDER } from "./payment.constants.js";
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
            const normalizedPayload = validateInitiatePayment(payload);
            const context = new PaymentContext(normalizedPayload);
            
            const providerName = context.provider.name;
            const provider = providerRegistry.get(providerName);
            
            const { intent, payment } = await PaymentStore.createBoth(context, session);
            
            const providerResponse = await provider.initiate(context);

            // Providers like "manual" (cash) settle synchronously - there's no
            // external gateway and no callback will ever arrive, so mark the
            // intent/payment COMPLETED right away instead of stranding them in
            // PROCESSING forever.
            const finalStatus = providerResponse.immediate
                ? PAYMENT_STATUS.COMPLETED
                : PAYMENT_STATUS.PROCESSING;

            intent.provider_request_id = providerResponse.checkoutRequestId;
            intent.status = finalStatus;
            if (finalStatus === PAYMENT_STATUS.COMPLETED) intent.completed_at = new Date();
            await intent.save({ session });

            payment.provider_payment_id = providerResponse.checkoutRequestId;
            payment.status = finalStatus;
            if (finalStatus === PAYMENT_STATUS.COMPLETED) payment.completed_at = new Date();
            await payment.save({ session });

            const eventType = finalStatus === PAYMENT_STATUS.COMPLETED
                ? PAYMENT_EVENTS.COMPLETED
                : PAYMENT_EVENTS.INITIATED;

            // COMPLETED here is what triggers FinanceEngine to post the GL entries;
            // INITIATED is audit-only for payments still awaiting a provider callback.
            // Awaited (emitAsync, not emit) so that for providers that settle
            // synchronously (cash), the ledger/obligation update has actually
            // landed by the time this call returns to the caller.
            await paymentEventBus.emitAsync(eventType, PaymentEventFactory.create(eventType, {
                payment: { ...payment.toObject(), productType: context.type }, // FIX: attach productType
                provider: providerName,
                actor: { userId: context.actorId },
                participant: { memberId: context.participantId, phoneNumber: context.phoneNumber },
                obligation: { id: context.obligationId },
                metadata: { productType: context.type, chamaId: context.chamaId }
            }, providerResponse));

            return { 
                success: true, 
                paymentId: payment._id,
                paymentIntentId: intent._id,
                reference: context.reference,
                checkoutRequestId: providerResponse.checkoutRequestId,
                phoneNumber: context.phoneNumber,
                providerResponse 
            };
        });
    }

    async handleCallback(rawBody) {
        return this.processCallback({ provider: PAYMENT_PROVIDER.MPESA, rawBody });
    }

    async processCallback({ provider, paymentId, rawBody, success, status, providerData, metadata }) {
        return withSession(async (session) => {
            let callback;
            let intent;

            if (rawBody) {
                const providerService = providerRegistry.get(provider);
                callback = providerService.processCallback(rawBody);
                
                intent = await PaymentIntent.findOne({ 
                    provider_request_id: callback.checkoutRequestId 
                }).session(session);
            } else {
                intent = await PaymentIntent.findById(paymentId).session(session);
                callback = {
                    checkoutRequestId: intent.provider_request_id,
                    status: status,
                    reason: providerData?.ResultDesc,
                    raw: providerData,
                    provider
                }
            }
            
            if (!intent) {
                console.warn(`[payment.service] No PaymentIntent found for ${callback.checkoutRequestId || paymentId}`);
                return { success: false, skipped: true, reason: 'PaymentIntent not found' };
            }

            if (intent.status === PAYMENT_STATUS.COMPLETED) {
                return { success: true, duplicate: true, intent };
            }

            intent.status = callback.status;
            intent.provider_response = callback.raw;
            intent.completed_at = callback.status === PAYMENT_STATUS.COMPLETED ? new Date() : null;
            await intent.save({ session });

            let payment = null;
            let eventType = PAYMENT_EVENTS.FAILED;

            if (callback.status === PAYMENT_STATUS.COMPLETED) {
                payment = await PaymentStore.markCompletedByIntentId(intent._id, callback, session);
                eventType = PAYMENT_EVENTS.COMPLETED;
            } else if (callback.status === PAYMENT_STATUS.CANCELLED) {
                payment = await PaymentStore.markCancelledByIntentId(intent._id, callback.reason, session);
                eventType = PAYMENT_EVENTS.CANCELLED;
            } else {
                payment = await PaymentStore.markFailedByIntentId(intent._id, callback.reason, session);
                eventType = PAYMENT_EVENTS.FAILED;
            }

            if (payment) {
                const event = PaymentEventFactory.create(eventType, {
                    payment: { ...payment.toObject(), productType: intent.type }, // FIX: attach productType for FinanceEngine
                    provider: callback.provider,
                    actor: { userId: payment.created_by },
                    participant: { 
                      memberId: payment.participant_id, 
                      phoneNumber: payment.payment_instrument?.phone_number 
                    },
                    obligation: { id: payment.obligation_id },
                    metadata: { productType: intent.type, chamaId: intent.owner_id }
                }, callback.raw);
                await paymentEventBus.emitAsync(eventType, event);
            }

            return { success: callback.status === PAYMENT_STATUS.COMPLETED, payment, status: callback.status };
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
      return PaymentStore.markCancelled(paymentId, reason);
    }
    
    async fail(paymentId, reason) { 
      return PaymentStore.markFailed(paymentId, reason);
    }
}

export default new PaymentService();