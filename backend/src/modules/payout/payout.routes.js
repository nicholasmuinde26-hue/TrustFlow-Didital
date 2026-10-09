import express from 'express';

import {
  getPayoutHistoryController,
  getCurrentPayoutController,
  getPayoutController,
  startPayoutController,
  approvePayoutController,
  markPayoutPaidController,
  cancelPayoutController
} from './payout.controller.js';

import {
  protect
} from '../../middleware/auth.middleware.js';

import {
  requireChamaMember,
  requireChamaTreasurer,
  requireChamaTreasurerOrChairperson,
  requireChamaLeadershipOfficial
} from '../../middleware/chama.middleware.js';


import { requireModule } from '../../middleware/module.middleware.js';
const router = express.Router();


// ========================================
// AUTHENTICATION
// ========================================

router.use(
  protect
);


// ========================================
// GET PAYOUT HISTORY
// ========================================

router.get(
  '/:id/payouts',
  requireChamaMember, requireModule('payouts'),
  getPayoutHistoryController
);


// ========================================
// GET CURRENT PAYOUT
// ========================================

router.get(
  '/:id/payouts/current',
  requireChamaMember, requireModule('payouts'),
  getCurrentPayoutController
);


// ========================================
// GET SINGLE PAYOUT
// ========================================

router.get(
  '/:id/payouts/:payoutId',
  requireChamaMember, requireModule('payouts'),
  getPayoutController
);


// ========================================
// START PAYOUT
// TREASURER ONLY
// ========================================

router.post(
  '/:id/payouts/start',
  requireChamaMember, requireModule('payouts'),
  requireChamaTreasurer,
  startPayoutController
);


// ========================================
// APPROVE PAYOUT
// 2-OF-N COMMITTEE APPROVAL
// ========================================
//
// Chairperson AND treasurer must each sign off (or, when one of them is
// this round's recipient, a standing-in independent official) before /pay
// below will accept this payout — markPayoutPaid rejects any payout that
// isn't already fully 'approved'. Route-level gate is coarse (any Chama
// official); payout.service.js#approvePayout enforces exactly who still
// needs to sign.
//
// ========================================

router.patch(
  '/:id/payouts/:payoutId/approve',
  requireChamaMember, requireModule('payouts'),
  requireChamaLeadershipOfficial,
  approvePayoutController
);


// ========================================
// MARK PAYOUT AS PAID
// TREASURER ONLY
// ========================================

router.patch(
  '/:id/payouts/:payoutId/pay',
  requireChamaMember, requireModule('payouts'),
  requireChamaTreasurer,
  markPayoutPaidController
);


// ========================================
// CANCEL PAYOUT
// TREASURER OR CHAIRPERSON
// ========================================

router.patch(
  '/:id/payouts/:payoutId/cancel',
  requireChamaMember, requireModule('payouts'),
  requireChamaTreasurerOrChairperson,
  cancelPayoutController
);


export default router;