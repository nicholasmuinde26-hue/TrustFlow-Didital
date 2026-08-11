/**
 * ============================================================================
 * PAYMENT INTENT RECONCILIATION JOB
 * ============================================================================
 *
 * WHY THIS EXISTS
 * ----------------
 * STK push payments only fully complete when:
 *   (a) Safaricom's async callback reaches POST /mpesa/callback, or
 *   (b) the frontend polling loop on the Savings/MGR/Contribution pages
 *       manually queries Daraja via the /reconcile endpoint.
 *
 * Both of those are unreliable on their own: (a) requires a publicly
 * reachable MPESA_CALLBACK_URL, which frequently fails in dev and can also
 * fail transiently in prod; (b) only runs for ~60 seconds while the specific
 * page is open, and gives up if the user navigates away.
 *
 * When neither happens, a PaymentIntent (and its savings/contribution/MGR
 * obligation + FinancialAccount balance) is left stuck at status
 * "pending"/"processing" indefinitely — the STK push succeeded on the
 * member's phone, but the dashboard never reflects it.
 *
 * This job is the durable fallback: it periodically re-queries Daraja for
 * any stale intent and runs it through the same reconciliation path used by
 * the webhook, so the ledger/balance update happens regardless of whether
 * the callback or the frontend poll ever fired.
 */

import PaymentIntent from "../models/PaymentIntent.js";
import MpesaAttempt from "../models/MpesaAttempt.js";
import mpesaService from "../payment/providers/mpesa/mpesa.service.js";
import { reconcileSavingsCallback } from "../modules/chama/chamaFinance.service.js";

// How often the sweep runs.
const SWEEP_INTERVAL_MS = Number(process.env.MPESA_RECONCILE_INTERVAL_MS) || 30_000;

// Don't query Daraja for an intent younger than this — give the normal
// webhook/frontend-poll path a fair chance first, and avoid hammering the
// STK query endpoint (which itself has rate limits) for brand new pushes.
const MIN_AGE_MS = Number(process.env.MPESA_RECONCILE_MIN_AGE_MS) || 25_000;

// Beyond this age, stop trying and mark the intent failed so it doesn't
// haunt the dashboard as "processing" forever. STK prompts expire on
// Safaricom's side well before this.
const MAX_AGE_MS = Number(process.env.MPESA_RECONCILE_MAX_AGE_MS) || 60 * 60 * 1000; // 1 hour

// How many stale intents to process per sweep, to avoid bursts of STK
// query calls (Daraja rate-limits these).
const BATCH_SIZE = Number(process.env.MPESA_RECONCILE_BATCH_SIZE) || 10;

let sweepInProgress = false;

const reconcileOne = async (intent) => {
  const attempt = await MpesaAttempt.findOne({ payment_intent_id: intent._id });
  if (!attempt?.checkout_request_id) return;

  try {
    const query = await mpesaService.queryStkPush({ checkoutRequestId: attempt.checkout_request_id });

    // Daraja returns no ResultCode while the push is still awaiting PIN
    // entry - nothing to reconcile yet, try again next sweep.
    if (query.resultCode === null || query.resultCode === undefined) return;

    const successful = Number(query.resultCode) === 0;

    await reconcileSavingsCallback({
      checkoutRequestId: attempt.checkout_request_id,
      resultCode: Number(query.resultCode),
      resultDescription: query.resultDescription || "M-Pesa STK status received (reconciliation sweep)",
      success: successful,
      amount: successful ? Number(attempt.amount.toString()) : null,
      phoneNumber: successful ? attempt.phone_number : null,
      mpesaReceiptNumber: query.rawResponse?.MpesaReceiptNumber || null,
      rawCallback: query.rawResponse,
    });
  } catch (error) {
    if (error.statusCode === 429 || error.statusCode === 500) {
      console.warn(`[reconciliation] STK query throttled/unavailable (${error.statusCode}) for ${attempt.checkout_request_id}. Retrying next sweep.`);
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

    // Fetch a slightly wider window and filter out intents whose STK push
    // never actually made it to Daraja (still holding the temporary
    // "pending_..." request id) - those have nothing to query yet.
    const candidates = await PaymentIntent.find({
      provider: "mpesa",
      status: { $in: ["pending", "processing"] },
      updatedAt: { $lte: cutoff, $gte: oldestAllowed },
    })
      .sort({ updatedAt: 1 })
      .limit(BATCH_SIZE * 2);

    const staleIntents = candidates
      .filter((intent) => intent.provider_request_id && !intent.provider_request_id.startsWith("pending_"))
      .slice(0, BATCH_SIZE);

    for (const intent of staleIntents) {
      await reconcileOne(intent);
    }

    // Give up on anything that's exceeded the max age so it doesn't sit as
    // "processing" on the dashboard forever with no explanation.
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

    if (staleIntents.length || timeoutResult.modifiedCount) {
      console.log(`[reconciliation] Sweep processed ${staleIntents.length} stale intent(s), timed out ${timeoutResult.modifiedCount}.`);
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
  // Don't let this timer keep the process alive on its own during shutdown.
  timer.unref?.();
  return timer;
};