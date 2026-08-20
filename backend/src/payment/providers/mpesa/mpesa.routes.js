import express from 'express';

import {
  initiateStkPush, // RENAMED: was initiateContributionStkPush
  handleMpesaCallback,
  handleB2cResult,
  queryMpesaPayment,
  getPaymentIntentStatus,
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
// MEMBER PAYMENT - GENERIC STK PUSH
// ============================================================
// Body must include: { amount, phoneNumber, productType: 'savings' | 'contribution' | 'mgr', ...ids }
// productType tells PaymentEngine/FinanceEngine how to route the GL
router.post(
  "/stk-push",
  protect,
  initiateStkPush
);

// Backward compatibility for old frontend
router.post(
  "/contributions/stk-push",
  protect,
  initiateStkPush
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
// M-PESA CALLBACKS - PUBLIC, NO AUTH
// ============================================================

router.post(
  "/callback",
  express.json({ limit: '1mb' }), // Saf sends big payload
  handleMpesaCallback
);

router.post(
  "/b2c/result",
  express.json({ limit: '1mb' }),
  handleB2cResult
);

// ============================================================
// STK QUERY - FOR MANUAL RECONCILE BUTTON
// ============================================================

router.post(
  "/query",
  protect,
  queryMpesaPayment
);

export default router;