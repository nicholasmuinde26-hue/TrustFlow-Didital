import mongoose from 'mongoose';

import ContributionGroupMember
  from '../models/ContributionGroupMember.js';


// ========================================
// VALIDATE OBJECT ID
// ========================================

const validateObjectId = (
  value,
  fieldName
) => {

  if (
    !value ||
    !mongoose.Types.ObjectId.isValid(value)
  ) {

    const error =
      new Error(
        `Invalid ${fieldName}`
      );

    error.statusCode =
      400;

    throw error;

  }

};


// ========================================
// REQUIRE CONTRIBUTION GROUP MEMBER
// ========================================
//
// Requirements:
//
// 1. User must be authenticated.
// 2. User must have an active membership.
// 3. Membership is identified using:
//
//    user_id
//    contribution_group_id
//
// 4. Membership is attached to:
//
//    req.groupMembership
//
// ========================================

export const requireContributionGroupMember =
async (
  req,
  res,
  next
) => {

  try {

    // ======================================
    // 1. AUTHENTICATION CHECK
    // ======================================

    if (
      !req.user
    ) {

      const error =
        new Error(
          'Authentication required'
        );

      error.statusCode =
        401;

      throw error;

    }


    // ======================================
    // 2. GET GROUP ID
    // ======================================

    const groupId =
      req.params.groupId ||
      req.params.contributionGroupId;


    if (
      !groupId
    ) {

      const error =
        new Error(
          'Contribution group ID is required'
        );

      error.statusCode =
        400;

      throw error;

    }


    // ======================================
    // 3. VALIDATE GROUP ID
    // ======================================

    validateObjectId(

      groupId,

      'contribution group ID'

    );


    // ======================================
    // 4. VALIDATE USER ID
    // ======================================

    validateObjectId(

      req.user._id,

      'user ID'

    );


    // ======================================
    // 5. CHECK MEMBERSHIP
    // ======================================
    //
    // IMPORTANT:
    //
    // Your schema uses:
    //
    // user_id
    // contribution_group_id
    //
    // NOT:
    //
    // member_id
    // group_id
    //
    // ======================================

    const membership =

      await ContributionGroupMember
        .findOne({

          user_id:
            req.user._id,

          contribution_group_id:
            groupId,

          status:
            'active'

        });


    // ======================================
    // 6. NOT A MEMBER
    // ======================================

    if (
      !membership
    ) {

      const error =
        new Error(
          'You are not an active member of this contribution group'
        );

      error.statusCode =
        403;

      throw error;

    }


    // ======================================
    // 7. ATTACH MEMBERSHIP TO REQUEST
    // ======================================

    req.groupMembership =
      membership;


    // ======================================
    // 8. ATTACH GROUP ID
    // ======================================

    req.contributionGroupId =
      groupId;


    // ======================================
    // 9. CONTINUE
    // ======================================

    next();

  } catch (error) {

    next(error);

  }

};


// ========================================
// REQUIRE CONTRIBUTION GROUP ORGANIZER
// ========================================
//
// Only the primary organizer can perform
// organizer-level operations.
//
// Role:
//
// organizer
//
// ========================================

export const requireContributionGroupOrganizer =
(
  req,
  res,
  next
) => {

  try {

    // ======================================
    // 1. MEMBERSHIP MUST BE VERIFIED
    // ======================================

    if (
      !req.groupMembership
    ) {

      const error =
        new Error(
          'Group membership not verified'
        );

      error.statusCode =
        403;

      throw error;

    }


    // ======================================
    // 2. CHECK ORGANIZER ROLE
    // ======================================

    if (
      req.groupMembership.role !==
      'organizer'
    ) {

      const error =
        new Error(
          'Only the contribution group organizer can perform this action'
        );

      error.statusCode =
        403;

      throw error;

    }


    // ======================================
    // 3. CONTINUE
    // ======================================

    next();

  } catch (error) {

    next(error);

  }

};


// ========================================
// REQUIRE CONTRIBUTION GROUP MANAGER
// ========================================
//
// Allowed management roles:
//
// organizer
// co_organizer
//
// The organizer is the creator.
//
// Co-organizers can assist with
// group management.
//
// ========================================

export const requireContributionGroupManager =
(
  req,
  res,
  next
) => {

  try {

    // ======================================
    // 1. MEMBERSHIP MUST BE VERIFIED
    // ======================================

    if (
      !req.groupMembership
    ) {

      const error =
        new Error(
          'Group membership not verified'
        );

      error.statusCode =
        403;

      throw error;

    }


    // ======================================
    // 2. ALLOWED MANAGEMENT ROLES
    // ======================================

    const allowedRoles = [

      'organizer',

      'co_organizer'

    ];


    // ======================================
    // 3. CHECK ROLE
    // ======================================

    if (
      !allowedRoles.includes(

        req.groupMembership.role

      )
    ) {

      const error =
        new Error(
          'You do not have permission to manage this contribution group'
        );

      error.statusCode =
        403;

      throw error;

    }


    // ======================================
    // 4. CONTINUE
    // ======================================

    next();

  } catch (error) {

    next(error);

  }

};


// ========================================
// REQUIRE CONTRIBUTION GROUP CO-ORGANIZER
// OR ORGANIZER
// ========================================
//
// Useful for sensitive management actions.
//
// Allowed:
//
// organizer
// co_organizer
//
// ========================================

export const requireContributionGroupOrganizerOrCoOrganizer =
(
  req,
  res,
  next
) => {

  try {

    // ======================================
    // 1. MEMBERSHIP MUST BE VERIFIED
    // ======================================

    if (
      !req.groupMembership
    ) {

      const error =
        new Error(
          'Group membership not verified'
        );

      error.statusCode =
        403;

      throw error;

    }


    // ======================================
    // 2. CHECK ROLE
    // ======================================

    const allowedRoles = [

      'organizer',

      'co_organizer'

    ];


    if (
      !allowedRoles.includes(

        req.groupMembership.role

      )
    ) {

      const error =
        new Error(
          'Only the organizer or co-organizer can perform this action'
        );

      error.statusCode =
        403;

      throw error;

    }


    // ======================================
    // 3. CONTINUE
    // ======================================

    next();

  } catch (error) {

    next(error);

  }

};


// ========================================
// REQUIRE CONTRIBUTION GROUP MEMBER
// OR ORGANIZER
// ========================================
//
// Any active member can access the route.
//
// Roles:
//
// organizer
// co_organizer
// member
//
// ========================================

export const requireContributionGroupActiveMember =
(
  req,
  res,
  next
) => {

  try {

    if (
      !req.groupMembership
    ) {

      const error =
        new Error(
          'Group membership not verified'
        );

      error.statusCode =
        403;

      throw error;

    }


    const allowedRoles = [

      'organizer',

      'co_organizer',

      'member'

    ];


    if (
      !allowedRoles.includes(

        req.groupMembership.role

      )
    ) {

      const error =
        new Error(
          'Invalid contribution group membership role'
        );

      error.statusCode =
        403;

      throw error;

    }


    next();

  } catch (error) {

    next(error);

  }

};