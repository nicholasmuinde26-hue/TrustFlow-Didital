import mongoose from 'mongoose';


import ContributionGroup
  from '../../models/ContributionGroup.js';

import ContributionGroupMember
  from '../../models/ContributionGroupMember.js';

import User
  from '../../models/User.js';

import AppError
  from '../../utils/AppError.js';

import {
  createAuditLog
} from '../../services/audit.service.js';

import {
  AUDIT_ACTIONS
} from '../../constants/audit.constants.js';


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

    throw new AppError(

      `Invalid ${fieldName}`,

      400

    );

  }

};


// ========================================
// ADD CONTRIBUTION GROUP MEMBER
// ========================================
//
// BUSINESS RULES:
//
// 1. Actor must be authenticated.
//
// 2. Actor must already belong to the
//    contribution group.
//
// 3. Actor must be:
//
//    organizer
//    OR
//    co_organizer
//
// 4. Target user must exist.
//
// 5. Target user must be active.
//
// 6. Target user cannot already have
//    a membership in this group.
//
// 7. New members are created as:
//
//    role: member
//
//    status: active
//
// 8. The actor who adds the member is
//    stored in:
//
//    invited_by
//
// ========================================

export const addContributionGroupMember = async ({

  actorUserId,

  groupId,

  userId

}) => {

  // ======================================
  // 1. VALIDATE ACTOR USER ID
  // ======================================

  validateObjectId(

    actorUserId,

    'actor user ID'

  );


  // ======================================
  // 2. VALIDATE GROUP ID
  // ======================================

  validateObjectId(

    groupId,

    'contribution group ID'

  );


  // ======================================
  // 3. VALIDATE TARGET USER ID
  // ======================================

  validateObjectId(

    userId,

    'user ID'

  );


  // ======================================
  // 4. FIND CONTRIBUTION GROUP
  // ======================================

  const group =

    await ContributionGroup

      .findById(

        groupId

      )

      .select(

        '_id name created_by status'

      )

      .lean();


  // ======================================
  // 5. GROUP MUST EXIST
  // ======================================

  if (

    !group

  ) {

    throw new AppError(

      'Contribution group not found',

      404

    );

  }


  // ======================================
  // 6. GROUP MUST BE ACTIVE
  // ======================================

  if (

    group.status !== 'active'

  ) {

    throw new AppError(

      'Members cannot be added to an inactive contribution group',

      409

    );

  }


  // ======================================
  // 7. FIND ACTOR MEMBERSHIP
  // ======================================
  //
  // IMPORTANT:
  //
  // We use the NEW schema fields:
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

  const actorMembership =

    await ContributionGroupMember

      .findOne({

        user_id:

          actorUserId,

        contribution_group_id:

          groupId,

        status:

          'active'

      })

      .lean();


  // ======================================
  // 8. ACTOR MUST BE A MEMBER
  // ======================================

  if (

    !actorMembership

  ) {

    throw new AppError(

      'You are not an active member of this contribution group',

      403

    );

  }


  // ======================================
  // 9. CHECK ACTOR PERMISSION
  // ======================================
  //
  // Only:
  //
  // organizer
  // co_organizer
  //
  // can add members.
  //
  // ======================================

  const allowedRoles = [

    'organizer',

    'co_organizer'

  ];


  if (

    !allowedRoles.includes(

      actorMembership.role

    )

  ) {

    throw new AppError(

      'Only the organizer or co-organizer can add members to this group',

      403

    );

  }


  // ======================================
  // 10. FIND TARGET USER
  // ======================================

  const targetUser =

    await User

      .findById(

        userId

      )

      .select(

        '_id name phone status'

      )

      .lean();


  // ======================================
  // 11. TARGET USER MUST EXIST
  // ======================================

  if (

    !targetUser

  ) {

    throw new AppError(

      'User to be added was not found',

      404

    );

  }


  // ======================================
  // 12. TARGET USER MUST BE ACTIVE
  // ======================================

  if (

    targetUser.status !== 'active'

  ) {

    throw new AppError(

      'The user cannot be added because their account is not active',

      409

    );

  }


  // ======================================
  // 13. PREVENT SELF-ADD
  // ======================================
  //
  // The organizer already has a membership.
  //
  // A member also cannot add themselves.
  //
  // ======================================

  if (

    actorUserId.toString() ===

    userId.toString()

  ) {

    throw new AppError(

      'You are already a member of this contribution group',

      409

    );

  }


  // ======================================
  // 14. CHECK EXISTING MEMBERSHIP
  // ======================================

  const existingMembership =

    await ContributionGroupMember

      .findOne({

        user_id:

          userId,

        contribution_group_id:

          groupId

      })

      .lean();


  // ======================================
  // 15. BLOCK DUPLICATE MEMBERSHIP
  // ======================================

  if (

    existingMembership

  ) {

    if (

      existingMembership.status ===

      'active'

    ) {

      throw new AppError(

        'This user is already an active member of this contribution group',

        409

      );

    }


    if (

      existingMembership.status ===

      'invited'

    ) {

      throw new AppError(

        'This user already has a pending invitation to this contribution group',

        409

      );

    }


    throw new AppError(

      'This user already has a membership record for this contribution group',

      409

    );

  }


  // ======================================
  // 16. CREATE MEMBERSHIP
  // ======================================

  let membership;


  try {

    membership =

      await ContributionGroupMember.create({

        user_id:

          userId,

        contribution_group_id:

          groupId,

        role:

          'member',

        status:

          'active',

        joined_at:

          new Date(),

        invited_by:

          actorUserId

      });

  } catch (error) {

    // ====================================
    // DUPLICATE KEY PROTECTION
    // ====================================

    if (

      error?.code === 11000

    ) {

      throw new AppError(

        'This user is already a member of this contribution group',

        409

      );

    }


    throw error;

  }


  // ======================================
  // 17. CREATE AUDIT LOG
  // ======================================

  try {

    await createAuditLog({

      actorUserId,

      scopeType:

        'CONTRIBUTION_GROUP',

      contributionGroupId:

        groupId,

      action:

        AUDIT_ACTIONS.CONTRIBUTION_GROUP_MEMBER_ADDED,

      resourceType:

        'ContributionGroupMember',

      resourceId:

        membership._id,

      before:

        null,

      after: {

        userId:

          membership.user_id,

        contributionGroupId:

          membership.contribution_group_id,

        role:

          membership.role,

        status:

          membership.status,

        invitedBy:

          membership.invited_by

      },

      metadata: {

        targetUserName:

          targetUser.name,

        targetUserPhone:

          targetUser.phone

      }

    });

  } catch (error) {

    console.error(

      'Member was added but audit logging failed:',

      error

    );

    throw error;

  }


  // ======================================
  // 18. POPULATE MEMBERSHIP
  // ======================================

  const populatedMembership =

    await ContributionGroupMember

      .findById(

        membership._id

      )

      .populate(

        'user_id',

        'name phone status'

      )

      .populate(

        'invited_by',

        'name phone status'

      );


  // ======================================
  // 19. RETURN RESULT
  // ======================================

  return {

    membership:

      populatedMembership

  };

};

// ========================================
// GET CONTRIBUTION GROUP MEMBERS
// ========================================
//
// BUSINESS RULES:
//
// 1. User must belong to the group.
// 2. User must have an active membership.
// 3. Any active member can view the
//    group's members.
//
// Returns:
//
// - User details
// - Membership role
// - Membership status
// - Joined date
// - Invited by
//
// ========================================

export const getContributionGroupMembers = async ({

  groupId

}) => {

  // ======================================
  // 1. VALIDATE GROUP ID
  // ======================================

  validateObjectId(

    groupId,

    'contribution group ID'

  );


  // ======================================
  // 2. CHECK GROUP EXISTS
  // ======================================

  const group =

    await ContributionGroup

      .findById(

        groupId

      )

      .select(

        '_id name status created_by'

      )

      .populate(

        'created_by',

        'name phone status'

      )

      .lean();


  // ======================================
  // 3. GROUP NOT FOUND
  // ======================================

  if (

    !group

  ) {

    throw new AppError(

      'Contribution group not found',

      404

    );

  }


  // ======================================
  // 4. FIND MEMBERS
  // ======================================

  const members =

    await ContributionGroupMember

      .find({

        contribution_group_id:

          groupId,

        status:

          'active'

      })

      .populate(

        'user_id',

        'name phone status'

      )

      .populate(

        'invited_by',

        'name phone status'

      )

      .sort({

        role:

          1,

        joined_at:

          1

      });


  // ======================================
  // 5. RETURN RESULT
  // ======================================

  return {

    group,

    members,

    total:

      members.length

  };

};


// ========================================
// REMOVE CONTRIBUTION GROUP MEMBER
// ========================================
//
// BUSINESS RULES:
//
// 1. Membership is SOFT REMOVED.
//
//    active
//       ↓
//    removed
//
// 2. The organizer cannot be removed.
//
// 3. The organizer cannot remove themselves.
//
// 4. The group creator is always the
//    primary organizer.
//
// 5. A removed membership remains in the
//    database for historical purposes.
//
// ========================================

export const removeContributionGroupMember = async ({

  groupId,

  memberId,

  actorUserId

}) => {

  // ======================================
  // 1. VALIDATE GROUP ID
  // ======================================

  if (

    !groupId ||

    !mongoose.Types.ObjectId.isValid(

      groupId

    )

  ) {

    throw new AppError(

      'Invalid contribution group ID',

      400

    );

  }


  // ======================================
  // 2. VALIDATE MEMBER ID
  // ======================================

  if (

    !memberId ||

    !mongoose.Types.ObjectId.isValid(

      memberId

    )

  ) {

    throw new AppError(

      'Invalid contribution group member ID',

      400

    );

  }


  // ======================================
  // 3. VALIDATE ACTOR ID
  // ======================================

  if (

    !actorUserId ||

    !mongoose.Types.ObjectId.isValid(

      actorUserId

    )

  ) {

    throw new AppError(

      'Invalid actor user ID',

      400

    );

  }


  // ======================================
  // 4. FIND GROUP
  // ======================================

  const group =

    await ContributionGroup

      .findById(

        groupId

      )

      .select(

        '_id name created_by status'

      );


  // ======================================
  // 5. GROUP NOT FOUND
  // ======================================

  if (

    !group

  ) {

    throw new AppError(

      'Contribution group not found',

      404

    );

  }


  // ======================================
  // 6. FIND TARGET MEMBERSHIP
  // ======================================

  const membership =

    await ContributionGroupMember

      .findOne({

        _id:

          memberId,

        contribution_group_id:

          groupId

      })

      .populate(

        'user_id',

        'name phone status'

      );


  // ======================================
  // 7. MEMBERSHIP NOT FOUND
  // ======================================

  if (

    !membership

  ) {

    throw new AppError(

      'Contribution group membership not found',

      404

    );

  }


  // ======================================
  // 8. CHECK MEMBERSHIP STATUS
  // ======================================

  if (

    membership.status !==

    'active'

  ) {

    throw new AppError(

      `This membership is already ${membership.status}`,

      409

    );

  }


  // ======================================
  // 9. PROTECT ORGANIZER
  // ======================================
  //
  // The organizer cannot be removed.
  //
  // This is a critical business rule.
  //
  // The organizer is represented by:
  //
  // ContributionGroup.created_by
  //
  // ======================================

  if (

    membership.role ===

    'organizer'

  ) {

    throw new AppError(

      'The contribution group organizer cannot be removed',

      403

    );

  }


  // ======================================
  // 10. PROTECT GROUP CREATOR
  // ======================================
  //
  // Defense in depth.
  //
  // Even if the membership role was
  // accidentally changed, the creator
  // cannot be removed from their own group.
  //
  // ======================================

  if (

    membership.user_id?._id?.toString() ===

    group.created_by.toString()

  ) {

    throw new AppError(

      'The contribution group creator cannot be removed',

      403

    );

  }


  // ======================================
  // 11. PREPARE BEFORE STATE
  // ======================================

  const before = {

    membershipId:

      membership._id,

    userId:

      membership.user_id?._id,

    role:

      membership.role,

    status:

      membership.status

  };


  // ======================================
  // 12. SOFT REMOVE MEMBER
  // ======================================

  membership.status =

    'removed';


  await membership.save();


  // ======================================
  // 13. CREATE AUDIT LOG
  // ======================================

  try {

    await createAuditLog({

      actorUserId,

      scopeType:

        'CONTRIBUTION_GROUP',

      contributionGroupId:

        group._id,

      action:

        AUDIT_ACTIONS.CONTRIBUTION_GROUP_MEMBER_REMOVED,

      resourceType:

        'ContributionGroupMember',

      resourceId:

        membership._id,

      before,

      after: {

        membershipId:

          membership._id,

        userId:

          membership.user_id?._id,

        role:

          membership.role,

        status:

          membership.status

      },

      metadata: {

        groupName:

          group.name,

        removedUserId:

          membership.user_id?._id

      }

    });

  } catch (error) {

    // ====================================
    // IMPORTANT
    // ====================================
    //
    // The membership has already been
    // successfully removed.
    //
    // We do not restore it automatically.
    //
    // The audit failure should be logged
    // and handled separately.
    //
    // ====================================

    console.error(

      'Member removed but audit logging failed:',

      error

    );

  }


  // ======================================
  // 14. RETURN RESULT
  // ======================================

  return {

    group,

    membership

  };

};


// ========================================
// UPDATE CONTRIBUTION GROUP MEMBER ROLE
// ========================================
//
// Allowed transitions:
//
// member
//    ↓
// co_organizer
//
// co_organizer
//    ↓
// member
//
// The organizer role is protected.
//
// The organizer is determined by:
//
// ContributionGroup.created_by
//
// ========================================

export const updateContributionGroupMemberRole = async ({

  groupId,

  memberId,

  actorUserId,

  role

}) => {

  // ======================================
  // 1. VALIDATE GROUP ID
  // ======================================

  if (

    !groupId ||

    !mongoose.Types.ObjectId.isValid(

      groupId

    )

  ) {

    throw new AppError(

      'Invalid contribution group ID',

      400

    );

  }


  // ======================================
  // 2. VALIDATE MEMBER ID
  // ======================================

  if (

    !memberId ||

    !mongoose.Types.ObjectId.isValid(

      memberId

    )

  ) {

    throw new AppError(

      'Invalid contribution group member ID',

      400

    );

  }


  // ======================================
  // 3. VALIDATE ACTOR ID
  // ======================================

  if (

    !actorUserId ||

    !mongoose.Types.ObjectId.isValid(

      actorUserId

    )

  ) {

    throw new AppError(

      'Invalid actor user ID',

      400

    );

  }


  // ======================================
  // 4. VALIDATE REQUESTED ROLE
  // ======================================

  const allowedRoles = [

    'member',

    'co_organizer',

    'treasurer'

  ];


  if (

    !allowedRoles.includes(

      role

    )

  ) {

    throw new AppError(

      'Invalid role. Only member, co_organizer, and treasurer roles are allowed.',

      400

    );

  }


  // ======================================
  // 5. FIND GROUP
  // ======================================

  const group =

    await ContributionGroup

      .findById(

        groupId

      )

      .select(

        '_id name created_by status'

      );


  if (

    !group

  ) {

    throw new AppError(

      'Contribution group not found',

      404

    );

  }


  // ======================================
  // 6. FIND TARGET MEMBERSHIP
  // ======================================

  const membership =

    await ContributionGroupMember

      .findOne({

        _id:

          memberId,

        contribution_group_id:

          groupId

      })

      .populate(

        'user_id',

        'name phone status'

      );


  if (

    !membership

  ) {

    throw new AppError(

      'Contribution group membership not found',

      404

    );

  }


  // ======================================
  // 7. MEMBERSHIP MUST BE ACTIVE
  // ======================================

  if (

    membership.status !==

    'active'

  ) {

    throw new AppError(

      `Cannot change role of a membership with status: ${membership.status}`,

      409

    );

  }


  // ======================================
  // 8. PROTECT ORGANIZER
  // ======================================
  //
  // The organizer cannot be changed into
  // another role.
  //
  // We check both:
  //
  // 1. Membership role
  // 2. ContributionGroup.created_by
  //
  // This provides defense in depth.
  //
  // ======================================

  const targetUserId =

    membership.user_id?._id;


  const isGroupCreator =

    targetUserId?.toString() ===

    group.created_by.toString();


  if (

    membership.role ===

      'organizer' ||

    isGroupCreator

  ) {

    throw new AppError(

      'The contribution group organizer role cannot be changed',

      403

    );

  }


  // ======================================
  // 9. CHECK IF ROLE IS ALREADY SET
  // ======================================

  if (

    membership.role ===

    role

  ) {

    throw new AppError(

      `Member already has the ${role} role`,

      409

    );

  }


  // ======================================
  // 10. SAVE BEFORE STATE
  // ======================================

  const previousRole =

    membership.role;


  const before = {

    membershipId:

      membership._id,

    userId:

      targetUserId,

    role:

      previousRole,

    status:

      membership.status

  };


  // ======================================
  // 11. UPDATE ROLE
  // ======================================

  membership.role =

    role;


  await membership.save();


  // ======================================
  // 12. CREATE AUDIT LOG
  // ======================================

  try {

    await createAuditLog({

      actorUserId,

      scopeType:

        'CONTRIBUTION_GROUP',

      contributionGroupId:

        group._id,

      action:

        AUDIT_ACTIONS.CONTRIBUTION_GROUP_MEMBER_ROLE_UPDATED,

      resourceType:

        'ContributionGroupMember',

      resourceId:

        membership._id,

      before,

      after: {

        membershipId:

          membership._id,

        userId:

          targetUserId,

        role:

          membership.role,

        status:

          membership.status

      },

      metadata: {

        groupName:

          group.name,

        previousRole,

        newRole:

          role

      }

    });

  } catch (error) {

    console.error(

      'Member role updated but audit logging failed:',

      error

    );

  }


  // ======================================
  // 13. RETURN RESULT
  // ======================================

  return {

    group,

    membership,

    previousRole,

    newRole:

      role

  };

};
