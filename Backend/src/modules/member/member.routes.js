import express from 'express';

import {
  addMemberController,
  getMemberController,
  updateMemberRoleController,
  updateMemberStatusController,
  removeMemberController,
  transferTreasurerController,
  updateMemberProfileController,
  rearrangePayoutOrderController // 1. IMPORT NEW CONTROLLER
} from './member.controller.js';

import {
  protect
} from '../../middleware/auth.middleware.js';

import {
  requireChamaMember,
  requireChamaTreasurerOrChairperson
} from '../../middleware/chama.middleware.js';

const router = express.Router();

// ADD MEMBER TO CHAMA
router.post(
  '/:chamaId/members',
  protect,
  requireChamaMember,
  requireChamaTreasurerOrChairperson,
  addMemberController
);

// REARRANGE PAYOUT ORDER  <-- 2. NEW ROUTE
// PATCH /api/v1/chamas/:chamaId/members/payout-order
// Body: { "order": [{ "memberId": "id", "position": 1 }, ...] }
router.patch(
  '/:chamaId/members/payout-order',
  protect,
  requireChamaMember,
  requireChamaTreasurerOrChairperson,
  rearrangePayoutOrderController
);

// TRANSFER TREASURER ROLE
router.patch(
  '/:chamaId/members/transfer-treasurer',
  protect,
  requireChamaMember,
  requireChamaTreasurerOrChairperson,
  transferTreasurerController
);

// GET MEMBER BY ID
router.get(
  '/:chamaId/members/:memberId',
  protect,
  requireChamaMember,
  getMemberController
);

// UPDATE MEMBER ROLE
router.patch(
  '/:chamaId/members/:memberId/role',
  protect,
  requireChamaMember,
  requireChamaTreasurerOrChairperson,
  updateMemberRoleController
);

// UPDATE MEMBER PROFILE
router.patch(
  '/:chamaId/members/:memberId/profile',
  protect,
  requireChamaMember,
  updateMemberProfileController
);

// UPDATE MEMBER STATUS
router.patch(
  '/:chamaId/members/:memberId/status',
  protect,
  requireChamaMember,
  requireChamaTreasurerOrChairperson,
  updateMemberStatusController
);

// REMOVE MEMBER FROM CHAMA
router.patch(
  '/:chamaId/members/:memberId/remove',
  protect,
  requireChamaMember,
  requireChamaTreasurerOrChairperson,
  removeMemberController
);

export default router;