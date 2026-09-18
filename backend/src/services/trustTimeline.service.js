import mongoose from 'mongoose';

import AuditLog from '../models/AuditLog.js';
import AppError from '../utils/AppError.js';

import {
  TRUST_TIMELINE_ACTIONS,
  TRUST_TIMELINE_CATEGORIES,
  TRUST_TIMELINE_LABELS,
} from '../constants/trustTimeline.constants.js';

// ========================================
// TRUST TIMELINE SERVICE
// ========================================
//
// Reads from the SAME immutable AuditLog collection the treasurer/auditor
// view uses — this is not a parallel log, so there's exactly one source
// of truth for "what happened". It differs from getChamaAuditLogs()
// (audit.service.js) in three ways:
//
// 1. Scope    — only TRUST_TIMELINE_ACTIONS (see trustTimeline.constants),
//               not every internal/operational action.
// 2. Access   — any active member of the chama, not just
//               treasurer/chairperson/auditor (requireChamaMember, not
//               requireAuditAccess — enforced in the route).
// 3. Shape    — a short human-readable sentence per event instead of a
//               raw before/after diff, so a member never sees another
//               member's private financial fields, only what happened.
//
// ========================================

const validateObjectId = (value, fieldName) => {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
};

const getPagination = ({ page = 1, limit = 20 }) => {
  const currentPage = Math.max(Number(page) || 1, 1);
  const pageLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const skip = (currentPage - 1) * pageLimit;
  return { currentPage, pageLimit, skip };
};

// Best-effort amount extraction — different actions store the relevant
// amount under different keys in `after`/`metadata`. Returns null (not
// zero) when nothing usable is found so the frontend can hide the amount
// line cleanly instead of showing "KES 0".
const extractAmount = (log) => {
  const candidates = [
    log?.after?.amount,
    log?.after?.disbursedAmount,
    log?.after?.approvedAmount,
    log?.metadata?.amount,
  ];

  const found = candidates.find((v) => typeof v === 'number' && !Number.isNaN(v));
  return found ?? null;
};

// Renders the "{actor} did X" label, substituting the actor's first name
// (falling back to "A chama official") and cleaning up when there's no
// human actor (system-generated entries, e.g. an automated default sweep).
const renderLabel = (log) => {
  const template = TRUST_TIMELINE_LABELS[log.action] || log.action;

  const actorName = log.isSystemGenerated
    ? 'The system'
    : log.actorUserId?.name?.split(' ')?.[0] || 'A chama official';

  return template.replace('{actor}', actorName);
};

const formatEntry = (log) => ({
  id: String(log._id),
  timestamp: log.createdAt,
  action: log.action,
  category: TRUST_TIMELINE_CATEGORIES[log.action] || 'other',
  title: renderLabel(log),
  amount: extractAmount(log),
  // Kept deliberately minimal — no raw before/after, no other member's
  // personal fields. If a richer detail view is ever needed, fetch the
  // single event via an auditor-scoped endpoint instead of widening this
  // one.
});

// ========================================
// GET CHAMA TRUST TIMELINE
// ========================================
//
// Any active member of the chama can call this — see requireChamaMember
// in the route. Deliberately does NOT take an actorUserId/resourceType
// filter the way the auditor endpoint does; the whole point is a single,
// un-editable, un-filterable view of what happened.
//
// ========================================

export const getChamaTrustTimeline = async ({ chamaId, page = 1, limit = 20 }) => {
  validateObjectId(chamaId, 'Chama ID');

  const { currentPage, pageLimit, skip } = getPagination({ page, limit });

  const query = {
    scopeType: 'CHAMA',
    chamaId,
    action: { $in: TRUST_TIMELINE_ACTIONS },
  };

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .populate('actorUserId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageLimit)
      .lean(),

    AuditLog.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / pageLimit) || 1;

  return {
    events: logs.map(formatEntry),
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
