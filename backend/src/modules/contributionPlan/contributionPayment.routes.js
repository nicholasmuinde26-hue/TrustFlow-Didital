/**
 * ============================================================================
 * CONTRIBUTION PAYMENT ROUTES
 * ============================================================================
 *
 * API routes for contribution payments.
 *
 * Responsibilities
 * ----------------
 * ✓ Define endpoints
 * ✓ Attach middleware
 * ✓ Connect controllers
 *
 * DOES NOT
 * --------
 * ✗ Process payments
 * ✗ Validate business rules
 * ✗ Handle accounting
 *
 * ============================================================================
 */


import express from "express";


import contributionPaymentController
    from "./contributionPayment.controller.js";

import {
    protect
} from "../../middleware/auth.middleware.js";


const router = express.Router();





/**
 * ============================================================================
 * CREATE MANUAL PAYMENT
 * ============================================================================
 *
 * POST
 *
 * /api/v1/contributions
 *
 * Requires authentication.
 *
 * Example:
 *
 * {
 *    obligationId:"123",
 *    amount:500,
 *    paymentMethod:"MPESA"
 * }
 *
 */


router.post(

    "/",

    protect,

    contributionPaymentController.createPayment

);







/**
 * ============================================================================
 * PAYMENT PROVIDER CALLBACK
 * ============================================================================
 *
 * POST
 *
 * /api/v1/contributions/callback
 *
 *
 * External providers:
 *
 * M-Pesa
 * Banks
 * Payment gateways
 *
 */


router.post(

    "/callback",

    contributionPaymentController.paymentCallback

);






export default router;