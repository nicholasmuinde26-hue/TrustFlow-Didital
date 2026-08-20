import express from 'express';

import {
  addMemberController,
  getMemberController,
  updateMemberRoleController,
  updateMemberStatusController,
  removeMemberController,
  transferTreasurerController,
  updateMemberProfileController,
  reorderPayoutPositionsController
} from './member.controller.js';

import {
  protect
} from '../../middleware/auth.middleware.js';

import {
  requireChamaMember,
  requireChamaTreasurerOrChairperson
} from '../../middleware/chama.middleware.js';


// ========================================
// ROUTER
// ========================================

const router =
  express.Router();


// ========================================
// ADD MEMBER TO CHAMA
// ========================================
//
// POST
// /api/v1/chamas/:chamaId/members
//
// Requirements:
//
// 1. User must be authenticated
// 2. User must be an active Chama member
// 3. User must be the Treasurer or Chairperson
//
// Body:
//
// {
//   "phone": "0712345678",
//   "name": "John Doe" (optional)
// }
//
// OR
//
// {
//   "userId": "USER_OBJECT_ID"
// }
//
// The authenticated User is taken from:
//
// req.user._id
//
// The phone number or userId in the request body
// represents the User being added.
//
// Service layer independently verifies
// the actor's Chama membership and role.
//
// ========================================

router.post(
  '/:chamaId/members',
  protect,
  requireChamaMember,
  requireChamaTreasurerOrChairperson,
  addMemberController
);


// ========================================
// TRANSFER TREASURER ROLE
// ========================================
//
// PATCH
// /api/v1/chamas/:chamaId/members/transfer-treasurer
//
// Requirements:
//
// 1. User must be authenticated
// 2. User must be an active Chama member
// 3. User must be the Treasurer or Chairperson
//
// Body:
//
// {
//   "newTreasurerMemberId":
//   "MEMBERSHIP_OBJECT_ID"
// }
//
// IMPORTANT:
//
// newTreasurerMemberId is the
// ChamaMembership document ID.
//
// It is NOT the User ID.
//
// The service layer independently verifies
// that the actor is the Treasurer or
// Chairperson, and separately looks up
// whichever membership currently holds the
// Treasurer role to demote.
//
// This route is intentionally placed BEFORE
// the dynamic :memberId routes.
//
// ========================================

router.patch(
  '/:chamaId/members/transfer-treasurer',
  protect,
  requireChamaMember,
  requireChamaTreasurerOrChairperson,
  transferTreasurerController
);


// ========================================
// REORDER PAYOUT POSITIONS
// (MGR ROTATION ARRANGEMENT)
// ========================================
//
// PATCH
// /api/v1/chamas/:chamaId/members/payout-order
//
// Requirements:
//
// 1. User must be authenticated
// 2. User must be an active Chama member
// 3. User must be the Treasurer or Chairperson
//
// Body:
//
// {
//   "order": [
//     "MEMBERSHIP_OBJECT_ID_POSITION_1",
//     "MEMBERSHIP_OBJECT_ID_POSITION_2",
//     ...
//   ]
// }
//
// This route is intentionally placed BEFORE
// the dynamic :memberId routes, same as
// transfer-treasurer above.
//
// ========================================

router.patch(
  '/:chamaId/members/payout-order',
  protect,
  requireChamaMember,
  requireChamaTreasurerOrChairperson,
  reorderPayoutPositionsController
);


// ========================================
// GET MEMBER BY ID
// ========================================
//
// GET
// /api/v1/chamas/:chamaId/members/:memberId
//
// Requirements:
//
// 1. User must be authenticated
// 2. User must be an active Chama member
//
// IMPORTANT:
//
// memberId is the ChamaMembership
// document ID.
//
// It is NOT the User ID.
//
// ========================================

router.get(
  '/:chamaId/members/:memberId',
  protect,
  requireChamaMember,
  getMemberController
);


// ========================================
// UPDATE MEMBER ROLE
// ========================================
//
// PATCH
// /api/v1/chamas/:chamaId/members/:memberId/role
//
// Requirements:
//
// 1. User must be authenticated
// 2. User must be an active Chama member
// 3. User must be the Treasurer or Chairperson
//
// Body:
//
// {
//   "role": "auditor"
// }
//
// Allowed roles:
//
// member
// treasurer
// auditor
//
// ========================================

router.patch(
  '/:chamaId/members/:memberId/role',
  protect,
  requireChamaMember,
  requireChamaTreasurerOrChairperson,
  updateMemberRoleController
);


// ========================================
// UPDATE MEMBER PROFILE
// ========================================
//
// PATCH
// /api/v1/chamas/:chamaId/members/:memberId/profile
//
// Requirements:
//
// 1. User must be authenticated
// 2. User must be an active Chama member
// 3. User must be EITHER:
//    - the member themselves, OR
//    - the Treasurer or Chairperson
//
// Permission between "self" and "manager" is
// resolved in the service layer (updateMemberProfile),
// since it depends on whose membership memberId
// points to, not just the actor's own role — so
// no requireChamaTreasurerOrChairperson gate here.
//
// Body (all optional):
//
// {
//   "name": "Jane Doe",
//   "phone": "0712345678",
//   "email": "jane@example.com",
//   "id_number": "12345678",
//   "avatar_url": "data:image/png;base64,..."
// }
//
// ========================================

router.patch(
  '/:chamaId/members/:memberId/profile',
  protect,
  requireChamaMember,
  updateMemberProfileController
);


// ========================================
// UPDATE MEMBER STATUS
// ========================================
//
// PATCH
// /api/v1/chamas/:chamaId/members/:memberId/status
//
// Requirements:
//
// 1. User must be authenticated
// 2. User must be an active Chama member
// 3. User must be the Treasurer or Chairperson
//
// Body:
//
// {
//   "status": "suspended"
// }
//
// Allowed statuses:
//
// active
// inactive
// suspended
// removed
//
// ========================================

router.patch(
  '/:chamaId/members/:memberId/status',
  protect,
  requireChamaMember,
  requireChamaTreasurerOrChairperson,
  updateMemberStatusController
);


// ========================================
// REMOVE MEMBER FROM CHAMA
// ========================================
//
// PATCH
// /api/v1/chamas/:chamaId/members/:memberId/remove
//
// Requirements:
//
// 1. User must be authenticated
// 2. User must be an active Chama member
// 3. User must be the Treasurer or Chairperson
//
// IMPORTANT:
//
// This is a SOFT DELETE.
//
// The membership document is NOT physically
// deleted from MongoDB.
//
// Instead:
//
// status = "removed"
// payout_position = null
//
// This preserves historical records.
//
// ========================================

router.patch(
  '/:chamaId/members/:memberId/remove',
  protect,
  requireChamaMember,
  requireChamaTreasurerOrChairperson,
  removeMemberController
);


// ========================================
// EXPORT ROUTER
// ========================================

export default router;