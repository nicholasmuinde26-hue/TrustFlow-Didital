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
import ChamaContribution from '../../models/ChamaContribution.js';
import ChamaLoan from '../../models/ChamaLoan.js';
import AuditLog from '../../models/AuditLog.js';
import PlatformAdminAuditLog from '../../models/PlatformAdminAuditLog.js';
import FinancialTransaction from '../../models/FinancialTransaction.js';
import C2bPayment from '../../models/C2bPayment.js';
import ApprovalRequest from '../../models/ApprovalRequest.js';
import ContributionObligation from '../../models/ContributionObligation.js';
import { findUnbalancedOwners } from '../finance/accounting/glBalance.service.js';
import AppError from '../../utils/AppError.js';
import { generateUniqueJoinCode } from '../../utils/joinCode.js';
import { formatPhone } from '../../utils/phone.js';
import { sendWorkspaceRequestStatusEmail } from '../../services/notifications/email.service.js';
import { sendAdminAccessEmail } from '../../services/notifications/email.service.js';
import { createAuditLog } from '../../services/audit.service.js';
import bcrypt from 'bcryptjs';
import { generateAdminStepUpToken } from '../../utils/jwt.js';
import AdminAccessSession from '../../models/AdminAccessSession.js';

// Each category is a distinct console, not just a label: `permissions` is
// what actually decides which workspaces render for that admin (see
// admin.middleware.js and the frontend nav). Super Admin bypasses all of
// this and always has every workspace.
const CATEGORY_PROFILES = {
  finance: {
    adminRole: 'FINANCE_ADMIN',
    label: 'Finance',
    description: 'Treasury, reconciliation & reporting',
    permissions: { users: false, chamas: true, businesses: true, contributionGroups: true, finance: true, auditLogs: true, settings: false, security: false, support: false, onboarding: false },
  },
  security: {
    adminRole: 'SECURITY_ADMIN',
    label: 'Security',
    description: 'Risk signals, fraud telemetry & audit investigation',
    permissions: { users: true, chamas: true, businesses: true, contributionGroups: true, finance: false, auditLogs: true, settings: false, security: true, support: false, onboarding: false },
  },
  support: {
    adminRole: 'SUPPORT_ADMIN',
    label: 'Support',
    description: 'Member and workspace assistance',
    permissions: { users: true, chamas: true, businesses: true, contributionGroups: true, finance: false, auditLogs: false, settings: false, security: false, support: true, onboarding: false },
  },
  operations: {
    adminRole: 'OPERATIONS_ADMIN',
    label: 'Operations',
    description: 'Daily platform operations',
    permissions: { users: true, chamas: true, businesses: true, contributionGroups: true, finance: false, auditLogs: true, settings: false, security: false, support: true, onboarding: true },
  },
  compliance: {
    adminRole: 'COMPLIANCE_ADMIN',
    label: 'Compliance',
    description: 'Controls & evidence review',
    permissions: { users: true, chamas: true, businesses: true, contributionGroups: true, finance: true, auditLogs: true, settings: false, security: true, support: false, onboarding: false },
  },
  onboarding: {
    adminRole: 'ONBOARDING_ADMIN',
    label: 'Onboarding',
    description: 'Workspace activation',
    permissions: { users: true, chamas: true, businesses: true, contributionGroups: true, finance: false, auditLogs: false, settings: false, security: false, support: false, onboarding: true },
  },
  marketplace: {
    adminRole: 'MARKETPLACE_ADMIN',
    label: 'Marketplace',
    description: 'Category hubs, product moderation & merchant governance',
    permissions: {
      users: false,
      chamas: false,
      businesses: true,
      contributionGroups: false,
      finance: false,
      auditLogs: true,
      settings: false,
      security: false,
      support: false,
      onboarding: false,
      marketplace: true,
      manageMarketplaceDesign: true,
      approveListings: true,
      manageCategories: true,
      manageFeaturedContent: true,
      viewMarketplaceAnalytics: true,
      manageCommissions: true,
      accessMerchantPayouts: false,
    },
  },
};

export const listAdminCategories = () =>
  Object.entries(CATEGORY_PROFILES).map(([value, profile]) => ({
    value,
    label: profile.label,
    description: profile.description,
    defaultPermissions: profile.permissions,
  }));

export const createAdminStepUp = async (userId, password) => {
  if (!password) throw new AppError('Password is required for administrative step-up', 400);
  const user = await User.findById(userId).select('+password');
  if (!user?.password || !(await bcrypt.compare(password, user.password))) {
    throw new AppError('Password verification failed', 401);
  }
  return generateAdminStepUpToken(user._id);
};

export const listMyAdminSessions = (userId) => AdminAccessSession.find({ userId }).sort({ lastSeenAt: -1 }).lean();
export const revokeMyAdminSession = async (userId, sessionId) => {
  const session = await AdminAccessSession.findOneAndUpdate({ _id: sessionId, userId }, { $set: { status: 'REVOKED', revokedAt: new Date() } }, { new: true });
  if (!session) throw new AppError('Administrative device session not found', 404);
  return session;
};

// ========================================
// "WHO AM I" — lets the frontend build a permission-aware nav/workspace
// without duplicating the category→permission table on the client.
// ========================================
export const getMyAdminProfile = async (user) => {
  if (user.systemRole === 'super_admin') {
    return {
      systemRole: 'super_admin',
      adminRole: 'SUPER_ADMIN',
      category: 'super_admin',
      permissions: {
        users: true,
        chamas: true,
        businesses: true,
        contributionGroups: true,
        finance: true,
        auditLogs: true,
        settings: true,
        security: true,
        support: true,
        onboarding: true,
        marketplace: true,
        manageMarketplaceDesign: true,
        approveListings: true,
        manageCategories: true,
        manageFeaturedContent: true,
        viewMarketplaceAnalytics: true,
        manageCommissions: true,
        accessMerchantPayouts: true,
      },
      marketplaceScopes: ['*'],
      status: 'ACTIVE',
    };
  }

  const record = await PlatformAdmin.findOne({ userId: user._id }).lean();
  if (!record || record.status !== 'ACTIVE') {
    return null;
  }

  return {
    systemRole: 'sub_admin',
    adminRole: record.adminRole,
    category: record.category,
    permissions: record.permissions,
    marketplaceScopes: record.marketplaceScopes || [],
    status: record.status,
  };
};

const adminSnapshot = (admin) => admin ? { adminRole: admin.adminRole, category: admin.category, permissions: admin.permissions, status: admin.status, notes: admin.notes } : null;
const writeAdminAudit = (payload) => PlatformAdminAuditLog.create(payload);
const notifyAdminAccess = (user, action, category, reason = '') => {
  sendAdminAccessEmail({ to: user?.email, name: user?.name, action, category, reason }).catch((error) => console.error('Admin access notification failed:', error.message));
};

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
// GET EXECUTIVE (CROSS-WORKSPACE) OVERVIEW
// ========================================
//
// Aggregates across every Chama/ContributionGroup rather than one
// workspace at a time — this is "Screen 1" of the platform: total
// groups/members, money processed, what fraction of M-Pesa payments
// were auto-verified, how many risk signals and approvals are
// currently open. Every number here is a straight read of data the
// platform already records (C2bPayment.match_status, ApprovalRequest,
// FinancialTransaction, ContributionObligation) — nothing here is
// simulated or estimated.
// ========================================
export const getExecutiveOverview = async () => {
  const [
    totalGroups,
    totalChamas,
    totalMembers,
    totalTransactions,
    moneyProcessedAgg,
    matchedPayments,
    totalPayments,
    pendingApprovals,
    overdueObligations,
    unbalancedChamas,
    unbalancedGroups,
  ] = await Promise.all([
    ContributionGroup.countDocuments(),
    Chama.countDocuments(),
    ChamaMembership.countDocuments({ status: 'active' }),
    FinancialTransaction.countDocuments({ status: 'posted' }),
    FinancialTransaction.aggregate([
      { $match: { status: 'posted' } },
      { $group: { _id: null, total: { $sum: { $toDouble: '$amount' } } } },
    ]),
    C2bPayment.countDocuments({ match_status: { $in: ['matched', 'manually_matched'] } }),
    C2bPayment.countDocuments(),
    ApprovalRequest.countDocuments({ status: 'pending' }),
    ContributionObligation.countDocuments({ status: 'overdue' }),
    findUnbalancedOwners('Chama'),
    findUnbalancedOwners('ContributionGroup'),
  ]);

  const moneyProcessed = moneyProcessedAgg[0]?.total ?? 0;
  const verifiedTransactionPercent =
    totalPayments > 0 ? Math.round((matchedPayments / totalPayments) * 100) : null;
  const unbalancedLedgers = unbalancedChamas.length + unbalancedGroups.length;

  return {
    groups: totalGroups + totalChamas,
    members: totalMembers,
    transactions: totalTransactions,
    moneyProcessed: Math.round(moneyProcessed),
    verifiedTransactionPercent,
    unbalancedLedgers,
    unbalancedLedgerDetails: [...unbalancedChamas, ...unbalancedGroups],
    // "Risk alerts" combines every real, already-tracked signal rather than
    // one invented number: contributions overdue, M-Pesa payments that came
    // in but couldn't be auto-matched to a member, and any workspace whose
    // general ledger doesn't balance (the most serious of the three — see
    // unbalancedLedgerDetails for exactly which workspaces).
    riskAlerts: overdueObligations + (totalPayments - matchedPayments) + unbalancedLedgers,
    pendingApprovals,
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
      category: u.systemRole === 'super_admin' ? 'super_admin' : record?.category || 'operations',
      notes: record?.notes || '',
    };
  });
};

// ========================================
// PROMOTE USER TO SUB-ADMIN (WITH PERMISSIONS)
// ========================================
export const promoteToSubAdmin = async (userId, permissions = {}, appointedByUserId = null, { category = 'operations', notes = '', marketplaceScopes = [] } = {}) => {
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

  const profile = CATEGORY_PROFILES[category] || CATEGORY_PROFILES.operations;
  const defaultPermissions = { ...profile.permissions, ...permissions };
  const previous = await PlatformAdmin.findOne({ userId: user._id });

  const platformAdmin = await PlatformAdmin.findOneAndUpdate(
    { userId: user._id },
    {
      userId: user._id,
      adminRole: profile.adminRole,
      permissions: defaultPermissions,
      marketplaceScopes: Array.isArray(marketplaceScopes) ? marketplaceScopes : [],
      status: 'ACTIVE',
      appointedBy: appointedByUserId,
      category: CATEGORY_PROFILES[category] ? category : 'operations',
      notes,
    },
    { upsert: true, new: true }
  );

  await writeAdminAudit({ actorUserId: appointedByUserId, targetUserId: user._id, action: 'SUB_ADMIN_APPOINTED', category: platformAdmin.category, before: adminSnapshot(previous), after: adminSnapshot(platformAdmin) });
  notifyAdminAccess(user, 'appointed', platformAdmin.category);
  return { user, platformAdmin };
};

// ========================================
// UPDATE SUB-ADMIN PERMISSIONS
// ========================================
export const updateSubAdminPermissions = async (userId, permissions = {}, actorUserId = null, { category, notes, marketplaceScopes } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError('Invalid user ID', 400);
  }

  const platformAdmin = await PlatformAdmin.findOne({ userId });
  if (!platformAdmin) {
    throw new AppError('Platform administrator record not found', 404);
  }

  const before = adminSnapshot(platformAdmin);
  const nextProfile = category && CATEGORY_PROFILES[category];
  if (nextProfile) { platformAdmin.category = category; platformAdmin.adminRole = nextProfile.adminRole; }
  if (typeof notes === 'string') platformAdmin.notes = notes;
  if (Array.isArray(marketplaceScopes)) platformAdmin.marketplaceScopes = marketplaceScopes;
  platformAdmin.permissions = {
    ...(nextProfile?.permissions || platformAdmin.permissions.toObject()),
    ...permissions,
  };

  await platformAdmin.save();
  await writeAdminAudit({ actorUserId, targetUserId: platformAdmin.userId, action: 'SUB_ADMIN_SCOPE_UPDATED', category: platformAdmin.category, before, after: adminSnapshot(platformAdmin) });
  const affectedUser = await User.findById(platformAdmin.userId).select('name email');
  notifyAdminAccess(affectedUser, 'rescoped', platformAdmin.category);
  return platformAdmin;
};

// ========================================
// DEMOTE SUB-ADMIN
// ========================================
export const demoteSubAdmin = async (userId, actorUserId = null) => {
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

  const previous = await PlatformAdmin.findOne({ userId });
  const before = adminSnapshot(previous);
  // Preserve the administrator record and its appointment history. Revoking
  // access means suspending it, never deleting evidence of the assignment.
  if (previous) { previous.status = 'SUSPENDED'; await previous.save(); }
  await writeAdminAudit({ actorUserId, targetUserId: user._id, action: 'SUB_ADMIN_REVOKED', category: previous?.category, before, after: { status: 'SUSPENDED' } });
  notifyAdminAccess(user, 'revoked', previous?.category);

  return user;
};

// ========================================
// SUSPEND / REINSTATE SUB-ADMIN
// ========================================
// Distinct from demotion on purpose: demoting strips the systemRole and is
// meant to be a permanent removal. Suspending pulls access immediately
// (requireAdmin rejects them on their very next request) while preserving
// their systemRole, category and permission configuration untouched —
// useful mid-investigation, when Super Admin wants the account frozen
// without deciding yet whether the appointment itself should end.
// ========================================
export const suspendSubAdmin = async (userId, actorUserId = null, reason = '') => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError('Invalid user ID', 400);
  }

  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);
  if (user.systemRole === 'super_admin') {
    throw new AppError('Cannot suspend the Super Admin', 400);
  }

  const platformAdmin = await PlatformAdmin.findOne({ userId });
  if (!platformAdmin) throw new AppError('Platform administrator record not found', 404);

  const before = adminSnapshot(platformAdmin);
  platformAdmin.status = 'SUSPENDED';
  if (reason) platformAdmin.notes = reason;
  await platformAdmin.save();

  await writeAdminAudit({
    actorUserId,
    targetUserId: userId,
    action: 'SUB_ADMIN_SUSPENDED',
    category: platformAdmin.category,
    before,
    after: adminSnapshot(platformAdmin),
    metadata: { reason: reason || null },
  });
  notifyAdminAccess(user, 'suspended', platformAdmin.category, reason);

  return platformAdmin;
};

export const reinstateSubAdmin = async (userId, actorUserId = null) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError('Invalid user ID', 400);
  }

  const platformAdmin = await PlatformAdmin.findOne({ userId });
  if (!platformAdmin) throw new AppError('Platform administrator record not found', 404);

  const before = adminSnapshot(platformAdmin);
  platformAdmin.status = 'ACTIVE';
  await platformAdmin.save();

  await writeAdminAudit({
    actorUserId,
    targetUserId: userId,
    action: 'SUB_ADMIN_REINSTATED',
    category: platformAdmin.category,
    before,
    after: adminSnapshot(platformAdmin),
  });

  const reinstatedUser = await User.findById(userId).select('name email');
  notifyAdminAccess(reinstatedUser, 'reinstated', platformAdmin.category);

  return platformAdmin;
};

export const listAdminActivity = async ({ page = 1, limit = 50, category = '', action = '', actor = '', from = '', to = '' } = {}) => {
  const query = {};
  if (category) query.category = category;
  if (action) query.action = action.toUpperCase();
  if (actor && mongoose.Types.ObjectId.isValid(actor)) query.actorUserId = actor;
  if (from || to) {
    query.createdAt = {};
    if (from && !Number.isNaN(new Date(from).getTime())) query.createdAt.$gte = new Date(from);
    if (to && !Number.isNaN(new Date(to).getTime())) { const until = new Date(to); until.setHours(23, 59, 59, 999); query.createdAt.$lte = until; }
  }
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * safeLimit;
  const [logs, total] = await Promise.all([
    PlatformAdminAuditLog.find(query).populate('actorUserId targetUserId', 'name email phone').sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
    PlatformAdminAuditLog.countDocuments(query),
  ]);
  return { logs, total, page: Number(page), limit: safeLimit };
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

// ========================================
// ENTITY DIRECTORY DETAIL
// ========================================
// Powers the Admin "who is who where" drill-down: given a workspace type
// and id, returns the full picture the Super Admin / Sub-Admin needs to
// manage it directly — the entity itself, every member/owner involved
// with their role and contact details, and a finance snapshot — without
// requiring the admin to log into the workspace itself.
// ========================================

const MONEY = (v) => (v === null || v === undefined ? 0 : Number(v.toString ? v.toString() : v));

export const getChamaDetail = async (chamaId) => {
  if (!mongoose.Types.ObjectId.isValid(chamaId)) {
    throw new AppError('Invalid chama ID', 400);
  }

  const chama = await Chama.findById(chamaId).populate('created_by', 'name phone email').lean();
  if (!chama) {
    throw new AppError('Chama not found', 404);
  }

  const [members, accounts, contributions, loans] = await Promise.all([
    ChamaMembership.find({ chama_id: chamaId, status: { $ne: 'removed' } })
      .populate('user_id', 'name phone email status isPhoneVerified')
      .sort({ role: 1, joined_at: 1 })
      .lean(),
    FinancialAccount.find({ owner_type: 'Chama', owner_id: chamaId }).lean(),
    ChamaContribution.find({ chama_id: chamaId }).select('title status target_amount collected_amount createdAt').sort({ createdAt: -1 }).limit(10).lean(),
    ChamaLoan.countDocuments({ chama_id: chamaId, status: { $ne: 'paid' } }),
  ]);

  const totalBalance = accounts.reduce((sum, a) => sum + MONEY(a.current_balance), 0);

  return {
    type: 'chama',
    entity: chama,
    members: members.map((m) => ({
      membershipId: m._id,
      user: m.user_id,
      role: m.role,
      status: m.status,
      custom_title: m.custom_title,
      payout_position: m.payout_position,
      joined_at: m.joined_at,
      suspended_at: m.suspended_at,
    })),
    finance: {
      accounts: accounts.map((a) => ({ name: a.name, account_type: a.account_type, balance: MONEY(a.current_balance) })),
      totalBalance,
    },
    contributions: contributions.map((c) => ({
      ...c,
      target_amount: MONEY(c.target_amount),
      collected_amount: MONEY(c.collected_amount),
    })),
    outstandingLoans: loans,
  };
};

export const getBusinessDetail = async (businessId) => {
  if (!mongoose.Types.ObjectId.isValid(businessId)) {
    throw new AppError('Invalid business ID', 400);
  }

  const business = await Business.findById(businessId).populate('created_by', 'name phone email status').lean();
  if (!business) {
    throw new AppError('Business not found', 404);
  }

  const accounts = await FinancialAccount.find({ owner_type: 'Business', owner_id: businessId }).lean();
  const totalBalance = accounts.reduce((sum, a) => sum + MONEY(a.current_balance), 0);

  return {
    type: 'business',
    entity: business,
    members: [
      {
        user: business.created_by,
        role: 'owner',
        status: 'active',
      },
    ],
    finance: {
      accounts: accounts.map((a) => ({ name: a.name, account_type: a.account_type, balance: MONEY(a.current_balance) })),
      totalBalance,
    },
  };
};

export const getContributionGroupDetail = async (groupId) => {
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    throw new AppError('Invalid contribution group ID', 400);
  }

  const group = await ContributionGroup.findById(groupId).populate('created_by', 'name phone email').lean();
  if (!group) {
    throw new AppError('Contribution group not found', 404);
  }

  const [members, accounts] = await Promise.all([
    ContributionGroupMember.find({ contribution_group_id: groupId, status: { $ne: 'removed' } })
      .populate('user_id', 'name phone email status')
      .sort({ role: 1 })
      .lean(),
    FinancialAccount.find({ owner_type: 'ContributionGroup', owner_id: groupId }).lean(),
  ]);

  const totalBalance = accounts.reduce((sum, a) => sum + MONEY(a.current_balance), 0);

  return {
    type: 'contribution_group',
    entity: group,
    members: members.map((m) => ({
      membershipId: m._id,
      user: m.user_id,
      role: m.role,
      status: m.status,
    })),
    finance: {
      accounts: accounts.map((a) => ({ name: a.name, account_type: a.account_type, balance: MONEY(a.current_balance) })),
      totalBalance,
    },
  };
};

export const getEntityDetail = async (type, id) => {
  const normalized = String(type || '').toLowerCase();
  if (normalized === 'chama') return getChamaDetail(id);
  if (normalized === 'business') return getBusinessDetail(id);
  if (normalized === 'contribution_group') return getContributionGroupDetail(id);
  throw new AppError('Unknown workspace type', 400);
};

// ========================================
// UPDATE A CHAMA MEMBER'S ROLE OR STATUS (ADMIN OVERRIDE)
// ========================================
// Lets Platform Admin fix a membership directly — most importantly,
// hand the chairperson seat to a new member when a term ends, without
// the outgoing chairperson needing to do it themselves. Promoting
// someone to chairperson automatically demotes whoever currently holds
// it, since a Chama can only have one active chairperson at a time.
// ========================================
export const updateChamaMemberRole = async (chamaId, membershipId, { role, status } = {}, adminUser) => {
  if (!mongoose.Types.ObjectId.isValid(chamaId) || !mongoose.Types.ObjectId.isValid(membershipId)) {
    throw new AppError('Invalid chama or member ID', 400);
  }

  const membership = await ChamaMembership.findOne({ _id: membershipId, chama_id: chamaId });
  if (!membership) {
    throw new AppError('Membership not found in this chama', 404);
  }

  const VALID_ROLES = ['member', 'treasurer', 'secretary', 'auditor', 'chairperson', 'committee_member', 'patron'];
  const VALID_STATUSES = ['active', 'inactive', 'suspended'];

  let demoted = null;
  const before = { role: membership.role, status: membership.status };

  if (role && role !== membership.role) {
    if (!VALID_ROLES.includes(role)) {
      throw new AppError('Invalid role', 400);
    }

    if (role === 'chairperson') {
      const currentChair = await ChamaMembership.findOne({
        chama_id: chamaId,
        role: 'chairperson',
        status: 'active',
        _id: { $ne: membership._id },
      });

      if (currentChair) {
        currentChair.role = 'member';
        await currentChair.save();
        demoted = currentChair;
      }
    }

    membership.role = role;
  }

  if (status && status !== membership.status) {
    if (!VALID_STATUSES.includes(status)) {
      throw new AppError('Invalid status', 400);
    }
    membership.status = status;
    membership.suspended_at = status === 'suspended' ? new Date() : null;
    membership.returned_at = status === 'active' && before.status === 'suspended' ? new Date() : membership.returned_at;
  }

  await membership.save();

  try {
    await createAuditLog({
      actorUserId: adminUser._id,
      scopeType: 'CHAMA',
      chamaId,
      action: role === 'chairperson' && before.role !== 'chairperson' ? 'ADMIN_CHAIRPERSON_TRANSFER' : 'ADMIN_MEMBERSHIP_UPDATE',
      resourceType: 'ChamaMembership',
      resourceId: membership._id,
      before,
      after: { role: membership.role, status: membership.status },
      metadata: {
        performedByAdmin: adminUser.name || adminUser.phone,
        demotedMembershipId: demoted?._id || null,
      },
    });
  } catch {
    // Non-blocking — the membership change itself already succeeded.
  }

  return getChamaDetail(chamaId);
};

// ========================================
// GLOBAL PEOPLE SEARCH ("who is who where")
// ========================================
// Finds a person by name/phone/email and shows every chama, business, and
// contribution group they're involved in and in what role, so an admin
// can answer "who is this person, and where are they active?" in one look.
// ========================================
export const searchPeople = async ({ query = '', page = 1, limit = 20 }) => {
  const filter = {};
  const term = query.trim();
  if (term) {
    filter.$or = [
      { name: { $regex: term, $options: 'i' } },
      { phone: { $regex: term, $options: 'i' } },
      { email: { $regex: term, $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [users, total] = await Promise.all([
    User.find(filter)
      .select('name phone email status systemRole createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    User.countDocuments(filter),
  ]);

  const userIds = users.map((u) => u._id);

  const [chamaMemberships, businesses, groupMemberships] = await Promise.all([
    ChamaMembership.find({ user_id: { $in: userIds }, status: { $ne: 'removed' } })
      .populate('chama_id', 'name chama_type')
      .lean(),
    Business.find({ created_by: { $in: userIds } }).select('name category created_by').lean(),
    ContributionGroupMember.find({ user_id: { $in: userIds }, status: { $ne: 'removed' } })
      .populate('contribution_group_id', 'name group_type')
      .lean(),
  ]);

  const rolesByUser = new Map(userIds.map((id) => [String(id), []]));

  for (const m of chamaMemberships) {
    if (!m.chama_id) continue;
    rolesByUser.get(String(m.user_id))?.push({
      workspaceType: 'chama',
      workspaceId: m.chama_id._id,
      workspaceName: m.chama_id.name,
      role: m.role,
      status: m.status,
    });
  }

  for (const b of businesses) {
    rolesByUser.get(String(b.created_by))?.push({
      workspaceType: 'business',
      workspaceId: b._id,
      workspaceName: b.name,
      role: 'owner',
      status: 'active',
    });
  }

  for (const m of groupMemberships) {
    if (!m.contribution_group_id) continue;
    rolesByUser.get(String(m.user_id))?.push({
      workspaceType: 'contribution_group',
      workspaceId: m.contribution_group_id._id,
      workspaceName: m.contribution_group_id.name,
      role: m.role,
      status: m.status,
    });
  }

  return {
    people: users.map((u) => ({ ...u, memberships: rolesByUser.get(String(u._id)) || [] })),
    total,
    page: Number(page),
    limit: Number(limit),
  };
};
