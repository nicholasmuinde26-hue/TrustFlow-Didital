import mpesaService from "./mpesa.service.js";

import {
  initiateMpesaContributionPayment,
  processMpesaCallback
} from "../payment.service.js";

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

      const result =
        await paymentService.initiateMpesaContributionPayment({
          userId,

          contributionObligationId,

          amount,

          phoneNumber,

          accountReference,

          transactionDescription,

          idempotencyKey,
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

      await paymentService.processMpesaCallback({
        callback,
      });

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