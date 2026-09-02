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
  chamaType,
  userId,
  treasurerPhone,
  treasurerEmail,
  treasurerUserId,
  treasurerInput,
  secretaryUserId,
  secretaryInput,
  committeeUserIds = [],
  committeeInputs = [],
  patronUserId,
  patronInput,
}) => {

  // ----------------------------------------
  // 1. Validate User ID (Chairperson)
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

  const chamaName = name.trim();

  if (chamaName.length < 2) {
    throw new AppError(
      'Chama name must be at least 2 characters',
      400
    );
  }


  // ----------------------------------------
  // 3. Validate monthly savings
  // ----------------------------------------

  const savings = monthlySavings !== undefined ? Number(monthlySavings) : 1000;

  if (!Number.isFinite(savings) || savings < 1) {
    throw new AppError('Monthly savings must be at least 1 KES', 400);
  }


  // ----------------------------------------
  // 4. Find authenticated User (Chairperson)
  // ----------------------------------------

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.status !== 'active') {
    throw new AppError('Your user account is not active', 403);
  }

  const assignedUserIds = new Set([user._id.toString()]);

  // Helper to resolve & verify a user for a governance role
  const resolveRoleUser = async (idVal, inputVal, roleTitle, isRequired = true) => {
    const query = (inputVal || '').trim();
    let foundUser = null;

    if (idVal && mongoose.Types.ObjectId.isValid(idVal)) {
      foundUser = await User.findById(idVal);
    } else if (query) {
      const formattedPhone = query.replace(/\s+/g, '');
      foundUser = await User.findOne({
        $or: [
          { phone: query },
          { phone: formattedPhone },
          { email: query.toLowerCase() },
        ],
      });
    }

    if (!foundUser) {
      if (isRequired) {
        throw new AppError(`A valid registered user is required for ${roleTitle}.`, 400);
      }
      return null;
    }

    if (foundUser.status !== 'active') {
      throw new AppError(`The user specified for ${roleTitle} is not active.`, 400);
    }

    const uidStr = foundUser._id.toString();
    if (assignedUserIds.has(uidStr)) {
      throw new AppError(`Each governance role must be assigned to a distinct user. (${foundUser.name || foundUser.email} is assigned multiple roles).`, 400);
    }

    assignedUserIds.add(uidStr);
    return foundUser;
  };

  // ----------------------------------------
  // 5. Resolve & Verify Governance Officials
  // ----------------------------------------

  // A. Treasurer (Required)
  const treasurerUser = await resolveRoleUser(treasurerUserId, treasurerInput || treasurerPhone || treasurerEmail, 'Treasurer', true);

  // B. Secretary (Required)
  const secretaryUser = await resolveRoleUser(secretaryUserId, secretaryInput, 'Secretary', true);

  // C. Committee Members (3 to 5 Required)
  const rawCommitteeList = Array.isArray(committeeUserIds) && committeeUserIds.length > 0 
    ? committeeUserIds.map((id, idx) => ({ id, input: committeeInputs[idx] || '' }))
    : Array.isArray(committeeInputs) ? committeeInputs.map((input) => ({ id: null, input })) : [];

  if (rawCommitteeList.length < 3 || rawCommitteeList.length > 5) {
    throw new AppError('Between 3 and 5 Committee Members are required to create a Chama.', 400);
  }

  const committeeUsers = [];
  for (let i = 0; i < rawCommitteeList.length; i++) {
    const item = rawCommitteeList[i];
    const cUser = await resolveRoleUser(item.id, item.input, `Committee Member #${i + 1}`, true);
    committeeUsers.push(cUser);
  }

  // D. Patron (Optional)
  const patronUser = await resolveRoleUser(patronUserId, patronInput, 'Patron', false);


  // ----------------------------------------
  // 6. Create Chama Document
  // ----------------------------------------

  const joinCode = await generateUniqueJoinCode();
  const chamaVisibility = ['public', 'private'].includes(visibility) ? visibility : 'private';
  const resolvedChamaType = ['standard', 'burial'].includes(chamaType) ? chamaType : 'standard';

  const chama = await Chama.create({
    name: chamaName,
    monthly_savings: savings,
    created_by: user._id,
    status: 'active',
    visibility: chamaVisibility,
    chama_type: resolvedChamaType,
    join_code: joinCode
  });


  // ----------------------------------------
  // 7. Create Chama Memberships
  // ----------------------------------------

  try {
    let position = 1;

    // 1. Creator = Chairperson (Position 1)
    await ChamaMembership.create({
      user_id: user._id,
      chama_id: chama._id,
      role: 'chairperson',
      status: 'active',
      payout_position: position++
    });

    // 2. Verified User = Treasurer (Position 2)
    await ChamaMembership.create({
      user_id: treasurerUser._id,
      chama_id: chama._id,
      role: 'treasurer',
      status: 'active',
      payout_position: position++
    });

    // 3. Verified User = Secretary (Position 3)
    await ChamaMembership.create({
      user_id: secretaryUser._id,
      chama_id: chama._id,
      role: 'secretary',
      status: 'active',
      payout_position: position++
    });

    // 4. Committee Members (Positions 4..N)
    for (const cUser of committeeUsers) {
      await ChamaMembership.create({
        user_id: cUser._id,
        chama_id: chama._id,
        role: 'committee_member',
        status: 'active',
        payout_position: position++
      });
    }

    // 5. Patron (Optional - no rotational payout position)
    if (patronUser) {
      await ChamaMembership.create({
        user_id: patronUser._id,
        chama_id: chama._id,
        role: 'patron',
        status: 'active',
        payout_position: null
      });
    }

  } catch (error) {
    await Chama.findByIdAndDelete(chama._id);
    await ChamaMembership.deleteMany({ chama_id: chama._id });
    throw error;
  }


  // ----------------------------------------
  // 8. Return populated Chama
  // ----------------------------------------

  const populatedChama = await Chama.findById(chama._id).populate('created_by', 'name phone status');

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