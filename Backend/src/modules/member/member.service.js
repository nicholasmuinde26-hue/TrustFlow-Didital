import mongoose from 'mongoose';

import User from '../../models/User.js';
import Chama from '../../models/Chama.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import Payout from '../../models/Payout.js';

import AppError from '../../utils/AppError.js';
import { formatPhone, isValidKenyanPhone } from '../../utils/phone.js';

import {
  createAuditLog
} from '../../services/audit.service.js';

import {
  AUDIT_ACTIONS
} from '../../constants/audit.constants.js';

import {
  buildUserProfileUpdates
} from '../../utils/userProfile.js';


// ========================================
// CONSTANTS
// ========================================

const ALLOWED_ROLES = [
  'member',
  'treasurer',
  'secretary',
  'auditor',
  'chairperson'
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
  //
  // requiredRole may be a single role string
  // (e.g. 'treasurer') or an array of roles
  // (e.g. ['treasurer', 'chairperson']), any
  // one of which satisfies the check.
  //
  // --------------------------------------

  if (requiredRole) {

    const allowedRoles =
      Array.isArray(requiredRole)
        ? requiredRole
        : [requiredRole];

    if (
      !allowedRoles.includes(
        actorMembership.role
      )
    ) {

      throw new AppError(
        allowedRoles.length > 1
          ? `Only the ${allowedRoles.join(' or ')} can perform this action`
          : `Only the ${allowedRoles[0]} can perform this action`,
        403
      );

    }

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
  userId,
  phone,
  name
}) => {

  // --------------------------------------
  // 1. Validate IDs & Inputs
  // --------------------------------------

  validateObjectId(
    chamaId,
    'Chama ID'
  );

  validateObjectId(
    actorUserId,
    'actor user ID'
  );

  const cleanUserId = (userId && String(userId).trim() !== '') ? userId : null;
  const cleanPhone = (phone && String(phone).trim() !== '')
    ? formatPhone(String(phone))
    : null;

  // Require either phone or userId
  if (!cleanUserId && !cleanPhone) {
    throw new AppError(
      'Either phone number or user ID must be provided',
      400
    );
  }

  // Only validate userId as an ObjectId if it was passed
  if (cleanUserId) {
    validateObjectId(
      cleanUserId,
      'user ID'
    );
  }

  if (cleanPhone && !isValidKenyanPhone(cleanPhone)) {
    throw new AppError('Enter a valid Kenyan phone number', 400);
  }


  // --------------------------------------
  // 2. Verify Treasurer or Chairperson
  // --------------------------------------

  await requireChamaRole({
    chamaId,
    actorUserId,
    requiredRole: ['treasurer', 'chairperson']
  });


  // --------------------------------------
  // 3. Find target User
  // --------------------------------------

  let user = null;

  if (cleanUserId) {
    user = await User.findById(cleanUserId);
  } else if (cleanPhone) {
    user = await User.findOne({
      $or: [
        { phone: cleanPhone }
      ]
    });
  }

  if (!user) {
    throw new AppError(
      cleanPhone
        ? `No registered user account found for phone number ${cleanPhone}. User must register on the platform before joining.`
        : 'User not found',
      404
    );
  }

  const targetUserId = user._id;


  // --------------------------------------
  // 4. Prevent self-addition
  // --------------------------------------

  if (
    actorUserId.toString() ===
    targetUserId.toString()
  ) {
    throw new AppError(
      'You are already a member of this Chama',
      409
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
      user_id: targetUserId,
      chama_id: chamaId
    });


  // ======================================
  // REACTIVATE EXISTING MEMBERSHIP
  // ======================================

  if (existingMembership) {

    if (
      existingMembership.status === 'active'
    ) {
      throw new AppError(
        'User is already an active member of this Chama',
        409
      );
    }

    const before = {
      userId: existingMembership.user_id,
      role: existingMembership.role,
      status: existingMembership.status,
      payout_position: existingMembership.payout_position
    };

    existingMembership.status = 'active';
    existingMembership.role = 'member';
    existingMembership.payout_position = null;
    existingMembership.joined_at = new Date();

    await existingMembership.save();

    await existingMembership.populate(
      'user_id',
      'name phone email id_number avatar_url status'
    );

    await createAuditLog({
      actorUserId,
      chamaId,
      action: AUDIT_ACTIONS.MEMBER_REACTIVATED,
      resourceType: 'ChamaMembership',
      resourceId: existingMembership._id,
      before,
      after: {
        userId: existingMembership.user_id,
        role: existingMembership.role,
        status: existingMembership.status,
        payout_position: existingMembership.payout_position
      }
    });

    return existingMembership;
  }


  // ======================================
  // CREATE NEW MEMBERSHIP
  // ======================================

  const membership =
    await ChamaMembership.create({
      user_id: targetUserId,
      chama_id: chamaId,
      role: 'member',
      status: 'active',
      payout_position: null
    });

  await membership.populate(
    'user_id',
    'name phone email id_number avatar_url status'
  );

  await createAuditLog({
    actorUserId,
    chamaId,
    action: AUDIT_ACTIONS.MEMBER_ADDED,
    resourceType: 'ChamaMembership',
    resourceId: membership._id,
    before: null,
    after: {
      userId: membership.user_id,
      role: membership.role,
      status: membership.status
    }
  });

  return membership;
};


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
        'name phone email id_number avatar_url status createdAt'
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
  // 3. Verify Treasurer or Chairperson
  // --------------------------------------

  await requireChamaRole({

    chamaId,

    actorUserId,

    requiredRole:
      ['treasurer', 'chairperson']

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
    'name phone email id_number avatar_url status'
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
  // 3. Verify Treasurer or Chairperson
  // --------------------------------------

  await requireChamaRole({

    chamaId,

    actorUserId,

    requiredRole:
      ['treasurer', 'chairperson']

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
    'name phone email id_number avatar_url status'
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
  // 2. Verify Treasurer or Chairperson
  // --------------------------------------

  await requireChamaRole({

    chamaId,

    actorUserId,

    requiredRole:
      ['treasurer', 'chairperson']

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
    'name phone email id_number avatar_url status'
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
  // 2. Verify Actor Is Treasurer Or
  //    Chairperson
  // --------------------------------------
  //
  // NOTE: The actor performing this action
  // is NOT necessarily the current Treasurer
  // — a Chairperson may initiate the transfer
  // on the Treasurer's behalf. The CURRENT
  // Treasurer (whoever holds that role right
  // now) is looked up separately in step 3
  // below and is the membership that actually
  // gets demoted to 'member'.
  //
  // --------------------------------------

  const {
    actorMembership
  } =
    await requireChamaRole({

      chamaId,

      actorUserId,

      requiredRole:
        ['treasurer', 'chairperson']

    });


  // --------------------------------------
  // 3. Find Current Treasurer Membership
  // --------------------------------------

  const currentTreasurerMembership =
    await ChamaMembership.findOne({

      chama_id:
        chamaId,

      role:
        'treasurer',

      status:
        'active'

    });


  if (!currentTreasurerMembership) {

    throw new AppError(
      'This Chama does not currently have an active Treasurer',
      404
    );

  }


  // --------------------------------------
  // 4. Find Target Membership
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
  // 5. Prevent Transfer To Current Treasurer
  // --------------------------------------

  if (
    currentTreasurerMembership._id.toString() ===
    targetMembership._id.toString()
  ) {

    throw new AppError(
      'This member is already the Treasurer of this Chama',
      409
    );

  }


  // --------------------------------------
  // 6. Check Target Status
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
  // 7. Check Target Role
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
  // 8. Capture BEFORE State
  // --------------------------------------

  const before = {

    actor: {

      membershipId:
        actorMembership._id,

      userId:
        actorMembership.user_id,

      role:
        actorMembership.role

    },

    previousTreasurer: {

      membershipId:
        currentTreasurerMembership._id,

      userId:
        currentTreasurerMembership.user_id,

      role:
        currentTreasurerMembership.role

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
  // 9. Transfer Roles
  // --------------------------------------
  //
  // Only the CURRENT Treasurer is demoted
  // to 'member'. The actor's own role is
  // left untouched — this matters when a
  // Chairperson (not the Treasurer) is the
  // one initiating the transfer.
  //
  // --------------------------------------

  currentTreasurerMembership.role =
    'member';

  targetMembership.role =
    'treasurer';


  // --------------------------------------
  // 10. Save Memberships
  // --------------------------------------

  await currentTreasurerMembership.save();

  await targetMembership.save();


  // --------------------------------------
  // 11. Populate Users
  // --------------------------------------

  await currentTreasurerMembership.populate(
    'user_id',
    'name phone email id_number avatar_url status'
  );

  await targetMembership.populate(
    'user_id',
    'name phone email id_number avatar_url status'
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
          currentTreasurerMembership._id,

        userId:
          currentTreasurerMembership.user_id,

        role:
          currentTreasurerMembership.role

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
      currentTreasurerMembership,

    newTreasurer:
      targetMembership

  };

};


// ========================================
// UPDATE MEMBER PROFILE
// ========================================
//
// Edits the User account backing a Chama
// membership: name, phone, email, id_number,
// avatar_url.
//
// Allowed actors:
//
// 1. The member themselves (self-service)
// 2. The Chama Treasurer or Chairperson
//    (managing any member's profile)
//
// NOTE: This updates the global User document,
// not the ChamaMembership. If the target User
// belongs to multiple Chamas, the change is
// visible everywhere they're a member — this
// mirrors how phone/name already work as
// account-level, not membership-level, fields.
//
// ========================================

export const updateMemberProfile = async ({
  chamaId,
  memberId,
  actorUserId,
  updates
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
  // 2. Verify Actor Is An Active
  //    Chama Member (any role)
  // --------------------------------------

  const {
    actorMembership
  } =
    await requireChamaRole({

      chamaId,

      actorUserId

    });


  // --------------------------------------
  // 3. Find Target Membership + User
  // --------------------------------------

  const targetMembership =
    await ChamaMembership.findOne({

      _id:
        memberId,

      chama_id:
        chamaId

    })
      .populate(
        'user_id',
        'name phone email id_number avatar_url status'
      );


  if (
    !targetMembership ||
    !targetMembership.user_id
  ) {

    throw new AppError(
      'Member not found in this Chama',
      404
    );

  }


  const targetUser =
    targetMembership.user_id;


  // --------------------------------------
  // 4. Check Permission
  // --------------------------------------
  //
  // Allowed:
  //
  // - The member editing their own profile
  // - Treasurer or Chairperson editing
  //   any member's profile
  //
  // --------------------------------------

  const isSelf =
    String(targetUser._id) ===
    String(actorUserId);

  const isManager =
    ['treasurer', 'chairperson'].includes(
      actorMembership.role
    );


  if (
    !isSelf &&
    !isManager
  ) {

    throw new AppError(
      'Only the treasurer, chairperson, or the member themselves can edit this profile',
      403
    );

  }


  // --------------------------------------
  // 5. Capture BEFORE State
  // --------------------------------------
  //
  // avatar_url is tracked as a boolean
  // (photo set or not) rather than storing
  // the base64 blob in the audit trail.
  //
  // --------------------------------------

  const before = {

    name:
      targetUser.name,

    phone:
      targetUser.phone,

    email:
      targetUser.email,

    id_number:
      targetUser.id_number,

    hasAvatar:
      Boolean(targetUser.avatar_url)

  };


  // --------------------------------------
  // 6. Validate & Apply Updates
  // --------------------------------------

  const set =
    await buildUserProfileUpdates({

      targetUser,

      updates

    });


  Object.assign(
    targetUser,
    set
  );


  await targetUser.save();


  // --------------------------------------
  // 7. Create Audit Log
  // --------------------------------------

  await createAuditLog({

    actorUserId,

    chamaId,

    action:
      AUDIT_ACTIONS.MEMBER_PROFILE_UPDATED,

    resourceType:
      'User',

    resourceId:
      targetUser._id,

    before,

    after: {

      name:
        targetUser.name,

      phone:
        targetUser.phone,

      email:
        targetUser.email,

      id_number:
        targetUser.id_number,

      hasAvatar:
        Boolean(targetUser.avatar_url)

    }

  });


  // --------------------------------------
  // 8. Return Updated Membership
  // --------------------------------------

  return targetMembership;

};


// ========================================
// REORDER PAYOUT POSITIONS
// (MGR ROTATION ARRANGEMENT)
// ========================================
//
// This is how a real Chama decides "who
// receives the merry-go-round payout, and
// in what order" — the Treasurer or
// Chairperson lays out the full rotation
// once, and every later payout follows it
// automatically.
//
// The submitted `order` is the complete
// list of active ChamaMembership IDs,
// arranged from first payout to last.
// order[0] becomes payout_position 1,
// order[1] becomes payout_position 2, etc.
//
// Nothing else needs to change to make the
// rotation "live": payout.service.js's
// startPayout() already reads
// payout_position ascending to pick the
// next recipient, and already wraps back to
// position 1 once the round completes.
// markPayoutPaid() already posts the ledger
// settlement automatically. Setting the
// order here is the one missing piece that
// lets the whole rotation run.
//
// ========================================

export const reorderPayoutPositions = async ({
  chamaId,
  actorUserId,
  order
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

  if (
    !Array.isArray(order) ||
    order.length === 0
  ) {

    throw new AppError(
      'Order must be a non-empty array of member IDs',
      400
    );

  }

  order.forEach(
    (memberId, index) => {

      validateObjectId(
        memberId,
        `member ID at position ${index + 1}`
      );

    }
  );

  const submittedIds =
    order.map(String);

  const uniqueSubmittedIds =
    new Set(submittedIds);

  if (
    uniqueSubmittedIds.size !==
    order.length
  ) {

    throw new AppError(
      'Order cannot contain duplicate members',
      400
    );

  }


  // --------------------------------------
  // 2. Verify Treasurer or Chairperson
  // --------------------------------------

  await requireChamaRole({

    chamaId,

    actorUserId,

    requiredRole:
      ['treasurer', 'chairperson']

  });


  // --------------------------------------
  // 3. Load Active Memberships
  // --------------------------------------

  const activeMemberships =
    await ChamaMembership.find({

      chama_id:
        chamaId,

      status:
        'active'

    });

  if (!activeMemberships.length) {

    throw new AppError(
      'This Chama has no active members to arrange',
      400
    );

  }

  const activeIds =
    new Set(
      activeMemberships.map(
        (membership) =>
          membership._id.toString()
      )
    );


  // --------------------------------------
  // 4. Cross-Check Order Against
  //    Active Membership
  // --------------------------------------
  //
  // Every active member must appear exactly
  // once, and nothing else may appear —
  // otherwise a member could be silently
  // dropped from the rotation, or an
  // inactive/foreign ID could be smuggled
  // into payout_position.
  //
  // --------------------------------------

  const missingMembers =
    activeMemberships.filter(
      (membership) =>
        !uniqueSubmittedIds.has(
          membership._id.toString()
        )
    );

  if (missingMembers.length > 0) {

    throw new AppError(
      'Order must include every active member exactly once',
      400
    );

  }

  const unknownIds =
    submittedIds.filter(
      (id) => !activeIds.has(id)
    );

  if (unknownIds.length > 0) {

    throw new AppError(
      'Order contains a member who is not an active member of this Chama',
      400
    );

  }


  // --------------------------------------
  // 5. Block Reorder Mid-Round
  // --------------------------------------
  //
  // Changing who's "next" while a payout is
  // already pending disbursement would let
  // the arrangement disagree with a payout
  // record that already names a recipient
  // and amount. Settle or cancel it first.
  //
  // --------------------------------------

  const pendingPayout =
    await Payout.findOne({

      chama_id:
        chamaId,

      status:
        'pending'

    });

  if (pendingPayout) {

    throw new AppError(
      'Cannot rearrange the payout order while a payout is pending. Settle or cancel it first.',
      409
    );

  }


  // --------------------------------------
  // 6. Capture BEFORE State
  // --------------------------------------

  const before =
    activeMemberships

      .map((membership) => ({

        member_id:
          membership._id,

        payout_position:
          membership.payout_position

      }))

      .sort(
        (a, b) =>
          (a.payout_position ?? Number.MAX_SAFE_INTEGER) -
          (b.payout_position ?? Number.MAX_SAFE_INTEGER)
      );


  // --------------------------------------
  // 7. Apply New Positions
  // --------------------------------------

  const membershipById =
    new Map(
      activeMemberships.map(
        (membership) =>
          [membership._id.toString(), membership]
      )
    );

  await Promise.all(
    order.map(
      (memberId, index) => {

        const membership =
          membershipById.get(
            String(memberId)
          );

        membership.payout_position =
          index + 1;

        return membership.save();

      }
    )
  );


  // --------------------------------------
  // 8. Create Audit Log
  // --------------------------------------

  await createAuditLog({

    actorUserId,

    chamaId,

    action:
      AUDIT_ACTIONS.ROTATION_UPDATED,

    resourceType:
      'Chama',

    resourceId:
      chamaId,

    before: {
      payout_order: before
    },

    after: {

      payout_order:
        order.map(
          (memberId, index) => ({

            member_id:
              memberId,

            payout_position:
              index + 1

          })
        )

    }

  });


  // --------------------------------------
  // 9. Return Updated, Ordered Memberships
  // --------------------------------------

  const updatedMemberships =
    await ChamaMembership.find({

      chama_id:
        chamaId,

      status:
        'active'

    })

    .sort({
      payout_position: 1
    })

    .populate(
      'user_id',
      'name phone email id_number avatar_url status'
    );

  return updatedMemberships;

};