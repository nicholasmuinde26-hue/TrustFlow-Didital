import express from 'express';

import {

  createContributionGroupController,

  getContributionGroupController,

  getMyContributionGroupsController,

  updateContributionGroupController,

  updateContributionGroupStatusController,

  addContributionGroupMemberController,

  getContributionGroupMembersController,

  removeContributionGroupMemberController,

  updateContributionGroupMemberRoleController,

  inviteUserToContributionGroupController,

  getMyContributionGroupInvitationsController,

  acceptContributionGroupInvitationController,


} from './contributionGroup.controller.js';

import {
  protect
} from '../../middleware/auth.middleware.js';

import {
  requireContributionGroupMember,
  requireContributionGroupManager,
  requireContributionGroupOrganizer
} from '../../middleware/contributionGroup.middleware.js';


const router = express.Router();


// ========================================
// CREATE CONTRIBUTION GROUP
// ========================================
//
// POST
// /api/v1/contribution-groups
//
// Any authenticated user can create ONE
// active contribution group.
//
// The creator automatically becomes:
//
// role: organizer
//
// ========================================

router.post(

  '/',

  protect,

  createContributionGroupController

);


// ========================================
// INVITE USER
// ========================================
//
// POST
// /api/v1/contribution-groups/:groupId/invitations
//
// Allowed:
// - organizer
// - co_organizer
//
// Creates an invitation with:
//
// status: pending
//
// IMPORTANT:
//
// This does NOT immediately create an
// active ContributionGroupMember.
//
// The user becomes a member only after
// accepting the invitation.
//
// ========================================

router.post(

  '/:groupId/invitations',

  protect,

  requireContributionGroupMember,

  requireContributionGroupManager,

  inviteUserToContributionGroupController

);




// ========================================
// GET MY CONTRIBUTION GROUP INVITATIONS
// ========================================
//
// GET
// /api/v1/contribution-groups/invitations
//
// Optional:
//
// GET
// /api/v1/contribution-groups/invitations?status=pending
//
// Any authenticated user can view their
// own invitations.
//
// IMPORTANT:
//
// This route MUST appear before:
//
// /:groupId/invitations
//
// Otherwise "invitations" could potentially
// be interpreted as a groupId.
//
// ========================================

router.get(

  '/invitations',

  protect,

  getMyContributionGroupInvitationsController

);

router.patch(

  '/invitations/:invitationId/accept',

  protect,

  acceptContributionGroupInvitationController

);

router.get(

  '/my-groups',

  protect,

  getMyContributionGroupsController

);

router.get(

  '/:groupId',

  protect,

  requireContributionGroupMember,

  getContributionGroupController

);

router.patch(

  '/:groupId',

  protect,

  requireContributionGroupMember,

  requireContributionGroupManager,

  updateContributionGroupController

);

router.patch(

  '/:groupId/status',

  protect,

  requireContributionGroupMember,

  requireContributionGroupOrganizer,

  updateContributionGroupStatusController

);


// ========================================
// ADD MEMBER DIRECTLY
// ========================================
//
// POST
// /api/v1/contribution-groups/:groupId/members
//
// Allowed:
// - organizer
// - co_organizer
//
// Creates an active membership directly.
//
// ========================================

router.post(

  '/:groupId/members',

  protect,

  requireContributionGroupMember,

  requireContributionGroupManager,

  addContributionGroupMemberController

);


// ========================================
// GET GROUP MEMBERS
// ========================================
//
// GET
// /api/v1/contribution-groups/:groupId/members
//
// Any active group member can view members.
//
// ========================================

router.get(

  '/:groupId/members',

  protect,

  requireContributionGroupMember,

  getContributionGroupMembersController

);


// ========================================
// REMOVE MEMBER
// ========================================
//
// DELETE
// /api/v1/contribution-groups/:groupId/members/:memberId
//
// Allowed:
// - organizer
// - co_organizer
//
// The service must prevent removal of the
// primary organizer.
//
// ========================================

router.delete(

  '/:groupId/members/:memberId',

  protect,

  requireContributionGroupMember,

  requireContributionGroupManager,

  removeContributionGroupMemberController

);


// ========================================
// UPDATE MEMBER ROLE
// ========================================
//
// PATCH
// /api/v1/contribution-groups/:groupId/members/:memberId/role
//
// Allowed managers:
// - organizer
// - co_organizer
//
// Supported role changes:
//
// member
//    ↓
// co_organizer
//
// co_organizer
//    ↓
// member
//
// Organizer should NOT be changed here.
//
// Primary ownership remains:
//
// ContributionGroup.created_by
//
// ========================================

router.patch(

  '/:groupId/members/:memberId/role',

  protect,

  requireContributionGroupMember,

  requireContributionGroupManager,

  updateContributionGroupMemberRoleController

);


// ========================================
// EXPORT ROUTER
// ========================================

export default router;