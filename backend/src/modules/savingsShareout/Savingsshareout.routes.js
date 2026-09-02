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
} from './savingsShareout.controller.js';

import { protect } from '../../middleware/auth.middleware.js';

import {
  requireChamaMember,
  requireChamaTreasurer,
  requireChamaChairperson,
  requireChamaTreasurerOrChairperson,
} from '../../middleware/chama.middleware.js';

const router = express.Router();

router.use(protect);

// ========================================
// SAVINGS SHARE POLICIES
// TREASURER/CHAIRPERSON MANAGE SETTINGS
// ========================================

router.get('/:id/savings-share-policies', requireChamaMember, listPoliciesController);

router.post('/:id/savings-share-policies', requireChamaTreasurerOrChairperson, createPolicyController);

router.patch('/:id/savings-share-policies/:policyId', requireChamaTreasurerOrChairperson, updatePolicyController);

router.patch(
  '/:id/savings-share-policies/:policyId/activate',
  requireChamaTreasurerOrChairperson,
  activatePolicyController
);

router.patch(
  '/:id/savings-share-policies/:policyId/archive',
  requireChamaTreasurerOrChairperson,
  archivePolicyController
);

// ========================================
// SAVINGS SHARE-OUTS
// ========================================

router.get('/:id/savings-shareouts/preview', requireChamaTreasurerOrChairperson, previewShareoutController);

router.get('/:id/savings-shareouts', requireChamaMember, listShareoutsController);

router.get('/:id/savings-shareouts/:shareoutId', requireChamaMember, getShareoutController);

// TREASURER OR CHAIRPERSON MAY START ONE MANUALLY (if the active policy allows it)
router.post('/:id/savings-shareouts', requireChamaTreasurerOrChairperson, createShareoutController);

// CHAIRPERSON APPROVES — same separation of duties as MGR/Payout approval
router.patch(
  '/:id/savings-shareouts/:shareoutId/approve',
  requireChamaChairperson,
  approveShareoutController
);

// TREASURER DISBURSES EACH MEMBER'S SHARE
router.patch(
  '/:id/savings-shareouts/:shareoutId/items/:itemId/pay',
  requireChamaTreasurer,
  payShareoutItemController
);

router.patch(
  '/:id/savings-shareouts/:shareoutId/cancel',
  requireChamaTreasurerOrChairperson,
  cancelShareoutController
);

export default router;