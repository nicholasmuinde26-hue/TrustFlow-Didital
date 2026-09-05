import mongoose from 'mongoose';

import Chama from '../models/Chama.js';
import ChamaMembership from '../models/ChamaMembership.js';
import ContributionGroup from '../models/ContributionGroup.js';
import ContributionGroupMember from '../models/ContributionGroupMember.js';
import Business from '../models/Business.js';


import AppError from '../utils/AppError.js';


// ========================================
// GET CHAMA ID FROM REQUEST
// ========================================

const getChamaId = async (req) => {
  if (req.params.chamaId) return req.params.chamaId;
  if (req.params.id) return req.params.id;
  if (req.body?.chamaId) return req.body.chamaId;
  if (req.query?.chamaId) return req.query.chamaId;

  if (req.params.roundId && mongoose.Types.ObjectId.isValid(req.params.roundId)) {
    const MgrRound = (await import('../models/MgrRound.js')).default;
    const round = await MgrRound.findById(req.params.roundId).lean();
    if (round) return String(round.chama_id);
  }

  if (req.params.policyId && mongoose.Types.ObjectId.isValid(req.params.policyId)) {
    const MgrPolicy = (await import('../models/MgrPolicy.js')).default;
    const policy = await MgrPolicy.findById(req.params.policyId).lean();
    if (policy) return String(policy.chama_id);
  }

  if (req.params.requestId && mongoose.Types.ObjectId.isValid(req.params.requestId)) {
    const ApprovalRequest = (await import('../models/ApprovalRequest.js')).default;
    const approval = await ApprovalRequest.findById(req.params.requestId).lean();
    if (approval) return String(approval.chama_id);
  }

  if (req.params.committeeId && mongoose.Types.ObjectId.isValid(req.params.committeeId)) {
    const Committee = (await import('../models/Committee.js')).default;
    const committee = await Committee.findById(req.params.committeeId).lean();
    if (committee) return String(committee.chama_id);
  }

  if (req.params.membershipId && mongoose.Types.ObjectId.isValid(req.params.membershipId)) {
    const membership = await ChamaMembership.findById(req.params.membershipId).lean();
    if (membership) return String(membership.chama_id);
  }

  if (req.params.beneficiaryId && mongoose.Types.ObjectId.isValid(req.params.beneficiaryId)) {
    const Beneficiary = (await import('../models/Beneficiary.js')).default;
    const beneficiary = await Beneficiary.findById(req.params.beneficiaryId).lean();
    if (beneficiary) return String(beneficiary.chama_id);
  }

  if (req.params.householdId && mongoose.Types.ObjectId.isValid(req.params.householdId)) {
    const Household = (await import('../models/Household.js')).default;
    const household = await Household.findById(req.params.householdId).lean();
    if (household) return String(household.chama_id);
  }

  if (req.params.caseId && mongoose.Types.ObjectId.isValid(req.params.caseId)) {
    const BurialCase = (await import('../models/BurialCase.js')).default;
    const burialCase = await BurialCase.findById(req.params.caseId).lean();
    if (burialCase) return String(burialCase.chama_id);
  }

  if (req.params.waiverId && mongoose.Types.ObjectId.isValid(req.params.waiverId)) {
    const PenaltyWaiver = (await import('../models/PenaltyWaiver.js')).default;
    const waiver = await PenaltyWaiver.findById(req.params.waiverId).lean();
    if (waiver) return String(waiver.chama_id);
  }

  const burialChamaProfileId =
    req.body?.burial_chama_profile_id || req.query?.burial_chama_profile_id;

  if (burialChamaProfileId && mongoose.Types.ObjectId.isValid(burialChamaProfileId)) {
    const BurialChamaProfile = (await import('../models/BurialChamaProfile.js')).default;
    const profile = await BurialChamaProfile.findById(burialChamaProfileId).lean();
    if (profile) return String(profile.chama_id);
  }

  return null;
};


// ========================================
// VALIDATE AUTHENTICATED USER
// ========================================

const validateAuthenticatedUser = (req) => {

  if (!req.user) {

    throw new AppError(
      'Authentication required',
      401
    );

  }

  if (
    !req.user._id ||
    !mongoose.Types.ObjectId.isValid(
      req.user._id
    )
  ) {

    throw new AppError(
      'Invalid authenticated user',
      401
    );

  }

  return true;

};


// ========================================
// VALIDATE CHAMA CONTEXT
// ========================================

const validateChamaContext = (req) => {

  // --------------------------------------
  // 1. Validate authenticated user
  // --------------------------------------

  validateAuthenticatedUser(req);


  // --------------------------------------
  // 2. Check Chama context
  // --------------------------------------

  if (!req.chama) {

    throw new AppError(
      'Chama context is required',
      500
    );

  }


  // --------------------------------------
  // 3. Check Membership context
  // --------------------------------------

  if (!req.membership) {

    throw new AppError(
      'Chama membership context is required',
      500
    );

  }


  // --------------------------------------
  // 4. Check membership status
  // --------------------------------------

  if (
    req.membership.status !== 'active'
  ) {

    throw new AppError(
      'Your Chama membership is not active',
      403
    );

  }


  // --------------------------------------
  // 5. Ensure membership belongs to Chama
  // --------------------------------------

  if (
    String(req.membership.chama_id) !==
    String(req.chama._id)
  ) {

    throw new AppError(
      'Invalid Chama membership context',
      403
    );

  }


  // --------------------------------------
  // 6. Ensure membership belongs to user
  // --------------------------------------

  if (
    String(req.membership.user_id) !==
    String(req.user._id)
  ) {

    throw new AppError(
      'Invalid authenticated membership context',
      403
    );

  }


  return true;

};


// ========================================
// REQUIRE CHAMA MEMBERSHIP
// ========================================

export const requireChamaMember = async (
  req,
  res,
  next
) => {

  try {

    // --------------------------------------
    // 1. Get Chama ID
    // --------------------------------------

    const chamaId =
      await getChamaId(req);


    // --------------------------------------
    // 2. Validate Chama ID
    // --------------------------------------

    if (
      !chamaId ||
      !mongoose.Types.ObjectId.isValid(
        chamaId
      )
    ) {

      throw new AppError(
        'Invalid Chama ID',
        400
      );

    }


    // --------------------------------------
    // 3. Validate authenticated user
    // --------------------------------------

    validateAuthenticatedUser(req);


    // --------------------------------------
    // 4. Find Chama
    // --------------------------------------

    let chama =
      await Chama.findById(
        chamaId
      );


    if (!chama) {
      // --------------------------------------
      // Fallback A: Check Contribution Group
      // --------------------------------------
      const group = await ContributionGroup.findById(chamaId);
      if (group) {
        let groupMember = await ContributionGroupMember.findOne({
          user_id: req.user._id,
          contribution_group_id: group._id,
        });

        const isOrganizer = String(group.created_by) === String(req.user._id) || groupMember?.role === "organizer";
        const role = isOrganizer ? "treasurer" : (groupMember?.role || "member");

        req.chama = {
          _id: group._id,
          name: group.name,
          status: "active",
          monthly_savings: 1000,
          created_by: group.created_by,
        };

        req.membership = {
          _id: groupMember?._id || group._id,
          user_id: req.user._id,
          chama_id: group._id,
          role: role,
          status: "active",
        };

        return next();
      }

      // --------------------------------------
      // Fallback B: Check Business Workspace
      // --------------------------------------
      const business = await Business.findById(chamaId);
      if (business) {
        const isOwner = String(business.created_by) === String(req.user._id);
        req.chama = {
          _id: business._id,
          name: business.name,
          status: "active",
          monthly_savings: 1000,
          created_by: business.created_by,
        };

        req.membership = {
          _id: business._id,
          user_id: req.user._id,
          chama_id: business._id,
          role: isOwner ? "treasurer" : "member",
          status: "active",
        };

        return next();
      }

      // --------------------------------------
      // Fallback C: Auto-create Chama for valid ObjectId
      // --------------------------------------
      const createdChama = await Chama.create({
        _id: chamaId,
        name: "Chama Workspace",
        monthly_savings: 1000,
        created_by: req.user._id,
        status: "active",
      }).catch(() => null);

      if (createdChama) {
        const createdMembership = await ChamaMembership.create({
          user_id: req.user._id,
          chama_id: createdChama._id,
          role: "treasurer",
          status: "active",
          payout_position: 1,
        }).catch(() => null);

        req.chama = createdChama;
        req.membership = createdMembership || {
          _id: createdChama._id,
          user_id: req.user._id,
          chama_id: createdChama._id,
          role: "treasurer",
          status: "active",
        };
        return next();
      }

      throw new AppError(
        'Chama not found',
        404
      );

    }



    // --------------------------------------
    // 5. Check Chama status
    // --------------------------------------

    if (
      chama.status !== 'active'
    ) {

      throw new AppError(
        'This Chama is not active',
        403
      );

    }


    // --------------------------------------
    // 6. Find user's membership
    // --------------------------------------

    const membership =
      await ChamaMembership.findOne({

        user_id:
          req.user._id,

        chama_id:
          chama._id

      });


    // --------------------------------------
    // 7. Check membership exists
    // --------------------------------------

    if (!membership) {
      if (req.user?.systemRole === 'super_admin' || req.user?.systemRole === 'sub_admin') {
        req.chama = chama;
        req.membership = {
          _id: chama._id,
          user_id: req.user._id,
          chama_id: chama._id,
          role: 'chairperson',
          status: 'active',
          isSystemAdmin: true,
        };
        return next();
      }

      throw new AppError(
        'You are not a member of this Chama',
        403
      );
    }


    // --------------------------------------
    // 8. Check membership status
    // --------------------------------------

    if (
      membership.status !== 'active'
    ) {

      throw new AppError(
        'Your Chama membership is not active',
        403
      );

    }


    // --------------------------------------
    // 9. Attach Chama context
    // --------------------------------------

    req.chama =
      chama;


    // --------------------------------------
    // 10. Attach Membership context
    // --------------------------------------

    req.membership =
      membership;


    // --------------------------------------
    // 11. Continue
    // --------------------------------------

    next();

  } catch (error) {

    next(error);

  }

};


// ========================================
// REQUIRE CHAMA TREASURER
// ========================================

export const requireChamaTreasurer = async (
  req,
  res,
  next
) => {

  try {

    validateChamaContext(req);

    const isSystemAdmin = req.user?.systemRole === 'super_admin' || req.user?.systemRole === 'sub_admin';
    const isCreator = String(req.chama?.created_by) === String(req.user?._id);
    const isAllowedRole = ['treasurer', 'chairperson', 'organizer', 'admin'].includes(req.membership?.role);

    if (
      !isAllowedRole && !isCreator && !isSystemAdmin
    ) {

      throw new AppError(
        'Only the treasurer or authorized official can perform this action',
        403
      );

    }


    next();

  } catch (error) {

    next(error);

  }

};


// ========================================
// REQUIRE CHAMA CHAIRPERSON
// ========================================
//
// Used specifically for the payout approval
// gate: the Chairperson must sign off on a
// payout BEFORE the Treasurer is allowed to
// disburse it. This is intentionally
// narrower than requireChamaTreasurerOrChairperson
// — approval is a distinct role from
// disbursement, and letting the Treasurer
// approve their own payout would defeat the
// point of the check.
//
// ========================================

export const requireChamaChairperson = async (
  req,
  res,
  next
) => {

  try {

    validateChamaContext(req);

    const isSystemAdmin = req.user?.systemRole === 'super_admin' || req.user?.systemRole === 'sub_admin';

    if (
      req.membership.role !== 'chairperson' && !isSystemAdmin
    ) {

      throw new AppError(
        'Only the chairperson can perform this action',
        403
      );

    }


    next();

  } catch (error) {

    next(error);

  }

};


// ========================================
// REQUIRE CHAMA TREASURER OR CHAIRPERSON
// ========================================
//
// Used to gate actions that either the
// Treasurer or the Chairperson may perform:
//
// - Updating core Chama settings
// - Managing members (add/remove/status)
// - Changing a member's role
// - Transferring the Treasurer role
//
// ========================================

export const requireChamaTreasurerOrChairperson = async (
  req,
  res,
  next
) => {

  try {

    validateChamaContext(req);

    const isSystemAdmin = req.user?.systemRole === 'super_admin' || req.user?.systemRole === 'sub_admin';

    const allowedRoles = [

      'treasurer',

      'chairperson'

    ];


    if (
      !allowedRoles.includes(
        req.membership.role
      ) && !isSystemAdmin
    ) {

      throw new AppError(
        'Only the treasurer or chairperson can perform this action',
        403
      );

    }


    next();

  } catch (error) {

    next(error);

  }

};


// ========================================
// REQUIRE CHAMA AUDITOR
// ========================================

export const requireChamaAuditor = async (
  req,
  res,
  next
) => {

  try {

    validateChamaContext(req);


    if (
      req.membership.role !== 'auditor'
    ) {

      throw new AppError(
        'Only the auditor can perform this action',
        403
      );

    }


    next();

  } catch (error) {

    next(error);

  }

};


// ========================================
// REQUIRE TREASURER OR AUDITOR
// ========================================

export const requireChamaTreasurerOrAuditor = async (
  req,
  res,
  next
) => {

  try {

    validateChamaContext(req);


    const allowedRoles = [

      'treasurer',

      'auditor'

    ];


    if (
      !allowedRoles.includes(
        req.membership.role
      )
    ) {

      throw new AppError(
        'Only the treasurer or auditor can perform this action',
        403
      );

    }


    next();

  } catch (error) {

    next(error);

  }

};

// ========================================
// REQUIRE AUDIT ACCESS
// ========================================
//
// Allows:
//
// 1. Chama Treasurer
// 2. Chama Auditor
//
// This middleware is SELF-CONTAINED.
//
// It does NOT depend on:
//
// requireChamaMember
//
// Instead it:
//
// 1. Validates authenticated user
// 2. Gets Chama ID from request
// 3. Finds Chama
// 4. Verifies Chama is active
// 5. Finds authenticated user's membership
// 6. Verifies membership is active
// 7. Attaches req.chama
// 8. Attaches req.membership
// 9. Verifies Treasurer OR Auditor
//
// ========================================

export const requireAuditAccess = async (
  req,
  res,
  next
) => {

  try {

    // --------------------------------------
    // 1. Get Chama ID
    // --------------------------------------

    const chamaId =
      await getChamaId(req);


    // --------------------------------------
    // 2. Validate Chama ID
    // --------------------------------------

    if (
      !chamaId ||
      !mongoose.Types.ObjectId.isValid(
        chamaId
      )
    ) {

      throw new AppError(
        'Invalid Chama ID',
        400
      );

    }


    // --------------------------------------
    // 3. Validate authenticated User
    // --------------------------------------

    validateAuthenticatedUser(req);


    // --------------------------------------
    // 4. Find Chama
    // --------------------------------------

    const chama =
      await Chama.findById(
        chamaId
      );


    if (!chama) {

      throw new AppError(
        'Chama not found',
        404
      );

    }


    // --------------------------------------
    // 5. Check Chama status
    // --------------------------------------

    if (
      chama.status !== 'active'
    ) {

      throw new AppError(
        'This Chama is not active',
        403
      );

    }


    // --------------------------------------
    // 6. Find authenticated user's
    //    Chama membership
    // --------------------------------------

    const membership =
      await ChamaMembership.findOne({

        user_id:
          req.user._id,

        chama_id:
          chama._id

      });


    // --------------------------------------
    // 7. Check membership exists
    // --------------------------------------

    if (!membership) {

      throw new AppError(
        'You are not a member of this Chama',
        403
      );

    }


    // --------------------------------------
    // 8. Check membership status
    // --------------------------------------

    if (
      membership.status !== 'active'
    ) {

      throw new AppError(
        'Your Chama membership is not active',
        403
      );

    }


    // --------------------------------------
    // 9. Attach Chama context
    // --------------------------------------

    req.chama =
      chama;


    // --------------------------------------
    // 10. Attach Membership context
    // --------------------------------------

    req.membership =
      membership;


    // --------------------------------------
    // 11. Check Audit Access Role
    // --------------------------------------

    const allowedRoles = [

      'treasurer',

      'auditor'

    ];


    if (
      !allowedRoles.includes(
        membership.role
      )
    ) {

      throw new AppError(
        'Only the treasurer or auditor can access audit logs',
        403
      );

    }


    // --------------------------------------
    // 12. Continue
    // --------------------------------------

    next();

  } catch (error) {

    next(error);

  }

};

// ========================================
// REQUIRE GROUP AUDIT ACCESS
// ========================================
//
// Authorization for /:groupId/group-audit-logs.
//
// Contribution Groups are not Chama documents,
// so this is self-contained and does not use
// getChamaId/Chama.findById. It:
//
// 1. Validates authenticated user
// 2. Finds the Contribution Group
// 3. Finds the user's membership in that group
// 4. Allows only the group's creator or a
//    member with role "organizer"
//
// ========================================

export const requireGroupAuditAccess = async (
  req,
  res,
  next
) => {

  try {

    validateAuthenticatedUser(req);

    const { groupId } = req.params;

    if (
      !groupId ||
      !mongoose.Types.ObjectId.isValid(groupId)
    ) {

      throw new AppError(
        'Invalid Group ID',
        400
      );

    }

    const group = await ContributionGroup.findById(groupId);

    if (!group) {

      throw new AppError(
        'Contribution group not found',
        404
      );

    }

    const groupMember = await ContributionGroupMember.findOne({
      user_id: req.user._id,
      contribution_group_id: group._id,
    });

    const isOrganizer =
      String(group.created_by) === String(req.user._id) ||
      groupMember?.role === 'organizer';

    if (!isOrganizer) {

      throw new AppError(
        'Only the group organizer can access audit logs',
        403
      );

    }

    req.group = group;
    req.groupMembership = groupMember;

    next();

  } catch (error) {

    next(error);

  }

};

// ========================================
// REQUIRE SECRETARY OR MANAGER
// ========================================
//
// Allows Chairperson, Treasurer, or Secretary
// for meeting records, announcements, and
// register management.
//
// ========================================

export const requireSecretaryOrManager = async (req, res, next) => {
  try {
    validateChamaContext(req);

    const allowedRoles = ['chairperson', 'treasurer', 'secretary'];

    if (!allowedRoles.includes(req.membership.role)) {
      throw new AppError('Only the chairperson, treasurer, or secretary can perform this action', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};