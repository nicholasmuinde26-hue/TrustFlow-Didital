import mongoose from 'mongoose';

import Dispute from '../models/Dispute.js';
import ChamaMembership from '../models/ChamaMembership.js';

import AppError from '../utils/AppError.js';

import { createAuditLog, AUDIT_SCOPE_TYPES } from './audit.service.js';
import { AUDIT_ACTIONS } from '../constants/audit.constants.js';
import { DISPUTE_SUBJECT_TYPES } from '../constants/Trustscore.constants.js';

// ========================================
// DISPUTE SERVICE
// ========================================
//
// A place for "something is wrong here" that isn't filtered through the
// official it might be about. Any active member can raise one; only
// chama officials can move it through investigating/resolved/dismissed
// — and an official can never resolve a dispute raised against
// themselves (see assertNoSelfResolution below), the same
// self-action-prevention principle already used for loan approvals and
// generic ApprovalRequests elsewhere in this app.
//
// ========================================

const validateObjectId = (value, fieldName) => {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
};

// ========================================
// RAISE A DISPUTE
// ========================================

export const raiseDispute = async ({
  chamaId,
  raisedByMembershipId,
  raisedByUserId,
  subjectType,
  subjectId = null,
  againstMembershipId = null,
  title,
  description,
}) => {
  validateObjectId(chamaId, 'Chama ID');

  if (!DISPUTE_SUBJECT_TYPES.includes(subjectType)) {
    throw new AppError('Invalid dispute subject type', 400);
  }

  if (!title || !title.trim()) throw new AppError('A short title is required', 400);
  if (!description || !description.trim()) {
    throw new AppError('A description of what happened is required', 400);
  }

  if (againstMembershipId) {
    validateObjectId(againstMembershipId, 'Against membership ID');

    const target = await ChamaMembership.findOne({
      _id: againstMembershipId,
      chama_id: chamaId,
    }).lean();

    if (!target) throw new AppError('That member could not be found in this chama', 404);
  }

  const dispute = await Dispute.create({
    chama_id: chamaId,
    raised_by_membership_id: raisedByMembershipId,
    raised_by_user_id: raisedByUserId,
    subject_type: subjectType,
    subject_id: subjectId || null,
    against_membership_id: againstMembershipId || null,
    title: title.trim(),
    description: description.trim(),
  });

  await createAuditLog({
    actorUserId: raisedByUserId,
    scopeType: AUDIT_SCOPE_TYPES.CHAMA,
    chamaId,
    action: AUDIT_ACTIONS.DISPUTE_RAISED,
    resourceType: 'Dispute',
    resourceId: dispute._id,
    // No title/description in the audit log — the point of the
    // timeline entry is "a dispute exists", not its content.
    metadata: { subjectType },
  });

  return dispute.toObject();
};

// ========================================
// LIST DISPUTES
// ========================================
//
// Plain members see only disputes they personally raised — a chama-wide
// list of open complaints, visible to everyone including the people
// they're about, would chill honest reporting. Officials with audit
// access (see requireAuditAccess on the route) see everything.
//
// ========================================

export const listDisputes = async ({
  chamaId,
  viewerMembershipId,
  viewerCanSeeAll,
  status = null,
  page = 1,
  limit = 20,
}) => {
  validateObjectId(chamaId, 'Chama ID');

  const currentPage = Math.max(Number(page) || 1, 1);
  const pageLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const skip = (currentPage - 1) * pageLimit;

  const query = { chama_id: chamaId };
  if (!viewerCanSeeAll) query.raised_by_membership_id = viewerMembershipId;
  if (status) query.status = status;

  const [disputes, total] = await Promise.all([
    Dispute.find(query)
      .populate('raised_by_user_id', 'name')
      .populate('against_membership_id')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageLimit)
      .lean(),
    Dispute.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / pageLimit) || 1;

  return {
    disputes: disputes.map((d) => ({
      id: String(d._id),
      subjectType: d.subject_type,
      title: d.title,
      description: d.description,
      status: d.status,
      raisedBy: viewerCanSeeAll ? d.raised_by_user_id?.name || 'A member' : 'You',
      resolutionNotes: d.resolution_notes,
      createdAt: d.createdAt,
      resolvedAt: d.resolved_at,
    })),
    pagination: {
      page: currentPage,
      limit: pageLimit,
      total,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    },
  };
};

// ========================================
// UPDATE STATUS (investigate / resolve / dismiss)
// ========================================

const RESOLVABLE_TRANSITIONS = {
  investigating: ['open'],
  resolved: ['open', 'investigating'],
  dismissed: ['open', 'investigating'],
};

export const updateDisputeStatus = async ({
  chamaId,
  disputeId,
  resolverMembershipId,
  resolverUserId,
  status,
  resolutionNotes = null,
}) => {
  validateObjectId(chamaId, 'Chama ID');
  validateObjectId(disputeId, 'Dispute ID');

  if (!Object.keys(RESOLVABLE_TRANSITIONS).includes(status)) {
    throw new AppError('Invalid status transition', 400);
  }

  const dispute = await Dispute.findOne({ _id: disputeId, chama_id: chamaId });
  if (!dispute) throw new AppError('Dispute not found', 404);

  if (!RESOLVABLE_TRANSITIONS[status].includes(dispute.status)) {
    throw new AppError(`Cannot move a "${dispute.status}" dispute directly to "${status}"`, 400);
  }

  // Self-action prevention: an official cannot resolve/dismiss a
  // dispute raised against themselves. Mirrors the self-action checks
  // already enforced on ApprovalRequest elsewhere in this app.
  if (
    dispute.against_membership_id &&
    String(dispute.against_membership_id) === String(resolverMembershipId)
  ) {
    throw new AppError(
      'You cannot resolve a dispute raised against yourself — another official needs to review this one',
      403
    );
  }

  dispute.status = status;
  if (['resolved', 'dismissed'].includes(status)) {
    dispute.resolved_by_membership_id = resolverMembershipId;
    dispute.resolved_by_user_id = resolverUserId;
    dispute.resolved_at = new Date();
    dispute.resolution_notes = resolutionNotes ? String(resolutionNotes).trim().slice(0, 3000) : null;
  }

  await dispute.save();

  await createAuditLog({
    actorUserId: resolverUserId,
    scopeType: AUDIT_SCOPE_TYPES.CHAMA,
    chamaId,
    action:
      status === 'resolved'
        ? AUDIT_ACTIONS.DISPUTE_RESOLVED
        : status === 'dismissed'
        ? AUDIT_ACTIONS.DISPUTE_DISMISSED
        : AUDIT_ACTIONS.DISPUTE_STATUS_UPDATED,
    resourceType: 'Dispute',
    resourceId: dispute._id,
    metadata: { status },
  });

  return dispute.toObject();
};