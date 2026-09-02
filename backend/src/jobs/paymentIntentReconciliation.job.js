/**
 * ============================================================================
 * PAYMENT INTENT RECONCILIATION JOB
 * ============================================================================
 * Runs every 30s. Queries STK for stale intents and emits events.
 * FinanceEngine picks it up and posts GL based on productType.
 */

import PaymentIntent from "../models/PaymentIntent.js";
import MpesaAttempt from "../models/MpesaAttempt.js";
import mpesaService from "../payment/providers/mpesa/mpesa.service.js";
import paymentService from "../payment/payment.service.js";
import { PAYMENT_STATUS } from "../payment/payment.constants.js";

const SWEEP_INTERVAL_MS = Number(process.env.MPESA_RECONCILE_INTERVAL_MS) || 30_000;
const MIN_AGE_MS = Number(process.env.MPESA_RECONCILE_MIN_AGE_MS) || 25_000;
const MAX_AGE_MS = Number(process.env.MPESA_RECONCILE_MAX_AGE_MS) || 60 * 60 * 1000; // 1 hour
const BATCH_SIZE = Number(process.env.MPESA_RECONCILE_BATCH_SIZE) || 10;

let sweepInProgress = false;

const reconcileOne = async (intent) => {
  const attempt = await MpesaAttempt.findOne({ payment_intent_id: intent._id });
  if (!attempt?.checkout_request_id) return;

  try {
    const query = await mpesaService.queryStkPush({ checkoutRequestId: attempt.checkout_request_id });

    // Still waiting for user PIN
    if (query.resultCode === null || query.resultCode === undefined || query.resultCode === 1037) return;

    const successful = Number(query.resultCode) === 0;

    // Use processCallback with standard lowercase PAYMENT_STATUS enum values
    await paymentService.processCallback({
      provider: 'mpesa',
      paymentId: intent._id,
      success: successful,
      status: successful ? PAYMENT_STATUS.COMPLETED : PAYMENT_STATUS.FAILED,
      providerData: {
       ...query,
        ResultDesc: query.resultDescription || "M-Pesa STK status received (reconciliation sweep)"
      },
      metadata: {
        productType: intent.type, // 'savings' | 'contribution' | 'mgr'
        chamaId: intent.owner_id
      }
    });

  } catch (error) {
    if (error.statusCode === 429 || error.statusCode === 500) {
      console.warn(`[reconciliation] STK query throttled for ${attempt.checkout_request_id}. Retrying next sweep.`);
      return;
    }
    console.error(`[reconciliation] Failed to reconcile PaymentIntent ${intent._id}:`, error.message);
  }
};

export const sweepStalePaymentIntents = async () => {
  if (sweepInProgress) return;
  sweepInProgress = true;

  try {
    const now = Date.now();
    const cutoff = new Date(now - MIN_AGE_MS);
    const oldestAllowed = new Date(now - MAX_AGE_MS);

    const candidates = await PaymentIntent.find({
      provider: "mpesa",
      status: { $in: ["pending", "processing"] },
      updatedAt: { $lte: cutoff, $gte: oldestAllowed },
    })
     .sort({ updatedAt: 1 })
     .limit(BATCH_SIZE * 2);

    const staleIntents = candidates
     .filter((intent) => intent.provider_request_id &&!intent.provider_request_id.startsWith("pending_"))
     .slice(0, BATCH_SIZE);

    if (staleIntents.length > 0) {
        console.log(`[reconciliation] Processing ${staleIntents.length} stale intent(s)`);
    }

    for (const intent of staleIntents) {
      await reconcileOne(intent);
      await new Promise(r => setTimeout(r, 500)); // 500ms backoff to avoid 429
    }

    const timeoutResult = await PaymentIntent.updateMany(
      {
        provider: "mpesa",
        status: { $in: ["pending", "processing"] },
        updatedAt: { $lt: oldestAllowed },
      },
      {
        $set: {
          status: "failed",
          failure_reason: "No confirmation received from M-Pesa within the expected window",
          failed_at: new Date(),
        },
      }
    );

    if (timeoutResult.modifiedCount > 0) {
        console.log(`[reconciliation] Timed out ${timeoutResult.modifiedCount} intent(s) older than 1h.`);
    }

  } catch (error) {
    console.error("[reconciliation] Sweep failed:", error.message);
  } finally {
    sweepInProgress = false;
  }
};

export const startPaymentIntentReconciliationJob = () => {
  console.log(`[reconciliation] Payment intent reconciliation job started (every ${SWEEP_INTERVAL_MS / 1000}s)`);
  const timer = setInterval(sweepStalePaymentIntents, SWEEP_INTERVAL_MS);
  timer.unref?.();
  return timer;
};