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
  requireChamaChairperson,
  requireChamaTreasurerOrChairperson
} from '../../middleware/chama.middleware.js';


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
  requireChamaMember,
  getPayoutHistoryController
);


// ========================================
// GET CURRENT PAYOUT
// ========================================

router.get(
  '/:id/payouts/current',
  requireChamaMember,
  getCurrentPayoutController
);


// ========================================
// GET SINGLE PAYOUT
// ========================================

router.get(
  '/:id/payouts/:payoutId',
  requireChamaMember,
  getPayoutController
);


// ========================================
// START PAYOUT
// TREASURER ONLY
// ========================================

router.post(
  '/:id/payouts/start',
  requireChamaMember,
  requireChamaTreasurer,
  startPayoutController
);


// ========================================
// APPROVE PAYOUT
// CHAIRPERSON ONLY
// ========================================
//
// Must happen before /pay below will accept
// this payout — markPayoutPaid rejects any
// payout that isn't already 'approved'.
//
// ========================================

router.patch(
  '/:id/payouts/:payoutId/approve',
  requireChamaMember,
  requireChamaChairperson,
  approvePayoutController
);


// ========================================
// MARK PAYOUT AS PAID
// TREASURER ONLY
// ========================================

router.patch(
  '/:id/payouts/:payoutId/pay',
  requireChamaMember,
  requireChamaTreasurer,
  markPayoutPaidController
);


// ========================================
// CANCEL PAYOUT
// TREASURER OR CHAIRPERSON
// ========================================

router.patch(
  '/:id/payouts/:payoutId/cancel',
  requireChamaMember,
  requireChamaTreasurerOrChairperson,
  cancelPayoutController
);


export default router;