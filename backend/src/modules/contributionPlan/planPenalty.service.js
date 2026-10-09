/**
 * ============================================================================
 * PLAN LATE PENALTIES
 * ============================================================================
 *
 * Reuses the loan penalty pattern (loans/Loanpenalty.service.js):
 *
 *   - a grace window after the due date with no penalty;
 *   - past the grace window the penalty accrues per interval
 *     (loans: weekly; plans: once / weekly / monthly);
 *   - fixed KES per interval, or a % of what is still unpaid;
 *   - everything is recomputed against "now" on each run, and an accrued
 *     penalty never goes DOWN (loans: Math.max(item.penalty_accrued, ...)).
 *
 * The grace window is the plan's own schedule.grace_days, the same one that
 * decides when a contribution turns "overdue", so the two always agree.
 *
 * WHERE THE PENALTY LIVES
 * -----------------------
 * Loans keep penalty_accrued on the repayment item. Contributions are paid by
 * the generic payment pipeline, which settles one obligation at a time, so a
 * penalty is its own ContributionObligation inside the chama's built-in
 * "Late penalties" plan (system_key 'late_penalties', behaviour 'fine').
 * That way it is paid, receipted and posted to the ledger by the existing
 * pipeline with no changes to it, and it shows up under Fines & penalties.
 *
 *   late contribution (Hisa, March)  ──penalty_for_obligation_id──┐
 *                                                                 ▼
 *                                   penalty obligation (Late penalties plan)
 *
 * Rules
 *   - One penalty obligation per late contribution (unique index).
 *   - It is raised only once the contribution is overdue and unpaid.
 *   - It keeps growing while the contribution stays unpaid; once the
 *     contribution is paid the penalty is frozen at what had accrued.
 *   - A penalty already partly or fully paid is never reduced.
 *   - A waived or cancelled penalty (leadership decision) is left alone.
 *   - Paused and archived plans are not swept, so penalties do not accrue
 *     while a plan is on hold.
 * ============================================================================
 */

import mongoose from 'mongoose';
import ContributionPlan from '../../models/ContributionPlan.js';
import ContributionObligation from '../../models/ContributionObligation.js';
import AppError from '../../utils/AppError.js';
import { toDecimal } from '../../shared/decimal.js';
import { ensurePlanLedgerAccount } from './planLedgerAccount.service.js';

const DAY_MS = 86400000;
const D = toDecimal;

export const PENALTY_PLAN_KEY = 'late_penalties';
export const PENALTY_PLAN_DEFAULT_NAME = 'Late penalties';

const INTERVAL_DAYS = Object.freeze({ weekly: 7, monthly: 30 });
const RULE_TYPES = ['fixed', 'percentage_of_due'];
const RULE_INTERVALS = ['once', 'weekly', 'monthly'];

const round2 = (decimal) => decimal.toDecimalPlaces(2);
const moneyString = (decimal) => round2(decimal).toFixed(2);

// ============================================================================
// 1. RULE VALIDATION (used by create + edit)
// ============================================================================

/**
 * Validate a late_penalty payload from the client.
 * Returns undefined when nothing was sent, so callers can leave the rule as is.
 */
export const cleanLatePenalty = (raw, current = {}) => {
  if (raw === undefined || raw === null) return undefined;

  const enabled = Boolean(raw.enabled);
  if (!enabled) {
    // Keep the last numbers so switching it back on is one click.
    return {
      enabled: false,
      type: current.type || 'fixed',
      amount: Number(current.amount) || 0,
      interval: current.interval || 'once',
      max_amount: Number(current.max_amount) || 0,
    };
  }

  const type = raw.type ?? current.type ?? 'fixed';
  if (!RULE_TYPES.includes(type)) throw new AppError('Penalty type must be fixed or percentage_of_due.', 400);

  const interval = raw.interval ?? current.interval ?? 'once';
  if (!RULE_INTERVALS.includes(interval)) throw new AppError('Penalty interval must be once, weekly or monthly.', 400);

  const amount = Number(raw.amount ?? current.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new AppError('Enter the penalty amount (more than zero).', 400);
  if (type === 'percentage_of_due' && amount > 100) throw new AppError('A percentage penalty cannot be more than 100%.', 400);

  const max = Number(raw.max_amount ?? current.max_amount ?? 0);
  if (!Number.isFinite(max) || max < 0) throw new AppError('The penalty cap must be zero (no cap) or more.', 400);

  return { enabled: true, type, amount, interval, max_amount: max };
};

// ============================================================================
// 2. THE CALCULATION (pure: no database, easy to test)
// ============================================================================

/** Whole days between two dates, like loans' daysBetween(a, b). */
const daysBetween = (a, b) => Math.floor((new Date(a).getTime() - new Date(b).getTime()) / DAY_MS);

/**
 * How many penalty intervals have elapsed for one contribution.
 * 0 while still inside the grace window (same boundary as sweepOverdue).
 */
export const penaltyIntervals = ({ rule, dueDate, graceDays = 0, now = new Date() }) => {
  if (!rule?.enabled) return 0;
  const daysLate = daysBetween(now, dueDate);
  const grace = Number(graceDays) || 0;
  if (daysLate <= grace) return 0;
  if (rule.interval === 'once') return 1;
  const length = INTERVAL_DAYS[rule.interval] || 7;
  return Math.ceil((daysLate - grace) / length);
};

/**
 * The penalty owed so far on one contribution, as a Decimal.
 *   obligation = { expected_amount, paid_amount, due_date }
 * `outstanding` is what is still unpaid on the contribution right now.
 */
export const computePlanPenalty = ({ rule, obligation, graceDays = 0, now = new Date() }) => {
  const intervals = penaltyIntervals({ rule, dueDate: obligation.due_date, graceDays, now });
  if (intervals <= 0) return { intervals: 0, amount: D(0) };

  const outstanding = D(obligation.expected_amount || 0).minus(D(obligation.paid_amount || 0)).max(0);
  let amount =
    rule.type === 'percentage_of_due'
      ? outstanding.times(D(rule.amount).div(100)).times(intervals)
      : D(rule.amount).times(intervals);

  if (Number(rule.max_amount) > 0) amount = amount.min(D(rule.max_amount));
  return { intervals, amount: round2(amount) };
};

// ============================================================================
// 3. THE CHAMA'S "LATE PENALTIES" PLAN
// ============================================================================

/**
 * Find or create the built-in plan that holds penalty obligations. Created
 * lazily the first time a penalty is raised. The name is the chama's to
 * change (Kiswahili included); code finds it by system_key, never by name.
 */
export const ensurePenaltyPlan = async ({ chamaId, actorUserId = null }) => {
  const filter = { owner_type: 'Chama', owner_id: chamaId, system_key: PENALTY_PLAN_KEY };
  const existing = await ContributionPlan.findOne(filter);
  if (existing) return existing;

  // The creator must be a real user id; fall back to any plan creator in the chama.
  let createdBy = actorUserId;
  if (!createdBy) {
    const any = await ContributionPlan.findOne({ owner_type: 'Chama', owner_id: chamaId }).select('created_by').lean();
    createdBy = any?.created_by || null;
  }
  if (!createdBy) throw new AppError('Cannot set up late penalties: the chama has no contributions yet.', 409);

  try {
    const plan = await ContributionPlan.create({
      owner_type: 'Chama',
      owner_id: chamaId,
      participant_type: 'ChamaMembership',
      created_by: createdBy,
      name: PENALTY_PLAN_DEFAULT_NAME,
      description: 'Penalties charged for late contributions. Raised automatically.',
      contribution_type: 'free_will',
      frequency: 'once',
      is_permanent: true,
      start_date: new Date(),
      behavior: 'fine',
      amount_mode: 'fixed',
      system_key: PENALTY_PLAN_KEY,
      status: 'active',
      activated_at: new Date(),
      activated_by: createdBy,
      schedule: { aligned_to_calendar: false, category: 'fine' },
      display: { color: '#dc2626', icon: 'alert-triangle', sort_order: 900 },
    });
    await ensurePlanLedgerAccount(plan, { actorUserId: createdBy }).catch((err) =>
      console.warn('[planPenalty] ledger account not created:', err.message)
    );
    return plan;
  } catch (err) {
    if (err?.code !== 11000) throw err;
    return ContributionPlan.findOne(filter); // another run created it first
  }
};

// ============================================================================
// 4. THE SWEEP (called from the calendar job, after sweepOverdue)
// ============================================================================

const notifyPenalty = async ({ source, penalty, plan, amount }) => {
  // Once per late contribution: claim it atomically so overlapping runs do not double-send.
  const claim = await ContributionObligation.updateOne(
    { _id: source._id, 'reminder_log.kind': { $ne: 'penalty_raised' } },
    { $push: { reminder_log: { kind: 'penalty_raised', sent_at: new Date() } } }
  );
  if ((claim.modifiedCount ?? claim.nModified ?? 0) !== 1) return false;
  try {
    const { default: notificationService } = await import('../../services/notification.service.js');
    await notificationService.createNotification({
      chamaId: source.owner_id,
      recipientMembershipId: source.participant_id,
      notificationType: 'CONTRIBUTION_OVERDUE',
      title: `${plan.name}: late penalty added`,
      message: `A late penalty of KES ${Math.round(Number(amount)).toLocaleString('en-KE')} was added because ${plan.name} is overdue.`,
      metadata: { planId: String(plan._id), planName: plan.name, obligationId: String(penalty._id), lateObligationId: String(source._id) },
      relatedEntityType: 'ContributionObligation',
      relatedEntityId: penalty._id,
      actionUrl: `/workspace/${source.owner_id}/my-chama`,
      actionText: 'View my contributions',
      priority: 'high',
      requiresAction: true,
      eventSource: 'contribution_calendar',
    });
    return true;
  } catch (err) {
    await ContributionObligation.updateOne({ _id: source._id }, { $pull: { reminder_log: { kind: 'penalty_raised' } } }).catch(() => {});
    console.warn(`[planPenalty] notification failed for ${source._id}:`, err.message);
    return false;
  }
};

/**
 * Raise or grow penalties for every overdue contribution of `plan`.
 * Safe to run as often as you like (the hourly job does).
 * Returns { raised, grown }.
 */
export const applyLatePenaltiesForPlan = async ({ plan, now = new Date() }) => {
  const result = { raised: 0, grown: 0 };
  const rule = plan.late_penalty;
  if (!rule?.enabled || plan.status !== 'active' || plan.system_key === PENALTY_PLAN_KEY) return result;

  const graceDays = Number(plan.schedule?.grace_days) || 0;
  const late = await ContributionObligation.find({
    plan_id: plan._id,
    period_key: { $ne: null },
    penalty_for_obligation_id: null,
    status: { $in: ['overdue', 'partially_paid'] },
    due_date: { $lt: new Date(now.getTime() - graceDays * DAY_MS) },
  });
  if (!late.length) return result;

  const penaltyPlan = await ensurePenaltyPlan({ chamaId: plan.owner_id });
  if (!penaltyPlan) return result;

  const existing = await ContributionObligation.find({
    penalty_for_obligation_id: { $in: late.map((o) => o._id) },
  });
  const byLate = new Map(existing.map((p) => [String(p.penalty_for_obligation_id), p]));

  for (const source of late) {
    if (!D(source.expected_amount).minus(D(source.paid_amount || 0)).greaterThan(0)) continue;

    const { intervals, amount } = computePlanPenalty({ rule, obligation: source, graceDays, now });
    if (intervals <= 0 || !amount.greaterThan(0)) continue;

    const current = byLate.get(String(source._id));

    if (!current) {
      try {
        const penalty = await ContributionObligation.create({
          plan_id: penaltyPlan._id,
          owner_type: 'Chama',
          owner_id: plan.owner_id,
          participant_type: 'ChamaMembership',
          participant_id: source.participant_id,
          expected_amount: moneyString(amount),
          paid_amount: 0,
          currency: source.currency || 'KES',
          status: 'overdue', // a penalty is payable immediately
          due_date: now,
          notes: `Late penalty - ${plan.name} (${source.period_key})`.slice(0, 500),
          penalty_for_obligation_id: source._id,
          penalty_intervals: intervals,
          penalty_computed_at: now,
        });
        result.raised += 1;
        await notifyPenalty({ source, penalty, plan, amount });
      } catch (err) {
        if (err?.code !== 11000) throw err; // a concurrent run raised it first
      }
      continue;
    }

    // Already raised: grow it, never shrink it, never touch a settled or decided one.
    if (['paid', 'waived', 'cancelled'].includes(current.status)) continue;
    const before = D(current.expected_amount);
    if (!amount.greaterThan(before)) continue;
    // A part-paid penalty keeps its paid amount; only the total moves up.
    current.expected_amount = moneyString(amount);
    current.penalty_intervals = intervals;
    current.penalty_computed_at = now;
    if (current.status === 'partially_paid' || D(current.paid_amount || 0).greaterThan(0)) current.status = 'partially_paid';
    await current.save();
    result.grown += 1;
  }
  return result;
};

/**
 * Raise penalties for every active plan of a chama. Mirrors how
 * runCalendarForChama loops its plans.
 */
export const applyLatePenaltiesForChama = async ({ chamaId, now = new Date() }) => {
  const plans = await ContributionPlan.find({
    owner_type: 'Chama',
    owner_id: new mongoose.Types.ObjectId(String(chamaId)),
    status: 'active',
    'late_penalty.enabled': true,
  });
  const total = { raised: 0, grown: 0 };
  for (const plan of plans) {
    const r = await applyLatePenaltiesForPlan({ plan, now });
    total.raised += r.raised;
    total.grown += r.grown;
  }
  return total;
};

// ============================================================================
// 5. READ MODEL (for the leadership screen)
// ============================================================================

/** The rule as the UI reads it, plus a one-line plain-language summary. */
export const latePenaltyView = (plan, graceDays = Number(plan?.schedule?.grace_days) || 0) => {
  const r = plan?.late_penalty?.toObject?.() ?? plan?.late_penalty ?? {};
  const view = {
    enabled: Boolean(r.enabled),
    type: r.type || 'fixed',
    amount: Number(r.amount) || 0,
    interval: r.interval || 'once',
    max_amount: Number(r.max_amount) || 0,
    grace_days: graceDays,
  };
  if (view.enabled) {
    const what = view.type === 'percentage_of_due' ? `${view.amount}% of the unpaid amount` : `KES ${view.amount.toLocaleString('en-KE')}`;
    const when = view.interval === 'once' ? 'once' : `every ${view.interval === 'weekly' ? 'week' : 'month'}`;
    view.summary = `${what}, ${when}, after ${graceDays} grace day(s)${view.max_amount ? `, up to KES ${view.max_amount.toLocaleString('en-KE')}` : ''}.`;
  } else {
    view.summary = 'No late penalty.';
  }
  return view;
};

export default {
  cleanLatePenalty,
  penaltyIntervals,
  computePlanPenalty,
  ensurePenaltyPlan,
  applyLatePenaltiesForPlan,
  applyLatePenaltiesForChama,
  latePenaltyView,
};
