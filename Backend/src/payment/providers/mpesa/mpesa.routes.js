import express from 'express';

import {
  initiateContributionStkPush,
  handleMpesaCallback,
  handleB2cResult,
  queryMpesaPayment,
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
//
// Authenticated endpoint.
//
// A member initiates an M-Pesa payment for
// a ContributionObligation.
//
// ============================================================

router.post(
  "/contributions/stk-push",
  protect,
  initiateContributionStkPush
);


// ============================================================
// M-PESA CALLBACK
// ============================================================
//
// This endpoint is called by Safaricom.
//
// DO NOT protect this route with JWT authentication.
//
// Safaricom does not have your application's JWT.
//
// Provider callbacks must be secured through:
// - callback URL secrecy
// - provider identifiers
// - payment matching
// - idempotency
// - amount verification
// - phone verification
// - reconciliation
//
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
//
// This can later be restricted to:
// - internal service
// - admin
// - payment reconciliation worker
//
// For now it is exposed through the controller.
//
// ============================================================

router.post(
  "/query",
  protect,
  queryMpesaPayment
);


export default router;
