import express from 'express';

import {
  addMemberController,
  getMemberController,
  updateMemberRoleController,
  updateMemberStatusController,
  removeMemberController,
  transferTreasurerController
} from './member.controller.js';

import {
  protect
} from '../../middleware/auth.middleware.js';

import {
  requireChamaMember,
  requireChamaTreasurer
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
// 3. User must be the Treasurer
//
// Body:
//
// {
//   "userId": "USER_OBJECT_ID"
// }
//
// The authenticated User is taken from:
//
// req.user._id
//
// The userId in the request body represents
// the User being added.
//
// Service layer independently verifies
// the actor's Chama membership and role.
//
// ========================================

router.post(
  '/:chamaId/members',
  protect,
  requireChamaMember,
  requireChamaTreasurer,
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
// 3. User must be the current Treasurer
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
// that the actor is the current Treasurer.
//
// This route is intentionally placed BEFORE
// the dynamic :memberId routes.
//
// ========================================

router.patch(
  '/:chamaId/members/transfer-treasurer',
  protect,
  requireChamaMember,
  requireChamaTreasurer,
  transferTreasurerController
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
// 3. User must be the Treasurer
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
  requireChamaTreasurer,
  updateMemberRoleController
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
// 3. User must be the Treasurer
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
  requireChamaTreasurer,
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
// 3. User must be the Treasurer
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
  requireChamaTreasurer,
  removeMemberController
);


// ========================================
// EXPORT ROUTER
// ========================================

export default router;