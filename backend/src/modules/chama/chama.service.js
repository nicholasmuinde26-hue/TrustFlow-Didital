import mongoose from 'mongoose';

import Chama from '../../models/Chama.js';
import User from '../../models/User.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import ChamaProfile from '../../models/ChamaProfile.js';

import AppError from '../../utils/AppError.js';
import { generateUniqueJoinCode } from '../../utils/joinCode.js';
import { formatPhone, isValidKenyanPhone } from '../../utils/phone.js';
import { organizationLabel } from '../../utils/organizationTerminology.js';
import { assertMemberCanRejoin } from './chamaInvitation.rules.js';
import permissionService from '../../services/permission.service.js';
import { mgrService } from '../mgr/index.js';
import { getOrCreatePolicy as getOrCreateLoanPolicy } from '../loans/index.js';
import {
  WORKSPACE_PRESETS,
  LEGACY_PRESET_BY_CHAMA_TYPE,
  buildWorkspaceConfig,
  validateModuleSelection,
  sanitizeModuleLabels,
} from '../../constants/workspaceModules.constants.js';
import { isOrganizationTypeValid, getOrganizationPresetKey, getDefaultTerminology } from '../../constants/organizationTypes.constants.js';

// ========================================
// CHAMA CREATION PRESETS
// ========================================
//
// A preset is a shortcut, not a new chama type — it just pre-wires the
// composable policy layers (MgrPolicy, ChamaLoanPolicy) that already
// exist independently of `chama_type`, right after creation, instead
// of leaving the chairperson to discover and configure each one
// separately. Nothing here is exclusive: a 'mixed' chama genuinely
// runs a rotating pot AND internal lending on the exact same ledger.
//
// MGR policies are always created as 'draft' (matching mgrService's
// own default) — never auto-activated, since activation generates
// real rounds and expects a settled participant list. The chairperson
// activates it from the MGR setup screen once membership is final.
// ========================================

const CHAMA_PRESETS = ['merry_go_round', 'table_banking', 'investment', 'burial', 'mixed', 'custom'];

async function provisionPreset({ preset, chama, userId }) {
  const resolvedPreset = CHAMA_PRESETS.includes(preset) ? preset : 'custom';
  const summary = { preset: resolvedPreset, provisioned: [], nextSteps: [] };

  const addMgrPolicy = async () => {
    try {
      const policy = await mgrService.createPolicy({
        chamaId: chama._id,
        userId,
        policyData: {
          name: `${chama.name} Merry-Go-Round`,
          frequency: 'monthly',
          uniform_amount: chama.monthly_savings,
        },
      });
      summary.provisioned.push({ type: 'mgr_policy', id: policy._id, status: policy.status });
      summary.nextSteps.push('Activate the Merry-Go-Round policy once your member list is final.');
    } catch (err) {
      console.error('Preset provisioning: MGR policy failed', err.message);
    }
  };

  const addLoanPolicy = async () => {
    try {
      const policy = await getOrCreateLoanPolicy(chama._id);
      summary.provisioned.push({ type: 'loan_policy', id: policy._id });
    } catch (err) {
      console.error('Preset provisioning: loan policy failed', err.message);
    }
  };

  switch (resolvedPreset) {
    case 'merry_go_round':
      await addMgrPolicy();
      break;
    case 'table_banking':
      await addLoanPolicy();
      break;
    case 'investment':
      await addLoanPolicy();
      summary.nextSteps.push('Set up a free-will contribution plan to enable dividend share-outs.');
      break;
    case 'burial':
      // chama_type: 'burial' already drives the dedicated setup wizard —
      // nothing extra to provision here.
      summary.nextSteps.push('Complete the burial chama setup wizard to configure tiers and eligibility.');
      break;
    case 'mixed':
      await addMgrPolicy();
      await addLoanPolicy();
      break;
    default:
      break;
  }

  return summary;
}


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
  preset,
  userId,
  chairpersonInput,
  chairpersonName,
  chairpersonPhone,
  chairpersonEmail,
  chairpersonUserId,
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
  workspaceModules,
  organizationFamily = 'chama',
  organizationType = 'custom',
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

  const isAdminCreator = user.systemRole === 'super_admin' || user.systemRole === 'sub_admin';
  const hasChairpersonParam = Boolean(
    chairpersonUserId ||
    chairpersonInput ||
    chairpersonPhone ||
    chairpersonEmail ||
    chairpersonName
  );

  const assignedUserIds = new Set();

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
      if (isAdminCreator) {
        let phoneVal = null;
        let emailVal = null;
        if (query.includes('@')) {
          emailVal = query.toLowerCase();
        } else if (query) {
          try {
            phoneVal = formatPhone(query);
          } catch {
            phoneVal = null;
          }
        }

        if (!phoneVal) {
          phoneVal = `2547${Math.floor(10000000 + Math.random() * 89999999)}`;
        }

        foundUser = await User.create({
          name: roleTitle,
          phone: phoneVal,
          email: emailVal,
          status: 'unverified',
          isPhoneVerified: false,
          systemRole: 'user',
        });
      } else if (isRequired) {
        throw new AppError(`A valid registered user is required for ${roleTitle}.`, 400);
      } else {
        return null;
      }
    }

    if (foundUser.status === 'blocked' || foundUser.status === 'suspended') {
      throw new AppError(`The user specified for ${roleTitle} is suspended or blocked.`, 400);
    }

    const uidStr = foundUser._id.toString();
    if (assignedUserIds.has(uidStr)) {
      throw new AppError(`Each governance role must be assigned to a distinct user. (${foundUser.name || foundUser.email || foundUser.phone} is assigned multiple roles).`, 400);
    }

    assignedUserIds.add(uidStr);
    return foundUser;
  };

  // ----------------------------------------
  // 5. Resolve & Verify Governance Officials
  // ----------------------------------------

  // A. Chairperson (Resolved for clients when admin creates, or defaults to user)
  let chairUser;
  if (isAdminCreator || hasChairpersonParam) {
    chairUser = await resolveRoleUser(
      chairpersonUserId,
      chairpersonInput || chairpersonPhone || chairpersonEmail || chairpersonName,
      'Chairperson',
      true
    );
  } else {
    chairUser = user;
    assignedUserIds.add(chairUser._id.toString());
  }

  // B. Treasurer (Required)
  const treasurerUser = await resolveRoleUser(treasurerUserId, treasurerInput || treasurerPhone || treasurerEmail, 'Treasurer', true);

  // C. Secretary (Required)
  const secretaryUser = await resolveRoleUser(secretaryUserId, secretaryInput, 'Secretary', true);

  // D. Committee Members (3 to 5 Required)
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

  // E. Patron (Optional)
  const patronUser = await resolveRoleUser(patronUserId, patronInput, 'Patron', false);


  // ----------------------------------------
  // 6. Create Chama Document
  // ----------------------------------------

  const joinCode = await generateUniqueJoinCode();
  if (!isOrganizationTypeValid(organizationFamily, organizationType)) {
    throw new AppError('Choose a valid organization family and type.', 400);
  }
  const chamaVisibility = ['public', 'private'].includes(visibility) ? visibility : 'private';
  // A 'burial' preset implies chama_type 'burial' even if the caller
  // didn't separately pass chamaType — the preset IS the type here.
  const effectiveChamaType = chamaType || (preset === 'burial' ? 'burial' : undefined);
  const resolvedChamaType = ['standard', 'burial'].includes(effectiveChamaType) ? effectiveChamaType : 'standard';

  // Which feature modules the workspace contains. An explicit selection
  // ({ preset, modules: [...] }) wins; without one the chama gets the legacy
  // set for its type, i.e. exactly what it had before workspaces were
  // configurable. Only the 'burial' shell is chosen by module: it needs
  // burial_welfare switched on.
  let workspaceConfig;
  let shellChamaType = resolvedChamaType;
  if (workspaceModules && Array.isArray(workspaceModules.modules) && workspaceModules.modules.length > 0) {
    const selection = validateModuleSelection(workspaceModules.modules);
    if (!selection.ok) {
      throw new AppError(`Workspace modules are not valid: ${selection.errors.join('; ')}`, 400);
    }
    workspaceConfig = buildWorkspaceConfig({
      preset: workspaceModules.preset,
      enabled: selection.enabled,
      terminology: { ...getDefaultTerminology(organizationFamily), module_labels: sanitizeModuleLabels(workspaceModules.moduleLabels) },
      configuredBy: userId,
    });
    shellChamaType = selection.enabled.includes('burial_welfare') ? 'burial' : 'standard';
  } else {
    // Plain chama with no subtype keeps the legacy set; any other
    // family/type starts from its own preset.
    const legacy = organizationFamily === 'chama' && organizationType === 'custom';
    const startPreset = legacy
      ? (LEGACY_PRESET_BY_CHAMA_TYPE[resolvedChamaType] || 'standard')
      : getOrganizationPresetKey(organizationFamily, organizationType);
    workspaceConfig = buildWorkspaceConfig({
      preset: startPreset,
      enabled: WORKSPACE_PRESETS[startPreset].modules,
      terminology: getDefaultTerminology(organizationFamily),
      configuredBy: userId,
    });
    shellChamaType = WORKSPACE_PRESETS[startPreset].modules.includes('burial_welfare') ? 'burial' : shellChamaType;
  }

  const chama = await Chama.create({
    name: chamaName,
    monthly_savings: savings,
    created_by: chairUser._id,
    status: 'active',
    visibility: chamaVisibility,
    chama_type: shellChamaType,
    organization_family: organizationFamily,
    organization_type: organizationType,
    workspace_config: workspaceConfig,
    join_code: joinCode
  });


  // ----------------------------------------
  // 7. Create Chama Memberships
  // ----------------------------------------

  try {
    let position = 1;

    // 1. Designated Chairperson (Position 1)
    await ChamaMembership.create({
      user_id: chairUser._id,
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
  // 8. Initialize Default Permissions
  // ----------------------------------------
  
  try {
    // Use the chairperson membership to initialize permissions
    const chairpersonMembership = await ChamaMembership.findOne({
      user_id: user._id,
      chama_id: chama._id,
      role: 'chairperson'
    });

    if (chairpersonMembership) {
      await permissionService.initializeDefaultPermissions(
        chama._id,
        chairpersonMembership._id
      );
    }
  } catch (permissionError) {
    // Log permission initialization error but don't fail chama creation
    console.error('Failed to initialize default permissions:', permissionError.message);
    // Note: Chama is still created successfully, permissions can be initialized later via seed script
  }

  // ----------------------------------------
  // 9. Provision preset policies (composable, additive — see
  //    provisionPreset above). A failure here never blocks chama
  //    creation, same pattern as default-permission initialization
  //    above.
  // ----------------------------------------

  let presetSummary = { preset: 'custom', provisioned: [], nextSteps: [] };
  try {
    presetSummary = await provisionPreset({ preset, chama, userId: user._id });
  } catch (presetError) {
    console.error('Preset provisioning failed:', presetError.message);
  }

  // ----------------------------------------
  // 10. Return populated Chama
  // ----------------------------------------

  const populatedChama = await Chama.findById(chama._id).populate('created_by', 'name phone status');

  return { chama: populatedChama, presetSummary };
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
  chamaId,
  { includeContact = false } = {}
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

      // Keep suspended members visible in the directory.
      status: {
        $in: ['active', 'suspended']
      }
    })
      .populate(
        'user_id',
        includeContact
          ? 'name phone email avatar_url status createdAt'
          : 'name avatar_url status createdAt'
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

export const getPublicChamas = async ({ organizationFamily, organizationType } = {}) => {
  const filter = {
    status: 'active',
    visibility: 'public'
  };
  if (organizationFamily === 'chama') filter.$or = [{ organization_family: 'chama' }, { organization_family: { $exists: false } }];
  else if (['sacco', 'cooperative'].includes(organizationFamily)) filter.organization_family = organizationFamily;
  if (typeof organizationType === 'string' && organizationType.trim()) {
    if (organizationType === 'custom') filter.$and = [{ $or: [{ organization_type: 'custom' }, { organization_type: { $exists: false } }] }];
    else filter.organization_type = organizationType.trim();
  }
  const chamas = await Chama.find(filter)
    .select('name monthly_savings visibility status organization_family organization_type workspace_config createdAt')
    .sort({ createdAt: -1 });
  const profiles = await ChamaProfile.find({
    chama_id: { $in: chamas.map((chama) => chama._id) },
    'public_profile.enabled': true,
  }).select('chama_id public_profile.tagline public_profile.purpose public_profile.description public_profile.location public_profile.logo_url').lean();
  const profileByChama = new Map(profiles.map((profile) => [String(profile.chama_id), profile.public_profile || {}]));

  return chamas.map((chama) => ({
    ...chama.toObject(),
    has_public_profile: profileByChama.has(String(chama._id)),
    public_profile: profileByChama.get(String(chama._id)) || null,
  }));
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

  const cooldownDays = ['burial', 'burial_welfare'].includes(chama.chama_type) || ['burial', 'burial_welfare'].includes(chama.workspace_config?.preset) ? 180 : 30;
  assertMemberCanRejoin(existingMembership, new Date(), cooldownDays);

  // Create pending membership
  const membership = existingMembership
    ? await ChamaMembership.findByIdAndUpdate(existingMembership._id, { $set: { role: 'member', status: 'pending', payout_position: null, removed_at: null, removed_by: null } }, { new: true, runValidators: true })
    : await ChamaMembership.create({ user_id: userId, chama_id: chama._id, role: 'member', status: 'pending', joined_at: new Date() });

  await membership.populate("chama_id", "name");

  return membership;
};


// ========================================
// REQUEST TO JOIN A PUBLIC CHAMA
// (NO INVITATION CODE REQUIRED)
// ========================================
//
// For a Chama with visibility: 'public', anyone can already SEE it in
// getPublicChamas() above. This lets them request to join it directly
// from that listing with a single click — no join_code, invite link,
// or token needed, since public visibility itself is what makes the
// Chama discoverable/joinable in the first place.
//
// Same end state as joinWithCode()/acceptInvite(): a ChamaMembership
// with status 'pending'. It does NOT grant membership immediately —
// the Treasurer or Chairperson still reviews it via
// GET /chamas/:chamaId/members/join-requests and approves/declines it
// through updateMemberStatus() in member.service.js.
//
// ========================================

export const requestToJoinPublicChama = async (userId, chamaId) => {
  if (!chamaId || !mongoose.Types.ObjectId.isValid(chamaId)) {
    throw new AppError('Invalid Chama ID', 400);
  }

  const chama = await Chama.findOne({
    _id: chamaId,
    status: 'active'
  });

  if (!chama) {
    throw new AppError('Organization not found', 404);
  }
  const orgLabel = organizationLabel(chama.organization_family, chama.workspace_config?.terminology);

  // Deliberately not exposed for private Chamas — those still require
  // a join_code or invite link so they stay undiscoverable to anyone
  // who wasn't given one directly.
  if (chama.visibility !== 'public') {
    throw new AppError(`This ${orgLabel} is not open to public join requests`, 403);
  }

  const existingMembership = await ChamaMembership.findOne({
    user_id: userId,
    chama_id: chama._id
  });

  assertMemberCanRejoin(existingMembership);

  const membership = existingMembership
    ? await ChamaMembership.findByIdAndUpdate(existingMembership._id, { $set: { role: 'member', status: 'pending', payout_position: null, removed_at: null, removed_by: null } }, { new: true, runValidators: true })
    : await ChamaMembership.create({ user_id: userId, chama_id: chama._id, role: 'member', status: 'pending', joined_at: new Date() });

  await membership.populate('chama_id', 'name');

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
