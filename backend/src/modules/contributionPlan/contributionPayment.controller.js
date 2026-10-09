/**
 * ============================================================================
 * CONTRIBUTION PAYMENT CONTROLLER - Finance Engine v2
 * ============================================================================
 */
import crypto from 'crypto';
import ContributionObligation from '../../models/ContributionObligation.js';
import PaymentIntent from '../../models/PaymentIntent.js';
import ContributionPayment from '../../models/ContributionPayment.js';
import paymentService from "../../payment/payment.service.js";
import mpesaService from "../../payment/providers/mpesa/mpesa.service.js";
import AppError from '../../utils/AppError.js';
import { PAYMENT_PROVIDER } from '../../payment/payment.constants.js';
import { previewContributionPayment } from './contributionAllocation.service.js';

const generateUniqueReference = (displayRef) => {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${displayRef}-${ts}-${rand}`.slice(0, 100);
};


const pickPeriodKey = (body) => body.period_key || body.periodKey || null;

/**
 * Who is being paid for. A member pays for themselves; leadership (scope 'all')
 * may name another member. The route's permission check already refuses a plain
 * member who names someone else - this is the same rule enforced again here.
 */
const resolveTargetMembershipId = (req) => {
  const own = req.membership?._id ? String(req.membership._id) : null;
  const named = req.body?.membershipId ? String(req.body.membershipId) : null;
  const isOwnScopeOnly = req.permissionResult?.scope && req.permissionResult.scope !== 'all';
  if (named && named !== own && isOwnScopeOnly) {
    throw new AppError('You can only pay your own contributions.', 403);
  }
  const target = named || own;
  if (!target) throw new AppError('Chama membership context is required.', 400);
  return target;
};

const planPaymentKey = (req, targetMembershipId) => {
  const { planId, amount, paymentMethod } = req.body;
  return crypto
    .createHash('sha256')
    .update(`${req.user._id}:${targetMembershipId}:${planId}:${pickPeriodKey(req.body) || 'lump'}:${amount}:${paymentMethod || 'cash'}`)
    .digest('hex');
};

/**
 * THE contribution product: { planId, period_key?, amount }.
 *   period_key set  -> that month of that contribution (excess carries forward)
 *   period_key not  -> lump sum, cleared oldest-first (excess carries forward)
 * The split itself is applied when the payment settles
 * (contributionAllocation.service.js); here we validate, preview and initiate.
 */
const initiatePlanPayment = async (req, res) => {
  const { planId, amount, paymentMethod, phoneNumber, idempotencyKey } = req.body;
  const periodKey = pickPeriodKey(req.body);
  const userId = req.user._id;

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ success: false, message: 'Valid payment amount is required.' });
  }
  if (paymentMethod === 'MPESA' && !phoneNumber) {
    return res.status(400).json({ success: false, message: 'Phone number is required for M-Pesa payments.' });
  }

  const isOwnScopeOnly = req.permissionResult?.scope && req.permissionResult.scope !== 'all';
  if (isOwnScopeOnly && paymentMethod !== 'MPESA') {
    return res.status(403).json({
      success: false,
      message: 'Only the treasurer can record cash/bank payments. Use M-Pesa to pay your own contribution.',
    });
  }

  const targetMembershipId = resolveTargetMembershipId(req);
  const chamaId = req.chama._id;

  // Validates the plan, the member, the month and the amount; nothing is written.
  const preview = await previewContributionPayment({
    chamaId,
    planId,
    membershipId: targetMembershipId,
    amount,
    periodKey,
  });

  // Same retry rule as the obligation flow: only a payment still in flight
  // shares the deterministic key; a failed/cancelled one must not block a retry.
  const baseKey = idempotencyKey || planPaymentKey(req, targetMembershipId);
  let key = baseKey;
  if (!idempotencyKey) {
    const prior = await PaymentIntent.findOne({ idempotency_key: baseKey }).select('status').lean();
    if (prior && !['pending', 'processing'].includes(prior.status)) key = `${baseKey}-${Date.now()}`;
  }

  const displayRef = `CONTRIB-${preview.plan.name || 'PLAN'}`.slice(0, 20);
  const normalizedPhone = paymentMethod === 'MPESA' ? mpesaService.normalizePhoneNumber(phoneNumber) : null;

  const result = await paymentService.initiate({
    type: 'CONTRIBUTION', // the single contribution product
    amount: Number(amount),
    currency: 'KES',
    provider: { name: paymentMethod === 'MPESA' ? PAYMENT_PROVIDER.MPESA : PAYMENT_PROVIDER.CASH },
    actorId: userId,
    chamaId,
    participantId: targetMembershipId,
    obligationId: preview.anchor_obligation_id || undefined,
    planId: preview.plan.id,
    phoneNumber: normalizedPhone,
    reference: generateUniqueReference(displayRef),
    displayReference: displayRef,
    participant: { id: targetMembershipId, phoneNumber: normalizedPhone },
    metadata: {
      description: `Contribution to ${preview.plan.name}${periodKey ? ` (${periodKey})` : ''}`,
      ownerType: 'Chama',
      period_key: periodKey,
      // This marker is what routes settlement to the allocation service.
      allocation: { mode: periodKey ? 'specific' : 'oldest_first', period_key: periodKey },
    },
    idempotencyKey: key,
  });

  return res.status(result.duplicate ? 200 : 201).json({
    success: true,
    message: result.duplicate ? 'Payment already initiated' : 'Payment initiated',
    duplicate: result.duplicate || false,
    data: {
      paymentId: result.paymentId,
      paymentIntentId: result.paymentIntentId,
      reference: result.reference,
      checkoutRequestId: result.checkoutRequestId,
      phoneNumber: result.phoneNumber,
    },
    providerResponse: result.providerResponse,
    // What this payment will do once it settles (an estimate: balances can
    // move between the prompt and the PIN being entered).
    allocation: preview,
  });
};

class ContributionPaymentController {

  /**
   * POST /contributions/payments
   * For CASH payments or to initiate MPESA STK
   */
  async createPayment(req, res, next) {
    try {
      const { obligationId, amount, paymentMethod, phoneNumber, idempotencyKey } = req.body;
      const userId = req.user._id;

      // New product: { planId, period_key? } - a specific month, or a lump sum
      // allocated oldest-first. obligationId (one specific obligation) still works.
      if (req.body.planId && !obligationId) return await initiatePlanPayment(req, res);

      if (!obligationId) return res.status(400).json({ success: false, message: "Choose a contribution (planId) or an obligation (obligationId)." });
      if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: "Valid payment amount is required." });

      // FIX: Validate phone for MPESA
      if (paymentMethod === 'MPESA' && !phoneNumber) {
        return res.status(400).json({ success: false, message: "Phone number is required for M-Pesa payments." });
      }

      // A plain member's 'contributions.record' grant is scope: 'own' (see
      // requirePermission in the route, which already confirmed this is
      // their own obligation). Cash/bank marks an obligation paid without
      // any money actually moving, so that path stays treasurer-only
      // (scope: 'all') - members self-recording cash would let anyone mark
      // themselves paid for free. Members can only pay via a real M-Pesa
      // STK push to their own phone.
      const isOwnScopeOnly = req.permissionResult?.scope && req.permissionResult.scope !== 'all';
      if (isOwnScopeOnly && paymentMethod !== 'MPESA') {
        return res.status(403).json({
          success: false,
          message: "Only the treasurer can record cash/bank payments. Use M-Pesa to pay your own contribution.",
        });
      }

      const baseKey = idempotencyKey || crypto.createHash('sha256').update(`${userId}:${obligationId}:${amount}:${paymentMethod || 'cash'}`).digest('hex');

      // Only reuse the deterministic key while a prior attempt is still
      // genuinely in-flight (pending/processing) - that's the case the
      // unique index exists to protect against: a double-click or a
      // network retry firing two STK pushes for the same tap. Once that
      // prior attempt is terminal (failed/cancelled/completed), this exact
      // (obligation, amount, method) combination must NOT stay permanently
      // claimed - the member has to be able to try again. Without this
      // check, any failed/timed-out/cancelled attempt would collide with
      // the SAME idempotency key forever, and every retry would just hand
      // back that dead record's stale failure_reason (e.g. the
      // reconciliation job's "No confirmation received from M-Pesa within
      // the expected window" once it's over an hour old) instead of ever
      // sending a new STK push.
      let key = baseKey;
      if (!idempotencyKey) {
        const priorAttempt = await PaymentIntent.findOne({ idempotency_key: baseKey }).select('status').lean();
        if (priorAttempt && !['pending', 'processing'].includes(priorAttempt.status)) {
          key = `${baseKey}-${Date.now()}`;
        }
      }

      // 1. Load obligation
      const obligation = await ContributionObligation.findById(obligationId).populate('plan_id', 'name contribution_type');
      if (!obligation) return res.status(404).json({ success: false, message: "Obligation not found" });
      if (obligation.status === 'paid') return res.status(409).json({ success: false, message: "Obligation already paid" });

      // 2. Determine product type
      const productType = obligation.plan_id?.contribution_type === 'merry_go_round' ? 'MGR' : 'CONTRIBUTION';
      const displayRef = `CONTRIB-${obligation.plan_id?.name || 'PLAN'}`.slice(0, 20);
      const uniqueRef = generateUniqueReference(displayRef);
      const normalizedPhone = paymentMethod === 'MPESA' ? mpesaService.normalizePhoneNumber(phoneNumber) : null;

      // 3. Build unified payment payload - MATCH validator structure
      const paymentPayload = {
        type: productType,
        amount: Number(amount),
        currency: obligation.currency || 'KES',
        provider: {
          name: paymentMethod === 'MPESA' ? PAYMENT_PROVIDER.MPESA : PAYMENT_PROVIDER.CASH
        },
        // top-level fields required by PaymentContext
        actorId: userId,
        chamaId: obligation.owner_id,
        participantId: obligation.participant_id,
        obligationId,
        planId: obligation.plan_id?._id,
        phoneNumber: normalizedPhone,
        reference: uniqueRef,
        displayReference: displayRef,
        participant: { // REQUIRED by validator for mpesa
          id: obligation.participant_id,
          phoneNumber: normalizedPhone
        },
        metadata: {
          description: `Contribution to ${obligation.plan_id?.name || 'Plan'}`,
          ownerType: obligation.owner_type,
          periodStart: obligation.period_start,
          periodEnd: obligation.period_end
        },
        idempotencyKey: key
      };

      const result = await paymentService.initiate(paymentPayload);

      const statusCode = result.duplicate ? 200 : 201;
      return res.status(statusCode).json({
        success: true,
        message: result.duplicate ? "Payment already initiated" : "Payment initiated",
        duplicate: result.duplicate || false,
        // FIX: PaymentService.initiate() returns { paymentId, paymentIntentId,
        // reference, checkoutRequestId, phoneNumber, providerResponse } - there
        // is no `.payment` field. Sending `result.payment` here always sent
        // `data: undefined`, so the frontend's STK modal could never read
        // paymentIntentId/checkoutRequestId back out and immediately failed
        // with "M-Pesa did not return a payment reference", even though the
        // STK push itself had gone out fine.
        data: {
          paymentId: result.paymentId,
          paymentIntentId: result.paymentIntentId,
          reference: result.reference,
          checkoutRequestId: result.checkoutRequestId,
          phoneNumber: result.phoneNumber
        },
        providerResponse: result.providerResponse
      });

    } catch (error) {
      if (error.code === 11000) {
        // FIX: `error.existingRecord` was never set anywhere (Mongo's E11000
        // doesn't attach one) - every duplicate-key retry (e.g. a member
        // re-submitting the same obligation/amount/method, whose
        // idempotencyKey is deterministic: sha256(userId:obligationId:amount:
        // paymentMethod)) returned `data: null`, which reproduces the exact
        // same "M-Pesa did not return a payment reference" failure on the
        // frontend as the original missing-`data` bug. Look up the intent
        // that was actually created for this idempotency key and return it
        // in the same shape as the success path.
        const key = req.body.idempotencyKey || (req.body.planId && !req.body.obligationId
          ? planPaymentKey(req, req.body.membershipId || req.membership?._id)
          : crypto.createHash('sha256')
            .update(`${req.user._id}:${req.body.obligationId}:${req.body.amount}:${req.body.paymentMethod || 'cash'}`)
            .digest('hex'));
        const existingIntent = await PaymentIntent.findOne({ idempotency_key: key }).lean();

        return res.status(200).json({
          success: true,
          message: "Payment already initiated",
          duplicate: true,
          data: existingIntent ? {
            paymentId: existingIntent._id,
            paymentIntentId: existingIntent._id,
            reference: existingIntent.reference,
            checkoutRequestId: existingIntent.provider_request_id,
            phoneNumber: existingIntent.metadata?.phoneNumber || null
          } : null
        });
      }
      next(error);
    }
  }

  /**
   * POST /contributions/preview
   * { chamaId, planId, period_key?, amount, membershipId? }
   * What a payment WOULD do - which months it clears, what goes forward as an
   * advance - without starting it. Writes nothing.
   */
  async previewPayment(req, res, next) {
    try {
      const preview = await previewContributionPayment({
        chamaId: req.chama._id,
        planId: req.body.planId,
        membershipId: resolveTargetMembershipId(req),
        amount: req.body.amount,
        periodKey: pickPeriodKey(req.body),
      });
      return res.status(200).json({ success: true, data: preview });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /contributions/payments/callback - M-Pesa
   */
  async paymentCallback(req, res, next) {
    try {
      const callbackData = req.body;
      const parsed = mpesaService.parseStkCallback(callbackData); // now never throws
      
      // Find PaymentIntent by checkoutRequestId
      const intent = await PaymentIntent.findOne({ provider_request_id: parsed.checkoutRequestId });
      if (!intent) {
        console.warn(`Callback for unknown CheckoutRequestID: ${parsed.checkoutRequestId}`);
        return res.status(200).json({ success: true, message: "Unknown payment, acknowledged" });
      }

      // FIX: mapResultCode() already knows how to tell "insufficient balance"
      // (1), "cancelled by user" (1032), and "timed out" (1037) apart - it
      // just wasn't being called here, so every non-zero ResultCode collapsed
      // into a generic FAILED with no distinguishing reason.
      const mapped = mpesaService.mapResultCode(parsed.resultCode);
      const reason = parsed.success
        ? null
        : (parsed.resultDescription || mapped.reason || 'M-Pesa payment was not completed.');

      const result = await paymentService.processCallback({
        provider: 'mpesa',
        paymentId: intent._id,
        success: parsed.success,
        status: parsed.success ? 'COMPLETED' : mapped.status === 'cancelled' ? 'CANCELLED' : 'FAILED',
        amount: parsed.amount || intent.amount,
        currency: 'KES',
        providerData: { ...parsed, ResultDesc: reason },
        metadata: intent.metadata
      });

      return res.status(200).json({
        success: true,
        message: result.duplicate ? "Callback already processed" : "Payment callback processed.",
        data: result.payment
      });

    } catch (error) {
      console.error("MPESA Callback error:", error);
      return res.status(200).json({ success: false, message: "Error processing callback" });
    }
  }

  /**
   * GET /contributions/payments/:paymentIntentId/status
   */
  async getPaymentStatus(req, res, next) {
    try {
      const { paymentIntentId } = req.params;
      
      const intent = await PaymentIntent.findById(paymentIntentId).lean();
      if (!intent) throw new AppError("Payment not found", 404);
      if (String(intent.created_by) !== String(req.user._id)) throw new AppError("Not authorized", 403);

      // Once a { planId, period_key? } payment has settled, tell the member where
      // the money went: which months it cleared, what moved forward as an advance,
      // and anything nobody could absorb. Read-only, and never blocks the status.
      let allocation = null;
      if (String(intent.status).toLowerCase() === 'completed') {
        try {
          const payment = await ContributionPayment
            .findOne({ provider_payment_id: intent.provider_request_id })
            .select('metadata')
            .lean();
          const meta = payment?.metadata;
          if (meta?.allocation_applied) {
            allocation = {
              summary: meta.allocation_summary || null,
              lines: meta.allocations || [],
            };
          } else if (meta?.allocation_error) {
            allocation = { pending_review: true };
          }
        } catch {
          allocation = null;
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          id: intent._id,
          status: intent.status,
          amount: intent.amount,
          currency: intent.currency,
          reference: intent.reference,
          external_reference: intent.external_reference,
          completed_at: intent.completed_at,
          failure_reason: intent.failure_reason,
          allocation
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new ContributionPaymentController();