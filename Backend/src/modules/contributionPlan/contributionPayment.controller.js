/**
 * ============================================================================
 * CONTRIBUTION PAYMENT CONTROLLER - Finance Engine v2
 * ============================================================================
 */
import crypto from 'crypto';
import ContributionObligation from '../../models/ContributionObligation.js';
import PaymentIntent from '../../models/PaymentIntent.js';
import paymentService from "../../payment/payment.service.js";
import mpesaService from "../../payment/providers/mpesa/mpesa.service.js";
import AppError from '../../utils/AppError.js';
import { PAYMENT_PROVIDER } from '../../payment/payment.constants.js';

const generateUniqueReference = (displayRef) => {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${displayRef}-${ts}-${rand}`.slice(0, 100);
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

      if (!obligationId) return res.status(400).json({ success: false, message: "Contribution obligation is required." });
      if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: "Valid payment amount is required." });

      // FIX: Validate phone for MPESA
      if (paymentMethod === 'MPESA' && !phoneNumber) {
        return res.status(400).json({ success: false, message: "Phone number is required for M-Pesa payments." });
      }

      const key = idempotencyKey || crypto.createHash('sha256').update(`${userId}:${obligationId}:${amount}:${paymentMethod || 'cash'}`).digest('hex');

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
        data: result.payment,
        providerResponse: result.providerResponse
      });

    } catch (error) {
      if (error.code === 11000) {
        return res.status(200).json({
          success: true,
          message: "Payment already processed. Returning existing record.",
          duplicate: true,
          data: error.existingRecord || null
        });
      }
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

      const result = await paymentService.processCallback({
        provider: 'mpesa',
        paymentId: intent._id,
        success: parsed.success,
        status: parsed.success ? 'COMPLETED' : 'FAILED',
        amount: parsed.amount || intent.amount,
        currency: 'KES',
        providerData: parsed,
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
          failure_reason: intent.failure_reason
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new ContributionPaymentController();