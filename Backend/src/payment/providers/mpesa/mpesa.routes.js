import express from 'express';

import {
  initiateContributionStkPush,
  handleMpesaCallback,
  handleB2cResult,
  queryMpesaPayment,
  getPaymentIntentStatus, // <-- ADD THIS
} from './mpesa.controller.js';

// ============================================================
// MIDDLEWARE
// ============================================================

import { protect } from '../../../middleware/auth.middleware.js';

// ============================================================
// ROUTER
// ============================================================

const router = express.Router();

// ============================================================
// MEMBER PAYMENT
// ============================================================

router.post(
  "/contributions/stk-push",
  protect,
  initiateContributionStkPush
);

// ============================================================
// PAYMENT INTENT STATUS - FOR FRONTEND POLLING
// ============================================================

router.get(
  "/payment-intents/:paymentIntentId",
  protect,
  getPaymentIntentStatus
);

// ============================================================
// M-PESA CALLBACK
// ============================================================

router.post(
  "/callback",
  handleMpesaCallback
);

router.post(
  "/b2c/result",
  handleB2cResult
);

// ============================================================
// STK QUERY
// ============================================================

router.post(
  "/query",
  protect,
  queryMpesaPayment
);

export default router;