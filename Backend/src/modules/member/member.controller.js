import {
  addMemberToChama,
  getMemberById,
  updateMemberRole,
  updateMemberStatus,
  removeMemberFromChama,
  transferTreasurerRole
} from './member.service.js';

import AppError from '../../utils/AppError.js';


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
      userId
    } = req.body;

    // Only userId is allowed
    const allowedFields = [
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

    // Service independently verifies:
    // actor exists
    // actor is active
    // actor is Chama member
    // actor is Treasurer
    const membership =
      await addMemberToChama({

        chamaId,

        actorUserId,

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
//
// Soft delete.
//
// status = removed
//
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
// TRANSFER TREASURER ROLE
// ========================================
//
// PATCH
// /api/v1/chamas/:chamaId/members/transfer-treasurer
//
// Body:
//
// {
//   "newTreasurerMemberId":
//   "MEMBERSHIP_OBJECT_ID"
// }
//
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

    // --------------------------------------
    // 1. Get authenticated actor
    // --------------------------------------

    const actorUserId =
      req.user._id;


    // --------------------------------------
    // 2. Validate body
    // --------------------------------------

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


    // --------------------------------------
    // 3. Extract target membership
    // --------------------------------------

    const {
      newTreasurerMemberId
    } = req.body;


    // --------------------------------------
    // 4. Reject unexpected fields
    // --------------------------------------

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


    // --------------------------------------
    // 5. Transfer Treasurer
    // --------------------------------------

    const result =
      await transferTreasurerRole({

        chamaId,

        actorUserId,

        newTreasurerMemberId

      });


    // --------------------------------------
    // 6. Response
    // --------------------------------------

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