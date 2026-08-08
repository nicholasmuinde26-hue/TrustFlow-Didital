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
  recordMgrReminderController
} from './chama.controller.js';

import {
  protect
} from '../../middleware/auth.middleware.js';

import {
  requireChamaMember,
  requireChamaTreasurer,
  requireChamaTreasurerOrChairperson
} from '../../middleware/chama.middleware.js';


const router =
  express.Router();


// ========================================
// CREATE CHAMA
// ========================================

router.post(
  '/',
  protect,
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

router.patch(
  '/:id',
  protect,
  requireChamaMember,
  requireChamaTreasurerOrChairperson,
  updateChamaController
);


// ========================================
// DELETE CHAMA
// ========================================

router.delete(
  '/:id',
  protect,
  requireChamaMember,
  requireChamaTreasurer,
  deleteChamaController
);


export default router;
