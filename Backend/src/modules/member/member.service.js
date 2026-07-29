import mongoose from 'mongoose';

import User from '../../models/User.js';
import Chama from '../../models/Chama.js';
import ChamaMembership from '../../models/ChamaMembership.js';

import AppError from '../../utils/AppError.js';

import {
  createAuditLog
} from '../../services/audit.service.js';

import {
  AUDIT_ACTIONS
} from '../../constants/audit.constants.js';


// ========================================
// CONSTANTS
// ========================================

const ALLOWED_ROLES = [
  'member',
  'treasurer',
  'auditor'
];

const ALLOWED_STATUSES = [
  'active',
  'inactive',
  'suspended',
  'removed'
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
    !mongoose.Types.ObjectId.isValid(value)
  ) {

    throw new AppError(
      `Invalid ${fieldName}`,
      400
    );

  }

};


// ========================================
// VERIFY ACTOR AUTHORIZATION
// ========================================
//
// Service-level authorization.
//
// Verifies:
//
// 1. Chama exists
// 2. Chama is active
// 3. Actor User exists
// 4. Actor account is active
// 5. Actor is a Chama member
// 6. Actor membership is active
// 7. Actor has required role
//
// ========================================

const requireChamaRole = async ({
  chamaId,
  actorUserId,
  requiredRole
}) => {

  // --------------------------------------
  // 1. Validate IDs
  // --------------------------------------

  validateObjectId(
    chamaId,
    'Chama ID'
  );

  validateObjectId(
    actorUserId,
    'actor user ID'
  );


  // --------------------------------------
  // 2. Find Chama
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
  // 3. Check Chama status
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
  // 4. Verify Actor User
  // --------------------------------------

  const actor =
    await User.findById(
      actorUserId
    );


  if (!actor) {

    throw new AppError(
      'Authenticated user not found',
      401
    );

  }


  // --------------------------------------
  // 5. Check Actor account status
  // --------------------------------------

  if (
    actor.status !== 'active'
  ) {

    throw new AppError(
      'Your user account is not active',
      403
    );

  }


  // --------------------------------------
  // 6. Find Actor membership
  // --------------------------------------

  const actorMembership =
    await ChamaMembership.findOne({

      user_id:
        actorUserId,

      chama_id:
        chamaId

    });


  if (!actorMembership) {

    throw new AppError(
      'You are not a member of this Chama',
      403
    );

  }


  // --------------------------------------
  // 7. Check Actor membership status
  // --------------------------------------

  if (
    actorMembership.status !== 'active'
  ) {

    throw new AppError(
      'Your membership in this Chama is not active',
      403
    );

  }


  // --------------------------------------
  // 8. Check required role
  // --------------------------------------

  if (
    requiredRole &&
    actorMembership.role !== requiredRole
  ) {

    throw new AppError(
      `Only the ${requiredRole} can perform this action`,
      403
    );

  }


  // --------------------------------------
  // 9. Return authorization context
  // --------------------------------------

  return {

    chama,

    actor,

    actorMembership

  };

};


// ========================================
// ADD MEMBER TO CHAMA
// ========================================

export const addMemberToChama = async ({
  chamaId,
  actorUserId,
  userId
}) => {

  // --------------------------------------
  // 1. Validate IDs
  // --------------------------------------

  validateObjectId(
    chamaId,
    'Chama ID'
  );

  validateObjectId(
    actorUserId,
    'actor user ID'
  );

  validateObjectId(
    userId,
    'user ID'
  );


  // --------------------------------------
  // 2. Verify Treasurer
  // --------------------------------------

  await requireChamaRole({

    chamaId,

    actorUserId,

    requiredRole:
      'treasurer'

  });


  // --------------------------------------
  // 3. Prevent self-addition
  // --------------------------------------

  if (
    actorUserId.toString() ===
    userId.toString()
  ) {

    throw new AppError(
      'You are already a member of this Chama',
      409
    );

  }


  // --------------------------------------
  // 4. Find target User
  // --------------------------------------

  const user =
    await User.findById(
      userId
    );


  if (!user) {

    throw new AppError(
      'User not found',
      404
    );

  }


  // --------------------------------------
  // 5. Check target User status
  // --------------------------------------

  if (
    user.status !== 'active'
  ) {

    throw new AppError(
      'This user account is not active',
      403
    );

  }


  // --------------------------------------
  // 6. Check existing membership
  // --------------------------------------

  const existingMembership =
    await ChamaMembership.findOne({

      user_id:
        userId,

      chama_id:
        chamaId

    });


  // ======================================
  // REACTIVATE EXISTING MEMBERSHIP
  // ======================================

  if (existingMembership) {

    // ------------------------------------
    // Prevent duplicate active membership
    // ------------------------------------

    if (
      existingMembership.status === 'active'
    ) {

      throw new AppError(
        'User is already an active member of this Chama',
        409
      );

    }


    // ------------------------------------
    // Capture BEFORE state
    // ------------------------------------

    const before = {

      userId:
        existingMembership.user_id,

      role:
        existingMembership.role,

      status:
        existingMembership.status,

      payout_position:
        existingMembership.payout_position

    };


    // ------------------------------------
    // Reactivate membership
    // ------------------------------------

    existingMembership.status =
      'active';

    existingMembership.role =
      'member';

    existingMembership.payout_position =
      null;

    existingMembership.joined_at =
      new Date();


    await existingMembership.save();


    // ------------------------------------
    // Populate User
    // ------------------------------------

    await existingMembership.populate(
      'user_id',
      'name phone status'
    );


    // ------------------------------------
    // Create Audit Log
    // ------------------------------------

    await createAuditLog({

      actorUserId,

      chamaId,

      action:
        AUDIT_ACTIONS.MEMBER_REACTIVATED,

      resourceType:
        'ChamaMembership',

      resourceId:
        existingMembership._id,

      before,

      after: {

        userId:
          existingMembership.user_id,

        role:
          existingMembership.role,

        status:
          existingMembership.status,

        payout_position:
          existingMembership.payout_position

      }

    });


    return existingMembership;

  }


  // ======================================
  // CREATE NEW MEMBERSHIP
  // ======================================

  const membership =
    await ChamaMembership.create({

      user_id:
        userId,

      chama_id:
        chamaId,

      role:
        'member',

      status:
        'active',

      payout_position:
        null

    });


  // --------------------------------------
  // Populate User
  // --------------------------------------

  await membership.populate(
    'user_id',
    'name phone status'
  );


  // --------------------------------------
  // Create Audit Log
  // --------------------------------------

  await createAuditLog({

    actorUserId,

    chamaId,

    action:
      AUDIT_ACTIONS.MEMBER_ADDED,

    resourceType:
      'ChamaMembership',

    resourceId:
      membership._id,

    before:
      null,

    after: {

      userId:
        membership.user_id,

      role:
        membership.role,

      status:
        membership.status

    }

  });


  return membership;

};


// ========================================
// GET MEMBER BY ID
// ========================================

export const getMemberById = async ({
  chamaId,
  memberId,
  actorUserId
}) => {

  // --------------------------------------
  // 1. Validate IDs
  // --------------------------------------

  validateObjectId(
    chamaId,
    'Chama ID'
  );

  validateObjectId(
    memberId,
    'member ID'
  );

  validateObjectId(
    actorUserId,
    'actor user ID'
  );


  // --------------------------------------
  // 2. Verify Active Chama Member
  // --------------------------------------

  await requireChamaRole({

    chamaId,

    actorUserId

  });


  // --------------------------------------
  // 3. Find Membership
  // --------------------------------------

  const membership =
    await ChamaMembership.findOne({

      _id:
        memberId,

      chama_id:
        chamaId

    })
      .populate(
        'user_id',
        'name phone status createdAt'
      )
      .populate(
        'chama_id',
        'name monthly_savings status'
      );


  // --------------------------------------
  // 4. Check Membership Exists
  // --------------------------------------

  if (!membership) {

    throw new AppError(
      'Member not found in this Chama',
      404
    );

  }


  return membership;

};


// ========================================
// UPDATE MEMBER ROLE
// ========================================

export const updateMemberRole = async ({
  chamaId,
  memberId,
  actorUserId,
  role
}) => {

  // --------------------------------------
  // 1. Validate IDs
  // --------------------------------------

  validateObjectId(
    chamaId,
    'Chama ID'
  );

  validateObjectId(
    memberId,
    'member ID'
  );

  validateObjectId(
    actorUserId,
    'actor user ID'
  );


  // --------------------------------------
  // 2. Validate Role
  // --------------------------------------

  if (
    !ALLOWED_ROLES.includes(role)
  ) {

    throw new AppError(
      'Invalid member role',
      400
    );

  }


  // --------------------------------------
  // 3. Verify Treasurer
  // --------------------------------------

  await requireChamaRole({

    chamaId,

    actorUserId,

    requiredRole:
      'treasurer'

  });


  // --------------------------------------
  // 4. Find Membership
  // --------------------------------------

  const membership =
    await ChamaMembership.findOne({

      _id:
        memberId,

      chama_id:
        chamaId

    });


  if (!membership) {

    throw new AppError(
      'Member not found in this Chama',
      404
    );

  }


  // --------------------------------------
  // 5. Check Membership Status
  // --------------------------------------

  if (
    membership.status !== 'active'
  ) {

    throw new AppError(
      'Cannot change role of an inactive member',
      403
    );

  }


  // --------------------------------------
  // 6. Prevent Duplicate Role
  // --------------------------------------

  if (
    membership.role === role
  ) {

    throw new AppError(
      `Member already has the ${role} role`,
      409
    );

  }


  // --------------------------------------
  // 7. Prevent Multiple Treasurers
  // --------------------------------------

  if (
    role === 'treasurer'
  ) {

    const existingTreasurer =
      await ChamaMembership.findOne({

        chama_id:
          chamaId,

        role:
          'treasurer',

        status:
          'active',

        _id: {
          $ne:
            memberId
        }

      });


    if (existingTreasurer) {

      throw new AppError(
        'This Chama already has an active treasurer',
        409
      );

    }

  }


  // --------------------------------------
  // 8. Capture BEFORE state
  // --------------------------------------

  const before = {

    userId:
      membership.user_id,

    role:
      membership.role,

    status:
      membership.status

  };


  // --------------------------------------
  // 9. Update Role
  // --------------------------------------

  membership.role =
    role;


  await membership.save();


  // --------------------------------------
  // 10. Populate User
  // --------------------------------------

  await membership.populate(
    'user_id',
    'name phone status'
  );


  // --------------------------------------
  // 11. Create Audit Log
  // --------------------------------------

  await createAuditLog({

    actorUserId,

    chamaId,

    action:
      AUDIT_ACTIONS.MEMBER_ROLE_UPDATED,

    resourceType:
      'ChamaMembership',

    resourceId:
      membership._id,

    before,

    after: {

      userId:
        membership.user_id,

      role:
        membership.role,

      status:
        membership.status

    }

  });


  return membership;

};


// ========================================
// UPDATE MEMBER STATUS
// ========================================

export const updateMemberStatus = async ({
  chamaId,
  memberId,
  actorUserId,
  status
}) => {

  // --------------------------------------
  // 1. Validate IDs
  // --------------------------------------

  validateObjectId(
    chamaId,
    'Chama ID'
  );

  validateObjectId(
    memberId,
    'member ID'
  );

  validateObjectId(
    actorUserId,
    'actor user ID'
  );


  // --------------------------------------
  // 2. Validate Status
  // --------------------------------------

  if (
    !ALLOWED_STATUSES.includes(status)
  ) {

    throw new AppError(
      'Invalid membership status',
      400
    );

  }


  // --------------------------------------
  // 3. Verify Treasurer
  // --------------------------------------

  await requireChamaRole({

    chamaId,

    actorUserId,

    requiredRole:
      'treasurer'

  });


  // --------------------------------------
  // 4. Find Membership
  // --------------------------------------

  const membership =
    await ChamaMembership.findOne({

      _id:
        memberId,

      chama_id:
        chamaId

    });


  if (!membership) {

    throw new AppError(
      'Member not found in this Chama',
      404
    );

  }


  // --------------------------------------
  // 5. Prevent Duplicate Status
  // --------------------------------------

  if (
    membership.status === status
  ) {

    throw new AppError(
      `Member already has the ${status} status`,
      409
    );

  }


  // --------------------------------------
  // 6. Protect Treasurer
  // --------------------------------------

  if (
    membership.role === 'treasurer' &&
    status !== 'active'
  ) {

    throw new AppError(
      'The Treasurer cannot be deactivated or removed. Transfer the Treasurer role first.',
      403
    );

  }


  // --------------------------------------
  // 7. Prevent Self-Deactivation
  // --------------------------------------

  const isSelf =
    membership.user_id.toString() ===
    actorUserId.toString();


  if (
    isSelf &&
    status !== 'active'
  ) {

    throw new AppError(
      'You cannot deactivate or remove your own membership',
      403
    );

  }


  // --------------------------------------
  // 8. Capture BEFORE State
  // --------------------------------------

  const before = {

    userId:
      membership.user_id,

    role:
      membership.role,

    status:
      membership.status,

    payout_position:
      membership.payout_position

  };


  // --------------------------------------
  // 9. Update Status
  // --------------------------------------

  membership.status =
    status;


  // --------------------------------------
  // 10. Clear Payout Position
  // --------------------------------------

  if (
    status !== 'active'
  ) {

    membership.payout_position =
      null;

  }


  await membership.save();


  // --------------------------------------
  // 11. Populate User
  // --------------------------------------

  await membership.populate(
    'user_id',
    'name phone status'
  );


  // --------------------------------------
  // 12. Create Audit Log
  // --------------------------------------

  await createAuditLog({

    actorUserId,

    chamaId,

    action:
      AUDIT_ACTIONS.MEMBER_STATUS_UPDATED,

    resourceType:
      'ChamaMembership',

    resourceId:
      membership._id,

    before,

    after: {

      userId:
        membership.user_id,

      role:
        membership.role,

      status:
        membership.status,

      payout_position:
        membership.payout_position

    }

  });


  return membership;

};


// ========================================
// REMOVE MEMBER FROM CHAMA
// ========================================
//
// Soft delete.
//
// ========================================

export const removeMemberFromChama = async ({
  chamaId,
  memberId,
  actorUserId
}) => {

  // --------------------------------------
  // 1. Validate IDs
  // --------------------------------------

  validateObjectId(
    chamaId,
    'Chama ID'
  );

  validateObjectId(
    memberId,
    'member ID'
  );

  validateObjectId(
    actorUserId,
    'actor user ID'
  );


  // --------------------------------------
  // 2. Verify Treasurer
  // --------------------------------------

  await requireChamaRole({

    chamaId,

    actorUserId,

    requiredRole:
      'treasurer'

  });


  // --------------------------------------
  // 3. Find Membership
  // --------------------------------------

  const membership =
    await ChamaMembership.findOne({

      _id:
        memberId,

      chama_id:
        chamaId

    });


  if (!membership) {

    throw new AppError(
      'Member not found in this Chama',
      404
    );

  }


  // --------------------------------------
  // 4. Prevent Duplicate Removal
  // --------------------------------------

  if (
    membership.status === 'removed'
  ) {

    throw new AppError(
      'Member has already been removed',
      409
    );

  }


  // --------------------------------------
  // 5. Prevent Removing Treasurer
  // --------------------------------------

  if (
    membership.role === 'treasurer'
  ) {

    throw new AppError(
      'The Treasurer cannot be removed. Transfer the Treasurer role first.',
      403
    );

  }


  // --------------------------------------
  // 6. Prevent Self-Removal
  // --------------------------------------

  const isSelf =
    membership.user_id.toString() ===
    actorUserId.toString();


  if (isSelf) {

    throw new AppError(
      'You cannot remove your own membership',
      403
    );

  }


  // --------------------------------------
  // 7. Capture BEFORE State
  // --------------------------------------

  const before = {

    userId:
      membership.user_id,

    role:
      membership.role,

    status:
      membership.status,

    payout_position:
      membership.payout_position

  };


  // --------------------------------------
  // 8. Remove Member
  // --------------------------------------

  membership.status =
    'removed';

  membership.payout_position =
    null;


  await membership.save();


  // --------------------------------------
  // 9. Populate User
  // --------------------------------------

  await membership.populate(
    'user_id',
    'name phone status'
  );


  // --------------------------------------
  // 10. Create Audit Log
  // --------------------------------------

  await createAuditLog({

    actorUserId,

    chamaId,

    action:
      AUDIT_ACTIONS.MEMBER_REMOVED,

    resourceType:
      'ChamaMembership',

    resourceId:
      membership._id,

    before,

    after: {

      userId:
        membership.user_id,

      role:
        membership.role,

      status:
        membership.status,

      payout_position:
        membership.payout_position

    }

  });


  return membership;

};


// ========================================
// TRANSFER TREASURER ROLE
// ========================================
//
// This operation changes two membership
// documents.
//
// Ideally this should use a MongoDB
// transaction.
//
// ========================================

export const transferTreasurerRole = async ({
  chamaId,
  actorUserId,
  newTreasurerMemberId
}) => {

  // --------------------------------------
  // 1. Validate IDs
  // --------------------------------------

  validateObjectId(
    chamaId,
    'Chama ID'
  );

  validateObjectId(
    actorUserId,
    'actor user ID'
  );

  validateObjectId(
    newTreasurerMemberId,
    'new treasurer member ID'
  );


  // --------------------------------------
  // 2. Verify Current Treasurer
  // --------------------------------------

  const {
    actorMembership
  } =
    await requireChamaRole({

      chamaId,

      actorUserId,

      requiredRole:
        'treasurer'

    });


  // --------------------------------------
  // 3. Find Target Membership
  // --------------------------------------

  const targetMembership =
    await ChamaMembership.findOne({

      _id:
        newTreasurerMemberId,

      chama_id:
        chamaId

    });


  if (!targetMembership) {

    throw new AppError(
      'Target member not found in this Chama',
      404
    );

  }


  // --------------------------------------
  // 4. Prevent Transfer to Self
  // --------------------------------------

  if (
    actorMembership._id.toString() ===
    targetMembership._id.toString()
  ) {

    throw new AppError(
      'You are already the Treasurer of this Chama',
      409
    );

  }


  // --------------------------------------
  // 5. Check Target Status
  // --------------------------------------

  if (
    targetMembership.status !== 'active'
  ) {

    throw new AppError(
      'The new Treasurer must be an active Chama member',
      403
    );

  }


  // --------------------------------------
  // 6. Check Target Role
  // --------------------------------------

  if (
    targetMembership.role === 'treasurer'
  ) {

    throw new AppError(
      'This member is already the Treasurer',
      409
    );

  }


  // --------------------------------------
  // 7. Capture BEFORE State
  // --------------------------------------

  const before = {

    previousTreasurer: {

      membershipId:
        actorMembership._id,

      userId:
        actorMembership.user_id,

      role:
        actorMembership.role

    },

    newTreasurer: {

      membershipId:
        targetMembership._id,

      userId:
        targetMembership.user_id,

      role:
        targetMembership.role

    }

  };


  // --------------------------------------
  // 8. Transfer Roles
  // --------------------------------------

  actorMembership.role =
    'member';

  targetMembership.role =
    'treasurer';


  // --------------------------------------
  // 9. Save Both Memberships
  // --------------------------------------

  await actorMembership.save();

  await targetMembership.save();


  // --------------------------------------
  // 10. Populate Users
  // --------------------------------------

  await actorMembership.populate(
    'user_id',
    'name phone status'
  );

  await targetMembership.populate(
    'user_id',
    'name phone status'
  );


  // --------------------------------------
  // 11. Create Audit Log
  // --------------------------------------

  await createAuditLog({

    actorUserId,

    chamaId,

    action:
      AUDIT_ACTIONS.TREASURER_TRANSFERRED,

    resourceType:
      'ChamaMembership',

    resourceId:
      targetMembership._id,

    before,

    after: {

      previousTreasurer: {

        membershipId:
          actorMembership._id,

        userId:
          actorMembership.user_id,

        role:
          actorMembership.role

      },

      newTreasurer: {

        membershipId:
          targetMembership._id,

        userId:
          targetMembership.user_id,

        role:
          targetMembership.role

      }

    }

  });


  // --------------------------------------
  // 12. Return Result
  // --------------------------------------

  return {

    previousTreasurer:
      actorMembership,

    newTreasurer:
      targetMembership

  };

};