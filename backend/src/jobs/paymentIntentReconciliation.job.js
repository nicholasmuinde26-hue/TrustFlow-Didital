/**
 * ============================================================================
 * PAYMENT INTENT RECONCILIATION JOB
 * ============================================================================
 * Runs every 30s. Queries STK for stale intents and emits events.
 * FinanceEngine picks it up and posts GL based on productType.
 */

import PaymentIntent from "../models/PaymentIntent.js";
import ContributionObligation from "../models/ContributionObligation.js";
import ContributionPledge from "../models/ContributionPledge.js";
import { sendPublicGivingReceipt } from '../services/publicGivingReceipt.service.js';
import { isPublicGivingIntent } from '../modules/publicGiving/publicGiving.logic.js';
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
  // FIX: PaymentService.initiate() (the unified flow used by MGR /
  // contributions payments) stores the STK CheckoutRequestID directly on
  // the intent itself - intent.provider_request_id, set in
  // payment.service.js. It never writes an MpesaAttempt record; that
  // collection is only populated by the older, separate chamaFinance/
  // mpesa.controller flows. Requiring MpesaAttempt here meant every intent
  // created through the unified flow had no way to be reconciled at all:
  // this function returned immediately, sweep after sweep, and the intent
  // just sat "stale" forever regardless of what actually happened on
  // M-Pesa's side. Prefer the intent's own field; fall back to
  // MpesaAttempt for the legacy flows that still rely on it.
  let checkoutRequestId = intent.provider_request_id;
  if (!checkoutRequestId) {
    const attempt = await MpesaAttempt.findOne({ payment_intent_id: intent._id });
    checkoutRequestId = attempt?.checkout_request_id;
  }
  if (!checkoutRequestId) return;

  try {
    const query = await mpesaService.queryStkPush({ checkoutRequestId });

    // resultCode null/undefined genuinely means M-Pesa hasn't resolved the
    // prompt yet (member still looking at their phone) - keep waiting.
    //
    // FIX: 1037 ("DS timeout user cannot be reached") does NOT belong in
    // that same bucket - mapResultCode() below already classifies it as a
    // terminal timeout, not a pending state. Treating it as "still waiting"
    // meant a member who simply never entered their PIN sat on the
    // "Waiting for M-Pesa PIN" spinner until the 1-hour MAX_AGE_MS sweep
    // eventually force-failed the intent with a generic reason - instead of
    // failing fast with "PIN entry timed out" like it should.
    if (query.resultCode === null || query.resultCode === undefined) return;

    const mapped = mpesaService.mapResultCode(query.resultCode);
    const successful = mapped.paymentStatus === PAYMENT_STATUS.COMPLETED;
    const status = mapped.status === "cancelled" ? PAYMENT_STATUS.CANCELLED
      : successful ? PAYMENT_STATUS.COMPLETED
      : PAYMENT_STATUS.FAILED;

    // Use processCallback with standard lowercase PAYMENT_STATUS enum values
    const settlement = await paymentService.processCallback({
      provider: 'mpesa',
      paymentId: intent._id,
      success: successful,
      status,
      providerData: {
       ...query,
        ResultDesc: query.resultDescription || mapped.reason || "M-Pesa STK status received (reconciliation sweep)"
      },
      metadata: {
        productType: intent.type, // 'savings' | 'contribution' | 'mgr'
        chamaId: intent.owner_id
      }
    });
    if (isPublicGivingIntent(intent) && successful) {
      await restoreSettledPublicDonation(intent.obligation_id);
      await sendPublicGivingReceipt(intent._id);
    }
    if (isPublicGivingIntent(intent) && !successful && !settlement?.amountMismatch) await rollbackUnsettledPublicDonation(intent.obligation_id);

  } catch (error) {
    if (error.statusCode === 429 || error.statusCode === 500) {
      console.warn(`[reconciliation] STK query throttled for ${checkoutRequestId}. Retrying next sweep.`);
      return;
    }
    console.error(`[reconciliation] Failed to reconcile PaymentIntent ${intent._id}:`, error.message);
  }
};

async function rollbackUnsettledPublicDonation(obligationId) {
  if (!obligationId) return;
  const obligation = await ContributionObligation.findById(obligationId);
  if (!obligation) return;
  const paid = Number(obligation.paid_amount?.toString?.() ?? obligation.paid_amount ?? 0);
  obligation.expected_amount = paid;
  obligation.status = paid > 0 ? 'paid' : 'pending';
  await obligation.save();
  await ContributionPledge.updateOne({ obligation_id: obligation._id }, { $set: { pledged_amount: paid, status: paid > 0 ? 'paid' : 'pledged' } });
}

async function restoreSettledPublicDonation(obligationId) {
  if (!obligationId) return;
  const obligation = await ContributionObligation.findById(obligationId);
  if (!obligation) return;
  const paid = Number(obligation.paid_amount?.toString?.() ?? obligation.paid_amount ?? 0);
  const expected = Number(obligation.expected_amount?.toString?.() ?? obligation.expected_amount ?? 0);
  if (paid > expected) obligation.expected_amount = paid;
  obligation.status = 'paid';
  await obligation.save();
  const pledge = await ContributionPledge.findOne({ obligation_id: obligation._id });
  if (pledge) {
    const pledged = Number(pledge.pledged_amount?.toString?.() ?? pledge.pledged_amount ?? 0);
    if (paid > pledged) pledge.pledged_amount = paid;
    pledge.status = 'paid';
    await pledge.save();
  }
}

export const sweepStalePaymentIntents = async ({ publicGivingOnly = false, excludePublicGiving = false } = {}) => {
  if (sweepInProgress) return;
  sweepInProgress = true;

  try {
    const now = Date.now();
    const cutoff = new Date(now - MIN_AGE_MS);
    const oldestAllowed = new Date(now - MAX_AGE_MS);

    const filter = {
      provider: "mpesa",
      status: { $in: ["pending", "processing"] },
      updatedAt: { $lte: cutoff, $gte: oldestAllowed },
    };
    if (publicGivingOnly) filter.$or = [{ 'metadata.publicDonation': true }, { reference: /^GIVE-/ }];
    else if (excludePublicGiving) filter.$nor = [{ 'metadata.publicDonation': true }, { reference: /^GIVE-/ }];
    const candidates = await PaymentIntent.find(filter)
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

    const timeoutFilter = {
        provider: "mpesa",
        status: { $in: ["pending", "processing"] },
        updatedAt: { $lt: oldestAllowed },
    };
    if (publicGivingOnly) timeoutFilter.$or = [{ 'metadata.publicDonation': true }, { reference: /^GIVE-/ }];
    else if (excludePublicGiving) timeoutFilter.$nor = [{ 'metadata.publicDonation': true }, { reference: /^GIVE-/ }];
    const timeoutResult = await PaymentIntent.updateMany(timeoutFilter,
      {
        $set: {
          status: "failed",
          failure_reason: "No confirmation received from M-Pesa within the expected window",
          failed_at: new Date(),
        },
      }
    );

    if (publicGivingOnly) {
      const timedOut = await PaymentIntent.find({ ...timeoutFilter, status: 'failed' }).select('obligation_id').lean();
      for (const intent of timedOut) await rollbackUnsettledPublicDonation(intent.obligation_id);
    }

    if (timeoutResult.modifiedCount > 0) {
        console.log(`[reconciliation] Timed out ${timeoutResult.modifiedCount} intent(s) older than 1h.`);
    }

  } catch (error) {
    console.error("[reconciliation] Sweep failed:", error.message);
  } finally {
    sweepInProgress = false;
  }
};

export const startPaymentIntentReconciliationJob = ({ publicGivingOnly = false, excludePublicGiving = false } = {}) => {
  console.log(`[reconciliation] Payment intent reconciliation job started (every ${SWEEP_INTERVAL_MS / 1000}s)`);
  const timer = setInterval(() => sweepStalePaymentIntents({ publicGivingOnly, excludePublicGiving }), SWEEP_INTERVAL_MS);
  timer.unref?.();
  return timer;
};
