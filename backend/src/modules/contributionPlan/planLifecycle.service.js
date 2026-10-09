/**
 * ============================================================================
 * PLAN LIFECYCLE: pause, resume, archive, restore
 * ============================================================================
 *
 * A contribution is never deleted. Its obligations, payments and ledger
 * entries are the chama's financial history, so the only ways to stop one are:
 *
 *   pause    Temporary. No new periods open, nothing turns overdue, no penalties
 *            accrue. Resume carries on. Periods that opened while paused are
 *            skipped, and open deadlines move out by the length of the pause,
 *            so nobody is billed or penalised for time the plan was on hold.
 *
 *   archive  Out of sight and out of the engine, history fully kept (shows under
 *            "Archived"). Needs all open dues settled first, or explicitly
 *            cancelled if nobody has paid toward them. Restorable.
 *
 *   restore  Brings an archived plan back as PAUSED (or draft), so leadership
 *            decides when it starts billing again by resuming it.
 *
 * Plans the platform relies on (built-in savings, late penalties) and
 * merry-go-round rotations (which have their own page) cannot be paused or
 * archived here.
 * ============================================================================
 */

import mongoose from 'mongoose';
import ContributionPlan from '../../models/ContributionPlan.js';
import ContributionObligation from '../../models/ContributionObligation.js';
import AppError from '../../utils/AppError.js';
import { toDecimal } from '../../shared/decimal.js';
import { createAuditLog } from '../../services/audit.service.js';
import { AUDIT_ACTIONS } from '../../constants/audit.constants.js';
import { periodsForPlan, isCalendarAligned } from '../../models/Calendarperiods.js';
import { getActiveYear } from './financialYear.service.js';

const DAY_MS = 86400000;
const D = toDecimal;
const OPEN = ['pending', 'partially_paid', 'overdue'];

const loadPlan = async (chamaId, planId) => {
  if (!mongoose.Types.ObjectId.isValid(planId)) throw new AppError('Invalid contribution.', 400);
  const plan = await ContributionPlan.findOne({ _id: planId, owner_type: 'Chama', owner_id: chamaId });
  if (!plan) throw new AppError('Contribution not found in this chama.', 404);
  return plan;
};

const assertManageable = (plan, verb) => {
  if (plan.system_key) {
    throw new AppError(`This is a built-in contribution and cannot be ${verb}. You can rename it or change its rules instead.`, 409);
  }
  if (plan.behavior === 'rotation' || plan.contribution_type === 'merry_go_round') {
    throw new AppError(`Merry-Go-Round is managed from its own page and cannot be ${verb} here.`, 409);
  }
};

const audit = (action, { actorUserId, chamaId, plan, before, after, metadata }) =>
  createAuditLog({
    actorUserId,
    scopeType: 'CHAMA',
    chamaId,
    action,
    resourceType: 'ContributionPlan',
    resourceId: plan._id,
    before,
    after,
    metadata: { plan: plan.name, ...(metadata || {}) },
  }).catch((err) => console.error(`[planLifecycle] AUDIT NOT WRITTEN (${action}):`, err.message));

const reasonOf = (body) => String(body?.reason || '').trim().slice(0, 300);

// ============================================================================
// PAUSE
// ============================================================================

export const pausePlan = async ({ chamaId, planId, actorUserId, body = {} }) => {
  const plan = await loadPlan(chamaId, planId);
  assertManageable(plan, 'paused');
  if (plan.status === 'paused') throw new AppError('This contribution is already paused.', 409);
  if (plan.status !== 'active') throw new AppError(`Only an active contribution can be paused (this one is ${plan.status}).`, 409);

  const now = new Date();
  plan.status = 'paused';
  plan.paused_at = now;
  plan.paused_by = actorUserId;
  plan.pause_reason = reasonOf(body);
  plan.updated_by = actorUserId;
  await plan.save();

  await audit(AUDIT_ACTIONS.CONTRIBUTION_PLAN_PAUSED, {
    actorUserId, chamaId, plan,
    before: { status: 'active' },
    after: { status: 'paused', reason: plan.pause_reason },
  });
  return { plan };
};

// ============================================================================
// RESUME
// ============================================================================

export const resumePlan = async ({ chamaId, planId, actorUserId, body = {} }) => {
  const plan = await loadPlan(chamaId, planId);
  assertManageable(plan, 'resumed');
  if (plan.status !== 'paused') throw new AppError(`Only a paused contribution can be resumed (this one is ${plan.status}).`, 409);

  const now = new Date();
  const pausedAt = plan.paused_at ? new Date(plan.paused_at) : now;
  const pausedMs = Math.max(0, now.getTime() - pausedAt.getTime());
  const skipPeriods = body.skip_paused_periods !== false; // default: do not bill the paused months
  const outcome = { skipped_periods: [], deadlines_moved: 0 };

  // 1. Periods that opened while paused are not billed.
  if (skipPeriods && isCalendarAligned(plan)) {
    const fy = await getActiveYear(chamaId, now);
    if (fy) {
      const opened = periodsForPlan({ plan, fy, upTo: now }).filter((p) => p.start > pausedAt);
      const keys = opened.map((p) => p.key);
      if (keys.length) {
        plan.paused_period_keys = [...new Set([...(plan.paused_period_keys || []), ...keys])];
        outcome.skipped_periods = keys;
      }
    }
  }

  // 2. Deadlines that were still ahead when the plan was paused move out by
  //    the length of the pause. Anything already overdue at that point stays so.
  if (pausedMs > 0) {
    const graceMs = (Number(plan.schedule?.grace_days) || 0) * DAY_MS;
    const open = await ContributionObligation.find({ plan_id: plan._id, period_key: { $ne: null }, status: { $in: ['pending', 'partially_paid'] } });
    for (const ob of open) {
      if (new Date(ob.due_date).getTime() + graceMs <= pausedAt.getTime()) continue;
      ob.due_date = new Date(new Date(ob.due_date).getTime() + pausedMs);
      ob.reminder_log = []; // re-arm reminders against the new date
      await ob.save();
      outcome.deadlines_moved += 1;
    }
  }

  plan.status = 'active';
  plan.paused_at = null;
  plan.paused_by = null;
  plan.pause_reason = '';
  plan.updated_by = actorUserId;
  await plan.save();

  // Opens the current period (and any not-skipped ones) right away.
  if (isCalendarAligned(plan)) {
    const { generateObligationsForPlan } = await import('./contributioncalendar.service.js');
    const fy = await getActiveYear(chamaId, now);
    if (fy) outcome.created = (await generateObligationsForPlan({ plan, fy, now })).created;
  }

  await audit(AUDIT_ACTIONS.CONTRIBUTION_PLAN_RESUMED, {
    actorUserId, chamaId, plan,
    before: { status: 'paused', paused_at: pausedAt },
    after: { status: 'active' },
    metadata: { outcome, paused_days: Math.round(pausedMs / DAY_MS) },
  });
  return { plan, outcome };
};

// ============================================================================
// ARCHIVE
// ============================================================================

export const archivePlan = async ({ chamaId, planId, actorUserId, body = {} }) => {
  const plan = await loadPlan(chamaId, planId);
  assertManageable(plan, 'archived');
  if (plan.status === 'archived') throw new AppError('This contribution is already archived.', 409);
  if (!['draft', 'active', 'paused'].includes(plan.status)) {
    throw new AppError(`A ${plan.status} contribution is already closed; it stays in your history as it is.`, 409);
  }

  const now = new Date();
  const open = await ContributionObligation.find({ plan_id: plan._id, status: { $in: OPEN } });
  const untouched = open.filter((o) => !D(o.paid_amount || 0).greaterThan(0));
  const partly = open.filter((o) => D(o.paid_amount || 0).greaterThan(0));

  if (partly.length) {
    throw new AppError(
      `${partly.length} member(s) have part-paid dues on this contribution. Let them finish paying, or waive the balance, before archiving.`,
      409
    );
  }
  if (untouched.length && body.cancel_open_unpaid !== true) {
    const err = new AppError(
      `${untouched.length} unpaid due(s) are still open on this contribution. Archive and cancel them (nothing has been paid toward them), or settle them first.`,
      409
    );
    err.details = { open_unpaid: untouched.length };
    throw err;
  }

  let cancelled = 0;
  for (const ob of untouched) {
    ob.status = 'cancelled';
    ob.cancelled_by = actorUserId;
    ob.cancelled_at = now;
    ob.cancellation_reason = 'Contribution archived by leadership.';
    await ob.save();
    cancelled += 1;
  }

  const from = plan.status;
  plan.archived_from_status = from;
  // A plan archived while running keeps the start of its "hold" so a later
  // resume does not bill the months it was archived.
  if (from === 'active') {
    plan.paused_at = now;
    plan.paused_by = actorUserId;
  }
  plan.status = 'archived';
  plan.archived_at = now;
  plan.archived_by = actorUserId;
  plan.archive_reason = reasonOf(body);
  plan.updated_by = actorUserId;
  await plan.save();

  await audit(AUDIT_ACTIONS.CONTRIBUTION_PLAN_ARCHIVED, {
    actorUserId, chamaId, plan,
    before: { status: from },
    after: { status: 'archived', reason: plan.archive_reason },
    metadata: { cancelled_unpaid: cancelled },
  });
  return { plan, outcome: { cancelled_unpaid: cancelled } };
};

// ============================================================================
// RESTORE
// ============================================================================

export const restorePlan = async ({ chamaId, planId, actorUserId }) => {
  const plan = await loadPlan(chamaId, planId);
  if (plan.status !== 'archived') throw new AppError('Only an archived contribution can be restored.', 409);

  // A live contribution may not share a name with the one coming back.
  const clash = await ContributionPlan.findOne({
    _id: { $ne: plan._id },
    owner_type: 'Chama',
    owner_id: chamaId,
    name: new RegExp(`^${plan.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    status: { $in: ['draft', 'active', 'paused'] },
  }).lean();
  if (clash) throw new AppError(`There is already a contribution called "${clash.name}". Rename one of them first.`, 409);

  const was = plan.archived_from_status;
  plan.status = was === 'draft' ? 'draft' : 'paused'; // resume deliberately; nothing starts billing by surprise
  plan.archived_at = null;
  plan.archived_by = null;
  plan.archive_reason = '';
  plan.archived_from_status = null;
  plan.updated_by = actorUserId;
  await plan.save();

  await audit(AUDIT_ACTIONS.CONTRIBUTION_PLAN_RESTORED, {
    actorUserId, chamaId, plan,
    before: { status: 'archived' },
    after: { status: plan.status },
  });
  return { plan };
};

export default { pausePlan, resumePlan, archivePlan, restorePlan };
