import {
  addMemberToChama,
  getMemberById,
  updateMemberRole,
  updateMemberStatus,
  removeMemberFromChama,
  transferTreasurerRole,
  updateMemberProfile
} from './member.service.js';

import AppError from '../../utils/AppError.js';
import { PROFILE_UPDATE_FIELDS } from '../../utils/userProfile.js';


// ========================================
// ADD MEMBER TO CHAMA
// ========================================

export const addMemberController = async (
  req,
  res,
  next
) => {
  try {
    const {
      chamaId
    } = req.params;

    // Authenticated User performing action
    const actorUserId =
      req.user._id;

    // Validate body
    if (
      !req.body ||
      typeof req.body !== 'object' ||
      Array.isArray(req.body)
    ) {
      throw new AppError(
        'Request body is required',
        400
      );
    }

    const {
      phone,
      name,
      userId
    } = req.body;

    // Allow phone, name, and userId
    const allowedFields = [
      'phone',
      'name',
      'userId'
    ];

    const receivedFields =
      Object.keys(req.body);

    const unexpectedFields =
      receivedFields.filter(
        (field) =>
          !allowedFields.includes(field)
      );

    if (
      unexpectedFields.length > 0
    ) {
      throw new AppError(
        `Unexpected field(s): ${unexpectedFields.join(', ')}`,
        400
      );
    }

    // Ensure at least phone or userId is provided
    if (!phone && !userId) {
      throw new AppError(
        'Either phone number or user ID is required',
        400
      );
    }

    // Service independently verifies:
    // actor exists
    // actor is active
    // actor is Chama member
    // actor is Treasurer
    // target user exists by phone/userId
    const membership =
      await addMemberToChama({
        chamaId,
        actorUserId,
        phone,
        name,
        userId
      });

    res.status(201).json({
      success: true,
      message:
        'Member added to Chama successfully',
      data: {
        member: membership
      }
    });

  } catch (error) {
    next(error);
  }
};


// ========================================
// GET MEMBER BY ID
// ========================================

export const getMemberController = async (
  req,
  res,
  next
) => {
  try {
    const {
      chamaId,
      memberId
    } = req.params;

    // Authenticated User requesting data
    const actorUserId =
      req.user._id;

    const membership =
      await getMemberById({
        chamaId,
        memberId,
        actorUserId
      });

    res.status(200).json({
      success: true,
      data: {
        member: membership
      }
    });

  } catch (error) {
    next(error);
  }
};


// ========================================
// UPDATE MEMBER ROLE
// ========================================

export const updateMemberRoleController = async (
  req,
  res,
  next
) => {
  try {
    const {
      chamaId,
      memberId
    } = req.params;

    // Authenticated User performing action
    const actorUserId =
      req.user._id;

    // Validate body
    if (
      !req.body ||
      typeof req.body !== 'object' ||
      Array.isArray(req.body)
    ) {
      throw new AppError(
        'Request body is required',
        400
      );
    }

    const {
      role
    } = req.body;

    // Only role is allowed
    const allowedFields = [
      'role'
    ];

    const receivedFields =
      Object.keys(req.body);

    const unexpectedFields =
      receivedFields.filter(
        (field) =>
          !allowedFields.includes(field)
      );

    if (
      unexpectedFields.length > 0
    ) {
      throw new AppError(
        `Unexpected field(s): ${unexpectedFields.join(', ')}`,
        400
      );
    }

    const membership =
      await updateMemberRole({
        chamaId,
        memberId,
        actorUserId,
        role
      });

    res.status(200).json({
      success: true,
      message:
        'Member role updated successfully',
      data: {
        member: membership
      }
    });

  } catch (error) {
    next(error);
  }
};


// ========================================
// UPDATE MEMBER STATUS
// ========================================

export const updateMemberStatusController = async (
  req,
  res,
  next
) => {
  try {
    const {
      chamaId,
      memberId
    } = req.params;

    // Authenticated User performing action
    const actorUserId =
      req.user._id;

    // Validate body
    if (
      !req.body ||
      typeof req.body !== 'object' ||
      Array.isArray(req.body)
    ) {
      throw new AppError(
        'Request body is required',
        400
      );
    }

    const {
      status
    } = req.body;

    // Only status is allowed
    const allowedFields = [
      'status'
    ];

    const receivedFields =
      Object.keys(req.body);

    const unexpectedFields =
      receivedFields.filter(
        (field) =>
          !allowedFields.includes(field)
      );

    if (
      unexpectedFields.length > 0
    ) {
      throw new AppError(
        `Unexpected field(s): ${unexpectedFields.join(', ')}`,
        400
      );
    }

    const membership =
      await updateMemberStatus({
        chamaId,
        memberId,
        actorUserId,
        status
      });

    res.status(200).json({
      success: true,
      message:
        'Member status updated successfully',
      data: {
        member: membership
      }
    });

  } catch (error) {
    next(error);
  }
};


// ========================================
// REMOVE MEMBER FROM CHAMA
// ========================================

export const removeMemberController = async (
  req,
  res,
  next
) => {
  try {
    const {
      chamaId,
      memberId
    } = req.params;

    // Authenticated User performing action
    const actorUserId =
      req.user._id;

    const membership =
      await removeMemberFromChama({
        chamaId,
        memberId,
        actorUserId
      });

    res.status(200).json({
      success: true,
      message:
        'Member removed from Chama successfully',
      data: {
        member: membership
      }
    });

  } catch (error) {
    next(error);
  }
};


// ========================================
// UPDATE MEMBER PROFILE
// ========================================
//
// PATCH /api/v1/chamas/:chamaId/members/:memberId/profile
//
// Allowed actors:
//
// 1. The member themselves
// 2. The Chama Treasurer or Chairperson
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

export const updateMemberProfileController = async (
  req,
  res,
  next
) => {
  try {
    const {
      chamaId,
      memberId
    } = req.params;

    const actorUserId =
      req.user._id;

    if (
      !req.body ||
      typeof req.body !== 'object' ||
      Array.isArray(req.body)
    ) {
      throw new AppError(
        'Request body is required',
        400
      );
    }

    const receivedFields =
      Object.keys(req.body);

    const unexpectedFields =
      receivedFields.filter(
        (field) =>
          !PROFILE_UPDATE_FIELDS.includes(field)
      );

    if (
      unexpectedFields.length > 0
    ) {
      throw new AppError(
        `Unexpected field(s): ${unexpectedFields.join(', ')}`,
        400
      );
    }

    const membership =
      await updateMemberProfile({
        chamaId,
        memberId,
        actorUserId,
        updates: req.body
      });

    res.status(200).json({
      success: true,
      message:
        'Member profile updated successfully',
      data: {
        member: membership
      }
    });

  } catch (error) {
    next(error);
  }
};

// ========================================
// TRANSFER TREASURER ROLE
// ========================================

export const transferTreasurerController = async (
  req,
  res,
  next
) => {
  try {
    const {
      chamaId
    } = req.params;

    const actorUserId =
      req.user._id;

    if (
      !req.body ||
      typeof req.body !== 'object' ||
      Array.isArray(req.body)
    ) {
      throw new AppError(
        'Request body is required',
        400
      );
    }

    const {
      newTreasurerMemberId
    } = req.body;

    const allowedFields = [
      'newTreasurerMemberId'
    ];

    const receivedFields =
      Object.keys(req.body);

    const unexpectedFields =
      receivedFields.filter(
        (field) =>
          !allowedFields.includes(field)
      );

    if (
      unexpectedFields.length > 0
    ) {
      throw new AppError(
        `Unexpected field(s): ${unexpectedFields.join(', ')}`,
        400
      );
    }

    const result =
      await transferTreasurerRole({
        chamaId,
        actorUserId,
        newTreasurerMemberId
      });

    res.status(200).json({
      success: true,
      message:
        'Treasurer role transferred successfully',
      data: {
        previousTreasurer:
          result.previousTreasurer,
        newTreasurer:
          result.newTreasurer
      }
    });

  } catch (error) {
    next(error);
  }
};

// ========================================
// REARRANGE PAYOUT ORDER
// TREASURER/CHAIR ONLY
// ========================================
export const rearrangePayoutOrderController = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const actorUserId = req.user._id;
    const { order } = req.body; // [{ memberId: 'id', position: 1 }]

    // Verify actor
    const actor = await ChamaMembership.findOne({ chama_id: chamaId, user_id: actorUserId, status: 'active' });
    if(!actor ||!['treasurer', 'chairperson'].includes(actor.role)){
      throw new AppError("Only Treasurer or Chairperson can rearrange", 403);
    }

    // Validate no duplicate positions
    const positions = order.map(o => o.position);
    if(new Set(positions).size!== positions.length){
      throw new AppError("Duplicate positions not allowed", 400);
    }

    await Promise.all(order.map(o =>
      ChamaMembership.updateOne(
        { _id: o.memberId, chama_id: chamaId },
        { payout_position: o.position }
      )
    ));

    res.status(200).json({ success: true, message: 'Payout order updated' });
  } catch (error) {
    next(error);
  }
};