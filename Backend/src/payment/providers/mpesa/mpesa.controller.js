import mpesaService from "./mpesa.service.js";
import ContributionObligation from '../../../models/ContributionObligation.js';
import ChamaMembership from '../../../models/ChamaMembership.js';
import ContributionGroupMember from '../../../models/ContributionGroupMember.js';
import AppError from '../../../utils/AppError.js';


import { reconcileB2cResult, reconcileStkCallback } from '../../../modules/business/business.service.js';

import MpesaAttempt from '../../../models/MpesaAttempt.js';
import contributionPaymentService from '../../../modules/contributionPlan/contributionPayment.service.js';
import { reconcileSavingsCallback, maybeCreateMgrPayoutForChama } from '../../../modules/chama/chamaFinance.service.js';
import loanRepayment from '../../../modules/loans/loanRepayment.service.js';

/**
 * ============================================================
 * M-PESA CONTROLLER
 * ============================================================
 *
 * HTTP boundary for M-Pesa payment operations.
 *
 * Responsibilities:
 *
 * 1. Receive authenticated member payment requests
 * 2. Validate request input
 * 3. Delegate STK initiation
 * 4. Receive Safaricom callbacks
 * 5. Parse callback payload
 * 6. Delegate callback processing
 *
 * NOT responsible for:
 *
 * - Updating ContributionPayment directly
 * - Updating ContributionObligation directly
 * - Creating FinancialTransaction directly
 * - Posting ledger entries
 * - Updating financial account balances
 *
 * All financial state changes must happen through
 * the payment/contribution payment services.
 *
 * ============================================================
 */


/**
 * ============================================================
 * INITIATE CONTRIBUTION PAYMENT
 * ============================================================
 *
 * POST
 * /api/v1/mpesa/contributions/stk-push
 *
 * Expected request body:
 *
 * {
 *   contributionObligationId,
 *   amount,
 *   phoneNumber
 * }
 *
 * Optional:
 *
 * {
 *   accountReference,
 *   transactionDescription,
 *   idempotencyKey
 * }
 *
 * ============================================================
 */

export const initiateContributionStkPush =
  async (req, res, next) => {
    try {
      const {
        contributionObligationId,
        amount,
        phoneNumber,
        accountReference,
        transactionDescription,
        idempotencyKey,
      } = req.body;

      // --------------------------------------------------------
      // BASIC INPUT VALIDATION
      // --------------------------------------------------------

      if (!contributionObligationId) {
        return res.status(400).json({
          success: false,
          message:
            "Contribution obligation ID is required",
        });
      }

      if (
        amount === undefined ||
        amount === null
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Payment amount is required",
        });
      }

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          message:
            "M-Pesa phone number is required",
        });
      }

      // --------------------------------------------------------
      // AUTHENTICATED USER
      // --------------------------------------------------------

      /**
       * We expect authentication middleware to populate:
       *
       * req.user
       *
       * Depending on your auth implementation, this may be:
       *
       * req.user.id
       * req.user._id
       * req.user.userId
       *
       * We normalize it here.
       */

      const userId =
        req.user?.id ||
        req.user?._id ||
        req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message:
            "Authenticated user is required",
        });
      }

      // --------------------------------------------------------
      // INITIATE PAYMENT
      // --------------------------------------------------------

      const obligation = await ContributionObligation.findById(contributionObligationId).lean();
      if (!obligation) throw new AppError('Contribution obligation not found', 404);

      const membership = obligation.owner_type === 'Chama'
        ? await ChamaMembership.findOne({ chama_id: obligation.owner_id, user_id: userId, status: 'active' }).lean()
        : await ContributionGroupMember.findOne({ contribution_group_id: obligation.owner_id, user_id: userId, status: 'active' }).lean();
      const permitted = obligation.owner_type === 'Chama'
        // The treasurer may send an STK prompt to a member, but the completed
        // payment is still posted against that member's obligation.
        ? Boolean(membership && (String(obligation.participant_id) === String(membership._id) || membership.role === 'treasurer'))
        : ['organizer', 'co_organizer'].includes(membership?.role);
      if (!permitted) throw new AppError('Only the workspace financial manager can initiate this payment', 403);

      const result = await mpesaService.initiateStkPush({
        amount,
        phoneNumber,
        accountReference: accountReference || `CONTRIBUTION-${String(obligation._id).slice(-8)}`,
        transactionDescription: transactionDescription || 'Chama contribution',
      });

      await MpesaAttempt.create({
        obligation_id: obligation._id,
        amount,
        phone_number: mpesaService.normalizePhoneNumber(phoneNumber),
        initiated_by: userId,
        checkout_request_id: result.checkoutRequestId,
        merchant_request_id: result.merchantRequestId,
      });

      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      return res.status(200).json({
        success: true,

        message:
          result.message ||
          "M-Pesa STK Push initiated successfully",

        data: result.data ||
          result,
      });

    } catch (error) {
      next(error);
    }
  };


/**
 * ============================================================
 * M-PESA CALLBACK
 * ============================================================
 *
 * POST
 * /api/v1/mpesa/callback
 *
 * Safaricom sends the callback here after STK processing.
 *
 * IMPORTANT:
 *
 * This endpoint must NOT directly modify financial data.
 *
 * It:
 *
 * 1. Accepts callback
 * 2. Parses callback
 * 3. Delegates processing
 * 4. Returns quickly to Safaricom
 *
 * ============================================================
 */

export const handleMpesaCallback =
  async (req, res, next) => {
    try {
      // --------------------------------------------------------
      // CAPTURE RAW CALLBACK
      // --------------------------------------------------------

      const callbackBody =
        req.body;

      // --------------------------------------------------------
      // PARSE CALLBACK
      // --------------------------------------------------------

      const callback =
        mpesaService.parseStkCallback(
          callbackBody
        );

      // Chama self-service savings attempts own a PaymentIntent and must be
      // reconciled exactly once before falling back to legacy contribution flow.
      if (await reconcileSavingsCallback(callback)) {
        return res.status(200).json({ ResultCode: 0, ResultDesc: 'Savings payment processed' });
      }

      if (await reconcileStkCallback(callback)) {
        return res.status(200).json({
          ResultCode: 0,
          ResultDesc: "Business payment processed",
        });
      }

      const attempt = await MpesaAttempt.findOne({ checkout_request_id: callback.checkoutRequestId });
      if (attempt && attempt.status === "pending") {
        if (callback.success && Number(callback.amount) === Number(attempt.amount.toString())) {
          await contributionPaymentService.processPayment({
            obligationId: attempt.obligation_id,
            amount: callback.amount,
            paymentMethod: "mpesa",
            processingMode: "webhook",
            createdBy: attempt.initiated_by,
          });
          const obligation = await ContributionObligation.findById(attempt.obligation_id).lean();
          if (obligation?.owner_type === 'Chama') {
            await maybeCreateMgrPayoutForChama(obligation.owner_id, attempt.initiated_by);
          }
          attempt.status = "completed";
          attempt.mpesa_receipt_number = callback.mpesaReceiptNumber;
        } else {
          attempt.status = "failed";
        }
        await attempt.save();
      }

      // --------------------------------------------------------
      // PROCESS CALLBACK
      // --------------------------------------------------------

      /**
       * The payment service owns the business workflow.
       *
       * It should:
       *
       * - Locate payment
       * - Verify CheckoutRequestID
       * - Verify MerchantRequestID
       * - Verify expected amount
       * - Verify expected phone
       * - Check idempotency
       * - Transition payment state
       * - Trigger Finance Engine only once
       */

      // The provider callback is accepted here. The matching payment is
      // reconciled by the contribution-payment workflow after verification.
      // Keep the parsed value available for the reconciliation worker.
      console.info('M-Pesa callback received', callback.checkoutRequestId);

      // --------------------------------------------------------
      // ACKNOWLEDGE CALLBACK
      // --------------------------------------------------------

      return res.status(200).json({
        ResultCode: 0,

        ResultDesc:
          "Callback processed successfully",
      });

    } catch (error) {

      /**
       * IMPORTANT:
       *
       * We still acknowledge the callback to avoid
       * uncontrolled provider retries.
       *
       * The actual failure should be logged and handled
       * internally through monitoring/reconciliation.
       */

      console.error(
        "M-Pesa callback processing error:",
        error
      );

      return res.status(200).json({
        ResultCode: 0,

        ResultDesc:
          "Callback received",
      });
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
 *
 * POST
 * /api/v1/mpesa/query
 *
 * This endpoint is useful when:
 *
 * - Callback was delayed
 * - Callback was lost
 * - Payment remains pending
 * - Reconciliation process checks provider status
 *
 * IMPORTANT:
 *
 * Querying M-Pesa does not itself post money.
 *
 * The result must still pass through the same
 * payment completion pipeline.
 *
 * ============================================================
 */

export const queryMpesaPayment =
  async (req, res, next) => {
    try {
      const {
        checkoutRequestId,
      } = req.body;

      if (!checkoutRequestId) {
        return res.status(400).json({
          success: false,
          message:
            "CheckoutRequestID is required",
        });
      }

      const result =
        await mpesaService.queryStkPush({
          checkoutRequestId,
        });

      return res.status(200).json({
        success: true,

        data: result,
      });

    } catch (error) {
      next(error);
    }
  };