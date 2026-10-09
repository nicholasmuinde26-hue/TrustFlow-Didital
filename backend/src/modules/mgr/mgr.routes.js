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
  confirmRoundPositionController,
  markPayoutReceivedController,
} from './mgr.controller.js';

import { requireModule } from '../../middleware/module.middleware.js';
import { requireViewAllContributions } from '../../middleware/contributionsAccess.middleware.js';
const router = express.Router();

router.use(protect);

// ────────────────────────────────────────────────────────────
// MEMBER-ACCESSIBLE (any active Chama member)
// ────────────────────────────────────────────────────────────

// Full MGR command-center dashboard
router.get('/overview/:chamaId', requireChamaMember, requireModule('mgr'), getDashboardOverviewController);

// Fetch all active Chama members for the wizard participant picker
router.get('/members/:chamaId', requireChamaMember, requireModule('mgr'), getChamaMgrMembersController);

// Chama-scoped contributions: plans + per-member obligation overview
router.get('/contributions/:chamaId', requireChamaMember, requireModule('mgr'), requireViewAllContributions, getChamaContributionsController);

// ────────────────────────────────────────────────────────────
// TREASURER-ONLY ROUTES
// ────────────────────────────────────────────────────────────

// Create a new MGR Policy draft
router.post(
  '/policy/:chamaId',
  requireChamaMember, requireModule('mgr'),
  requireChamaTreasurer,
  createPolicyController
);

// Edit an MGR Policy
router.patch(
  '/policy/:chamaId/:policyId',
  requireChamaMember, requireModule('mgr'),
  requireChamaTreasurer,
  updatePolicyController
);

// Send payment reminders for current round
router.post(
  '/rounds/:roundId/send-reminders',
  requireChamaMember, requireModule('mgr'),
  requireChamaTreasurer,
  sendRemindersController
);

// Activate a draft policy → generates all MgrRound objects
router.post(
  '/policy/:chamaId/:policyId/activate',
  requireChamaMember, requireModule('mgr'),
  requireChamaTreasurer,
  activatePolicyController
);

// Reorder payout rotation positions (authorized change, audit-logged)
router.patch(
  '/policy/:chamaId/:policyId/reorder',
  requireChamaMember, requireModule('mgr'),
  requireChamaTreasurer,
  reorderRotationController
);

// Propose a payout for the current round
router.post(
  '/rounds/:roundId/propose-payout',
  requireChamaMember, requireModule('mgr'),
  requireChamaTreasurer,
  proposePayoutController
);

// Disburse a payout that has been fully approved
router.post(
  '/rounds/:roundId/disburse',
  requireChamaMember, requireModule('mgr'),
  requireChamaTreasurer,
  disbursePayoutController
);

router.post(
  '/rounds/:roundId/confirm-position',
  requireChamaMember, requireModule('mgr'),
  requireChamaTreasurer,
  confirmRoundPositionController
);

router.post(
  '/rounds/:roundId/received',
  requireChamaMember, requireModule('mgr'),
  markPayoutReceivedController
);

// Record a manual contribution payment for a member
router.post(
  '/payment/:chamaId',
  requireChamaMember, requireModule('mgr'),
  requireChamaTreasurer,
  recordPaymentController
);

export default router;
