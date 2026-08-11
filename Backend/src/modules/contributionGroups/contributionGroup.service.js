import mongoose from 'mongoose';

import User
  from '../../models/User.js';

import ContributionGroup
  from '../../models/ContributionGroup.js';

import ContributionGroupMember
  from '../../models/ContributionGroupMember.js';


import ContributionGroupInvitation
  from '../../models/ContributionGroupInvitation.js';

import FinancialAccount
  from '../../models/FinancialAccount.js';


import AppError
  from '../../utils/AppError.js';

import {
  createAuditLog
} from '../../services/audit.service.js';

import {
  AUDIT_ACTIONS
} from '../../constants/audit.constants.js';


// ========================================
// ALLOWED GROUP TYPES
// ========================================

const ALLOWED_GROUP_TYPES = [

  'party',

  'wedding',

  'graduation',

  'funeral',

  'birthday',

  'emergency',

  'fundraiser',

  'community',

  'other'

];


// ========================================
// ALLOWED VISIBILITY TYPES
// ========================================

const ALLOWED_VISIBILITY = [

  'private',

  'invite_only',

  'public'

];


// ========================================
// VALIDATE OBJECT ID
// ========================================

const validateObjectId = (

  value,

  fieldName

) => {

  if (

    !value ||

    !mongoose.Types.ObjectId.isValid(
      value
    )

  ) {

    throw new AppError(

      `Invalid ${fieldName}`,

      400

    );

  }

};


// ========================================
// VALIDATE GROUP CREATOR
// ========================================
//
// PRIMARY BUSINESS RULE
//
// The ONLY source of truth for whether a
// user already owns an active contribution
// group is:
//
//     ContributionGroup.created_by
//
// We DO NOT check:
//
//     ContributionGroupMember.role
//
// because membership is only a representation
// of the user's relationship with a group.
//
// BUSINESS RULES:
//
// User A creates Group 1
//     -> allowed
//
// User A creates Group 2 while Group 1 active
//     -> rejected
//
// User A joins Group 2 as member
//     -> allowed
//
// User A joins Group 3 as co_organizer
//     -> allowed
//
// User A creates another group after their
// first group becomes completed/cancelled/
// archived
//     -> allowed
//
// ========================================

const validateGroupCreator = async (

  userId

) => {

  // ======================================
  // 1. VALIDATE USER ID
  // ======================================

  validateObjectId(

    userId,

    'user ID'

  );


  // ======================================
  // 2. FIND EXISTING ACTIVE GROUP
  // ======================================
  //
  // IMPORTANT:
  //
  // This is the ONLY application-level
  // organizer ownership check.
  //
  // We query ContributionGroup.created_by.
  //
  // We do NOT query ContributionGroupMember.
  //
  // ======================================

  const existingGroup =

    await ContributionGroup
      .findOne({

        created_by:
          userId,

        status:
          'active'

      })
      .select(

        '_id name status created_by'

      )
      .lean();


  // ======================================
  // 3. DEBUG LOG
  // ======================================

  console.log(

    '\n========================================'

  );

  console.log(

    'GROUP CREATOR VALIDATION'

  );

  console.log(

    'User ID:',

    userId

  );

  console.log(

    'Existing Active Group:',

    existingGroup

  );

  console.log(

    '========================================\n'

  );


  // ======================================
  // 4. BLOCK SECOND ACTIVE GROUP
  // ======================================

  if (

    existingGroup

  ) {

    throw new AppError(

      `You already have an active contribution group: ${existingGroup.name}`,

      409

    );

  }

};


// ========================================
// CREATE CONTRIBUTION GROUP
// ========================================

export const createContributionGroup = async ({

  actorUserId,

  name,

  description,

  type,

  event_date,

  location,

  visibility

}) => {

  // ======================================
  // 1. VALIDATE ACTOR
  // ======================================

  await validateGroupCreator(

    actorUserId

  );


  // ======================================
  // 2. VALIDATE GROUP NAME
  // ======================================

  if (

    !name ||

    typeof name !== 'string' ||

    name.trim().length < 2

  ) {

    throw new AppError(

      'Contribution group name must contain at least 2 characters',

      400

    );

  }


  // ======================================
  // 3. VALIDATE GROUP TYPE
  // ======================================

  const groupType =

    type || 'other';


  if (

    !ALLOWED_GROUP_TYPES.includes(

      groupType

    )

  ) {

    throw new AppError(

      'Invalid contribution group type',

      400

    );

  }


  // ======================================
  // 4. VALIDATE VISIBILITY
  // ======================================

  const groupVisibility =

    visibility || 'invite_only';


  if (

    !ALLOWED_VISIBILITY.includes(

      groupVisibility

    )

  ) {

    throw new AppError(

      'Invalid contribution group visibility',

      400

    );

  }


  // ======================================
  // 5. VALIDATE EVENT DATE
  // ======================================

  let parsedEventDate = null;


  if (

    event_date

  ) {

    parsedEventDate =

      new Date(

        event_date

      );


    if (

      Number.isNaN(

        parsedEventDate.getTime()

      )

    ) {

      throw new AppError(

        'Invalid event date',

        400

      );

    }

  }


  // ======================================
  // 6. CREATE CONTRIBUTION GROUP
  // ======================================
  //
  // The `created_by` field is the primary
  // source of truth for ownership.
  //
  // The unique partial index on:
  //
  //     created_by
  //
  // with:
  //
  //     status = active
  //
  // prevents two active groups from being
  // created by the same user.
  //
  // ======================================

  let group;


  try {

    group =

      await ContributionGroup.create({

        name:

          name.trim(),

        description:

          description?.trim() || null,

        type:

          groupType,

        created_by:

          actorUserId,

        status:

          'active',

        visibility:

          groupVisibility,

        event_date:

          parsedEventDate,

        location:

          location?.trim() || null

      });

  } catch (error) {

    // ====================================
    // DUPLICATE ACTIVE CREATOR
    // ====================================
    //
    // This protects against race conditions.
    //
    // Example:
    //
    // Request A checks -> no group
    // Request B checks -> no group
    //
    // Both attempt creation.
    //
    // MongoDB unique partial index ensures
    // only one succeeds.
    //
    // ====================================

    if (

      error?.code === 11000

    ) {

      throw new AppError(

        'You already have an active contribution group. A user can create only one active contribution group.',

        409

      );

    }


    throw error;

  }


  // ======================================
  // 7. CREATE ORGANIZER MEMBERSHIP
  // ======================================
  //
  // The creator automatically becomes an
  // active organizer MEMBER of the group.
  //
  // IMPORTANT:
  //
  // This membership is NOT used to enforce
  // the one-group ownership rule.
  //
  // Ownership is determined by:
  //
  //     ContributionGroup.created_by
  //
  // ======================================

  let organizerMembership;


  try {

    organizerMembership =

      await ContributionGroupMember.create({

        user_id:

          actorUserId,

        contribution_group_id:

          group._id,

        role:

          'organizer',

        status:

          'active',

        joined_at:

          new Date(),

        invited_by:

          null

      });

  } catch (error) {

    // ====================================
    // MEMBERSHIP CREATION FAILED
    // ====================================
    //
    // The group was created successfully,
    // but its required organizer membership
    // failed.
    //
    // We must remove the group to prevent
    // an orphaned ContributionGroup.
    //
    // ====================================

    await ContributionGroup.deleteOne({

      _id:

        group._id

    });


    throw error;

  }


  // ======================================
  // 7b. BOOTSTRAP CHART OF ACCOUNTS
  // ======================================
  //
  // Contribution payments (cash and M-Pesa)
  // are posted against CASH / BANK /
  // MPESA_CLEARING / MEMBER_CONTRIBUTIONS
  // financial accounts. Without this step,
  // the first contribution ever recorded
  // against a new group fails with
  // "<code> account not configured."
  //
  // ======================================

  try {

    await FinancialAccount.bootstrapSystemAccounts({

      owner_type:
        'ContributionGroup',

      owner_id:
        group._id,

      created_by:
        actorUserId

    });

  } catch (error) {

    await ContributionGroupMember.deleteOne({
      _id: organizerMembership._id
    });

    await ContributionGroup.deleteOne({
      _id: group._id
    });

    throw error;

  }


  // ======================================
  // 8. CREATE AUDIT LOG
  // ======================================

  try {

    await createAuditLog({

      actorUserId,

      scopeType:

        'CONTRIBUTION_GROUP',

      contributionGroupId:

        group._id,

      action:

        AUDIT_ACTIONS.CONTRIBUTION_GROUP_CREATED,

      resourceType:

        'ContributionGroup',

      resourceId:

        group._id,

      before:

        null,

      after: {

        name:

          group.name,

        type:

          group.type,

        status:

          group.status,

        visibility:

          group.visibility,

        createdBy:

          group.created_by

      },

      metadata: {

        organizerMembershipId:

          organizerMembership._id

      }

    });

  } catch (error) {

    // ====================================
    // AUDIT FAILURE
    // ====================================
    //
    // At this stage the group and organizer
    // membership already exist.
    //
    // We do NOT delete the group silently
    // because deleting business data after
    // successful creation can cause more
    // serious consistency problems.
    //
    // Log the failure and propagate it.
    //
    // Ideally, this entire operation should
    // later use a MongoDB transaction.
    //
    // ====================================

    console.error(

      'Contribution group created but audit logging failed:',

      error

    );

    throw error;

  }


  // ======================================
  // 9. POPULATE CREATOR
  // ======================================

  await group.populate(

    'created_by',

    'name phone status'

  );


  // ======================================
  // 10. RETURN RESULT
  // ======================================

  return {

    group,

    organizerMembership

  };

};

// ========================================
// INVITE USER TO CONTRIBUTION GROUP
// ========================================
//
// BUSINESS RULES:
//
// 1. Only an authenticated group manager
//    can reach this service.
//
// 2. The target user must exist.
//
// 3. The group must exist.
//
// 4. The group must be active.
//
// 5. A user cannot be invited if they are
//    already an active member.
//
// 6. A user cannot have multiple pending
//    invitations for the same group.
//
// 7. The invitation is created as:
//
//       status: pending
//
// 8. The user does NOT become a member yet.
//
// Membership is created only after the
// invited user accepts the invitation.
//
// ========================================

export const inviteUserToContributionGroup = async ({

  actorUserId,

  groupId,

  invitedUserId,

  message,

  expiresAt

}) => {

  // ======================================
  // 1. VALIDATE ACTOR USER ID
  // ======================================

  validateObjectId(

    actorUserId,

    'inviting user ID'

  );


  // ======================================
  // 2. VALIDATE GROUP ID
  // ======================================

  validateObjectId(

    groupId,

    'contribution group ID'

  );


  // ======================================
  // 3. VALIDATE INVITED USER ID
  // ======================================

  validateObjectId(

    invitedUserId,

    'invited user ID'

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
  // 5. VERIFY GROUP IS ACTIVE
  // ======================================

  if (

    group.status !==
    'active'

  ) {

    throw new AppError(

      'Members cannot be invited to an inactive contribution group',

      400

    );

  }


  // ======================================
  // 6. VERIFY INVITED USER EXISTS
  // ======================================

  const invitedUser =

    await User
      .findById(

        invitedUserId

      )
      .select(

        '_id name phone status'

      )
      .lean();


  if (

    !invitedUser

  ) {

    throw new AppError(

      'The user you are trying to invite does not exist',

      404

    );

  }


  // ======================================
  // 7. VERIFY USER ACCOUNT IS ACTIVE
  // ======================================

  if (

    invitedUser.status !==
    'active'

  ) {

    throw new AppError(

      'The user you are trying to invite is not active',

      400

    );

  }


  // ======================================
  // 8. PREVENT SELF-INVITATION
  // ======================================

  if (

    String(invitedUserId) ===
    String(actorUserId)

  ) {

    throw new AppError(

      'You cannot invite yourself to a contribution group',

      400

    );

  }


  // ======================================
  // 9. CHECK EXISTING MEMBERSHIP
  // ======================================

  const existingMembership =

    await ContributionGroupMember
      .findOne({

        user_id:

          invitedUserId,

        contribution_group_id:

          groupId,

        status:

          'active'

      })
      .lean();


  if (

    existingMembership

  ) {

    throw new AppError(

      'This user is already an active member of the contribution group',

      409

    );

  }


  // ======================================
  // 10. CHECK EXISTING PENDING INVITATION
  // ======================================

  const existingInvitation =

    await ContributionGroupInvitation
      .findOne({

        contribution_group_id:

          groupId,

        invited_user_id:

          invitedUserId,

        status:

          'pending'

      })
      .lean();


  if (

    existingInvitation

  ) {

    throw new AppError(

      'This user already has a pending invitation to this contribution group',

      409

    );

  }


  // ======================================
  // 11. VALIDATE EXPIRATION DATE
  // ======================================

  let parsedExpiresAt = null;


  if (

    expiresAt

  ) {

    parsedExpiresAt =

      new Date(

        expiresAt

      );


    if (

      Number.isNaN(

        parsedExpiresAt.getTime()

      )

    ) {

      throw new AppError(

        'Invalid invitation expiration date',

        400

      );

    }


    // ====================================
    // EXPIRATION MUST BE IN THE FUTURE
    // ====================================

    if (

      parsedExpiresAt <=
      new Date()

    ) {

      throw new AppError(

        'Invitation expiration date must be in the future',

        400

      );

    }

  }


  // ======================================
  // 12. CREATE INVITATION
  // ======================================

  let invitation;


  try {

    invitation =

      await ContributionGroupInvitation.create({

        contribution_group_id:

          groupId,

        invited_user_id:

          invitedUserId,

        invited_by:

          actorUserId,

        status:

          'pending',

        message:

          message?.trim() || null,

        expires_at:

          parsedExpiresAt

      });

  } catch (error) {

    // ====================================
    // DUPLICATE PENDING INVITATION
    // ====================================

    if (

      error?.code ===
      11000

    ) {

      throw new AppError(

        'This user already has a pending invitation to this contribution group',

        409

      );

    }


    throw error;

  }


  // ======================================
  // 13. POPULATE INVITATION
  // ======================================

  await invitation.populate([

    {

      path:

        'contribution_group_id',

      select:

        'name status created_by'

    },

    {

      path:

        'invited_user_id',

      select:

        'name phone status'

    },

    {

      path:

        'invited_by',

      select:

        'name phone status'

    }

  ]);


  // ======================================
  // 14. CREATE AUDIT LOG
  // ======================================

  try {

    await createAuditLog({

      actorUserId,

      scopeType:

        'CONTRIBUTION_GROUP',

      contributionGroupId:

        groupId,

      action:

        AUDIT_ACTIONS.CONTRIBUTION_GROUP_MEMBER_INVITED,

      resourceType:

        'ContributionGroupInvitation',

      resourceId:

        invitation._id,

      before:

        null,

      after: {

        contributionGroupId:

          groupId,

        invitedUserId:

          invitedUserId,

        invitedBy:

          actorUserId,

        status:

          'pending'

      },

      metadata: {

        invitationId:

          invitation._id

      }

    });

  } catch (error) {

    // ====================================
    // AUDIT FAILURE
    // ====================================
    //
    // The invitation has already been
    // created.
    //
    // Do not delete it silently.
    //
    // ====================================

    console.error(

      'Invitation created but audit logging failed:',

      error

    );

  }


  // ======================================
  // 15. RETURN RESULT
  // ======================================

  return {

    invitation

  };

};

// ========================================
// GET MY CONTRIBUTION GROUP INVITATIONS
// ========================================
//
// Returns invitations received by the
// authenticated user.
//
// The authenticated user is taken from:
//
//     actorUserId
//
// Users can only see their own invitations.
//
// ========================================

export const getMyContributionGroupInvitations = async ({

  actorUserId,

  status

}) => {

  // ======================================
  // 1. VALIDATE USER ID
  // ======================================

  validateObjectId(

    actorUserId,

    'user ID'

  );


  // ======================================
  // 2. BUILD QUERY
  // ======================================

  const query = {

    invited_user_id:

      actorUserId

  };


  // ======================================
  // 3. OPTIONAL STATUS FILTER
  // ======================================
  //
  // Example:
  //
  // GET /invitations?status=pending
  //
  // ======================================

  if (

    status

  ) {

    const allowedStatuses = [

      'pending',

      'accepted',

      'declined',

      'cancelled',

      'expired'

    ];


    if (

      !allowedStatuses.includes(

        status

      )

    ) {

      throw new AppError(

        'Invalid invitation status',

        400

      );

    }


    query.status = status;

  }


  // ======================================
  // 4. FIND INVITATIONS
  // ======================================

  const invitations =

    await ContributionGroupInvitation

      .find(

        query

      )

      .populate(

        'contribution_group_id',

        'name description type status visibility event_date location created_by'

      )

      .populate(

        'invited_by',

        'name phone status'

      )

      .sort({

        createdAt:

          -1

      });


  // ======================================
  // 5. RETURN RESULT
  // ======================================

  return {

    invitations,

    total:

      invitations.length

  };

};

// ========================================
// ACCEPT CONTRIBUTION GROUP INVITATION
// ========================================
//
// BUSINESS FLOW:
//
// 1. Find invitation
// 2. Verify invitation belongs to user
// 3. Verify invitation is pending
// 4. Verify group exists
// 5. Verify group is active
// 6. Check existing membership
// 7. Create active member
// 8. Mark invitation as accepted
//
// ========================================

export const acceptContributionGroupInvitation = async ({

  invitationId,

  actorUserId

}) => {

  // ======================================
  // 1. VALIDATE INVITATION ID
  // ======================================

  if (

    !invitationId ||

    !mongoose.Types.ObjectId.isValid(

      invitationId

    )

  ) {

    throw new AppError(

      'Invalid invitation ID',

      400

    );

  }


  // ======================================
  // 2. VALIDATE USER ID
  // ======================================

  if (

    !actorUserId ||

    !mongoose.Types.ObjectId.isValid(

      actorUserId

    )

  ) {

    throw new AppError(

      'Invalid user ID',

      400

    );

  }


  // ======================================
  // 3. FIND INVITATION
  // ======================================

  const invitation =

    await ContributionGroupInvitation.findOne({

      _id:

        invitationId,

      invited_user_id:

        actorUserId

    });


  // ======================================
  // 4. INVITATION NOT FOUND
  // ======================================

  if (

    !invitation

  ) {

    throw new AppError(

      'Invitation not found',

      404

    );

  }


  // ======================================
  // 5. CHECK INVITATION STATUS
  // ======================================

  if (

    invitation.status !==

    'pending'

  ) {

    throw new AppError(

      `This invitation has already been ${invitation.status}`,

      409

    );

  }


  // ======================================
  // 6. CHECK INVITATION EXPIRATION
  // ======================================

  if (

    invitation.expires_at &&

    new Date() >

    invitation.expires_at

  ) {

    invitation.status =

      'expired';

    invitation.responded_at =

      new Date();

    await invitation.save();


    throw new AppError(

      'This invitation has expired',

      410

    );

  }


  // ======================================
  // 7. FIND CONTRIBUTION GROUP
  // ======================================

  const group =

    await ContributionGroup.findOne({

      _id:

        invitation.contribution_group_id,

      status:

        'active'

    });


  // ======================================
  // 8. GROUP NOT AVAILABLE
  // ======================================

  if (

    !group

  ) {

    throw new AppError(

      'This contribution group is no longer active',

      409

    );

  }


  // ======================================
  // 9. CHECK EXISTING MEMBERSHIP
  // ======================================

  const existingMembership =

    await ContributionGroupMember.findOne({

      user_id:

        actorUserId,

      contribution_group_id:

        group._id

    });


  // ======================================
  // 10. ALREADY A MEMBER
  // ======================================

  if (

    existingMembership

  ) {

    if (

      existingMembership.status ===

      'active'

    ) {

      throw new AppError(

        'You are already an active member of this contribution group',

        409

      );

    }


    // ====================================
    // RESTORE REMOVED MEMBERSHIP
    // ====================================
    //
    // If the user was previously removed,
    // we can reactivate the existing
    // membership instead of creating a
    // duplicate record.
    //
    // ====================================

    if (

      existingMembership.status ===

      'removed'

    ) {

      existingMembership.status =

        'active';

      existingMembership.role =

        'member';

      existingMembership.joined_at =

        new Date();

      existingMembership.invited_by =

        invitation.invited_by;

      await existingMembership.save();

    }

    else {

      throw new AppError(

        'You already have a membership record for this contribution group',

        409

      );

    }

  }

  else {

    // ====================================
    // 11. CREATE MEMBERSHIP
    // ====================================

    await ContributionGroupMember.create({

      user_id:

        actorUserId,

      contribution_group_id:

        group._id,

      role:

        'member',

      status:

        'active',

      joined_at:

        new Date(),

      invited_by:

        invitation.invited_by

    });

  }


  // ======================================
  // 12. ACCEPT INVITATION
  // ======================================

  invitation.status =

    'accepted';

  invitation.responded_at =

    new Date();


  await invitation.save();


  // ======================================
  // 13. RETURN RESULT
  // ======================================

  const membership =

    await ContributionGroupMember.findOne({

      user_id:

        actorUserId,

      contribution_group_id:

        group._id

    });


  return {

    invitation,

    membership,

    group

  };

};

// ========================================
// GET SINGLE CONTRIBUTION GROUP
// ========================================
//
// Returns:
//
// 1. Group details
// 2. Primary organizer / creator
// 3. Current user's membership
// 4. Total active member count
//
// ========================================

export const getContributionGroupById = async ({

  groupId,

  actorUserId

}) => {

  // ======================================
  // 1. VALIDATE GROUP ID
  // ======================================

  validateObjectId(

    groupId,

    'contribution group ID'

  );


  // ======================================
  // 2. VALIDATE USER ID
  // ======================================

  validateObjectId(

    actorUserId,

    'user ID'

  );


  // ======================================
  // 3. FIND GROUP
  // ======================================

  const group =

    await ContributionGroup

      .findById(

        groupId

      )

      .populate(

        'created_by',

        'name phone status'

      );


  // ======================================
  // 4. GROUP NOT FOUND
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
  // 5. FIND CURRENT USER MEMBERSHIP
  // ======================================

  const membership =

    await ContributionGroupMember

      .findOne({

        user_id:

          actorUserId,

        contribution_group_id:

          groupId

      });


  // ======================================
  // 6. COUNT ACTIVE MEMBERS
  // ======================================

  const memberCount =

    await ContributionGroupMember

      .countDocuments({

        contribution_group_id:

          groupId,

        status:

          'active'

      });


  // ======================================
  // 7. RETURN
  // ======================================

  return {

    group,

    membership,

    memberCount

  };

};

// ========================================
// GET MY CONTRIBUTION GROUPS
// ========================================
//
// Returns all active groups where the
// authenticated user has an active
// membership.
//
// Roles:
// - organizer
// - co_organizer
// - member
//
// ========================================

export const getMyContributionGroups = async ({

  actorUserId

}) => {

  // ======================================
  // 1. VALIDATE USER
  // ======================================

  validateObjectId(

    actorUserId,

    'user ID'

  );


  // ======================================
  // 2. FIND ACTIVE MEMBERSHIPS
  // ======================================

  const memberships =

    await ContributionGroupMember

      .find({

        user_id:

          actorUserId,

        status:

          'active'

      })

      .populate({

        path:

          'contribution_group_id',

        populate: {

          path:

            'created_by',

          select:

            'name phone status'

        }

      })

      .sort({

        createdAt:

          -1

      });


  // ======================================
  // 3. FORMAT RESULTS
  // ======================================

  const groups =

    memberships

      .filter(

        membership =>

          membership.contribution_group_id

      )

      .map(

        membership => ({

          group:

            membership.contribution_group_id,

          membership: {

            _id:

              membership._id,

            role:

              membership.role,

            status:

              membership.status,

            joined_at:

              membership.joined_at

          }

        })

      );


  // ======================================
  // 4. RETURN
  // ======================================

  return {

    groups,

    total:

      groups.length

  };

};

// ========================================
// UPDATE CONTRIBUTION GROUP
// ========================================

export const updateContributionGroup = async ({

  groupId,

  actorUserId,

  name,

  description,

  type,

  event_date,

  location,

  visibility

}) => {

  validateObjectId(

    groupId,

    'contribution group ID'

  );


  validateObjectId(

    actorUserId,

    'user ID'

  );


  // ======================================
  // 1. FIND GROUP
  // ======================================

  const group =

    await ContributionGroup.findById(

      groupId

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
  // 2. ONLY ACTIVE GROUPS CAN BE UPDATED
  // ======================================

  if (

    group.status !==

    'active'

  ) {

    throw new AppError(

      'Only active contribution groups can be updated',

      409

    );

  }


  // ======================================
  // 3. VERIFY MANAGER
  // ======================================

  const membership =

    await ContributionGroupMember.findOne({

      user_id:

        actorUserId,

      contribution_group_id:

        groupId,

      status:

        'active'

    });


  if (

    !membership ||

    ![

      'organizer',

      'co_organizer'

    ].includes(

      membership.role

    )

  ) {

    throw new AppError(

      'Only the organizer or co-organizer can update this contribution group',

      403

    );

  }


  // ======================================
  // 4. STORE BEFORE STATE
  // ======================================

  const before = {

    name:

      group.name,

    description:

      group.description,

    type:

      group.type,

    event_date:

      group.event_date,

    location:

      group.location,

    visibility:

      group.visibility

  };


  // ======================================
  // 5. UPDATE PROVIDED FIELDS
  // ======================================

  if (

    name !== undefined

  ) {

    if (

      typeof name !== 'string' ||

      name.trim().length < 2

    ) {

      throw new AppError(

        'Contribution group name must contain at least 2 characters',

        400

      );

    }

    group.name =

      name.trim();

  }


  if (

    description !== undefined

  ) {

    group.description =

      description?.trim() || null;

  }


  if (

    type !== undefined

  ) {

    if (

      !ALLOWED_GROUP_TYPES.includes(

        type

      )

    ) {

      throw new AppError(

        'Invalid contribution group type',

        400

      );

    }

    group.type =

      type;

  }


  if (

    event_date !== undefined

  ) {

    if (

      event_date === null

    ) {

      group.event_date =

        null;

    }

    else {

      const parsedDate =

        new Date(

          event_date

        );


      if (

        Number.isNaN(

          parsedDate.getTime()

        )

      ) {

        throw new AppError(

          'Invalid event date',

          400

        );

      }


      group.event_date =

        parsedDate;

    }

  }


  if (

    location !== undefined

  ) {

    group.location =

      location?.trim() || null;

  }


  if (

    visibility !== undefined

  ) {

    if (

      !ALLOWED_VISIBILITY.includes(

        visibility

      )

    ) {

      throw new AppError(

        'Invalid contribution group visibility',

        400

      );

    }

    group.visibility =

      visibility;

  }


  // ======================================
  // 6. SAVE
  // ======================================

  await group.save();


  // ======================================
  // 7. AUDIT
  // ======================================

  await createAuditLog({

    actorUserId,

    scopeType:

      'CONTRIBUTION_GROUP',

    contributionGroupId:

      group._id,

    action:

      AUDIT_ACTIONS.CONTRIBUTION_GROUP_UPDATED,

    resourceType:

      'ContributionGroup',

    resourceId:

      group._id,

    before,

    after: {

      name:

        group.name,

      description:

        group.description,

      type:

        group.type,

      event_date:

        group.event_date,

      location:

        group.location,

      visibility:

        group.visibility

    }

  });


  await group.populate(

    'created_by',

    'name phone status'

  );


  return {

    group

  };

};

// ========================================
// UPDATE CONTRIBUTION GROUP STATUS
// ========================================

export const updateContributionGroupStatus = async ({

  groupId,

  actorUserId,

  status

}) => {

  validateObjectId(

    groupId,

    'contribution group ID'

  );


  validateObjectId(

    actorUserId,

    'user ID'

  );


  const allowedStatuses = [

    'active',

    'completed',

    'cancelled',

    'archived'

  ];


  if (

    !allowedStatuses.includes(

      status

    )

  ) {

    throw new AppError(

      'Invalid contribution group status',

      400

    );

  }


  // ======================================
  // 1. FIND GROUP
  // ======================================

  const group =

    await ContributionGroup.findById(

      groupId

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
  // 2. VERIFY PRIMARY ORGANIZER
  // ======================================

  if (

    group.created_by.toString() !==

    actorUserId.toString()

  ) {

    throw new AppError(

      'Only the primary organizer can change the contribution group status',

      403

    );

  }


  // ======================================
  // 3. PREVENT NO-OP
  // ======================================

  if (

    group.status ===

    status

  ) {

    throw new AppError(

      `Contribution group is already ${status}`,

      409

    );

  }


  // ======================================
  // 4. PREVENT ARCHIVED MODIFICATION
  // ======================================

  if (

    group.status ===

    'archived'

  ) {

    throw new AppError(

      'An archived contribution group cannot be modified',

      409

    );

  }


  // ======================================
  // 5. VALIDATE TRANSITION
  // ======================================

  const validTransitions = {

    active: [

      'completed',

      'cancelled',

      'archived'

    ],

    completed: [

      'archived'

    ],

    cancelled: [

      'archived'

    ]

  };


  if (

    !validTransitions[

      group.status

    ]?.includes(

      status

    )

  ) {

    throw new AppError(

      `Cannot change contribution group status from ${group.status} to ${status}`,

      409

    );

  }


  // ======================================
  // 6. STORE BEFORE STATE
  // ======================================

  const previousStatus =

    group.status;


  // ======================================
  // 7. UPDATE STATUS
  // ======================================

  group.status =

    status;


  await group.save();


  // ======================================
  // 8. DETERMINE AUDIT ACTION
  // ======================================

  const auditActions = {

    completed:

      AUDIT_ACTIONS.CONTRIBUTION_GROUP_COMPLETED,

    cancelled:

      AUDIT_ACTIONS.CONTRIBUTION_GROUP_CANCELLED,

    archived:

      AUDIT_ACTIONS.CONTRIBUTION_GROUP_ARCHIVED

  };


  // ======================================
  // 9. AUDIT
  // ======================================

  await createAuditLog({

    actorUserId,

    scopeType:

      'CONTRIBUTION_GROUP',

    contributionGroupId:

      group._id,

    action:

      auditActions[

        status

      ],

    resourceType:

      'ContributionGroup',

    resourceId:

      group._id,

    before: {

      status:

        previousStatus

    },

    after: {

      status:

        group.status

    }

  });


  // ======================================
  // 10. RETURN
  // ======================================

  await group.populate(

    'created_by',

    'name phone status'

  );


  return {

    group

  };

};