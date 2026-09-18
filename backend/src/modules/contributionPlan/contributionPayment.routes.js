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

import {
    requireChamaMember
} from "../../middleware/chama.middleware.js";

import {
    requirePermission
} from "../../middleware/permission.middleware.js";

import ContributionObligation from "../../models/ContributionObligation.js";


const router = express.Router();


/**
 * Resolves the "owner" of the obligation being paid, so
 * requirePermission('contributions.record') can enforce 'own' scope for
 * plain members (they may only pay their own obligation) while treasurers
 * (scope 'all') can pay for any member.
 *
 * participant_id on ContributionObligation IS the ChamaMembership /
 * ContributionGroupMember id, which is exactly what req.membership._id
 * resolves to for the requester (see requireChamaMember) - so comparing
 * the two directly identifies "is this my own obligation?".
 */
const getObligationOwnerMembershipId = async (req) => {
    const obligationId = req.params.obligationId || req.body?.obligationId;
    if (!obligationId) return null;

    const obligation = await ContributionObligation
        .findById(obligationId)
        .select('participant_id')
        .lean();

    return obligation ? String(obligation.participant_id) : null;
};





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

    // Resolves req.chama + req.membership from body.obligationId (see
    // getChamaId() in chama.middleware.js) - required before
    // requirePermission can run, since this route has no :chamaId param.
    requireChamaMember,

    // 'own' scope (plain members) may only ever pay their own obligation;
    // 'all' scope (treasurer) may pay for any member. checkSelfAction is
    // off because "self" is exactly what we want to allow here - it's the
    // opposite of e.g. loans.approve where self-action is disallowed.
    requirePermission('contributions.record', {
        getResourceOwnerId: getObligationOwnerMembershipId,
        checkSelfAction: false,
    }),

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




/**
 * ============================================================================
 * PAYMENT / PIN-ENTRY STATUS (polled by the STK push modal)
 * ============================================================================
 *
 * GET
 *
 * /api/v1/contributions/payments/:paymentIntentId/status
 *
 * The frontend polls this every few seconds while showing "Waiting for
 * M-Pesa PIN...". It was never wired up here, so every poll 404'd, the
 * modal's fetch just fell into its "keep waiting" catch block, and the
 * member sat on the spinner until the 40-60s client-side countdown gave up
 * - even once the M-Pesa callback had already landed and FinanceEngine had
 * posted the payment on the backend.
 */

router.get(

    "/payments/:paymentIntentId/status",

    protect,

    contributionPaymentController.getPaymentStatus

);




export default router;