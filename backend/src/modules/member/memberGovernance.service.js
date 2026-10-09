import mongoose from 'mongoose';

import ChamaMembership from '../../models/ChamaMembership.js';
import ChamaLoan from '../../models/ChamaLoan.js';
import MemberExitRequest from '../../models/MemberExitRequest.js';
import ApprovalRequest from '../../models/ApprovalRequest.js';
import MeetingRecord from '../../models/MeetingRecord.js';
import ChamaMeetingRecord from '../../models/ChamaMeetingRecord.js';
import Meeting from '../../models/Meeting.js';

import AppError from '../../utils/AppError.js';
import approvalService from '../approval/approval.service.js';
import notificationService from '../../services/notification.service.js';
import { LOAN_STATUS, LOAN_OFFICIAL_ROLES } from '../loans/Loan.constants.js';
import { createAuditLog, AUDIT_SCOPE_TYPES } from '../../services/audit.service.js';
import { AUDIT_ACTIONS } from '../../constants/audit.constants.js';
import { assessMemberExit } from './member.service.js';

// ========================================
// MEMBER GOVERNANCE
// ========================================
//
// Two jobs, both feeding the "People & governance" page and the
// Leadership Desk:
//
//   1. getMembersOverview — real numbers for the member directory
//      (attendance per member, headline counts, governance health and
//      the to-do list), replacing the placeholder figures the page used
//      to hard-code.
//
//   2. The member-exit workflow around the existing
//      initiateMemberExit / completeMemberExit pair:
//
//        member (or chairperson) requests exit
//          -> chairperson / treasurer / secretary are notified
//          -> request sits in the Leadership Desk "Exit Requests" tab
//          -> two eligible officials approve (or one rejects)
//          -> treasurer disburses the refund, membership closes
//
//      This file adds the queue, the approve/reject action, cancel and
//      the notifications. Money movement stays in completeMemberExit.
//
// ========================================

const REVIEW_ROLES = ['chairperson', 'treasurer', 'secretary'];
const OPEN_EXIT_STATUSES = ['pending_approval', 'approved'];
const REQUIRED_ROLES = [
  { role: 'chairperson', label: 'Chairperson', required: true },
  { role: 'treasurer', label: 'Treasurer', required: true },
  { role: 'secretary', label: 'Secretary', required: false },
];

const moneyNumber = (value) => Number(value?.toString?.() ?? value ?? 0);
const idOf = (value) => String(value?._id ?? value ?? '');

const validateObjectId = (value, label) => {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(`Invalid ${label}`, 400);
  }
};

const getActiveMembership = async (chamaId, userId) => {
  const membership = await ChamaMembership.findOne({
    chama_id: chamaId,
    user_id: userId,
    status: 'active',
  });
  if (!membership) throw new AppError('You are not an active member of this Chama.', 403);
  return membership;
};

// ========================================
// NOTIFICATIONS (never allowed to break the action that triggered them)
// ========================================

const safeNotify = async (payload) => {
  try {
    await notificationService.createNotification(payload);
  } catch (error) {
    console.error('[member-exit] notification failed:', error.message);
  }
};

const exitDeskUrl = (chamaId) => `/workspace/${chamaId}/leadership?tab=exits`;

export const notifyExitRequested = async ({ exit, memberName, initiatorMembershipId }) => {
  const reviewers = await ChamaMembership.find({
    chama_id: exit.chama_id,
    status: 'active',
    role: { $in: REVIEW_ROLES },
    _id: { $nin: [exit.membership_id, initiatorMembershipId].filter(Boolean) },
  }).select('_id');

  const amount = moneyNumber(exit.savings_amount);
  const byOther = String(exit.initiated_by) !== String(exit.membership_id) && initiatorMembershipId;

  await Promise.all(
    reviewers.map((reviewer) =>
      safeNotify({
        chamaId: exit.chama_id,
        recipientMembershipId: reviewer._id,
        notificationType: 'WITHDRAWAL_REQUESTED',
        title: 'Member exit request',
        message: byOther
          ? `An exit was started for ${memberName}. Savings refund: KES ${amount.toLocaleString()}. Needs your sign-off.`
          : `${memberName} has asked to leave the Chama. Savings refund: KES ${amount.toLocaleString()}. Needs your sign-off.`,
        metadata: { type: 'member_exit', exit_request_id: exit._id },
        relatedEntityType: 'MemberExitRequest',
        relatedEntityId: exit._id,
        actionUrl: exitDeskUrl(exit.chama_id),
        actionText: 'Review request',
        priority: 'high',
        requiresAction: true,
      })
    )
  );
};

export const notifyExitDecision = async ({ exit, decision, comment = '' }) => {
  const amount = moneyNumber(exit.savings_amount);

  if (decision === 'approved') {
    await safeNotify({
      chamaId: exit.chama_id,
      recipientMembershipId: exit.membership_id,
      notificationType: 'WITHDRAWAL_APPROVED',
      title: 'Your exit request was approved',
      message:
        amount > 0
          ? `Leadership approved your exit. Your savings refund of KES ${amount.toLocaleString()} now waits for the Treasurer to disburse it.`
          : 'Leadership approved your exit. The Treasurer will now close your membership.',
      metadata: { type: 'member_exit', exit_request_id: exit._id },
      relatedEntityType: 'MemberExitRequest',
      relatedEntityId: exit._id,
    });

    const treasurers = await ChamaMembership.find({
      chama_id: exit.chama_id,
      status: 'active',
      role: 'treasurer',
      _id: { $ne: exit.membership_id },
    }).select('_id');

    await Promise.all(
      treasurers.map((treasurer) =>
        safeNotify({
          chamaId: exit.chama_id,
          recipientMembershipId: treasurer._id,
          notificationType: 'WITHDRAWAL_REQUESTED',
          title: 'Exit approved — ready to disburse',
          message:
            amount > 0
              ? `An exit was approved. Disburse KES ${amount.toLocaleString()} to close the membership.`
              : 'An exit was approved. Close the membership from the Exit Requests tab.',
          metadata: { type: 'member_exit', exit_request_id: exit._id },
          relatedEntityType: 'MemberExitRequest',
          relatedEntityId: exit._id,
          actionUrl: exitDeskUrl(exit.chama_id),
          actionText: 'Disburse',
          priority: 'high',
          requiresAction: true,
        })
      )
    );
    return;
  }

  if (decision === 'rejected') {
    await safeNotify({
      chamaId: exit.chama_id,
      recipientMembershipId: exit.membership_id,
      notificationType: 'WITHDRAWAL_REJECTED',
      title: 'Your exit request was not approved',
      message: comment
        ? `Leadership declined your exit request: ${comment}`
        : 'Leadership declined your exit request. Speak to the Chairperson for details.',
      metadata: { type: 'member_exit', exit_request_id: exit._id },
      relatedEntityType: 'MemberExitRequest',
      relatedEntityId: exit._id,
    });
    return;
  }

  if (decision === 'disbursed') {
    await safeNotify({
      chamaId: exit.chama_id,
      recipientMembershipId: exit.membership_id,
      notificationType: 'WITHDRAWAL_APPROVED',
      title: 'Exit complete',
      message:
        amount > 0
          ? `Your savings refund of KES ${amount.toLocaleString()} was disbursed and your membership is closed.`
          : 'Your membership is now closed.',
      metadata: { type: 'member_exit', exit_request_id: exit._id },
      relatedEntityType: 'MemberExitRequest',
      relatedEntityId: exit._id,
    });
  }
};

// ========================================
// ATTENDANCE
// ========================================
//
// Real attendance per member, from the meeting records the Chama has
// actually closed. A member is only measured against meetings held after
// they joined, so a newcomer is never "0/8".
//

const buildAttendance = async (chamaId, memberships) => {
  const [records, legacyRecords] = await Promise.all([
    MeetingRecord.find({ chama_id: chamaId, status: 'completed' })
      .select('scheduled_date createdAt attendance.attendees.membership_id')
      .lean(),
    ChamaMeetingRecord.find({ chama_id: chamaId, status: 'closed' })
      .select('createdAt attendance.membership_id')
      .lean(),
  ]);

  const meetings = [
    ...records.map((record) => ({
      at: new Date(record.scheduled_date || record.createdAt),
      present: new Set((record.attendance?.attendees || []).map((a) => idOf(a.membership_id))),
    })),
    ...legacyRecords.map((record) => ({
      at: new Date(record.createdAt),
      present: new Set((record.attendance || []).map((a) => idOf(a.membership_id))),
    })),
  ];

  const byMember = {};
  let attendedTotal = 0;
  let possibleTotal = 0;

  for (const membership of memberships) {
    const joined = new Date(membership.joined_at || membership.createdAt || 0);
    const eligible = meetings.filter((meeting) => meeting.at >= joined);
    const attended = eligible.filter((meeting) => meeting.present.has(idOf(membership._id))).length;
    byMember[idOf(membership._id)] = { attended, total: eligible.length };
    attendedTotal += attended;
    possibleTotal += eligible.length;
  }

  return {
    by_member: byMember,
    overall_rate: possibleTotal > 0 ? Math.round((attendedTotal / possibleTotal) * 100) : null,
    meetings_held: meetings.length,
  };
};

// ========================================
// EXIT REQUEST SHAPING
// ========================================

const shapeExit = ({ exit, actor, assessment }) => {
  const member = exit.membership_id || {};
  const memberUser = member.user_id || {};
  const approval = exit.approval_request_id || null;
  const initiatorUserId = idOf(exit.initiated_by?._id ?? exit.initiated_by);
  const memberUserId = idOf(memberUser._id ?? memberUser);
  const actorIsSubject = idOf(member._id) === idOf(actor._id);
  const open = OPEN_EXIT_STATUSES.includes(exit.status);

  const approvals = (approval?.approvals || []).map((entry) => ({
    role: entry.role,
    status: entry.status,
    comment: entry.comment || '',
    name: entry.approver_id?.user_id?.name || null,
    at: entry.timestamp || null,
  }));

  const mine = (approval?.approvals || []).find((entry) => idOf(entry.approver_id) === idOf(actor._id));
  const actorIsInitiator = approval && idOf(approval.initiated_by) === idOf(actor._id);
  const conflicted = (approval?.conflict_management?.detected_conflicts || []).some(
    (c) => idOf(c.membership_id) === idOf(actor._id) && c.resolution !== 'waived'
  );
  const roleEligible = (approval?.eligible_roles || []).includes(actor.role);

  const canSign =
    exit.status === 'pending_approval' &&
    approval?.status === 'pending' &&
    roleEligible &&
    !actorIsSubject &&
    !actorIsInitiator &&
    !conflicted &&
    !mine;

  const requestedBySelf = initiatorUserId === memberUserId;
  const isRequester = initiatorUserId === idOf(actor.user_id) || idOf(member._id) === idOf(actor._id);

  return {
    id: String(exit._id),
    status: exit.status,
    reason: exit.reason || '',
    savings_amount: moneyNumber(exit.savings_amount),
    currency: exit.currency || 'KES',
    created_at: exit.createdAt,
    approved_at: exit.approved_at,
    disbursed_at: exit.disbursed_at,
    disbursement_method: exit.disbursement_method,
    external_reference: exit.external_reference,
    requested_by_self: requestedBySelf,
    requested_by_name: exit.initiated_by?.name || null,
    member: {
      membership_id: idOf(member._id),
      name: memberUser.name || 'Member',
      phone: memberUser.phone || null,
      avatar_url: memberUser.avatar_url || null,
      role: member.role || 'member',
      joined_at: member.joined_at || null,
    },
    approval: approval
      ? {
          id: String(approval._id),
          status: approval.status,
          required: approval.required_approvals,
          approved_count: approvals.filter((a) => a.status === 'approved').length,
          approvals,
          my_decision: mine?.status || null,
        }
      : null,
    // Live figures while the request is open, so the people signing off
    // see today's balance rather than the one captured at request time.
    clearance: assessment
      ? {
          savings: assessment.savings,
          arrears: assessment.arrears,
          loan_outstanding: assessment.loanOutstanding,
          blocking_reasons: assessment.blockingReasons,
        }
      : null,
    can_sign: Boolean(canSign),
    can_disburse: actor.role === 'treasurer' && exit.status === 'approved' && !actorIsSubject,
    can_cancel:
      open && (isRequester || actor.role === 'chairperson'),
  };
};

const EXIT_POPULATE = [
  {
    path: 'membership_id',
    select: 'user_id role status joined_at',
    populate: { path: 'user_id', select: 'name phone avatar_url' },
  },
  { path: 'initiated_by', select: 'name' },
  {
    path: 'approval_request_id',
    select: 'status required_approvals approvals eligible_roles initiated_by conflict_management resolved_at',
    populate: {
      path: 'approvals.approver_id',
      select: 'user_id role',
      populate: { path: 'user_id', select: 'name' },
    },
  },
];

const loadExits = async (filter, limit = 200) =>
  MemberExitRequest.find(filter).sort({ createdAt: -1 }).limit(limit).populate(EXIT_POPULATE).lean();

const withAssessments = async ({ exits, chamaId, actor }) =>
  Promise.all(
    exits.map(async (exit) => {
      let assessment = null;
      if (OPEN_EXIT_STATUSES.includes(exit.status)) {
        try {
          assessment = await assessMemberExit({ chamaId, memberId: idOf(exit.membership_id) });
        } catch {
          assessment = null;
        }
      }
      return shapeExit({ exit, actor, assessment });
    })
  );

// ========================================
// EXIT QUEUE (leadership)
// ========================================

export const listExitQueue = async ({ chamaId, actorUserId, scope = 'open' }) => {
  validateObjectId(chamaId, 'Chama ID');
  validateObjectId(actorUserId, 'user ID');

  const actor = await getActiveMembership(chamaId, actorUserId);
  if (!['chairperson', 'treasurer', 'secretary'].includes(actor.role)) {
    throw new AppError('Only the Chairperson, Treasurer or Secretary can see the exit queue.', 403);
  }

  const filter = { chama_id: chamaId };
  if (scope === 'open') filter.status = { $in: OPEN_EXIT_STATUSES };
  else if (scope === 'closed') filter.status = { $in: ['disbursed', 'rejected', 'cancelled'] };

  const exits = await loadExits(filter);
  const items = await withAssessments({ exits, chamaId, actor });

  const [openCount, awaitingMe] = await Promise.all([
    MemberExitRequest.countDocuments({ chama_id: chamaId, status: { $in: OPEN_EXIT_STATUSES } }),
    Promise.resolve(items.filter((item) => item.can_sign || item.can_disburse).length),
  ]);

  return { items, summary: { open: openCount, awaiting_my_action: awaitingMe } };
};

// ========================================
// MY EXIT REQUESTS (any member)
// ========================================

export const listMyExits = async ({ chamaId, actorUserId }) => {
  validateObjectId(chamaId, 'Chama ID');
  validateObjectId(actorUserId, 'user ID');

  const actor = await getActiveMembership(chamaId, actorUserId);
  const exits = await loadExits({ chama_id: chamaId, membership_id: actor._id }, 20);
  return withAssessments({ exits, chamaId, actor });
};

// ========================================
// APPROVE / REJECT
// ========================================

export const decideMemberExit = async ({ chamaId, exitRequestId, actorUserId, decision, comment = '' }) => {
  validateObjectId(chamaId, 'Chama ID');
  validateObjectId(exitRequestId, 'exit request ID');
  validateObjectId(actorUserId, 'user ID');

  if (!['approve', 'reject'].includes(decision)) {
    throw new AppError('Decision must be "approve" or "reject".', 400);
  }
  const note = String(comment || '').trim().slice(0, 500);
  if (decision === 'reject' && !note) {
    throw new AppError('Please give a short reason for declining this exit request.', 400);
  }

  const actor = await getActiveMembership(chamaId, actorUserId);
  const exit = await MemberExitRequest.findOne({ _id: exitRequestId, chama_id: chamaId });
  if (!exit) throw new AppError('Member exit request not found', 404);
  if (exit.status !== 'pending_approval') {
    throw new AppError(`This exit request is already ${exit.status.replace('_', ' ')}.`, 409);
  }
  if (idOf(exit.membership_id) === idOf(actor._id)) {
    throw new AppError('You cannot approve or decline your own exit request.', 403);
  }
  if (!exit.approval_request_id) throw new AppError('This exit request has no approval workflow attached.', 409);

  try {
    // Notifications for the outcome are fired from approvalService once
    // the request reaches its final state, so every sign-off route
    // (this one or the generic approvals endpoint) behaves the same.
    await approvalService.submitSignoff({
      requestId: exit.approval_request_id,
      approverMembershipId: actor._id,
      status: decision === 'approve' ? 'approved' : 'rejected',
      comment: note,
    });
  } catch (error) {
    throw new AppError(error.message || 'Could not record your decision.', 400);
  }

  await createAuditLog({
    actorUserId,
    scopeType: AUDIT_SCOPE_TYPES.CHAMA,
    chamaId,
    action: AUDIT_ACTIONS.MEMBER_EXIT_DECIDED,
    resourceType: 'MemberExitRequest',
    resourceId: exit._id,
    before: { status: exit.status },
    after: { decision, role: actor.role, comment: note },
  }).catch(() => {});

  const [fresh] = await loadExits({ _id: exitRequestId });
  if (fresh && ['approved', 'rejected'].includes(fresh.status) && fresh.status !== exit.status) {
    await notifyExitDecision({ exit: fresh, decision: fresh.status, comment: note });
  }
  return shapeExit({ exit: fresh, actor, assessment: null });
};

// ========================================
// CANCEL
// ========================================

export const cancelMemberExit = async ({ chamaId, exitRequestId, actorUserId }) => {
  validateObjectId(chamaId, 'Chama ID');
  validateObjectId(exitRequestId, 'exit request ID');
  validateObjectId(actorUserId, 'user ID');

  const actor = await getActiveMembership(chamaId, actorUserId);
  const exit = await MemberExitRequest.findOne({ _id: exitRequestId, chama_id: chamaId });
  if (!exit) throw new AppError('Member exit request not found', 404);

  const isRequester =
    idOf(exit.initiated_by) === idOf(actorUserId) || idOf(exit.membership_id) === idOf(actor._id);
  if (!isRequester && actor.role !== 'chairperson') {
    throw new AppError('Only the member who asked to leave, or the Chairperson, can cancel this request.', 403);
  }
  if (!OPEN_EXIT_STATUSES.includes(exit.status)) {
    throw new AppError(`This exit request is already ${exit.status.replace('_', ' ')}.`, 409);
  }
  if (exit.settlement_transaction_id) {
    throw new AppError('The refund was already disbursed, so this request can no longer be cancelled.', 409);
  }

  const previous = exit.status;
  exit.status = 'cancelled';
  await exit.save();

  if (exit.approval_request_id) {
    await ApprovalRequest.updateOne(
      { _id: exit.approval_request_id, status: { $in: ['pending', 'approved'] } },
      { $set: { status: 'cancelled', resolved_at: new Date() } }
    );
  }

  await createAuditLog({
    actorUserId,
    scopeType: AUDIT_SCOPE_TYPES.CHAMA,
    chamaId,
    action: AUDIT_ACTIONS.MEMBER_EXIT_CANCELLED,
    resourceType: 'MemberExitRequest',
    resourceId: exit._id,
    before: { status: previous },
    after: { status: 'cancelled' },
  }).catch(() => {});

  const [fresh] = await loadExits({ _id: exitRequestId });
  return shapeExit({ exit: fresh, actor, assessment: null });
};

// ========================================
// EXIT ASSESSMENT — scoped to the member themself or leadership
// ========================================

export const assessMemberExitForActor = async ({ chamaId, memberId, actorUserId }) => {
  validateObjectId(chamaId, 'Chama ID');
  validateObjectId(memberId, 'member ID');
  validateObjectId(actorUserId, 'user ID');

  const actor = await getActiveMembership(chamaId, actorUserId);
  const isSelf = idOf(actor._id) === String(memberId);
  if (!isSelf && !['chairperson', 'treasurer', 'secretary'].includes(actor.role)) {
    throw new AppError('You can only view your own exit clearance.', 403);
  }

  const assessment = await assessMemberExit({ chamaId, memberId });
  return {
    arrears: assessment.arrears,
    loanOutstanding: assessment.loanOutstanding,
    savings: assessment.savings,
    blockingReasons: assessment.blockingReasons,
    canExit: assessment.blockingReasons.length === 0,
  };
};

// ========================================
// MEMBERS OVERVIEW
// ========================================

export const getMembersOverview = async ({ chamaId, actorUserId }) => {
  validateObjectId(chamaId, 'Chama ID');
  validateObjectId(actorUserId, 'user ID');

  const actor = await getActiveMembership(chamaId, actorUserId);
  const isLeader = REVIEW_ROLES.includes(actor.role);
  const canSeeJoinRequests = ['chairperson', 'treasurer'].includes(actor.role);

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const memberships = await ChamaMembership.find({
    chama_id: chamaId,
    status: { $in: ['active', 'suspended'] },
  })
    .select('role status joined_at createdAt accepted_at')
    .lean();

  const [attendance, pendingJoin, openExitCount] = await Promise.all([
    buildAttendance(chamaId, memberships),
    canSeeJoinRequests ? ChamaMembership.countDocuments({ chama_id: chamaId, status: 'pending' }) : 0,
    MemberExitRequest.countDocuments({ chama_id: chamaId, status: { $in: OPEN_EXIT_STATUSES } }),
  ]);

  const active = memberships.filter((m) => m.status === 'active');
  const suspended = memberships.filter((m) => m.status === 'suspended');
  const approvedThisMonth = active.filter((m) => m.accepted_at && new Date(m.accepted_at) >= monthStart).length;

  // ----- governance health: which required offices are actually filled
  const filledRoles = new Set(active.map((m) => m.role));
  const checks = REQUIRED_ROLES.map((entry) => ({ ...entry, ok: filledRoles.has(entry.role) }));
  const missingRequired = checks.filter((c) => !c.ok && c.required);
  const missingOptional = checks.filter((c) => !c.ok && !c.required);
  const passed = checks.filter((c) => c.ok).length;
  const compliancePct = Math.round((passed / checks.length) * 100);

  let health;
  if (missingRequired.length) {
    health = {
      tone: 'warn',
      label: 'Needs attention',
      detail: `No active ${missingRequired.map((c) => c.label).join(' or ')} assigned`,
    };
  } else if (missingOptional.length) {
    health = {
      tone: 'warn',
      label: `${compliancePct}% role coverage`,
      detail: `${missingOptional.map((c) => c.label).join(', ')} not assigned yet`,
    };
  } else if (suspended.length) {
    health = {
      tone: 'warn',
      label: 'Review needed',
      detail: `${suspended.length} suspended ${suspended.length === 1 ? 'member' : 'members'}`,
    };
  } else {
    health = { tone: 'good', label: 'Roles assigned', detail: 'All required offices are filled' };
  }

  // ----- to-do list (role aware)
  const todos = [];
  const deskBase = `/workspace/${chamaId}/leadership`;

  if (isLeader) {
    const [pendingApprovals, pendingLoans, nextMeeting] = await Promise.all([
      ApprovalRequest.find({ chama_id: chamaId, status: 'pending', eligible_roles: actor.role })
        .select('resource_type action initiated_by approvals.approver_id')
        .lean(),
      LOAN_OFFICIAL_ROLES.includes(actor.role)
        ? ChamaLoan.countDocuments({ chama_id: chamaId, status: LOAN_STATUS.PENDING_APPROVAL })
        : 0,
      Meeting.findOne({
        workspace_id: chamaId,
        workspace_type: 'Chama',
        cancelled_at: null,
        starts_at: { $gte: new Date(), $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      })
        .sort({ starts_at: 1 })
        .select('title starts_at')
        .lean(),
    ]);

    const mineToSign = pendingApprovals.filter(
      (request) =>
        idOf(request.initiated_by) !== idOf(actor._id) &&
        !(request.approvals || []).some((entry) => idOf(entry.approver_id) === idOf(actor._id))
    );
    const exitSigns = mineToSign.filter((r) => r.action === 'MEMBER_EXIT_SAVINGS_DISBURSEMENT');
    const otherSigns = mineToSign.filter(
      (r) => r.action !== 'MEMBER_EXIT_SAVINGS_DISBURSEMENT' && r.resource_type !== 'LOAN_DISBURSEMENT'
    );

    if (missingRequired.length) {
      todos.push({
        id: 'missing-roles',
        tone: 'urgent',
        title: `Assign a ${missingRequired.map((c) => c.label).join(' and ')}`,
        detail: 'Management actions stay locked until required roles are filled',
        href: `${deskBase}?tab=members`,
      });
    }

    if (exitSigns.length && ['chairperson', 'treasurer'].includes(actor.role)) {
      todos.push({
        id: 'exit-signoff',
        tone: 'urgent',
        title: `Review ${exitSigns.length} exit ${exitSigns.length === 1 ? 'request' : 'requests'}`,
        detail: 'Members asking to leave · awaiting your sign-off',
        href: `${deskBase}?tab=exits`,
      });
    }

    if (actor.role === 'treasurer') {
      const approvedExits = await MemberExitRequest.countDocuments({ chama_id: chamaId, status: 'approved' });
      if (approvedExits) {
        todos.push({
          id: 'exit-disburse',
          tone: 'urgent',
          title: `Disburse ${approvedExits} approved ${approvedExits === 1 ? 'exit' : 'exits'}`,
          detail: 'Approved by leadership · refund and close membership',
          href: `${deskBase}?tab=exits`,
        });
      }
    }

    if (pendingJoin) {
      todos.push({
        id: 'join-requests',
        tone: 'warn',
        title: `Decide on ${pendingJoin} join ${pendingJoin === 1 ? 'request' : 'requests'}`,
        detail: 'People waiting to be admitted',
        href: `${deskBase}?tab=members`,
      });
    }

    if (pendingLoans) {
      todos.push({
        id: 'loan-applications',
        tone: 'warn',
        title: `Review ${pendingLoans} loan ${pendingLoans === 1 ? 'application' : 'applications'}`,
        detail: 'Awaiting committee sign-off',
        href: `/workspace/${chamaId}/loans`,
      });
    }

    if (otherSigns.length) {
      todos.push({
        id: 'other-approvals',
        tone: 'warn',
        title: `${otherSigns.length} ${otherSigns.length === 1 ? 'approval needs' : 'approvals need'} your sign-off`,
        detail: 'Payouts, expenses and other requests',
        href: `${deskBase}?tab=treasury`,
      });
    }

    if (suspended.length) {
      todos.push({
        id: 'suspended',
        tone: 'info',
        title: `${suspended.length} suspended ${suspended.length === 1 ? 'member' : 'members'}`,
        detail: 'Decide whether to return them to the Chama',
        href: `${deskBase}?tab=members`,
      });
    }

    if (nextMeeting) {
      todos.push({
        id: 'next-meeting',
        tone: 'info',
        title: nextMeeting.title,
        detail: `Meeting · ${new Date(nextMeeting.starts_at).toLocaleDateString('en-KE', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })}`,
        href: `${deskBase}?tab=meetings`,
      });
    }
  }

  // Everyone sees the state of their own exit request.
  const [myExit] = await loadExits({ chama_id: chamaId, membership_id: actor._id, status: { $in: OPEN_EXIT_STATUSES } }, 1);
  const myExitShaped = myExit ? shapeExit({ exit: myExit, actor, assessment: null }) : null;
  if (myExitShaped) {
    todos.unshift({
      id: 'my-exit',
      tone: 'info',
      title: myExitShaped.status === 'approved' ? 'Your exit was approved' : 'Your exit request is pending',
      detail:
        myExitShaped.status === 'approved'
          ? 'Waiting for the Treasurer to disburse your refund'
          : `${myExitShaped.approval?.approved_count ?? 0} of ${myExitShaped.approval?.required ?? 2} approvals received`,
      href: null,
    });
  }

  return {
    counts: {
      active: active.length,
      suspended: suspended.length,
      pending_join_requests: pendingJoin,
      approved_this_month: approvedThisMonth,
      open_exit_requests: openExitCount,
    },
    governance: { ...health, compliance_pct: compliancePct },
    attendance,
    todos,
    my_exit: myExitShaped,
    viewer: { membership_id: idOf(actor._id), role: actor.role },
  };
};
