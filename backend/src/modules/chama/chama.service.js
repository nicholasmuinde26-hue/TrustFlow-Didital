import mongoose from 'mongoose';

import Chama from '../../models/Chama.js';
import User from '../../models/User.js';
import ChamaMembership from '../../models/ChamaMembership.js';

import AppError from '../../utils/AppError.js';
import { generateUniqueJoinCode } from '../../utils/joinCode.js';


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
  visibility,
  userId,
  treasurerPhone,
  treasurerEmail,
  treasurerUserId,
  treasurerInput,
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
  // 4. Find authenticated User (Chairperson)
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


  if (
    user.status !== 'active'
  ) {
    throw new AppError(
      'Your user account is not active',
      403
    );
  }


  // ----------------------------------------
  // 5. Verify & Find Treasurer User
  // ----------------------------------------

  const searchInput = (treasurerInput || treasurerPhone || treasurerEmail || '').trim();
  let treasurerUser = null;

  if (treasurerUserId && mongoose.Types.ObjectId.isValid(treasurerUserId)) {
    treasurerUser = await User.findById(treasurerUserId);
  } else if (searchInput) {
    const formattedPhone = searchInput.replace(/\s+/g, '');
    treasurerUser = await User.findOne({
      $or: [
        { phone: searchInput },
        { phone: formattedPhone },
        { email: searchInput.toLowerCase() },
      ],
    });
  }

  if (!treasurerUser) {
    throw new AppError(
      'A valid registered treasurer user is required to create a Chama. Please specify a registered user by phone or email.',
      400
    );
  }

  if (treasurerUser._id.toString() === user._id.toString()) {
    throw new AppError(
      'The chairperson cannot be the same user as the treasurer.',
      400
    );
  }

  if (treasurerUser.status !== 'active') {
    throw new AppError(
      'The specified treasurer user account is not active.',
      400
    );
  }


  // ----------------------------------------
  // 6. Create Chama
  // ----------------------------------------

  const joinCode = await generateUniqueJoinCode();
  const chamaVisibility = ['public', 'private'].includes(visibility) ? visibility : 'private';

  const chama =
    await Chama.create({
      name: chamaName,

      monthly_savings:
        savings,

      created_by:
        user._id,

      status:
        'active',
        
      visibility: chamaVisibility,

      join_code: joinCode
    });


  // ----------------------------------------
  // 7. Create Chama Memberships
  // ----------------------------------------
  //
  // Creator becomes Chairperson (payout position 1).
  // Added User becomes Treasurer (payout position 2).
  //
  // ----------------------------------------

  try {

    // 1. Creator = Chairperson
    await ChamaMembership.create({
      user_id:
        user._id,

      chama_id:
        chama._id,

      role:
        'chairperson',

      status:
        'active',

      payout_position:
        1
    });

    // 2. Verified User = Treasurer
    await ChamaMembership.create({
      user_id:
        treasurerUser._id,

      chama_id:
        chama._id,

      role:
        'treasurer',

      status:
        'active',

      payout_position:
        2
    });

  } catch (error) {

    await Chama.findByIdAndDelete(
      chama._id
    );

    await ChamaMembership.deleteMany({
      chama_id:
        chama._id
    });

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

export const verifyTreasurerUser = async (query, actorUserId) => {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new AppError('Search query (phone or email) is required', 400);
  }

  const cleanQuery = query.trim();
  const formattedPhone = cleanQuery.replace(/\s+/g, '');

  const user = await User.findOne({
    $or: [
      { phone: cleanQuery },
      { phone: formattedPhone },
      { email: cleanQuery.toLowerCase() },
    ],
  }).select('name first_name last_name phone email status');

  if (!user) {
    throw new AppError('No registered user found with that phone or email. The treasurer must have an account on the platform.', 404);
  }

  if (actorUserId && user._id.toString() === actorUserId.toString()) {
    throw new AppError('The treasurer cannot be yourself. You are the chairperson, please select another registered member as treasurer.', 400);
  }

  if (user.status !== 'active') {
    throw new AppError('The user account is not active.', 400);
  }

  const displayName = user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;

  return {
    _id: user._id,
    name: displayName,
    phone: user.phone,
    email: user.email,
  };
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
// Only the Treasurer or Chairperson of
// THIS Chama can update the Chama.
//
// Role is checked through:
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
  // 6. Check Treasurer or Chairperson Role
  // ----------------------------------------

  const allowedUpdaterRoles = [
    'treasurer',
    'chairperson'
  ];

  if (
    !allowedUpdaterRoles.includes(
      membership.role
    )
  ) {
    throw new AppError(
      'Only the treasurer or chairperson can update the Chama',
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
  // UPDATE VISIBILITY
  // ----------------------------------------

  if (
    updates.visibility !== undefined
  ) {

    if (
      !['public', 'private'].includes(updates.visibility)
    ) {
      throw new AppError(
        'Visibility must be either public or private',
        400
      );
    }

    allowedUpdates.visibility =
      updates.visibility;

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
// GET PUBLIC CHAMAS
// ========================================

export const getPublicChamas = async () => {
  const chamas = await Chama.find({
    status: 'active',
    visibility: 'public'
  })
    .select('name monthly_savings visibility status createdAt')
    .sort({ createdAt: -1 });

  return chamas;
};

// ========================================
// JOIN WITH CODE
// ========================================

export const joinWithCode = async (userId, joinCode) => {
  if (!joinCode || typeof joinCode !== 'string') {
    throw new AppError('Join code is required', 400);
  }

  const chama = await Chama.findOne({
    join_code: joinCode,
    status: 'active'
  });

  if (!chama) {
    throw new AppError('Invalid or inactive join code', 404);
  }

  const existingMembership = await ChamaMembership.findOne({
    user_id: userId,
    chama_id: chama._id
  });

  if (existingMembership) {
    if (existingMembership.status === 'active') {
      throw new AppError('You are already a member of this Chama', 409);
    }
    if (existingMembership.status === 'pending') {
      throw new AppError('Your request to join this Chama is already pending approval', 409);
    }
  }

  // Create pending membership
  const membership = await ChamaMembership.create({
    user_id: userId,
    chama_id: chama._id,
    role: 'member',
    status: 'pending',
    joined_at: new Date()
  });

  await membership.populate("chama_id", "name");

  return membership;
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