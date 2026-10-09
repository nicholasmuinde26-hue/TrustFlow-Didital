import express from 'express';

import {
  listPoliciesController,
  createPolicyController,
  updatePolicyController,
  activatePolicyController,
  archivePolicyController,
  previewShareoutController,
  createShareoutController,
  listShareoutsController,
  getShareoutController,
  approveShareoutController,
  payShareoutItemController,
  cancelShareoutController,
  getSavingsOverviewController,
} from './savingsShareout.controller.js';

import { protect } from '../../middleware/auth.middleware.js';

import {
  requireChamaMember,
  requireChamaTreasurer,
  requireChamaChairperson,
  requireChamaTreasurerOrChairperson,
} from '../../middleware/chama.middleware.js';

import { requireModule } from '../../middleware/module.middleware.js';
const router = express.Router();

router.use(protect);

// ========================================
// SAVINGS SHARE POLICIES
// TREASURER/CHAIRPERSON MANAGE SETTINGS
// ========================================

router.get('/:id/savings-share-policies', requireChamaMember, requireModule('savings_shareout'), listPoliciesController);

// ========================================
// SAVINGS OVERVIEW
// Per-member balances, top savers, growth trend - read-only,
// same visibility as the share-out list/detail routes below.
// ========================================

router.get('/:id/savings-overview', requireChamaMember, requireModule('savings'), getSavingsOverviewController);

router.post('/:id/savings-share-policies', requireChamaMember, requireModule('savings_shareout'), requireChamaTreasurerOrChairperson, createPolicyController);

router.patch('/:id/savings-share-policies/:policyId', requireChamaMember, requireModule('savings_shareout'), requireChamaTreasurerOrChairperson, updatePolicyController);

router.patch(
  '/:id/savings-share-policies/:policyId/activate',
  requireChamaMember, requireModule('savings_shareout'),
  requireChamaTreasurerOrChairperson,
  activatePolicyController
);

router.patch(
  '/:id/savings-share-policies/:policyId/archive',
  requireChamaMember, requireModule('savings_shareout'),
  requireChamaTreasurerOrChairperson,
  archivePolicyController
);

// ========================================
// SAVINGS SHARE-OUTS
// ========================================

router.get('/:id/savings-shareouts/preview', requireChamaMember, requireModule('savings_shareout'), requireChamaTreasurerOrChairperson, previewShareoutController);

router.get('/:id/savings-shareouts', requireChamaMember, requireModule('savings_shareout'), listShareoutsController);

router.get('/:id/savings-shareouts/:shareoutId', requireChamaMember, requireModule('savings_shareout'), getShareoutController);

// TREASURER OR CHAIRPERSON MAY START ONE MANUALLY (if the active policy allows it)
router.post('/:id/savings-shareouts', requireChamaMember, requireModule('savings_shareout'), requireChamaTreasurerOrChairperson, createShareoutController);

// CHAIRPERSON APPROVES — same separation of duties as MGR/Payout approval
router.patch(
  '/:id/savings-shareouts/:shareoutId/approve',
  requireChamaMember, requireModule('savings_shareout'),
  requireChamaChairperson,
  approveShareoutController
);

// TREASURER DISBURSES EACH MEMBER'S SHARE
router.patch(
  '/:id/savings-shareouts/:shareoutId/items/:itemId/pay',
  requireChamaMember, requireModule('savings_shareout'),
  requireChamaTreasurer,
  payShareoutItemController
);

router.patch(
  '/:id/savings-shareouts/:shareoutId/cancel',
  requireChamaMember, requireModule('savings_shareout'),
  requireChamaTreasurerOrChairperson,
  cancelShareoutController
);

export default router;