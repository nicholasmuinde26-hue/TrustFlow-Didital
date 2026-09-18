import express from 'express';

import {
  createChamaController,
  getChamaController,
  getChamaMembersController,
  updateChamaController,
  deleteChamaController,
  initiateSavingsDepositController,
  getPaymentIntentController,
  reconcilePaymentIntentController,
  updateMgrSettingsController,
  getMgrOverviewController,
  getMgrHistoryController,
  recordMgrReminderController,
  markMgrPaidController,
  verifyTreasurerController,
  getPublicChamasController,
  joinWithCodeController,
  requestToJoinPublicChamaController,
} from './chama.controller.js';

import {
  protect
} from '../../middleware/auth.middleware.js';
import { requireAdmin } from '../../middleware/admin.middleware.js';

import {
  requireChamaMember,
  requireChamaTreasurer,
  requireChamaTreasurerOrChairperson
} from '../../middleware/chama.middleware.js';

import {
  requireLeadershipSession,
  requireLeadershipStepUp,
  STEP_UP_ACTIONS
} from '../../middleware/leadershipSession.middleware.js';


const router =
  express.Router();


router.get('/verify-treasurer', protect, verifyTreasurerController);

// ========================================
// PUBLIC DIRECTORY & JOIN CODE
// ========================================

router.get(
  '/directory/public',
  protect,
  getPublicChamasController
);

router.post(
  '/directory/join',
  protect,
  joinWithCodeController
);

// One-click "Request to Join" straight from the public directory —
// no join_code required, since visibility: 'public' is itself what
// makes the Chama discoverable. Declared here (not under the
// /:id/... member routes below) since the requester isn't a member
// yet and requireChamaMember would reject them.
router.post(
  '/directory/:chamaId/join',
  protect,
  requestToJoinPublicChamaController
);

// ========================================
// CREATE CHAMA (ADMIN ONLY)
// ========================================

router.post(
  '/',
  protect,
  requireAdmin,
  createChamaController
);

// Any active member can initiate a deposit to their own savings account.
router.post('/:chamaId/savings/deposit', protect, requireChamaMember, initiateSavingsDepositController);
router.get('/:chamaId/payment-intents/:paymentIntentId', protect, requireChamaMember, getPaymentIntentController);
router.post('/:chamaId/payment-intents/:paymentIntentId/reconcile', protect, requireChamaMember, reconcilePaymentIntentController);

// Only the treasurer configures the communal MGR plan; members may view it.
router.get('/:chamaId/mgr', protect, requireChamaMember, getMgrOverviewController);
router.put('/:chamaId/mgr/settings', protect, requireChamaMember, requireChamaTreasurer, updateMgrSettingsController);
router.post('/:chamaId/mgr/reminders', protect, requireChamaMember, requireChamaTreasurer, recordMgrReminderController);
router.get('/:chamaId/mgr/history', protect, requireChamaMember, getMgrHistoryController);
// Treasurer marks a member's round as paid via cash/bank/other, outside M-Pesa.
router.post('/:chamaId/mgr/obligations/:obligationId/mark-paid', protect, requireChamaMember, requireChamaTreasurer, markMgrPaidController);


// ========================================
// GET CHAMA MEMBERS
// ========================================

router.get(
  '/:id/members',
  protect,
  requireChamaMember,
  getChamaMembersController
);


// ========================================
// GET CHAMA
// ========================================

router.get(
  '/:id',
  protect,
  requireChamaMember,
  getChamaController
);


// ========================================
// UPDATE CHAMA
// ========================================
//
// Treasurer or Chairperson may update
// core Chama settings (name, monthly savings).
//
// ========================================

// The Leadership Desk is the only UI entry point for this now, and the
// PIN guarding that desk has to mean something at the API layer too —
// otherwise it is skippable by anyone who can send an HTTP request with
// a treasurer's access token.
router.patch(
  '/:id',
  protect,
  requireChamaMember,
  requireChamaTreasurerOrChairperson,
  requireLeadershipSession,
  updateChamaController
);


// ========================================
// DELETE CHAMA
// ========================================

// Deleting a Chama is irreversible and takes every member's association
// with it. An unlocked desk is not enough here — the Treasurer re-enters
// the PIN for this specific action, seconds before it runs.
router.delete(
  '/:id',
  protect,
  requireChamaMember,
  requireChamaTreasurer,
  requireLeadershipStepUp(STEP_UP_ACTIONS.DELETE_CHAMA),
  deleteChamaController
);


export default router;
