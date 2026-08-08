import mongoose from 'mongoose';

import Chama from '../models/Chama.js';
import ChamaMembership from '../models/ChamaMembership.js';

import AppError from '../utils/AppError.js';


// ========================================
// GET CHAMA ID FROM REQUEST
// ========================================

const getChamaId = (req) => {

  return (
    req.params.chamaId ||
    req.params.id
  );

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
      getChamaId(req);


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


    if (
      req.membership.role !== 'treasurer'
    ) {

      throw new AppError(
        'Only the treasurer can perform this action',
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


    const allowedRoles = [

      'treasurer',

      'chairperson'

    ];


    if (
      !allowedRoles.includes(
        req.membership.role
      )
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
      getChamaId(req);


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