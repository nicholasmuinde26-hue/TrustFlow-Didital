import express from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import { requireChamaMember, requireChamaTreasurer } from '../../middleware/chama.middleware.js';
import {
  createPolicyController,
  activatePolicyController,
  updatePolicyController,
  getDashboardOverviewController,
  getChamaMgrMembersController,
  getChamaContributionsController,
  proposePayoutController,
  disbursePayoutController,
  recordPaymentController,
  reorderRotationController,
  sendRemindersController,
} from './mgr.controller.js';

const router = express.Router();

router.use(protect);

// ────────────────────────────────────────────────────────────
// MEMBER-ACCESSIBLE (any active Chama member)
// ────────────────────────────────────────────────────────────

// Full MGR command-center dashboard
router.get('/overview/:chamaId', requireChamaMember, getDashboardOverviewController);

// Fetch all active Chama members for the wizard participant picker
router.get('/members/:chamaId', requireChamaMember, getChamaMgrMembersController);

// Chama-scoped contributions: plans + per-member obligation overview
router.get('/contributions/:chamaId', requireChamaMember, getChamaContributionsController);

// ────────────────────────────────────────────────────────────
// TREASURER-ONLY ROUTES
// ────────────────────────────────────────────────────────────

// Create a new MGR Policy draft
router.post(
  '/policy/:chamaId',
  requireChamaMember,
  requireChamaTreasurer,
  createPolicyController
);

// Edit an MGR Policy
router.patch(
  '/policy/:chamaId/:policyId',
  requireChamaMember,
  requireChamaTreasurer,
  updatePolicyController
);

// Send payment reminders for current round
router.post(
  '/rounds/:roundId/send-reminders',
  requireChamaMember,
  requireChamaTreasurer,
  sendRemindersController
);

// Activate a draft policy → generates all MgrRound objects
router.post(
  '/policy/:chamaId/:policyId/activate',
  requireChamaMember,
  requireChamaTreasurer,
  activatePolicyController
);

// Reorder payout rotation positions (authorized change, audit-logged)
router.patch(
  '/policy/:chamaId/:policyId/reorder',
  requireChamaMember,
  requireChamaTreasurer,
  reorderRotationController
);

// Propose a payout for the current round
router.post(
  '/rounds/:roundId/propose-payout',
  requireChamaMember,
  requireChamaTreasurer,
  proposePayoutController
);

// Disburse a payout that has been fully approved
router.post(
  '/rounds/:roundId/disburse',
  requireChamaMember,
  requireChamaTreasurer,
  disbursePayoutController
);

// Record a manual contribution payment for a member
router.post(
  '/payment/:chamaId',
  requireChamaMember,
  requireChamaTreasurer,
  recordPaymentController
);

export default router;
