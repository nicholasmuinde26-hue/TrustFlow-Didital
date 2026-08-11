import crypto from 'node:crypto';

import mpesaService from "./mpesa.service.js";
import ContributionObligation from '../../../models/ContributionObligation.js';
import ChamaMembership from '../../../models/ChamaMembership.js';
import ContributionGroupMember from '../../../models/ContributionGroupMember.js';
import PaymentIntent from '../../../models/PaymentIntent.js';
import AppError from '../../../utils/AppError.js';

import { reconcileB2cResult, reconcileStkCallback } from '../../../modules/business/business.service.js';
import MpesaAttempt from '../../../models/MpesaAttempt.js';
import paymentService from '../../../payment/payment.service.js'; // REMOVED contributionPaymentService
import { reconcileSavingsCallback, maybeCreateMgrPayoutForChama } from '../../../modules/chama/chamaFinance.service.js';

// helper to generate unique reference for DB
const generateUniqueReference = (displayRef) => {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${displayRef}-${ts}-${rand}`.slice(0, 100);
};

// helper to record that a callback was received, WITHOUT deciding the
// final status. The actual status transition to 'completed' must only
// happen after the payment has actually been posted to the ledger
const recordCallbackReceipt = async (checkoutRequestId, callback) => {
  const intent = await PaymentIntent.findOne({ provider_request_id: checkoutRequestId });
  if (!intent) return;

  intent.provider_response = callback.rawCallback;
  if (!callback.success) {
    intent.status = 'failed';
    intent.failure_reason = callback.resultDescription;
    intent.failure_code = callback.resultCode !== undefined ? String(callback.resultCode) : intent.failure_code;
    intent.failed_at = new Date();
  }
  await intent.save();
};

/**
 * ============================================================
 * M-PESA CONTROLLER
 * ============================================================
 */
export const initiateContributionStkPush = async (req, res, next) => {
  try {
    const {
      contributionObligationId,
      amount,
      phoneNumber,
      accountReference,
      transactionDescription,
      idempotencyKey,
    } = req.body;

    if (!contributionObligationId) {
      return res.status(400).json({ success: false, message: "Contribution obligation ID is required" });
    }
    if (amount === undefined || amount === null) {
      return res.status(400).json({ success: false, message: "Payment amount is required" });
    }
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: "M-Pesa phone number is required" });
    }

    const userId = req.user?.id || req.user?._id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authenticated user is required" });
    }

    const obligation = await ContributionObligation.findById(contributionObligationId);
    if (!obligation) throw new AppError('Contribution obligation not found', 404);

    const membership = obligation.owner_type === 'Chama'
      ? await ChamaMembership.findOne({ chama_id: obligation.owner_id, user_id: userId, status: 'active' }).lean()
      : await ContributionGroupMember.findOne({ contribution_group_id: obligation.owner_id, user_id: userId, status: 'active' }).lean();

    const isSelf = Boolean(membership && String(obligation.participant_id) === String(membership._id));
    const isTreasurer = Boolean(membership && membership.role === 'treasurer');
    const permitted = obligation.owner_type === 'Chama' ? (isSelf || isTreasurer) : ['organizer', 'co_organizer'].includes(membership?.role);
    if (!permitted) throw new AppError('You are not permitted to initiate this payment', 403);

    const key = idempotencyKey || req.get('Idempotency-Key') || crypto.randomUUID();
    const existingIntent = await PaymentIntent.findOne({ idempotency_key: key });
    if (existingIntent) {
      return res.status(200).json({
        success: true,
        message: 'Existing payment request returned',
        data: { paymentIntent: existingIntent },
      });
    }

    const normalizedPhone = mpesaService.normalizePhoneNumber(phoneNumber);
    const temporaryRequestId = `pending_${crypto.randomUUID()}`;

    const displayRef = (accountReference || `CONTRIB`).slice(0, 20);
    const uniqueRef = generateUniqueReference(displayRef);

    const intent = await PaymentIntent.create({
      obligation_id: obligation._id,
      plan_id: obligation.plan_id,
      owner_type: obligation.owner_type,
      owner_id: obligation.owner_id,
      participant_type: obligation.participant_type,
      participant_id: obligation.participant_id,
      amount,
      currency: obligation.currency || 'KES',
      payment_method: 'mpesa',
      phone_number: normalizedPhone,
      reference: uniqueRef,
      display_reference: displayRef,
      idempotency_key: key,
      provider: 'mpesa',
      provider_request_id: temporaryRequestId,
      status: 'pending',
      created_by: userId,
      metadata: { // ADD THIS for finance engine
        productType: 'CONTRIBUTION',
        chamaId: obligation.owner_id,
        obligationId: obligation._id
      }
    });

    try {
      const result = await mpesaService.initiateStkPush({
        amount,
        phoneNumber: normalizedPhone,
        accountReference: intent.reference,
        displayReference: intent.display_reference,
        transactionDescription: transactionDescription || 'Chama contribution',
      });

      intent.provider_request_id = result.checkoutRequestId;
      intent.provider_response_id = result.merchantRequestId;
      intent.provider_response = result.rawResponse;
      intent.status = 'processing';
      await intent.save();

      await MpesaAttempt.create({
        obligation_id: obligation._id,
        payment_intent_id: intent._id,
        amount,
        phone_number: normalizedPhone,
        initiated_by: userId,
        checkout_request_id: result.checkoutRequestId,
        merchant_request_id: result.merchantRequestId,
      });

      return res.status(200).json({
        success: true,
        message: result.customerMessage || 'M-Pesa STK Push initiated successfully',
        data: { paymentIntent: intent, stk: result },
      });
    } catch (error) {
      intent.status = 'failed';
      intent.failure_reason = error.message;
      intent.failed_at = new Date();
      await intent.save();
      throw error;
    }

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Duplicate payment detected. Please wait 10 seconds and try again." });
    }
    next(error);
  }
};

/**
 * ============================================================
 * M-PESA CALLBACK - FULLY REFACTORED
 * ============================================================
 */
export const handleMpesaCallback = async (req, res, next) => {
  try {
    const callbackBody = req.body;
    const callback = mpesaService.parseStkCallback(callbackBody);

    // Record receipt of the callback
    await recordCallbackReceipt(callback.checkoutRequestId, callback);

    // 1. Try savings first
    if (await reconcileSavingsCallback(callback)) {
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Savings payment processed' });
    }

    // 2. Try business/other
    if (await reconcileStkCallback(callback)) {
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Business payment processed" });
    }

    // 3. FALLBACK: Generic CONTRIBUTION/MGR payment via central paymentService
    const attempt = await MpesaAttempt.findOne({ checkout_request_id: callback.checkoutRequestId, status: 'pending' });
    if (attempt) {
      if (callback.success && Number(callback.amount) === Number(attempt.amount.toString())) {
        const obligation = await ContributionObligation.findById(attempt.obligation_id).lean();
        const intent = await PaymentIntent.findById(attempt.payment_intent_id);

        // NEW: Route through paymentService instead of contributionPaymentService
        const result = await paymentService.processCallback({
          provider: 'mpesa',
          paymentId: intent._id,
          success: true,
          status: 'COMPLETED',
          amount: callback.amount,
          currency: 'KES',
          providerData: {
            CheckoutRequestID: callback.checkoutRequestId,
            MpesaReceiptNumber: callback.mpesaReceiptNumber,
            PhoneNumber: callback.phoneNumber,
            Amount: callback.amount,
            rawCallback: callback.rawCallback
          },
          metadata: {
            productType: obligation?.plan_id ? 'CONTRIBUTION' : 'MGR', // infer product
            chamaId: intent.owner_id,
            obligationId: attempt.obligation_id,
            paymentIntentId: intent._id,
            memberId: intent.participant_id
          }
        });

        if (obligation?.owner_type === 'Chama') {
          await maybeCreateMgrPayoutForChama(obligation.owner_id, attempt.initiated_by);
        }

        attempt.status = "completed";
        attempt.mpesa_receipt_number = callback.mpesaReceiptNumber;
        await attempt.save();

        await PaymentIntent.findOneAndUpdate(
          { provider_request_id: callback.checkoutRequestId },
          {
            status: 'completed',
            completed_at: new Date(),
            external_reference: callback.mpesaReceiptNumber,
            financial_transaction_id: result?.payment?.financialTransactionId || null,
            journal_id: result?.payment?.journalId || null
          }
        );
      } else {
        attempt.status = "failed";
        await attempt.save();

        await PaymentIntent.findOneAndUpdate(
          { provider_request_id: callback.checkoutRequestId },
          {
            status: 'failed',
            failed_at: new Date(),
            failure_reason: callback.success
              ? 'The amount confirmed by M-Pesa did not match the requested contribution amount.'
              : (callback.resultDescription || 'M-Pesa payment failed.')
          }
        );
      }

      return res.status(200).json({ ResultCode: 0, ResultDesc: "Contribution payment processed" });
    }

    console.info('M-Pesa callback received', callback.checkoutRequestId);
    return res.status(200).json({ ResultCode: 0, ResultDesc: "Callback processed successfully" });

  } catch (error) {
    console.error("M-Pesa callback processing error:", {
      checkoutRequestId: req.body?.Body?.stkCallback?.CheckoutRequestID,
      message: error.message,
      stack: error.stack,
    });
    return res.status(200).json({ ResultCode: 0, ResultDesc: "Callback received" });
  }
};

export const handleB2cResult = async (req, res) => {
  try {
    await reconcileB2cResult(req.body);
  } catch (error) {
    console.error("M-Pesa B2C result processing error:", error);
  }
  return res.status(200).json({ ResultCode: 0, ResultDesc: "Result received" });
};

/**
 * ============================================================
 * QUERY STK PAYMENT
 * ============================================================
 */
export const queryMpesaPayment = async (req, res, next) => {
  try {
    const { checkoutRequestId } = req.body;
    if (!checkoutRequestId) {
      return res.status(400).json({ success: false, message: "CheckoutRequestID is required" });
    }

    const result = await mpesaService.queryStkPush({ checkoutRequestId });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================================
 * GET PAYMENT INTENT STATUS - FOR FRONTEND POLLING
 * ============================================================
 */
export const getPaymentIntentStatus = async (req, res, next) => {
  try {
    const { paymentIntentId } = req.params;

    const intent = await PaymentIntent.findById(paymentIntentId).lean();
    if (!intent) {
      return res.status(404).json({ success: false, message: "Payment intent not found" });
    }

    const userId = req.user?.id || req.user?._id || req.user?.userId;
    if (String(intent.created_by) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: intent._id,
        status: intent.status,
        amount: intent.amount,
        currency: intent.currency,
        reference: intent.reference,
        display_reference: intent.display_reference,
        provider_request_id: intent.provider_request_id,
        completed_at: intent.completed_at,
        failure_reason: intent.failure_reason
      }
    });
  } catch (error) {
    next(error);
  }
};