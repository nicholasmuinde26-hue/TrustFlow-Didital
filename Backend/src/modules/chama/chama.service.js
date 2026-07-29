import mongoose from 'mongoose';

import Chama from '../../models/Chama.js';
import User from '../../models/User.js';
import ChamaMembership from '../../models/ChamaMembership.js';

import AppError from '../../utils/AppError.js';


// ========================================
// CREATE CHAMA
// ========================================
//
// The authenticated User creates a Chama.
//
// The system automatically creates:
//
// User
//   │
//   ├── Chama
//   │
//   └── ChamaMembership
//          role: treasurer
//          status: active
//          payout_position: 1
//
// NOTE:
// MongoDB transaction has intentionally been
// removed for now to allow testing with a
// standalone MongoDB instance.
//
// ========================================

export const createChama = async ({
  name,
  monthlySavings,
  userId
}) => {

  // ----------------------------------------
  // 1. Validate User ID
  // ----------------------------------------

  if (
    !userId ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    throw new AppError(
      'Invalid user ID',
      400
    );
  }


  // ----------------------------------------
  // 2. Validate Chama name
  // ----------------------------------------

  if (
    !name ||
    typeof name !== 'string' ||
    !name.trim()
  ) {
    throw new AppError(
      'Chama name is required',
      400
    );
  }


  const chamaName =
    name.trim();


  if (
    chamaName.length < 2
  ) {
    throw new AppError(
      'Chama name must be at least 2 characters',
      400
    );
  }


  // ----------------------------------------
  // 3. Validate monthly savings
  // ----------------------------------------

  const savings =
    monthlySavings !== undefined
      ? Number(monthlySavings)
      : 1000;


  if (
    !Number.isFinite(savings) ||
    savings < 1
  ) {
    throw new AppError(
      'Monthly savings must be at least 1 KES',
      400
    );
  }


  // ----------------------------------------
  // 4. Find authenticated User
  // ----------------------------------------

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


  // ----------------------------------------
  // 5. Check User account status
  // ----------------------------------------

  if (
    user.status !== 'active'
  ) {
    throw new AppError(
      'Your user account is not active',
      403
    );
  }


  // ----------------------------------------
  // 6. Create Chama
  // ----------------------------------------

  const chama =
    await Chama.create({
      name: chamaName,

      monthly_savings:
        savings,

      created_by:
        user._id,

      status:
        'active'
    });


  // ----------------------------------------
  // 7. Create Chama Membership
  // ----------------------------------------
  //
  // The creator automatically becomes
  // the Treasurer of this Chama.
  //
  // The role belongs to ChamaMembership,
  // NOT the User document.
  //
  // ----------------------------------------

  try {

    await ChamaMembership.create({
      user_id:
        user._id,

      chama_id:
        chama._id,

      role:
        'treasurer',

      status:
        'active',

      payout_position:
        1
    });

  } catch (error) {

    // --------------------------------------
    // IMPORTANT:
    //
    // Because transactions are disabled,
    // if membership creation fails after
    // Chama creation, we manually remove
    // the Chama to avoid leaving orphan data.
    // --------------------------------------

    await Chama.findByIdAndDelete(
      chama._id
    );

    throw error;

  }


  // ----------------------------------------
  // 8. Return populated Chama
  // ----------------------------------------

  const populatedChama =
    await Chama.findById(
      chama._id
    )
      .populate(
        'created_by',
        'name phone status'
      );


  return populatedChama;

};



// ========================================
// GET CHAMA BY ID
// ========================================
//
// Access is controlled by ChamaMembership.
//
// The User must have an active membership.
//
// ========================================

export const getChamaById = async (
  chamaId,
  userId = null
) => {

  // ----------------------------------------
  // 1. Validate Chama ID
  // ----------------------------------------

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


  // ----------------------------------------
  // 2. Validate User ID
  // ----------------------------------------

  if (
    userId &&
    !mongoose.Types.ObjectId.isValid(
      userId
    )
  ) {
    throw new AppError(
      'Invalid user ID',
      400
    );
  }


  // ----------------------------------------
  // 3. Find Chama
  // ----------------------------------------

  const chama =
    await Chama.findById(
      chamaId
    )
      .populate(
        'created_by',
        'name phone status'
      );


  if (!chama) {
    throw new AppError(
      'Chama not found',
      404
    );
  }


  // ----------------------------------------
  // 4. Check User membership
  // ----------------------------------------

  if (userId) {

    const membership =
      await ChamaMembership.findOne({
        user_id:
          userId,

        chama_id:
          chamaId
      });


    if (!membership) {
      throw new AppError(
        'You are not a member of this Chama',
        403
      );
    }


    // --------------------------------------
    // 5. Check membership status
    // --------------------------------------

    if (
      membership.status !== 'active'
    ) {
      throw new AppError(
        'Your membership in this Chama is not active',
        403
      );
    }

  }


  // ----------------------------------------
  // 6. Return Chama
  // ----------------------------------------

  return chama;

};



// ========================================
// GET CHAMA MEMBERS
// ========================================
//
// Returns all active memberships for a Chama.
//
// Membership information comes from:
//
// ChamaMembership
//      │
//      ├── user_id
//      ├── chama_id
//      ├── role
//      ├── status
//      ├── payout_position
//      └── joined_at
//
// User information is populated from:
//
// User
//
// ========================================

export const getChamaMembers = async (
  chamaId
) => {

  // ----------------------------------------
  // 1. Validate Chama ID
  // ----------------------------------------

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


  // ----------------------------------------
  // 2. Check Chama exists
  // ----------------------------------------

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


  // ----------------------------------------
  // 3. Find Chama memberships
  // ----------------------------------------

  const memberships =
    await ChamaMembership.find({
      chama_id:
        chamaId,

      status:
        'active'
    })
      .populate(
        'user_id',
        'name phone status createdAt'
      )
      .sort({
        payout_position:
          1,

        joined_at:
          1
      });


  // ----------------------------------------
  // 4. Return memberships
  // ----------------------------------------

  return memberships;

};



// ========================================
// UPDATE CHAMA
// ========================================
//
// Only the Treasurer of THIS Chama
// can update the Chama.
//
// Treasurer role is checked through:
//
// ChamaMembership.role
//
// ========================================

export const updateChama = async (
  chamaId,
  userId,
  updates
) => {

  // ----------------------------------------
  // 1. Validate Chama ID
  // ----------------------------------------

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


  // ----------------------------------------
  // 2. Validate User ID
  // ----------------------------------------

  if (
    !userId ||
    !mongoose.Types.ObjectId.isValid(
      userId
    )
  ) {
    throw new AppError(
      'Invalid user ID',
      400
    );
  }


  // ----------------------------------------
  // 3. Find Chama
  // ----------------------------------------

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


  // ----------------------------------------
  // 4. Find User Membership
  // ----------------------------------------

  const membership =
    await ChamaMembership.findOne({
      user_id:
        userId,

      chama_id:
        chamaId
    });


  if (!membership) {
    throw new AppError(
      'You are not a member of this Chama',
      403
    );
  }


  // ----------------------------------------
  // 5. Check Membership Status
  // ----------------------------------------

  if (
    membership.status !== 'active'
  ) {
    throw new AppError(
      'Your membership in this Chama is not active',
      403
    );
  }


  // ----------------------------------------
  // 6. Check Treasurer Role
  // ----------------------------------------

  if (
    membership.role !== 'treasurer'
  ) {
    throw new AppError(
      'Only the treasurer can update the Chama',
      403
    );
  }


  // ----------------------------------------
  // 7. Validate Updates
  // ----------------------------------------

  if (
    !updates ||
    typeof updates !== 'object' ||
    Array.isArray(updates)
  ) {
    throw new AppError(
      'Update data is required',
      400
    );
  }


  // ----------------------------------------
  // 8. Build Allowed Updates
  // ----------------------------------------

  const allowedUpdates = {};


  // ----------------------------------------
  // UPDATE CHAMA NAME
  // ----------------------------------------

  if (
    updates.name !== undefined
  ) {

    if (
      typeof updates.name !== 'string'
    ) {
      throw new AppError(
        'Chama name must be a string',
        400
      );
    }


    const name =
      updates.name.trim();


    if (
      name.length < 2
    ) {
      throw new AppError(
        'Chama name must be at least 2 characters',
        400
      );
    }


    allowedUpdates.name =
      name;

  }


  // ----------------------------------------
  // UPDATE MONTHLY SAVINGS
  // ----------------------------------------

  if (
    updates.monthly_savings !== undefined
  ) {

    const monthlySavings =
      Number(
        updates.monthly_savings
      );


    if (
      !Number.isFinite(
        monthlySavings
      ) ||
      monthlySavings < 1
    ) {
      throw new AppError(
        'Monthly savings must be at least 1 KES',
        400
      );
    }


    allowedUpdates.monthly_savings =
      monthlySavings;

  }


  // ----------------------------------------
  // 9. Prevent Empty Updates
  // ----------------------------------------

  if (
    Object.keys(
      allowedUpdates
    ).length === 0
  ) {
    throw new AppError(
      'No valid fields provided for update',
      400
    );
  }


  // ----------------------------------------
  // 10. Update Chama
  // ----------------------------------------

  const updatedChama =
    await Chama.findByIdAndUpdate(
      chamaId,
      {
        $set:
          allowedUpdates
      },
      {
        new:
          true,

        runValidators:
          true
      }
    )
      .populate(
        'created_by',
        'name phone status'
      );


  return updatedChama;

};



// ========================================
// DELETE CHAMA
// ========================================
//
// Only the Treasurer can delete the Chama.
//
// All ChamaMembership records are removed
// together with the Chama.
//
// NOTE:
// MongoDB transaction has intentionally been
// removed for now.
//
// ========================================

export const deleteChama = async (
  chamaId,
  userId
) => {

  // ----------------------------------------
  // 1. Validate Chama ID
  // ----------------------------------------

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


  // ----------------------------------------
  // 2. Validate User ID
  // ----------------------------------------

  if (
    !userId ||
    !mongoose.Types.ObjectId.isValid(
      userId
    )
  ) {
    throw new AppError(
      'Invalid user ID',
      400
    );
  }


  // ----------------------------------------
  // 3. Find Chama
  // ----------------------------------------

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


  // ----------------------------------------
  // 4. Find User Membership
  // ----------------------------------------

  const membership =
    await ChamaMembership.findOne({
      user_id:
        userId,

      chama_id:
        chamaId
    });


  if (!membership) {
    throw new AppError(
      'You are not a member of this Chama',
      403
    );
  }


  // ----------------------------------------
  // 5. Check Membership Status
  // ----------------------------------------

  if (
    membership.status !== 'active'
  ) {
    throw new AppError(
      'Your membership in this Chama is not active',
      403
    );
  }


  // ----------------------------------------
  // 6. Check Treasurer Role
  // ----------------------------------------

  if (
    membership.role !== 'treasurer'
  ) {
    throw new AppError(
      'Only the treasurer can delete the Chama',
      403
    );
  }


  // ----------------------------------------
  // 7. Delete All Memberships
  // ----------------------------------------

  await ChamaMembership.deleteMany({
    chama_id:
      chamaId
  });


  // ----------------------------------------
  // 8. Delete Chama
  // ----------------------------------------

  await Chama.findByIdAndDelete(
    chamaId
  );


  // ----------------------------------------
  // 9. Return Success
  // ----------------------------------------

  return true;

};