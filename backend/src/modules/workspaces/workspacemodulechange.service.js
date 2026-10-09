import Chama from '../../models/Chama.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import ApprovalRequest from '../../models/ApprovalRequest.js';
import ChamaLoan from '../../models/ChamaLoan.js';
import MgrRound from '../../models/MgrRound.js';
import Withdrawal from '../../models/Withdrawal.js';
import Payout from '../../models/Payout.js';
import SavingsShareout from '../../models/SavingsShareout.js';
import Dispute from '../../models/Dispute.js';
import BurialCase from '../../models/BurialCase.js';
import ChamaAsset from '../../models/ChamaAsset.js';
import InvestmentProposal from '../../models/InvestmentProposal.js';
import AssetLease from '../../models/AssetLease.js';
import ContributionPlan from '../../models/ContributionPlan.js';
import AppError from '../../utils/AppError.js';
import approvalService from '../approval/approval.service.js';
import { createAuditLog } from '../../services/audit.service.js';
import { AUDIT_ACTIONS } from '../../constants/audit.constants.js';
import {
  WORKSPACE_MODULES,
  WORKSPACE_PRESETS,
  PRESET_KEYS,
  buildWorkspaceConfig,
  getEnabledModules,
  validateModuleSelection,
} from '../../constants/workspaceModules.constants.js';

/**
 * ============================================================================
 * WORKSPACE MODULE CHANGES
 * ============================================================================
 *
 * After a chama exists, a leader requests a feature change and a platform
 * admin reviews it. The admin can also configure an existing workspace
 * directly from the admin console.
 *
 * Switching a module off hides and blocks it, it never deletes data. But a
 * module that still has live business in it cannot be switched off: you
 * cannot hide Loans while members still owe money. That rule is enforced
 * twice - when the request is made, and again when it is approved - because
 * a loan can be disbursed while the request waits for sign-off.
 * ============================================================================
 */

export const APPROVAL_RESOURCE_TYPE = 'WORKSPACE_MODULES';
export const AUDIT_RESOURCE_TYPE = 'WORKSPACE_MODULES';

// ---------------------------------------------------------------------------
// "Can't disable while there is open data"
// ---------------------------------------------------------------------------
// Each check counts the live records that would be orphaned from the UI if the
// module were hidden. `noun` completes the sentence "N <noun>". Modules not
// listed here (chat, announcements, polls ...) hold nothing that needs
// finishing, so they can always be switched off.

const OPEN_LOAN_STATUSES = [
  'submitted', 'pending_approval', 'approved', 'disbursement_pending', 'disbursed',
  'active', 'partially_repaid', 'overdue', 'defaulted',
];

const OPEN_CHECKS = {
  loans: {
    noun: 'loan(s) not yet settled',
    hint: 'Wait until they are repaid, closed or cancelled.',
    count: (chamaId) => ChamaLoan.countDocuments({ chama_id: chamaId, status: { $in: OPEN_LOAN_STATUSES } }),
  },
  mgr: {
    noun: 'Merry-go-round round(s) still running',
    hint: 'Complete or close the open rounds first.',
    count: (chamaId) => MgrRound.countDocuments({ chama_id: chamaId, status: { $nin: ['completed', 'reconciled', 'received'] } }),
  },
  payouts: {
    noun: 'payout(s) waiting to be approved or paid',
    hint: 'Pay or cancel them first.',
    count: (chamaId) => Payout.countDocuments({ chama_id: chamaId, status: { $in: ['pending', 'approved'] } }),
  },
  withdrawals: {
    noun: 'member withdrawal(s) waiting to be decided or paid',
    hint: 'Decide, pay or cancel them first.',
    count: (chamaId) => Withdrawal.countDocuments({ chama_id: chamaId, status: { $in: ['pending', 'approved'] } }),
  },
  savings_shareout: {
    noun: 'savings share-out(s) in progress',
    hint: 'Complete or cancel them first.',
    count: (chamaId) => SavingsShareout.countDocuments({ chama_id: chamaId, status: { $in: ['pending_approval', 'approved'] } }),
  },
  disputes: {
    noun: 'unresolved dispute(s)',
    hint: 'Resolve or dismiss them first.',
    count: (chamaId) => Dispute.countDocuments({ chama_id: chamaId, status: { $in: ['open', 'investigating'] } }),
  },
  burial_welfare: {
    noun: 'burial case(s) still open',
    hint: 'Close or finish the open cases first.',
    count: (chamaId) =>
      BurialCase.countDocuments({
        chama_id: chamaId,
        status: { $nin: ['confirmed', 'closed', 'rejected', 'cancelled'] },
      }),
  },
  assets: {
    noun: 'registered asset(s) or open investment proposal(s)',
    hint: 'Dispose of, deactivate or resolve them first.',
    count: async (chamaId) => {
      const [assets, proposals] = await Promise.all([
        ChamaAsset.countDocuments({
          chama_id: chamaId,
          status: { $in: ['pending_approval', 'active', 'suspended', 'disposal_requested'] },
        }),
        InvestmentProposal.countDocuments({ chama_id: chamaId, status: { $in: ['draft', 'under_review', 'approved'] } }),
      ]);
      return assets + proposals;
    },
  },
  property_leases: {
    noun: 'active lease(s)',
    hint: 'End or terminate them first.',
    count: (chamaId) => AssetLease.countDocuments({ chama_id: chamaId, status: 'active' }),
  },
  contributions: {
    noun: 'active or paused contribution plan(s)',
    hint: 'Archive them first.',
    count: (chamaId) =>
      ContributionPlan.countDocuments({ owner_type: 'Chama', owner_id: chamaId, status: { $in: ['active', 'paused'] } }),
  },
};

const labelOf = (key) => WORKSPACE_MODULES[key]?.label || key;

const broadcastWorkspaceModulesChanged = async (chamaId, modules, chamaType) => {
  try {
    const { getIO } = await import('../realtime/socketServer.js');
    getIO().to(`chama:${String(chamaId)}`).emit('chama:workspace_modules_changed', {
      chama_id: String(chamaId),
      modules,
      chama_type: chamaType,
      at: Date.now(),
    });
  } catch {
    // The persisted configuration remains authoritative if realtime is unavailable.
  }
};

/**
 * Modules that currently cannot be switched off, with the reason.
 *   { loans: { count: 4, reason: "4 loan(s) not yet settled. Wait until ...", noun, hint } }
 * Only modules that are switched ON are checked.
 */
export async function getBlockedModules(chama, keys = null) {
  const enabled = getEnabledModules(chama);
  const candidates = (keys || Object.keys(OPEN_CHECKS)).filter((key) => OPEN_CHECKS[key] && enabled.includes(key));

  const results = await Promise.all(
    candidates.map(async (key) => {
      const check = OPEN_CHECKS[key];
      const count = await check.count(chama._id);
      return [key, count];
    })
  );

  const blocked = {};
  for (const [key, count] of results) {
    if (count > 0) {
      const check = OPEN_CHECKS[key];
      blocked[key] = {
        count,
        noun: check.noun,
        hint: check.hint,
        reason: `${labelOf(key)} has ${count} ${check.noun}. ${check.hint}`,
      };
    }
  }
  return blocked;
}

const presetFor = (keys) => {
  const set = new Set(keys);
  return (
    PRESET_KEYS.find((key) => {
      const preset = new Set(WORKSPACE_PRESETS[key].modules);
      return preset.size === set.size && [...preset].every((k) => set.has(k));
    }) || 'custom'
  );
};

/** What a target selection changes relative to the chama today. */
function diffSelection(chama, targetInput) {
  const validation = validateModuleSelection(targetInput);
  if (!validation.ok) {
    throw new AppError(`Workspace modules are not valid: ${validation.errors.join('; ')}`, 400);
  }
  const target = validation.enabled;
  const current = getEnabledModules(chama);
  return {
    target,
    current,
    enable: target.filter((key) => !current.includes(key)),
    disable: current.filter((key) => !target.includes(key)),
  };
}

function assertNothingBlocked(blocked, disable) {
  const hits = disable.filter((key) => blocked[key]);
  if (hits.length === 0) return;
  const error = new AppError(
    `Cannot switch off ${hits.map(labelOf).join(', ')}: ${hits.map((k) => blocked[k].reason).join(' ')}`,
    409
  );
  error.code = 'MODULE_HAS_OPEN_DATA';
  error.blocked = Object.fromEntries(hits.map((k) => [k, blocked[k]]));
  throw error;
}

const summarize = (request) => ({
  id: request._id,
  status: request.status,
  title: request.title,
  enable: request.metadata?.enable || [],
  disable: request.metadata?.disable || [],
  target_modules: request.metadata?.target_modules || [],
  initiated_by: request.initiated_by?._id || request.initiated_by,
  required_approvals: request.required_approvals,
  eligible_roles: request.eligible_roles,
  approvals: (request.approvals || []).map((a) => ({
    approver_id: a.approver_id?._id || a.approver_id,
    role: a.role,
    status: a.status,
    comment: a.comment,
    timestamp: a.timestamp,
  })),
  created_at: request.createdAt,
  resolved_at: request.resolved_at || null,
  cancel_reason: request.metadata?.cancel_reason || null,
  note: request.metadata?.note || '',
  decided_by_admin: request.metadata?.decided_by_admin ? { note: request.metadata.decided_by_admin.note || '' } : null,
});

/** Current setup + what blocks switching things off + any pending request. */
export async function getModuleSettings(chamaId) {
  const chama = await Chama.findById(chamaId).select('chama_type workspace_config');
  if (!chama) throw new AppError('Chama not found', 404);

  const [blocked, pending, recent] = await Promise.all([
    getBlockedModules(chama),
    ApprovalRequest.findOne({ chama_id: chamaId, resource_type: APPROVAL_RESOURCE_TYPE, status: 'pending' })
      .populate('approvals.approver_id', 'role')
      .sort({ createdAt: -1 }),
    ApprovalRequest.find({ chama_id: chamaId, resource_type: APPROVAL_RESOURCE_TYPE, status: { $ne: 'pending' } })
      .sort({ createdAt: -1 })
      .limit(5),
  ]);

  return {
    preset: chama.workspace_config?.preset ?? null,
    modules: getEnabledModules(chama),
    blocked,
    pending: pending ? summarize(pending) : null,
    recent: recent.map(summarize),
  };
}

/** Chama leadership asks platform administration for a module change. */
export async function requestModuleChange({ chamaId, userId, membershipId, modules, note = '' }) {
  const chama = await Chama.findById(chamaId).select('chama_type workspace_config');
  if (!chama) throw new AppError('Chama not found', 404);

  const existing = await ApprovalRequest.findOne({
    chama_id: chamaId,
    resource_type: APPROVAL_RESOURCE_TYPE,
    status: 'pending',
  });
  if (existing) {
    throw new AppError('A workspace change is already waiting for approval. Cancel it or wait for a decision.', 409);
  }

  const { target, enable, disable } = diffSelection(chama, modules);
  if (enable.length === 0 && disable.length === 0) {
    throw new AppError('That is the same set of modules the chama already has.', 400);
  }

  assertNothingBlocked(await getBlockedModules(chama, disable), disable);

  const parts = [];
  if (enable.length) parts.push(`Switch on: ${enable.map(labelOf).join(', ')}`);
  if (disable.length) parts.push(`Switch off: ${disable.map(labelOf).join(', ')}`);

  const request = await approvalService.createRequest({
    chamaId,
    resourceType: APPROVAL_RESOURCE_TYPE,
    resourceId: chamaId,
    action: 'CHANGE_MODULES',
    title: 'Change the chama workspace features',
    description: parts.join('. ') + (note ? `. Note: ${note}` : ''),
    initiatedByMembershipId: membershipId,
    // No Chama member sign-off: the request remains pending for a platform
    // administrator, who applies it through adminDecideModuleChange.
    requiredApprovals: 1,
    eligibleRoles: [],
    allowInitiatorApproval: false,
    metadata: { enable, disable, target_modules: target, note },
  });

  await createAuditLog({
    actorUserId: userId,
    scopeType: 'CHAMA',
    chamaId,
    action: AUDIT_ACTIONS.WORKSPACE_MODULES_REQUESTED,
    resourceType: AUDIT_RESOURCE_TYPE,
    resourceId: chamaId,
    before: { modules: getEnabledModules(chama) },
    after: { modules: target },
    metadata: { approval_request_id: String(request._id), enable, disable, note },
  });

  return summarize(request);
}

/** Chairperson (or the requester) withdraws a pending request. */
export async function cancelModuleChange({ chamaId, requestId, userId, membershipId, reason = '' }) {
  const request = await ApprovalRequest.findOne({
    _id: requestId,
    chama_id: chamaId,
    resource_type: APPROVAL_RESOURCE_TYPE,
  });
  if (!request) throw new AppError('Workspace change request not found', 404);
  if (request.status !== 'pending') throw new AppError(`This request is already ${request.status}`, 409);

  await approvalService.cancelRequest(request._id, membershipId, reason || 'Withdrawn by the requester');

  await createAuditLog({
    actorUserId: userId,
    scopeType: 'CHAMA',
    chamaId,
    action: AUDIT_ACTIONS.WORKSPACE_MODULES_CANCELLED,
    resourceType: AUDIT_RESOURCE_TYPE,
    resourceId: chamaId,
    metadata: { approval_request_id: String(request._id), reason },
  });

  return summarize(await ApprovalRequest.findById(request._id));
}

const userIdOfMembership = async (membershipId) =>
  (await ChamaMembership.findById(membershipId).select('user_id').lean())?.user_id || null;

/**
 * Called by approvalService.submitSignoff once a WORKSPACE_MODULES request
 * reaches a final decision. Mutates and saves `request` when the change turns
 * out not to be applicable any more.
 */
export async function handleModuleChangeDecision(request, { approverMembershipId, adminUserId = null } = {}) {
  if (request.resource_type !== APPROVAL_RESOURCE_TYPE) return request;

  if (request.status === 'rejected') {
    await createAuditLog({
      actorUserId: adminUserId || (await userIdOfMembership(approverMembershipId)),
      scopeType: 'CHAMA',
      chamaId: request.chama_id,
      action: AUDIT_ACTIONS.WORKSPACE_MODULES_REJECTED,
      resourceType: AUDIT_RESOURCE_TYPE,
      resourceId: request.chama_id,
      metadata: {
        approval_request_id: String(request._id),
        decided_by: adminUserId ? 'platform_admin' : 'officials',
        note: request.metadata?.decided_by_admin?.note || '',
      },
    });
    return request;
  }

  if (request.status !== 'approved') return request;
  if (request.metadata?.applied_at) return request; // already applied

  const cancelWith = async (reason, extra = {}) => {
    request.status = 'cancelled';
    request.resolved_at = new Date();
    request.metadata = { ...(request.metadata || {}), cancel_reason: reason };
    request.markModified('metadata');
    await request.save();
    await createAuditLog({
      actorUserId: await userIdOfMembership(request.initiated_by),
      scopeType: 'CHAMA',
      chamaId: request.chama_id,
      action: AUDIT_ACTIONS.WORKSPACE_MODULES_CANCELLED,
      resourceType: AUDIT_RESOURCE_TYPE,
      resourceId: request.chama_id,
      metadata: { approval_request_id: String(request._id), reason, ...extra },
    });
    return request;
  };

  try {
    const chama = await Chama.findById(request.chama_id).select('chama_type workspace_config');
    if (!chama) return cancelWith('The chama no longer exists.');

    const { target, current, enable, disable } = diffSelection(chama, request.metadata?.target_modules || []);

    // Re-check: data may have appeared while the request waited for sign-off.
    const blocked = await getBlockedModules(chama, disable);
    const hits = disable.filter((key) => blocked[key]);
    if (hits.length) {
      return cancelWith(
        `Not applied: ${hits.map((k) => blocked[k].reason).join(' ')}`,
        { blocked: Object.fromEntries(hits.map((k) => [k, blocked[k].count])) }
      );
    }

    const configuredBy = await userIdOfMembership(request.initiated_by);
    const config = buildWorkspaceConfig({ preset: presetFor(target), enabled: target, configuredBy });

    const update = { workspace_config: config };
    // Keep the workspace shell in step with burial cover, as chama creation does.
    if (enable.includes('burial_welfare')) update.chama_type = 'burial';
    if (disable.includes('burial_welfare')) update.chama_type = 'standard';

    await Chama.updateOne({ _id: chama._id }, { $set: update });
    await ApprovalRequest.updateOne({ _id: request._id }, { $set: { 'metadata.applied_at': new Date() } });
    await broadcastWorkspaceModulesChanged(request.chama_id, target, update.chama_type || chama.chama_type);

    await createAuditLog({
      actorUserId: adminUserId || configuredBy,
      scopeType: 'CHAMA',
      chamaId: request.chama_id,
      action: AUDIT_ACTIONS.WORKSPACE_MODULES_CHANGED,
      resourceType: AUDIT_RESOURCE_TYPE,
      resourceId: request.chama_id,
      before: { modules: current, chama_type: chama.chama_type },
      after: { modules: target, chama_type: update.chama_type || chama.chama_type },
      metadata: {
        approval_request_id: String(request._id),
        decided_by: adminUserId ? 'platform_admin' : 'officials',
        requested_by_user_id: configuredBy ? String(configuredBy) : null,
        enable,
        disable,
        approvers: (request.approvals || []).filter((a) => a.status === 'approved').map((a) => String(a.approver_id)),
      },
    });
    return request;
  } catch (error) {
    // Never leave an "approved" request that did nothing.
    await cancelWith(`Could not apply the change: ${error.message}`);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// PLATFORM ADMIN: review queue for feature changes
// ---------------------------------------------------------------------------
// A chairperson or treasurer asks for a change; besides the chama's own
// officials, a platform admin can decide it from the admin console
// (Workspace Requests -> "Feature changes"). Either path applies the change
// through handleModuleChangeDecision, so the open-data re-check and the audit
// trail are identical.

/** All module-change requests across chamas, newest first. */
export async function listModuleChangeRequestsForAdmin({ status = 'pending' } = {}) {
  const query = { resource_type: APPROVAL_RESOURCE_TYPE };
  if (status && status !== 'all') query.status = status;

  const requests = await ApprovalRequest.find(query)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate({ path: 'initiated_by', select: 'role user_id', populate: { path: 'user_id', select: 'name phone email' } });

  const chamas = await Chama.find({ _id: { $in: requests.map((r) => r.chama_id) } }).select('name chama_type workspace_config');
  const chamaById = new Map(chamas.map((c) => [String(c._id), c]));

  return Promise.all(
    requests.map(async (request) => {
      const chama = chamaById.get(String(request.chama_id));
      const item = summarize(request);
      const requester = request.initiated_by;
      // Live blockers (not the ones at request time) so the admin sees why an
      // approval would be refused right now.
      const blocked_now =
        chama && request.status === 'pending' && item.disable.length
          ? await getBlockedModules(chama, item.disable)
          : {};
      return {
        ...item,
        chama: chama ? { id: chama._id, name: chama.name, chama_type: chama.chama_type } : { id: request.chama_id, name: 'Deleted chama', chama_type: null },
        current_modules: chama ? getEnabledModules(chama) : [],
        requested_by: requester
          ? { name: requester.user_id?.name || 'Unknown', phone: requester.user_id?.phone || null, role: requester.role }
          : null,
        blocked_now,
      };
    })
  );
}

export async function countPendingModuleChanges() {
  return ApprovalRequest.countDocuments({ resource_type: APPROVAL_RESOURCE_TYPE, status: 'pending' });
}

/** Active Chamas and their current module setup for the admin feature console. */
export async function listChamasForModuleAdmin() {
  const chamas = await Chama.find({ status: 'active' })
    .select('_id name chama_type workspace_config')
    .sort({ name: 1 })
    .lean();

  const pendingRequests = await ApprovalRequest.find({
    chama_id: { $in: chamas.map((item) => item._id) },
    resource_type: APPROVAL_RESOURCE_TYPE,
    status: 'pending',
  }).select('chama_id').lean();
  const pendingIds = new Set(pendingRequests.map((request) => String(request.chama_id)));

  return Promise.all(chamas.map(async (chama) => ({
    id: chama._id,
    name: chama.name,
    chama_type: chama.chama_type,
    preset: chama.workspace_config?.preset || presetFor(getEnabledModules(chama)),
    modules: getEnabledModules(chama),
    blocked: await getBlockedModules(chama),
    pending_request: pendingIds.has(String(chama._id)),
  })));
}

/** Admin override: apply a module configuration directly, with blocker checks and an audit record. */
export async function adminConfigureWorkspaceModules({ chamaId, adminUser, modules, preset = 'custom', note = '' }) {
  const chama = await Chama.findById(chamaId).select('name chama_type workspace_config');
  if (!chama) throw new AppError('Chama not found', 404);

  const { target, current, disable } = diffSelection(chama, modules);
  const normalizedPreset = PRESET_KEYS.includes(preset) ? preset : presetFor(target);
  const config = buildWorkspaceConfig({
    preset: normalizedPreset,
    enabled: target,
    configuredBy: adminUser?._id || null,
  });
  const nextType = target.includes('burial_welfare') ? 'burial' : 'standard';
  const sameModules = target.length === current.length && target.every((key) => current.includes(key));
  const samePreset = chama.workspace_config?.preset === normalizedPreset;
  if (sameModules && samePreset && chama.chama_type === nextType) {
    throw new AppError('This Chama already has that feature configuration.', 400);
  }

  const blocked = await getBlockedModules(chama, disable);
  assertNothingBlocked(blocked, disable);

  const pending = await ApprovalRequest.findOne({
    chama_id: chamaId,
    resource_type: APPROVAL_RESOURCE_TYPE,
    status: 'pending',
  });
  if (pending) {
    const reason = 'Superseded by a platform administrator configuration.';
    pending.status = 'cancelled';
    pending.resolved_at = new Date();
    pending.metadata = {
      ...(pending.metadata || {}),
      cancel_reason: reason,
      decided_by_admin: { user_id: adminUser?._id, note: String(note || '').trim().slice(0, 300), at: new Date() },
    };
    pending.markModified('metadata');
    await pending.save();
    await createAuditLog({
      actorUserId: adminUser?._id,
      scopeType: 'CHAMA',
      chamaId,
      action: AUDIT_ACTIONS.WORKSPACE_MODULES_CANCELLED,
      resourceType: AUDIT_RESOURCE_TYPE,
      resourceId: chamaId,
      metadata: { approval_request_id: String(pending._id), reason, decided_by: 'platform_admin' },
    });
  }

  await Chama.updateOne({ _id: chamaId }, { $set: { workspace_config: config, chama_type: nextType } });
  await broadcastWorkspaceModulesChanged(chamaId, target, nextType);
  await createAuditLog({
    actorUserId: adminUser?._id,
    scopeType: 'CHAMA',
    chamaId,
    action: AUDIT_ACTIONS.WORKSPACE_MODULES_CHANGED,
    resourceType: AUDIT_RESOURCE_TYPE,
    resourceId: chamaId,
    before: { modules: current, chama_type: chama.chama_type },
    after: { modules: target, chama_type: nextType },
    metadata: { decided_by: 'platform_admin', admin_override: true, note: String(note || '').trim().slice(0, 500) },
  });

  return {
    id: chama._id,
    name: chama.name,
    chama_type: nextType,
    preset: normalizedPreset,
    modules: target,
  };
}

/**
 * A platform admin approves or rejects a pending request. `decision` is
 * 'approved' | 'rejected'. Approving is refused (409) while the module still
 * has open data - nothing is changed, so the admin can reject instead.
 */
export async function adminDecideModuleChange({ requestId, adminUser, decision, note = '' }) {
  if (!['approved', 'rejected'].includes(decision)) throw new AppError('Decision must be approved or rejected', 400);

  const request = await ApprovalRequest.findOne({ _id: requestId, resource_type: APPROVAL_RESOURCE_TYPE });
  if (!request) throw new AppError('Workspace change request not found', 404);
  if (request.status !== 'pending') throw new AppError(`This request is already ${request.status}`, 409);

  if (decision === 'approved') {
    const chama = await Chama.findById(request.chama_id).select('chama_type workspace_config');
    if (!chama) throw new AppError('The chama no longer exists.', 404);
    const { disable } = diffSelection(chama, request.metadata?.target_modules || []);
    assertNothingBlocked(await getBlockedModules(chama, disable), disable);
  }

  request.status = decision;
  request.resolved_at = new Date();
  request.metadata = {
    ...(request.metadata || {}),
    decided_by_admin: { user_id: adminUser._id, note: String(note || '').trim().slice(0, 300), at: new Date() },
  };
  request.markModified('metadata');
  await request.save();

  await handleModuleChangeDecision(request, { adminUserId: adminUser._id });
  return summarize(await ApprovalRequest.findById(request._id));
}

export default {
  getBlockedModules,
  getModuleSettings,
  requestModuleChange,
  cancelModuleChange,
  handleModuleChangeDecision,
  listModuleChangeRequestsForAdmin,
  countPendingModuleChanges,
  adminDecideModuleChange,
  listChamasForModuleAdmin,
  adminConfigureWorkspaceModules,
};
