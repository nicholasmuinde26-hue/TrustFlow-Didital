import mongoose from 'mongoose';
import User from '../../models/User.js';
import PlatformAdmin from '../../models/PlatformAdmin.js';
import Chama from '../../models/Chama.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import Business from '../../models/Business.js';
import ContributionGroup from '../../models/ContributionGroup.js';
import ContributionGroupMember from '../../models/ContributionGroupMember.js';
import WorkspaceRequest from '../../models/WorkspaceRequest.js';
import FinancialAccount from '../../models/FinancialAccount.js';
import AuditLog from '../../models/AuditLog.js';
import AppError from '../../utils/AppError.js';
import { generateUniqueJoinCode } from '../../utils/joinCode.js';
import { formatPhone } from '../../utils/phone.js';
import { sendWorkspaceRequestStatusEmail } from '../../services/notifications/email.service.js';

// ========================================
// GET SYSTEM OVERVIEW STATS
// ========================================
export const getOverviewStats = async () => {
  const [
    totalUsers,
    totalChamas,
    totalBusinesses,
    totalGroups,
    pendingRequests,
    totalSubAdmins,
  ] = await Promise.all([
    User.countDocuments(),
    Chama.countDocuments(),
    Business.countDocuments(),
    ContributionGroup.countDocuments(),
    WorkspaceRequest.countDocuments({ status: { $in: ['pending', 'PENDING', 'UNDER_REVIEW'] } }),
    PlatformAdmin.countDocuments({ adminRole: 'PLATFORM_ADMIN', status: 'ACTIVE' }),
  ]);

  return {
    totalUsers,
    totalChamas,
    totalBusinesses,
    totalGroups,
    pendingRequests,
    totalSubAdmins,
  };
};

// ========================================
// LIST USERS (WITH SEARCH & FILTER)
// ========================================
export const listUsers = async ({ query = '', role = '', page = 1, limit = 50 }) => {
  const filter = {};

  if (role) {
    filter.systemRole = role;
  }

  if (query.trim()) {
    const term = query.trim();
    filter.$or = [
      { name: { $regex: term, $options: 'i' } },
      { email: { $regex: term, $options: 'i' } },
      { phone: { $regex: term, $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('name phone email status systemRole isPhoneVerified createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    User.countDocuments(filter),
  ]);

  return { users, total, page: Number(page), limit: Number(limit) };
};

// ========================================
// LIST SUB-ADMINS & SUPER ADMINS
// ========================================
export const listSubAdmins = async () => {
  const users = await User.find({ systemRole: { $in: ['super_admin', 'sub_admin'] } })
    .select('name phone email status systemRole createdAt')
    .sort({ systemRole: -1, createdAt: 1 })
    .lean();

  const adminRecords = await PlatformAdmin.find().lean();
  const adminMap = new Map(adminRecords.map((a) => [String(a.userId), a]));

  return users.map((u) => {
    const record = adminMap.get(String(u._id));
    return {
      ...u,
      adminRole: u.systemRole === 'super_admin' ? 'SUPER_ADMIN' : record?.adminRole || 'PLATFORM_ADMIN',
      permissions:
        u.systemRole === 'super_admin'
          ? {
              users: true,
              chamas: true,
              businesses: true,
              contributionGroups: true,
              finance: true,
              auditLogs: true,
              settings: true,
            }
          : record?.permissions || {
              users: true,
              chamas: true,
              businesses: false,
              contributionGroups: true,
              finance: false,
              auditLogs: true,
              settings: false,
            },
      adminStatus: record?.status || 'ACTIVE',
    };
  });
};

// ========================================
// PROMOTE USER TO SUB-ADMIN (WITH PERMISSIONS)
// ========================================
export const promoteToSubAdmin = async (userId, permissions = {}, appointedByUserId = null) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError('Invalid user ID', 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.systemRole === 'super_admin') {
    throw new AppError('User is already Super Admin', 400);
  }

  user.systemRole = 'sub_admin';
  await user.save();

  const defaultPermissions = {
    users: permissions.users ?? true,
    chamas: permissions.chamas ?? true,
    businesses: permissions.businesses ?? false,
    contributionGroups: permissions.contributionGroups ?? true,
    finance: permissions.finance ?? false,
    auditLogs: permissions.auditLogs ?? true,
    settings: permissions.settings ?? false,
  };

  const platformAdmin = await PlatformAdmin.findOneAndUpdate(
    { userId: user._id },
    {
      userId: user._id,
      adminRole: 'PLATFORM_ADMIN',
      permissions: defaultPermissions,
      status: 'ACTIVE',
      appointedBy: appointedByUserId,
    },
    { upsert: true, new: true }
  );

  return { user, platformAdmin };
};

// ========================================
// UPDATE SUB-ADMIN PERMISSIONS
// ========================================
export const updateSubAdminPermissions = async (userId, permissions = {}) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError('Invalid user ID', 400);
  }

  const platformAdmin = await PlatformAdmin.findOne({ userId });
  if (!platformAdmin) {
    throw new AppError('Platform administrator record not found', 404);
  }

  platformAdmin.permissions = {
    ...platformAdmin.permissions.toObject(),
    ...permissions,
  };

  await platformAdmin.save();
  return platformAdmin;
};

// ========================================
// DEMOTE SUB-ADMIN
// ========================================
export const demoteSubAdmin = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError('Invalid user ID', 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.systemRole === 'super_admin') {
    throw new AppError('Cannot demote the Super Admin', 400);
  }

  user.systemRole = 'user';
  await user.save();

  await PlatformAdmin.findOneAndDelete({ userId });

  return user;
};

// ========================================
// LIST WORKSPACE REQUESTS
// ========================================
export const listWorkspaceRequests = async ({ status = '', entityType = '' }) => {
  const filter = {};

  if (status) {
    filter.status = { $regex: new RegExp(`^${status}$`, 'i') };
  }

  if (entityType) {
    filter.entityType = entityType;
  }

  return WorkspaceRequest.find(filter)
    .populate('requestedBy', 'name phone email')
    .populate('reviewedBy', 'name phone email')
    .sort({ createdAt: -1 });
};

// ========================================
// GET SINGLE WORKSPACE REQUEST
// ========================================
export const getWorkspaceRequestById = async (requestId) => {
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw new AppError('Invalid request ID', 400);
  }

  const request = await WorkspaceRequest.findById(requestId)
    .populate('requestedBy', 'name phone email')
    .populate('reviewedBy', 'name phone email');

  if (!request) {
    throw new AppError('Workspace request not found', 404);
  }

  return request;
};

// ========================================
// EDITABLE FIELDS HELPER
// ========================================
// The admin can review a submitted request and, instead of re-typing
// everything from scratch, adjust/complete only what's missing (add a
// treasurer's phone, fix a name, add extra committee members, etc.)
// before it gets provisioned. This whitelist defines what's safe for
// an admin to touch on someone else's request.
const PERSON_FIELDS = ['fullName', 'phone', 'email', 'idNumber'];

const applyPersonEdits = (target, edits) => {
  if (!edits || typeof edits !== 'object') return target;
  const next = { ...(target?.toObject ? target.toObject() : target) };
  for (const field of PERSON_FIELDS) {
    if (edits[field] !== undefined) next[field] = edits[field];
  }
  return next;
};

const applyEditsToRequest = (request, edits = {}) => {
  if (!edits || typeof edits !== 'object') return request;

  if (edits.name !== undefined && edits.name.trim()) request.name = edits.name.trim();
  if (edits.description !== undefined) request.description = edits.description;
  if (edits.category !== undefined && edits.category) request.category = edits.category;
  if (edits.monthlySavings !== undefined && edits.monthlySavings !== '') {
    request.monthlySavings = Number(edits.monthlySavings) || request.monthlySavings;
  }
  if (edits.adminNotes !== undefined) request.adminNotes = edits.adminNotes;

  if (edits.details && typeof edits.details === 'object') {
    request.details = { ...(request.details?.toObject ? request.details.toObject() : request.details), ...edits.details };
  }

  if (edits.chairperson) request.chairperson = applyPersonEdits(request.chairperson, edits.chairperson);
  if (edits.treasurer) request.treasurer = applyPersonEdits(request.treasurer, edits.treasurer);
  if (edits.secretary) request.secretary = applyPersonEdits(request.secretary, edits.secretary);

  // Committee members are replaced wholesale when provided, so the admin
  // can add/remove members as well as edit existing ones.
  if (Array.isArray(edits.committeeMembers)) {
    request.committeeMembers = edits.committeeMembers
      .filter((cm) => cm && (cm.fullName || cm.phone || cm.email))
      .map((cm) => ({
        role: cm.role || 'Committee Member',
        fullName: cm.fullName || '',
        phone: cm.phone || '',
        email: cm.email || '',
        idNumber: cm.idNumber || '',
      }));
  }

  return request;
};

const hasMeaningfulEdits = (edits = {}) =>
  Boolean(
    edits &&
      typeof edits === 'object' &&
      Object.keys(edits).some((k) => edits[k] !== undefined && edits[k] !== null && edits[k] !== '')
  );

// ========================================
// UPDATE WORKSPACE REQUEST (Admin edits before deciding)
// ========================================
export const updateWorkspaceRequest = async (requestId, edits, adminUser) => {
  const request = await getWorkspaceRequestById(requestId);

  const currentStatus = String(request.status).toUpperCase();
  if (currentStatus === 'APPROVED' || currentStatus === 'REJECTED') {
    throw new AppError(`Request has already been ${currentStatus.toLowerCase()} and can no longer be edited`, 400);
  }

  applyEditsToRequest(request, edits);
  request.status = 'UNDER_REVIEW';
  request.auditTrail.push({
    action: 'EDITED',
    performedBy: adminUser._id,
    performedAt: new Date(),
    notes: 'Admin updated request details prior to a decision.',
  });

  await request.save();
  return request;
};

// Helper: Find existing user or create unverified stub
const findOrCreateUserStub = async ({ name, fullName, phone, email, fallbackUserId }) => {
  const displayName = (fullName || name || '').trim();
  let user = null;

  if (phone) {
    const formatted = formatPhone(phone);
    user = await User.findOne({ phone: formatted });
  }

  if (!user && email) {
    user = await User.findOne({ email: email.trim().toLowerCase() });
  }

  if (!user && fallbackUserId) {
    user = await User.findById(fallbackUserId);
  }

  if (!user && phone) {
    const formatted = formatPhone(phone);
    user = await User.create({
      name: displayName || 'Member',
      phone: formatted,
      email: email ? email.trim().toLowerCase() : null,
      status: 'unverified',
      isPhoneVerified: false,
      systemRole: 'user',
    });
  }

  return user;
};

// ========================================
// APPROVE WORKSPACE REQUEST & CREATE ENTITY
// ========================================
export const approveWorkspaceRequest = async (requestId, adminUser, edits = {}) => {
  const request = await getWorkspaceRequestById(requestId);

  const currentStatus = String(request.status).toUpperCase();
  if (currentStatus === 'APPROVED' || currentStatus === 'REJECTED') {
    throw new AppError(`Request has already been ${currentStatus.toLowerCase()}`, 400);
  }

  // The admin can tweak or fill in details (e.g. add a missing member,
  // correct a name) in the same step as approving, so they don't have to
  // save an edit first and then approve separately.
  const editedInline = hasMeaningfulEdits(edits);
  if (editedInline) {
    applyEditsToRequest(request, edits);
  }

  let createdEntityId = null;

  if (request.entityType === 'chama') {
    // 1. Resolve Chairperson
    const chairUser = await findOrCreateUserStub({
      fullName: request.chairperson?.fullName || request.chairperson?.name,
      phone: request.chairperson?.phone,
      email: request.chairperson?.email,
      fallbackUserId: request.requestedBy?._id,
    });

    if (!chairUser) {
      throw new AppError('Could not resolve or create Chairperson account', 400);
    }

    // 2. Generate join code
    const joinCode = await generateUniqueJoinCode();

    // 3. Create Chama
    const chama = await Chama.create({
      name: request.name,
      monthly_savings: request.monthlySavings || 1000,
      chama_type: request.category === 'burial' ? 'burial' : 'standard',
      created_by: chairUser._id,
      status: 'active',
      visibility: 'public',
      join_code: joinCode,
      county: request.details?.county || '',
      location: request.details?.location || '',
    });

    createdEntityId = chama._id;

    // 4. Create Chairperson Membership
    await ChamaMembership.create({
      chama_id: chama._id,
      user_id: chairUser._id,
      role: 'chairperson',
      status: 'active',
      payout_position: 1,
    });

    const assignedUserIds = new Set([chairUser._id.toString()]);

    // 5. Create Treasurer Membership
    if (request.treasurer?.phone || request.treasurer?.email) {
      const treasurerUser = await findOrCreateUserStub({
        fullName: request.treasurer?.fullName || request.treasurer?.name,
        phone: request.treasurer?.phone,
        email: request.treasurer?.email,
      });

      if (treasurerUser && !assignedUserIds.has(treasurerUser._id.toString())) {
        assignedUserIds.add(treasurerUser._id.toString());
        await ChamaMembership.create({
          chama_id: chama._id,
          user_id: treasurerUser._id,
          role: 'treasurer',
          status: 'active',
          payout_position: 2,
        });
      }
    }

    // 6. Create Secretary Membership
    if (request.secretary?.phone || request.secretary?.email) {
      const secretaryUser = await findOrCreateUserStub({
        fullName: request.secretary?.fullName || request.secretary?.name,
        phone: request.secretary?.phone,
        email: request.secretary?.email,
      });

      if (secretaryUser && !assignedUserIds.has(secretaryUser._id.toString())) {
        assignedUserIds.add(secretaryUser._id.toString());
        await ChamaMembership.create({
          chama_id: chama._id,
          user_id: secretaryUser._id,
          role: 'secretary',
          status: 'active',
          payout_position: 3,
        });
      }
    }

    // 7. Create Committee Memberships
    if (Array.isArray(request.committeeMembers) && request.committeeMembers.length > 0) {
      let position = 4;
      for (const cm of request.committeeMembers) {
        if (!cm.phone && !cm.email) continue;
        const cUser = await findOrCreateUserStub({
          fullName: cm.fullName || cm.name,
          phone: cm.phone,
          email: cm.email,
        });

        if (cUser && !assignedUserIds.has(cUser._id.toString())) {
          assignedUserIds.add(cUser._id.toString());
          await ChamaMembership.create({
            chama_id: chama._id,
            user_id: cUser._id,
            role: 'committee_member',
            custom_title: cm.role || 'Committee Member',
            status: 'active',
            payout_position: position++,
          });
        }
      }
    }

    // 8. Provision Default Financial Structure
    try {
      await FinancialAccount.create([
        {
          owner_type: 'Chama',
          owner_id: chama._id,
          name: 'Main Treasury Account',
          account_type: 'ASSET',
          system_key: 'main_treasury',
          account_code: '1010',
          currency: 'KES',
          balance: 0,
          status: 'ACTIVE',
        },
        {
          owner_type: 'Chama',
          owner_id: chama._id,
          name: 'Welfare & Emergency Fund',
          account_type: 'EQUITY',
          system_key: 'welfare_fund',
          account_code: '3010',
          currency: 'KES',
          balance: 0,
          status: 'ACTIVE',
        },
      ]);
    } catch {
      // Ignore if accounts already initialized
    }
  } else if (request.entityType === 'business') {
    const ownerUser = await findOrCreateUserStub({
      fullName: request.chairperson?.fullName || request.chairperson?.name,
      phone: request.chairperson?.phone,
      email: request.chairperson?.email,
      fallbackUserId: request.requestedBy?._id,
    });

    const business = await Business.create({
      name: request.name,
      category: request.category || 'retail',
      category_label: request.category || 'Retail',
      created_by: ownerUser._id,
      location: request.details?.location || '',
    });

    createdEntityId = business._id;
  } else if (request.entityType === 'contribution_group') {
    const organizerUser = await findOrCreateUserStub({
      fullName: request.chairperson?.fullName || request.chairperson?.name,
      phone: request.chairperson?.phone,
      email: request.chairperson?.email,
      fallbackUserId: request.requestedBy?._id,
    });

    const group = await ContributionGroup.create({
      name: request.name,
      group_type: request.category || 'rotational',
      created_by: organizerUser._id,
      status: 'active',
    });

    await ContributionGroupMember.create({
      contribution_group_id: group._id,
      user_id: organizerUser._id,
      role: 'admin',
      status: 'active',
    });

    createdEntityId = group._id;
  }

  // Mark Request as Approved
  request.status = 'APPROVED';
  request.reviewedBy = adminUser._id;
  request.reviewedAt = new Date();
  request.createdEntityId = createdEntityId;
  request.auditTrail.push({
    action: editedInline ? 'EDITED_AND_APPROVED' : 'APPROVED',
    performedBy: adminUser._id,
    performedAt: new Date(),
    notes: `Workspace ${request.entityType} '${request.name}' approved and provisioned.`,
  });

  await request.save();

  // Audit Log Entry
  try {
    await AuditLog.create({
      actorUserId: adminUser._id,
      targetType: 'SYSTEM',
      targetId: createdEntityId,
      action: 'WORKSPACE_PROVISIONED',
      description: `Admin ${adminUser.name || adminUser.phone} approved and provisioned ${request.entityType} '${request.name}' (${request.requestNumber})`,
      metadata: {
        requestId: request._id,
        requestNumber: request.requestNumber,
        entityType: request.entityType,
        createdEntityId,
      },
    });
  } catch {
    // Non-blocking
  }

  // Let the requester know their workspace is ready and they can log in.
  // Fail-soft: email delivery is best-effort and never blocks approval.
  try {
    const notifyEmail = request.chairperson?.email || request.requestedBy?.email;
    const notifyPhone = request.chairperson?.phone || request.requestedBy?.phone;
    if (notifyEmail) {
      await sendWorkspaceRequestStatusEmail({
        to: notifyEmail,
        contactName: request.chairperson?.fullName || request.requestedBy?.name,
        entityName: request.name,
        entityType: request.entityType,
        status: 'APPROVED',
        loginPhone: notifyPhone,
        requestNumber: request.requestNumber,
      });
    }
  } catch {
    // Non-blocking
  }

  return request;
};

// ========================================
// REJECT WORKSPACE REQUEST
// ========================================
export const rejectWorkspaceRequest = async (requestId, adminNotes = '', adminUser) => {
  const request = await getWorkspaceRequestById(requestId);

  const currentStatus = String(request.status).toUpperCase();
  if (currentStatus === 'APPROVED' || currentStatus === 'REJECTED') {
    throw new AppError(`Request has already been ${currentStatus.toLowerCase()}`, 400);
  }

  request.status = 'REJECTED';
  request.adminNotes = adminNotes || 'Request does not meet verification requirements';
  request.rejectionReason = adminNotes || 'Request does not meet verification requirements';
  request.reviewedBy = adminUser._id;
  request.reviewedAt = new Date();
  request.auditTrail.push({
    action: 'REJECTED',
    performedBy: adminUser._id,
    performedAt: new Date(),
    notes: adminNotes,
  });

  await request.save();

  try {
    await AuditLog.create({
      actorUserId: adminUser._id,
      targetType: 'SYSTEM',
      targetId: request._id,
      action: 'WORKSPACE_REQUEST_REJECTED',
      description: `Admin ${adminUser.name || adminUser.phone} rejected request ${request.requestNumber}: ${adminNotes}`,
      metadata: {
        requestId: request._id,
        requestNumber: request.requestNumber,
        reason: adminNotes,
      },
    });
  } catch {
    // Non-blocking
  }

  // Let the requester know why their request was rejected.
  try {
    const notifyEmail = request.chairperson?.email || request.requestedBy?.email;
    if (notifyEmail) {
      await sendWorkspaceRequestStatusEmail({
        to: notifyEmail,
        contactName: request.chairperson?.fullName || request.requestedBy?.name,
        entityName: request.name,
        entityType: request.entityType,
        status: 'REJECTED',
        rejectionReason: request.rejectionReason,
        requestNumber: request.requestNumber,
      });
    }
  } catch {
    // Non-blocking
  }

  return request;
};
