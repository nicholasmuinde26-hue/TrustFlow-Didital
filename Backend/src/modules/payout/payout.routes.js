import express from 'express';

import {
  getPayoutHistoryController,
  getCurrentPayoutController,
  getPayoutController,
  startPayoutController,
  markPayoutPaidController,
  cancelPayoutController
} from './payout.controller.js';

import {
  protect
} from '../../middleware/auth.middleware.js';

import {
  requireChamaMember,
  requireChamaTreasurer
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
// TREASURER ONLY
// ========================================

router.patch(
  '/:id/payouts/:payoutId/cancel',
  requireChamaMember,
  requireChamaTreasurer,
  cancelPayoutController
);


export default router;