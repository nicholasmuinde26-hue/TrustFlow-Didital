import crypto from 'node:crypto';
import ContributionObligation from '../../../models/ContributionObligation.js';
import ChamaMembership from '../../../models/ChamaMembership.js';
import ContributionGroupMember from '../../../models/ContributionGroupMember.js';
import ContributionGroup from '../../../models/ContributionGroup.js';
import Business from '../../../models/Business.js';
import PaymentIntent from '../../../models/PaymentIntent.js';
import AppError from '../../../utils/AppError.js';

import { reconcileB2cResult, reconcileStkCallback } from '../../../modules/business/business.service.js';
import { confirmMpesaDisbursement } from '../../../modules/loans/Loandisbursement.service.js';
import { maybeCreateMgrPayoutForChama } from '../../../modules/chama/chamaFinance.service.js'; 
import MpesaAttempt from '../../../models/MpesaAttempt.js';
import paymentService from '../../../payment/payment.service.js';
import phoneUtil from '../../../utils/phone.js';

const generateUniqueReference = (displayRef) => {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${displayRef}-${ts}-${rand}`.slice(0, 100);
};

export const initiateStkPush = async (req, res, next) => {
  try {
    const {
      amount,
      phoneNumber,
      productType = 'contribution', // 'savings' | 'contribution' | 'mgr'
      chamaId,
      workspaceId,
      groupId,
      obligationId,
      planId,
      accountReference,
      transactionDescription,
      idempotencyKey,
    } = req.body;

    if (!amount) throw new AppError("Payment amount is required", 400);
    if (!phoneNumber) throw new AppError("M-Pesa phone number is required", 400);

    const userId = req.user?.id || req.user?._id;
    if (!userId) throw new AppError("Authenticated user is required", 401);

    const targetWorkspaceId = chamaId || workspaceId || groupId;
    if (!targetWorkspaceId) throw new AppError("Workspace ID is required", 400);

    let ownerType = "Chama";
    let ownerId = targetWorkspaceId;
    let participantType = "ChamaMembership";
    let participantId = null;

    // 1. Try Chama membership
    const chamaMembership = await ChamaMembership.findOne({ chama_id: targetWorkspaceId, user_id: userId, status: 'active' }).lean();
    if (chamaMembership) {
      ownerType = "Chama";
      participantType = "ChamaMembership";
      participantId = chamaMembership._id;
    } else {
      // 2. Try ContributionGroup membership or group creator
      let groupMembership = await ContributionGroupMember.findOne({ contribution_group_id: targetWorkspaceId, user_id: userId, status: 'active' }).lean();
      if (!groupMembership) {
        const groupCreated = await ContributionGroup.findOne({ _id: targetWorkspaceId, created_by: userId }).lean();
        if (groupCreated) {
          groupMembership = await ContributionGroupMember.findOneAndUpdate(
            { contribution_group_id: targetWorkspaceId, user_id: userId },
            { contribution_group_id: targetWorkspaceId, user_id: userId, role: 'organizer', status: 'active' },
            { upsert: true, new: true }
          ).lean();
        }
      }

      if (groupMembership) {
        ownerType = "ContributionGroup";
        participantType = "ContributionGroupMember";
        participantId = groupMembership._id;
      } else {
        // 3. Try Business
        const business = await Business.findOne({ _id: targetWorkspaceId, created_by: userId }).lean();
        if (business) {
          ownerType = "Business";
          participantType = "User";
          participantId = userId;
        } else {
          throw new AppError("You are not an active member of this workspace", 403);
        }
      }
    }

    let resolvedPlanId = planId;
    if (!resolvedPlanId && obligationId) {
      const obligation = await ContributionObligation.findById(obligationId).select('plan_id').lean();
      if (obligation) {
        resolvedPlanId = obligation.plan_id;
      }
    }

    const key = idempotencyKey || req.get('Idempotency-Key') || crypto.randomUUID();
    const normalizedPhone = phoneUtil.normalize(phoneNumber);
    const displayRef = (accountReference || `${ownerType.toUpperCase().slice(0, 5)}-${productType.toUpperCase()}`).slice(0, 20);
    const uniqueRef = generateUniqueReference(displayRef);

    const result = await paymentService.initiate({
        amount,
        currency: 'KES',
        type: productType,
        chamaId: targetWorkspaceId,
        ownerId: targetWorkspaceId,
        ownerType,
        obligationId: obligationId || null,
        planId: resolvedPlanId || null,
        participantId,
        participantType,
        phoneNumber: normalizedPhone,
        actorId: userId,
        provider: 'mpesa',
        reference: uniqueRef,
        displayReference: displayRef,
        description: transactionDescription || `${ownerType} ${productType} payment`,
        idempotencyKey: key
    });

    await MpesaAttempt.create({
        obligation_id: obligationId || null,
        payment_intent_id: result.paymentIntentId,
        amount,
        phone_number: normalizedPhone,
        initiated_by: userId,
        checkout_request_id: result.checkoutRequestId,
        status: 'pending'
    });

    return res.status(202).json({
        success: true,
        message: result.providerResponse.customerMessage || 'M-Pesa STK Push initiated successfully',
        data: { 
            paymentIntentId: result.paymentIntentId,
            paymentId: result.paymentId,
            reference: result.reference,
            checkoutRequestId: result.checkoutRequestId,
            customerMessage: result.providerResponse.customerMessage
        },
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Duplicate payment detected. Please wait 10 seconds and try again." });
    }
    next(error);
  }
};

export const initiateContributionStkPush = initiateStkPush;

/**
 * ============================================================
 * M-PESA CALLBACK - LET PAYMENT SERVICE HANDLE EVERYTHING
 * ============================================================
 */
export const handleMpesaCallback = async (req, res) => {
  try {
    const callbackBody = req.body;
    const stk = callbackBody?.Body?.stkCallback;
    
    // 1. Let PaymentService process it. It updates Intent, Payment, and EMITS PAYMENT_COMPLETED event
    // FinanceEngine listens to that event and posts GL for savings/contrib/mgr automatically
    await paymentService.handleCallback(callbackBody);

    // 2. Update MpesaAttempt for UI tracking only
    if (stk?.CheckoutRequestID) {
      const success = Number(stk.ResultCode) === 0;
      const receipt = stk.CallbackMetadata?.Item?.find(i => i.Name === 'MpesaReceiptNumber')?.Value || null;
      
      await MpesaAttempt.findOneAndUpdate(
        { checkout_request_id: stk.CheckoutRequestID },
        { 
            status: success ? 'completed' : 'failed',
            mpesa_receipt_number: receipt,
            result_description: stk.ResultDesc
        }
      ).catch(() => {});

      // 2b. Business POS sales don't go through PaymentIntent at all (see
      // business.service.js) - paymentService.handleCallback() above is a
      // no-op for them. This is the only place their STK callback ever
      // reconciles, so try it unconditionally; it's a safe no-op when the
      // CheckoutRequestID doesn't belong to a pending BusinessTransaction.
      const amount = stk.CallbackMetadata?.Item?.find(i => i.Name === 'Amount')?.Value ?? null;
      await reconcileStkCallback({
        checkoutRequestId: stk.CheckoutRequestID,
        amount,
        success,
        mpesaReceiptNumber: receipt,
        reason: stk.ResultDesc,
      }).catch((error) => {
        console.error("Business STK callback reconciliation error:", error.message);
      });
    }

    // 3. Legacy: Check if MGR round is complete and trigger payout
    const intent = await PaymentIntent.findOne({ provider_request_id: stk?.CheckoutRequestID }).lean();
    if (intent?.type === 'mgr' && intent.status === 'completed') {
        await maybeCreateMgrPayoutForChama(intent.owner_id, intent.created_by).catch(() => null);
    }

    return res.status(200).json({ ResultCode: 0, ResultDesc: "Callback processed successfully" });

  } catch (error) {
    console.error("M-Pesa callback processing error:", error.message);
    // Safaricom requires 200 even on error or they will retry 7 times
    return res.status(200).json({ ResultCode: 0, ResultDesc: "Callback received" });
  }
};

export const handleB2cResult = async (req, res) => {
  try {
    const result = req.body;
    const conversationId = result?.Result?.ConversationID;
    const success = Number(result?.Result?.ResultCode) === 0;
    const failureReason = result?.Result?.ResultDesc;

    // A single B2C ResultURL is shared by business/MGR payouts and loan
    // disbursements — Safaricom has no way to tell us which domain a given
    // payout belongs to, so we try the business-transaction match first and
    // fall back to the loan match when it doesn't hit. Without this fallback
    // a loan disbursement's B2C confirmation was silently dropped and the
    // loan stayed stuck in "disbursement_pending" (Processing...) forever,
    // even though Safaricom had already settled the payout.
    const handledAsBusinessPayout = await reconcileB2cResult(result);
    if (!handledAsBusinessPayout && conversationId) {
      await confirmMpesaDisbursement({ conversationId, success, failureReason }).catch((error) => {
        console.error("M-Pesa B2C loan disbursement reconciliation error:", error);
      });
    }
  } catch (error) {
    console.error("M-Pesa B2C result processing error:", error);
  }
  return res.status(200).json({ ResultCode: 0, ResultDesc: "Result received" });
};

/**
 * Result callback for queryTransactionStatus() (mpesa.service.js). Only the
 * loan disbursement reconciliation sweep (loanDisbursementReconciliation.job.js)
 * ever triggers that query today, so this only needs to resolve loans — but
 * the same ResultParameters.ConversationID trick would work for business
 * B2C payouts too if that ever needs the same backstop.
 */
export const handleTransactionStatusResult = async (req, res) => {
  try {
    const result = req.body?.Result;
    const params = result?.ResultParameters?.ResultParameter || [];
    const findParam = (key) => params.find((p) => p.Key === key)?.Value;

    // The original B2C transaction's own ConversationID is nested inside
    // ResultParameters here, not at the top level (the top-level
    // ConversationID/OriginatorConversationID belong to this status QUERY,
    // not the transaction being queried) — this is what actually matches
    // `loan.disbursement.provider_reference`.
    const originalConversationId = findParam('ConversationID');
    const transactionStatus = findParam('TransactionStatus'); // e.g. "Completed"
    const queryResultCode = Number(result?.ResultCode);

    if (originalConversationId) {
      const success = queryResultCode === 0 && transactionStatus === 'Completed';
      const failureReason = !success
        ? (transactionStatus ? `M-Pesa reports transaction status: ${transactionStatus}` : result?.ResultDesc || 'Transaction status query indicates the disbursement did not complete')
        : undefined;

      await confirmMpesaDisbursement({ conversationId: originalConversationId, success, failureReason }).catch((error) => {
        console.error("M-Pesa transaction-status loan reconciliation error:", error);
      });
    }
  } catch (error) {
    console.error("M-Pesa transaction status result processing error:", error);
  }
  return res.status(200).json({ ResultCode: 0, ResultDesc: "Result received" });
};

/** Safaricom hits this if the transaction-status query itself times out in the queue. Nothing to reconcile from a timeout — the sweep will simply retry this loan on its next pass. */
export const handleTransactionStatusTimeout = async (_req, res) => {
  return res.status(200).json({ ResultCode: 0, ResultDesc: "Timeout received" });
};

export const queryMpesaPayment = async (req, res, next) => {
  try {
    const { checkoutRequestId } = req.body;
    if (!checkoutRequestId) return res.status(400).json({ success: false, message: "CheckoutRequestID is required" });
    const result = await paymentService.query({ provider: 'mpesa', checkoutRequestId });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getPaymentIntentStatus = async (req, res, next) => {
  try {
    const { paymentIntentId } = req.params;
    const intent = await PaymentIntent.findById(paymentIntentId).lean();
    if (!intent) return res.status(404).json({ success: false, message: "Payment intent not found" });
    const userId = req.user?.id || req.user?._id;
    if (String(intent.created_by) !== String(userId)) return res.status(403).json({ success: false, message: "Not authorized" });

    return res.status(200).json({ success: true, data: intent });
  } catch (error) {
    next(error);
  }
};