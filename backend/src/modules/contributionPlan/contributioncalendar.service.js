/**
 * ============================================================================
 * CONTRIBUTION CALENDAR SERVICE
 * ============================================================================
 *
 * Turns a chama's contribution plans into a month-by-month calendar inside its
 * financial year:
 *
 *   1. GENERATION     each period that opens gets an obligation per active
 *                     member, automatically (idempotent — safe to run hourly)
 *   2. CLOSING        a fully paid obligation closes its month
 *   3. CARRY-FORWARD  a payment larger than the month needs pushes the excess
 *                     into the next month(s) as an ADVANCE, visibly
 *   4. OVERDUE        obligations past due date + grace flip to overdue
 *   5. REMINDERS      opened / due soon / overdue / month-closed notifications
 *   6. TIMINGS        leadership can reset due day, grace, start and end month
 *   7. READ MODELS    the leadership grid and the member dashboard calendar
 *
 * Only plans with schedule.aligned_to_calendar = true take part. Everything
 * else keeps behaving exactly as it did.
 *
 * MONEY INVARIANT
 * ---------------
 * For one member and one plan, the SUM of paid_amount across obligations always
 * equals the money actually received. Carry-forward moves paid_amount between
 * obligations; it never creates or destroys any. Money nobody can absorb (the
 * plan's window has ended) stays on the source obligation as unallocated_credit.
 * ============================================================================
 */

import mongoose from 'mongoose';
import ContributionPlan from '../../models/ContributionPlan.js';
import ContributionObligation from '../../models/ContributionObligation.js';
import ContributionPayment from '../../models/ContributionPayment.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import ChamaFinancialYear from '../../models/Chamafinancialyear.js';
import AppError from '../../utils/AppError.js';
import { toDecimal } from '../../shared/decimal.js';
import { createAuditLog } from '../../services/audit.service.js';
import { AUDIT_ACTIONS } from '../../constants/audit.constants.js';
import {
  CONTRIBUTION_BEHAVIORS,
  isBehavior,
  behaviorFromLegacy,
  legacyCategoryOf,
} from '../../constants/contributionBehavior.constants.js';
import { ensurePlanLedgerAccount, syncPlanLedgerAccountName } from './planLedgerAccount.service.js';
import { cleanLatePenalty, applyLatePenaltiesForPlan, latePenaltyView } from './planPenalty.service.js';
import { templateByKey, CHAMA_TEMPLATES } from '../../constants/chamaTemplates.constants.js';
import {
  periodsForPlan,
  cadenceOf,
  isCalendarAligned,
  timingState,
  parseMonthKey,
  monthStartOfIndex,
  monthKeyOfDate,
  dueDateOfIndex,
  monthOfIndex,
  yearOfIndex,
  monthKeyOfIndex,
  monthLabelOfIndex,
  monthIndexOf,
  FINANCIAL_YEAR_PRESETS,
  yearRange,
  presetStartYear,
  financialYearLabel,
} from '../../models/Calendarperiods.js';
import {
  getActiveYear,
  resolveYearForView,
  listYears,
} from './financialYear.service.js';

const DAY_MS = 86400000;
const D = toDecimal;

export const PLAN_CATEGORIES = Object.freeze([
  { value: 'mgr', label: 'Merry-Go-Round (MGR)' },
  { value: 'savings', label: 'Savings' },
  { value: 'welfare', label: 'Welfare / emergency fund' },
  { value: 'shares', label: 'Shares / investment' },
  { value: 'registration', label: 'Registration fee' },
  { value: 'annual_fee', label: 'Annual subscription' },
  { value: 'fine', label: 'Fines & penalties' },
  { value: 'other', label: 'Other' },
]);

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === 'ReplicaSetWithPrimary' || topology?.description?.type === 'Sharded';
};
const sessionOf = (session) => (canUseTransactions() && session ? session : null);

const kes = (value) => `KES ${Math.round(Number(value?.toString?.() ?? value ?? 0)).toLocaleString('en-KE')}`;
const money = (decimal) => decimal.toFixed(2);
const asNumber = (value) => Number(value?.toString?.() ?? value ?? 0);
const dayLabel = (date) =>
  new Date(date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' });

export const planAmount = (plan) => {
  const raw = plan.amount ?? plan.minimum_amount;
  if (raw === null || raw === undefined) return null;
  const amount = D(raw);
  return amount.greaterThan(0) ? amount : null;
};

/** What the desk should call a plan when leadership hasn't picked a category. */
export const inferCategory = (plan) => {
  // `behavior` is authoritative. Name-guessing below only serves plans that
  // predate it and have not been through backfillContributionBehavior yet.
  if (plan.behavior) return legacyCategoryOf(plan.behavior, plan.schedule?.category);
  const set = plan.schedule?.category;
  if (set && set !== 'other') return set;
  if (plan.contribution_type === 'merry_go_round') return 'mgr';
  const name = String(plan.name || '').toLowerCase();
  if (/saving/.test(name)) return 'savings';
  if (/welfare|emergency|bereave|funeral|burial/.test(name)) return 'welfare';
  if (/share|invest|land|stock/.test(name)) return 'shares';
  if (/regist|joining|entry/.test(name)) return 'registration';
  if (/annual|subscription|agm/.test(name)) return 'annual_fee';
  if (/fine|penalt/.test(name)) return 'fine';
  return 'other';
};

/** The financial year containing `date` for this chama (active or historical). */
const yearContaining = (chamaId, date) =>
  ChamaFinancialYear.findOne({ chama_id: chamaId, start_date: { $lte: date }, end_date: { $gte: date } });

// ============================================================================
// 1. GENERATION
// ============================================================================

export const periodFields = (period) => ({
  period_start: period.start,
  period_end: period.end,
  period_key: period.key,
  due_date: period.due_date,
});

/**
 * Create every missing obligation for every period of `plan` that has opened.
 * Idempotent: the (plan, participant, period_start, period_end) unique index
 * makes a duplicate insert a no-op, and we also skip what already exists.
 */
export const generateObligationsForPlan = async ({ plan, fy, now = new Date() }) => {
  const result = { created: 0, periods: 0, skipped: null };
  if (!isCalendarAligned(plan) || plan.status !== 'active') {
    result.skipped = 'not_aligned_or_inactive';
    return result;
  }
  const amount = planAmount(plan);
  if (!amount) {
    result.skipped = 'no_amount';
    return result;
  }

  // Periods that opened while the plan was paused are never billed.
  const skipKeys = new Set(plan.paused_period_keys || []);
  const periods = periodsForPlan({ plan, fy, upTo: now }).filter((p) => !skipKeys.has(p.key));
  result.periods = periods.length;
  if (!periods.length) return result;

  const memberFilter = { chama_id: plan.owner_id, status: 'active' };
  if (plan.applies_to?.mode === 'selected') memberFilter._id = { $in: plan.applies_to.participant_ids };
  const members = await ChamaMembership.find(memberFilter)
    .select('_id joined_at createdAt')
    .lean();
  if (!members.length) return result;

  const existing = await ContributionObligation.find({
    plan_id: plan._id,
    period_key: { $in: periods.map((p) => p.key) },
  })
    .select('participant_id period_key')
    .lean();
  const have = new Set(existing.map((o) => `${o.participant_id}|${o.period_key}`));

  const docs = [];
  for (const period of periods) {
    for (const member of members) {
      // Someone who joined after this period ended never owed it.
      const joined = member.joined_at || member.createdAt;
      if (joined && new Date(joined) >= period.end) continue;
      if (have.has(`${member._id}|${period.key}`)) continue;
      const owed = memberAmountFor(plan, member._id, period, amount);
      if (owed.isZero()) continue; // a custom amount of 0 exempts this member

      docs.push({
        plan_id: plan._id,
        owner_type: 'Chama',
        owner_id: plan.owner_id,
        participant_type: 'ChamaMembership',
        participant_id: member._id,
        expected_amount: money(owed),
        paid_amount: 0,
        currency: plan.currency || 'KES',
        status: 'pending',
        notes: `${plan.name} - ${period.label}`,
        ...periodFields(period),
      });
    }
  }

  if (docs.length) {
    try {
      const inserted = await ContributionObligation.insertMany(docs, { ordered: false });
      result.created = inserted.length;
    } catch (err) {
      // Duplicate-key errors from a concurrent run are expected and harmless.
      const writeErrors = err?.writeErrors || [];
      const onlyDuplicates = err?.code === 11000 || (writeErrors.length && writeErrors.every((e) => e.code === 11000));
      if (!onlyDuplicates) throw err;
      result.created = err?.insertedDocs?.length ?? Math.max(0, docs.length - writeErrors.length);
    }
  }
  return result;
};

/** Flip pending / partially-paid obligations past due date + grace to overdue. */
export const sweepOverdue = async ({ plan, now = new Date() }) => {
  const graceMs = (Number(plan.schedule?.grace_days) || 0) * DAY_MS;
  const res = await ContributionObligation.updateMany(
    {
      plan_id: plan._id,
      period_key: { $ne: null },
      status: { $in: ['pending', 'partially_paid'] },
      due_date: { $lt: new Date(now.getTime() - graceMs) },
    },
    { $set: { status: 'overdue' } }
  );
  return res.modifiedCount ?? res.nModified ?? 0;
};

/** Everything the hourly job (or a leader pressing "Refresh") does for one chama. */
export const runCalendarForChama = async ({ chamaId, now = new Date() }) => {
  const fy = await getActiveYear(chamaId, now);
  if (!fy) return { chamaId, skipped: 'no_active_financial_year' };

  const plans = await ContributionPlan.find({
    owner_type: 'Chama',
    owner_id: chamaId,
    status: 'active',
    'schedule.aligned_to_calendar': true,
  });

  const summary = { chamaId, plans: plans.length, created: 0, overdue: 0, reminders: 0, penalties_raised: 0, penalties_grown: 0 };
  for (const plan of plans) {
    const gen = await generateObligationsForPlan({ plan, fy, now });
    summary.created += gen.created;
    summary.overdue += await sweepOverdue({ plan, now });
    try {
      const pen = await applyLatePenaltiesForPlan({ plan, now });
      summary.penalties_raised += pen.raised;
      summary.penalties_grown += pen.grown;
    } catch (err) {
      // A penalty problem must never stop generation or reminders.
      console.error(`[contributionCalendar] late penalties failed for plan ${plan._id}:`, err.message);
    }
    summary.reminders += await sendRemindersForPlan({ plan, fy, now });
  }
  summary.reminders += await sendClosedNotifications({ chamaId, now });
  return summary;
};

// ============================================================================
// 2 + 3. CLOSING AND CARRY-FORWARD
// ============================================================================

/** Periods of `plan` strictly after `obligation`'s period, across this and later years. */
export const futurePeriodsAfter = async (plan, obligation) => {
  const chamaId = plan.owner_id;
  const years = await ChamaFinancialYear.find({
    chama_id: chamaId,
    end_date: { $gte: obligation.period_end },
    status: { $ne: 'closed' },
  })
    .sort({ start_date: 1 })
    .limit(3);

  const out = [];
  for (const fy of years) {
    for (const period of periodsForPlan({ plan, fy })) {
      if (period.start >= obligation.period_end && !out.some((p) => p.key === period.key)) out.push(period);
    }
  }
  return out.sort((a, b) => a.index - b.index);
};

/**
 * Called right after markPaid() has added a payment to a calendar obligation.
 * If that pushed paid_amount past expected_amount, the excess flows into the
 * next month(s) as advance credit. Returns the (fresh) source obligation.
 */
export const applyCarryForward = async (obligationId, session = null) => {
  const s = sessionOf(session);
  const withSession = (query) => (s ? query.session(s) : query);

  const obligation = await withSession(ContributionObligation.findById(obligationId));
  if (!obligation || !obligation.period_key) return obligation;

  const expected = D(obligation.expected_amount);
  const paid = D(obligation.paid_amount);
  const excess = paid.minus(expected);
  if (!excess.greaterThan(0)) return obligation;

  const plan = await withSession(ContributionPlan.findById(obligation.plan_id));
  if (!plan || !isCalendarAligned(plan)) return obligation;

  const amount = planAmount(plan);
  let remaining = excess;
  let carriedTotal = D(0);
  const now = new Date();

  if (amount) {
    const future = await futurePeriodsAfter(plan, obligation);
    for (const period of future) {
      if (!remaining.greaterThan(0)) break;

      let target = await withSession(
        ContributionObligation.findOne({
          plan_id: plan._id,
          participant_id: obligation.participant_id,
          period_key: period.key,
        })
      );

      if (!target) {
        const [created] = await ContributionObligation.create(
          [
            {
              plan_id: plan._id,
              owner_type: 'Chama',
              owner_id: plan.owner_id,
              participant_type: 'ChamaMembership',
              participant_id: obligation.participant_id,
              expected_amount: money(memberAmountFor(plan, obligation.participant_id, period, amount)),
              paid_amount: 0,
              currency: plan.currency || 'KES',
              status: 'pending',
              notes: `${plan.name} - ${period.label}`,
              ...periodFields(period),
            },
          ],
          s ? { session: s } : {}
        );
        target = created;
      }

      if (['waived', 'cancelled'].includes(target.status)) continue;

      const need = D(target.expected_amount).minus(D(target.paid_amount));
      if (!need.greaterThan(0)) continue;

      const give = need.lessThan(remaining) ? need : remaining;
      const newPaid = D(target.paid_amount).plus(give);

      target.paid_amount = money(newPaid);
      target.advance_amount = money(D(target.advance_amount || 0).plus(give));
      target.advance_sources.push({
        obligation_id: obligation._id,
        period_key: obligation.period_key,
        amount: money(give),
        credited_at: now,
      });
      if (newPaid.greaterThanOrEqualTo(D(target.expected_amount))) {
        target.status = 'paid';
        target.paid_at = now;
        target.closed_at = now;
      } else {
        target.status = 'partially_paid';
      }
      await target.save(s ? { session: s } : {});

      if (!obligation.carried_to_obligation_id) obligation.carried_to_obligation_id = target._id;
      carriedTotal = carriedTotal.plus(give);
      remaining = remaining.minus(give);
    }
  }

  // Whatever nobody could absorb stays here, so no shilling disappears.
  obligation.paid_amount = money(expected.plus(remaining));
  obligation.carried_out_amount = money(D(obligation.carried_out_amount || 0).plus(carriedTotal));
  obligation.unallocated_credit = money(D(obligation.unallocated_credit || 0).plus(remaining));
  await obligation.save(s ? { session: s } : {});
  return obligation;
};

// ============================================================================
// PAYING A SPECIFIC MONTH
// ============================================================================

/** The period of `plan` that is open right now, or null. Read-only. */
export const currentPlanPeriod = async (plan, now = new Date()) => {
  if (!isCalendarAligned(plan)) return null;
  const fy = await getActiveYear(plan.owner_id, now);
  if (!fy) return null;
  return periodsForPlan({ plan, fy, upTo: now }).find((p) => p.start <= now && now < p.end) || null;
};

/** The period of `plan` with this YYYY-MM key, looked up across the chama's open financial years. */
export const findPlanPeriod = async (plan, periodKey) => {
  const years = await ChamaFinancialYear.find({ chama_id: plan.owner_id, status: { $ne: 'closed' } }).sort({ start_date: 1 });
  for (const fy of years) {
    const hit = periodsForPlan({ plan, fy }).find((p) => p.key === periodKey);
    if (hit) return hit;
  }
  return null;
};

/**
 * This member's obligation for one period of a plan, created on demand when the
 * period is inside the plan's schedule but nothing has generated it yet (for
 * example a month being paid ahead). Returns null when the month is not part of
 * the plan's schedule.
 */
export const ensureObligationForPeriod = async ({ plan, membershipId, periodKey, session = null }) => {
  const s = sessionOf(session);
  const filter = { plan_id: plan._id, participant_id: membershipId, period_key: periodKey };
  const existing = await (s ? ContributionObligation.findOne(filter).session(s) : ContributionObligation.findOne(filter));
  if (existing) return existing;

  const period = await findPlanPeriod(plan, periodKey);
  const base = planAmount(plan);
  if (!period || !base) return null;

  // Same rules as generation: only the plan's audience, nobody who joined after
  // the period ended, and a custom amount of 0 exempts the member.
  if (plan.applies_to?.mode === 'selected' && !(plan.applies_to.participant_ids || []).some((id) => String(id) === String(membershipId))) return null;
  const member = await ChamaMembership.findOne({ _id: membershipId, chama_id: plan.owner_id }).select('joined_at createdAt').lean();
  if (!member) return null;
  const joined = member.joined_at || member.createdAt;
  if (joined && new Date(joined) >= period.end) return null;
  if (memberAmountFor(plan, membershipId, period, base).isZero()) return null;

  try {
    const [created] = await ContributionObligation.create(
      [
        {
          plan_id: plan._id,
          owner_type: 'Chama',
          owner_id: plan.owner_id,
          participant_type: 'ChamaMembership',
          participant_id: membershipId,
          expected_amount: money(memberAmountFor(plan, membershipId, period, base)),
          paid_amount: 0,
          currency: plan.currency || 'KES',
          status: 'pending',
          notes: `${plan.name} - ${period.label}`,
          ...periodFields(period),
        },
      ],
      s ? { session: s } : {}
    );
    return created;
  } catch (err) {
    if (err?.code !== 11000) throw err;
    return ContributionObligation.findOne(filter);
  }
};

// ============================================================================
// NOTIFICATIONS
// ============================================================================

const notify = async (obligation, plan, { type, title, message, priority = 'normal', requiresAction = false }) => {
  const { default: notificationService } = await import('../../services/notification.service.js');
  return notificationService.createNotification({
    chamaId: obligation.owner_id,
    recipientMembershipId: obligation.participant_id,
    notificationType: type,
    title,
    message,
    metadata: {
      planId: String(obligation.plan_id),
      planName: plan?.name,
      periodKey: obligation.period_key,
      obligationId: String(obligation._id),
    },
    relatedEntityType: 'ContributionObligation',
    relatedEntityId: obligation._id,
    actionUrl: `/workspace/${obligation.owner_id}/my-chama`,
    actionText: 'View my contributions',
    priority,
    requiresAction,
    eventSource: 'contribution_calendar',
  });
};

/** Claim a reminder kind atomically; true means "you are the one who sends it". */
const claimReminder = async (obligationId, kind, now) => {
  const res = await ContributionObligation.updateOne(
    { _id: obligationId, 'reminder_log.kind': { $ne: kind } },
    { $push: { reminder_log: { kind, sent_at: now } } }
  );
  return (res.modifiedCount ?? res.nModified ?? 0) === 1;
};
const releaseReminder = (obligationId, kind) =>
  ContributionObligation.updateOne({ _id: obligationId }, { $pull: { reminder_log: { kind } } });

const outstandingOf = (o) => D(o.expected_amount).minus(D(o.paid_amount || 0));

export const sendRemindersForPlan = async ({ plan, fy, now = new Date() }) => {
  const graceMs = (Number(plan.schedule?.grace_days) || 0) * DAY_MS;
  const leadMs = (Number(plan.schedule?.reminder_days_before) || 0) * DAY_MS;
  const keys = periodsForPlan({ plan, fy, upTo: now }).map((p) => p.key);
  if (!keys.length) return 0;

  const open = await ContributionObligation.find({
    plan_id: plan._id,
    period_key: { $in: keys },
    status: { $in: ['pending', 'partially_paid', 'overdue'] },
  });

  let sent = 0;
  for (const ob of open) {
    const owed = outstandingOf(ob);
    if (!owed.greaterThan(0)) continue;

    const due = new Date(ob.due_date);
    const overdueAfter = new Date(due.getTime() + graceMs);
    const label = monthLabelOfIndex(parseMonthKey(ob.period_key).index);

    let kind = null;
    let payload = null;

    if (now > overdueAfter) {
      kind = 'overdue';
      payload = {
        type: 'CONTRIBUTION_OVERDUE',
        title: `${plan.name}: ${label} is overdue`,
        message: `You still owe ${kes(owed)} for ${plan.name} (${label}). It was due on ${dayLabel(due)}.`,
        priority: 'urgent',
        requiresAction: true,
      };
    } else if (now >= new Date(due.getTime() - leadMs) && now <= due) {
      kind = 'due_soon';
      payload = {
        type: 'CONTRIBUTION_REMINDER',
        title: `${plan.name}: due ${dayLabel(due)}`,
        message: `${kes(owed)} is due for ${plan.name} (${label}) by ${dayLabel(due)}.`,
        priority: 'high',
        requiresAction: true,
      };
    } else if (now >= new Date(ob.period_start) && now < new Date(due.getTime() - leadMs)) {
      kind = 'opened';
      payload = {
        type: 'CONTRIBUTION_REMINDER',
        title: `${label} contributions are open`,
        message: `${plan.name} for ${label} is now open: ${kes(owed)} due by ${dayLabel(due)}.`,
        priority: 'normal',
        requiresAction: true,
      };
    }

    if (!kind) continue;
    if (!(await claimReminder(ob._id, kind, now))) continue;
    try {
      await notify(ob, plan, payload);
      sent += 1;
    } catch (err) {
      await releaseReminder(ob._id, kind).catch(() => {});
      console.warn(`[contributionCalendar] ${kind} reminder failed for ${ob._id}:`, err.message);
    }
  }
  return sent;
};

const closedMessage = (obligation, plan) => {
  const label = monthLabelOfIndex(parseMonthKey(obligation.period_key).index);
  const carried = asNumber(obligation.carried_out_amount);
  const early = obligation.paid_at && obligation.due_date && new Date(obligation.paid_at) <= new Date(obligation.due_date);
  let text = early
    ? `Well done! You paid ${plan?.name || 'your contribution'} for ${label} in full, on time. This month is now closed.`
    : `Thank you! ${plan?.name || 'Your contribution'} for ${label} is paid in full and the month is now closed.`;
  if (carried > 0) text += ` The extra ${kes(carried)} has been carried forward as an advance payment.`;
  return text;
};

/** Send the "month closed" congratulation once per closed obligation. */
export const sendClosedNotifications = async ({ chamaId, now = new Date(), sinceMs = 2 * DAY_MS }) => {
  const since = new Date(now.getTime() - sinceMs);
  const closed = await ContributionObligation.find({
    owner_type: 'Chama',
    owner_id: chamaId,
    period_key: { $ne: null },
    status: 'paid',
    closed_at: { $gte: since },
  });

  let sent = 0;
  for (const ob of closed) {
    // Months that were paid entirely by an earlier advance were already announced at the source.
    if (D(ob.advance_amount || 0).greaterThanOrEqualTo(D(ob.expected_amount))) continue;
    if (!(await claimReminder(ob._id, 'closed', now))) continue;
    try {
      const plan = await ContributionPlan.findById(ob.plan_id).select('name');
      await notify(ob, plan, {
        type: 'CONTRIBUTION_MONTH_CLOSED',
        title: `${monthLabelOfIndex(parseMonthKey(ob.period_key).index)} closed - well done!`,
        message: closedMessage(ob, plan),
        priority: 'low',
      });
      sent += 1;
    } catch (err) {
      await releaseReminder(ob._id, 'closed').catch(() => {});
      console.warn(`[contributionCalendar] closed notification failed for ${ob._id}:`, err.message);
    }
  }
  return sent;
};

/** Best-effort immediate congratulation after a payment (the hourly job is the safety net). */
export const scheduleClosedNotification = (chamaId) => {
  setTimeout(() => {
    sendClosedNotifications({ chamaId }).catch((err) =>
      console.warn('[contributionCalendar] immediate closed notification failed:', err.message)
    );
  }, 2000).unref?.();
};

// ============================================================================
// SAVINGS / PAYMENT ROUTING
// ============================================================================

/**
 * The obligation a deposit should land on for a calendar-aligned plan, or null
 * when the plan isn't aligned / there's no active year (caller keeps its
 * legacy behaviour). Creates the current period's obligation on demand.
 */
export const getOrCreateCurrentObligation = async ({ plan, membership, now = new Date() }) => {
  if (!isCalendarAligned(plan)) return null;
  const fy = await getActiveYear(plan.owner_id, now);
  if (!fy) return null;

  const period = periodsForPlan({ plan, fy, upTo: now }).find((p) => p.start <= now && now < p.end);
  const amount = planAmount(plan);
  if (!period || !amount) return null;

  const filter = { plan_id: plan._id, participant_id: membership._id, period_key: period.key };
  let obligation = await ContributionObligation.findOne(filter);
  if (obligation) return obligation;

  try {
    obligation = await ContributionObligation.create({
      plan_id: plan._id,
      owner_type: 'Chama',
      owner_id: plan.owner_id,
      participant_type: 'ChamaMembership',
      participant_id: membership._id,
      expected_amount: money(memberAmountFor(plan, membership._id, period, amount)),
      paid_amount: 0,
      currency: plan.currency || 'KES',
      status: 'pending',
      notes: `${plan.name} - ${period.label}`,
      ...periodFields(period),
    });
  } catch (err) {
    if (err?.code !== 11000) throw err;
    obligation = await ContributionObligation.findOne(filter);
  }
  return obligation;
};

// ============================================================================
// 6. TIMINGS: CREATE / CONFIGURE / RESET
// ============================================================================

const monthKeyToStart = (key, label) => {
  const parsed = parseMonthKey(key);
  if (!parsed) throw new AppError(`${label} must look like 2026-09 (year-month).`, 400);
  return { start: monthStartOfIndex(parsed.index), index: parsed.index };
};
const endOfMonthIndex = (index) => new Date(monthStartOfIndex(index + 1).getTime() - 1);

const intInRange = (value, min, max, label) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new AppError(`${label} must be a whole number from ${min} to ${max}.`, 400);
  }
  return n;
};

const validCategory = (value) => {
  if (!PLAN_CATEGORIES.some((c) => c.value === value)) throw new AppError('Unknown contribution category.', 400);
  return value;
};

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(v);

/** Presentation options: a colour, an icon name and a sort position. */
const cleanDisplay = (raw, current = {}) => {
  if (raw === undefined || raw === null) return undefined;
  const out = { color: current.color ?? null, icon: current.icon ?? null, sort_order: current.sort_order ?? 0 };
  if (raw.color !== undefined) out.color = raw.color ? String(raw.color).trim().slice(0, 20) : null;
  if (raw.icon !== undefined) out.icon = raw.icon ? String(raw.icon).trim().slice(0, 30) : null;
  if (raw.sort_order !== undefined) out.sort_order = intInRange(raw.sort_order, 0, 999, 'Sort order');
  return out;
};

/** Every id must be a membership of THIS chama - never trust ids from the client. */
const assertChamaMembers = async (chamaId, ids) => {
  if (!ids.length) return;
  if (!ids.every(isObjectId)) throw new AppError('One or more selected members are invalid.', 400);
  const found = await ChamaMembership.countDocuments({ _id: { $in: ids }, chama_id: chamaId });
  if (found !== new Set(ids.map(String)).size) throw new AppError('Some selected members do not belong to this chama.', 400);
};

const cleanAppliesTo = async (chamaId, raw) => {
  if (raw === undefined || raw === null) return undefined;
  const mode = raw.mode === 'selected' ? 'selected' : 'all';
  if (mode === 'all') return { mode: 'all', participant_ids: [] };
  const ids = [...new Set((raw.participant_ids || []).map(String))];
  if (!ids.length) throw new AppError('Choose at least one member, or set the contribution to apply to everyone.', 400);
  await assertChamaMembers(chamaId, ids);
  return { mode, participant_ids: ids };
};

const cleanOverrides = async (chamaId, raw) => {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) throw new AppError('Member amounts must be a list.', 400);
  const seen = new Set();
  const out = [];
  for (const row of raw) {
    const amt = Number(row?.amount);
    if (!Number.isFinite(amt) || amt < 0) throw new AppError('Each member amount must be zero or more.', 400);
    if (seen.has(String(row.participant_id))) throw new AppError('A member can only have one custom amount.', 400);
    seen.add(String(row.participant_id));
    out.push({
      participant_id: row.participant_id,
      amount: money(D(amt)),
      reason: String(row.reason || '').trim().slice(0, 200),
      effective_from: row.effective_from ? new Date(row.effective_from) : null,
    });
  }
  await assertChamaMembers(chamaId, out.map((o) => o.participant_id));
  return out;
};

const AMOUNT_MODES = ['fixed', 'minimum', 'member_chooses'];
const cleanAmountMode = (value, fallback = 'fixed') => {
  if (value === undefined || value === null || value === '') return fallback;
  if (!AMOUNT_MODES.includes(value)) throw new AppError('Amount mode must be fixed, minimum or member_chooses.', 400);
  return value;
};

/** The amount one member owes for a period: their custom amount, else the plan's. */
export const memberAmountFor = (plan, memberId, period, fallback) => {
  const row = (plan.member_amount_overrides || []).find(
    (o) => String(o.participant_id) === String(memberId) && (!o.effective_from || new Date(o.effective_from) <= period.start)
  );
  return row ? D(row.amount) : fallback;
};

/**
 * After timings change, bring the OPEN obligations in line: recompute due
 * dates, re-arm reminders, and cancel unpaid ones that now fall outside the
 * plan's window. Paid, waived and cancelled obligations are history — untouched.
 */
const reapplyScheduleToObligations = async ({ plan, now = new Date() }) => {
  const graceMs = (Number(plan.schedule?.grace_days) || 0) * DAY_MS;
  const dueDay = Number(plan.schedule?.due_day) || 5;
  const startIdx = plan.start_date ? monthIndexOf(plan.start_date) : -Infinity;
  const endIdx = plan.end_date ? monthIndexOf(plan.end_date) : Infinity;

  const open = await ContributionObligation.find({
    plan_id: plan._id,
    period_key: { $ne: null },
    status: { $in: ['pending', 'partially_paid', 'overdue'] },
  });

  const counts = { rescheduled: 0, cancelled: 0 };
  for (const ob of open) {
    const index = parseMonthKey(ob.period_key)?.index;
    if (index === undefined) continue;
    const paidNothing = !D(ob.paid_amount || 0).greaterThan(0);

    if ((index < startIdx || index > endIdx) && paidNothing) {
      ob.status = 'cancelled';
      ob.cancelled_at = now;
      ob.cancellation_reason = 'Outside the contribution window after leadership changed its start/end month.';
      await ob.save();
      counts.cancelled += 1;
      continue;
    }

    const newDue = dueDateOfIndex(index, dueDay);
    ob.due_date = newDue;
    ob.reminder_log = [];
    if (now.getTime() > newDue.getTime() + graceMs) {
      ob.status = 'overdue';
    } else {
      ob.status = D(ob.paid_amount || 0).greaterThan(0) ? 'partially_paid' : 'pending';
    }
    await ob.save();
    counts.rescheduled += 1;
  }
  return counts;
};

const cancelLegacyUnpaid = async ({ plan, now = new Date() }) => {
  const legacy = await ContributionObligation.find({
    plan_id: plan._id,
    period_key: null,
    status: { $in: ['pending', 'overdue'] },
  });
  let cancelled = 0;
  for (const ob of legacy) {
    if (D(ob.paid_amount || 0).greaterThan(0)) continue; // partially paid stays as is
    ob.status = 'cancelled';
    ob.cancelled_at = now;
    ob.cancellation_reason = 'Replaced by the calendar schedule when this contribution was aligned to the financial year.';
    await ob.save();
    cancelled += 1;
  }
  return cancelled;
};

export const configureSchedule = async ({ chamaId, planId, actorUserId, body }) => {
  if (!mongoose.Types.ObjectId.isValid(planId)) throw new AppError('Invalid contribution.', 400);
  const plan = await ContributionPlan.findOne({ _id: planId, owner_type: 'Chama', owner_id: chamaId });
  if (!plan) throw new AppError('Contribution not found in this chama.', 404);
  if (plan.status === 'archived') throw new AppError('This contribution is archived. Restore it before changing its schedule.', 409);
  if (['cancelled', 'completed'].includes(plan.status)) {
    throw new AppError(`A ${plan.status} contribution cannot be rescheduled.`, 409);
  }

  const fy = await getActiveYear(chamaId);
  const before = {
    schedule: plan.schedule?.toObject?.() ?? plan.schedule,
    start_date: plan.start_date,
    end_date: plan.end_date,
  };
  const now = new Date();
  let timingsChanged = false;

  if (body.aligned_to_calendar !== undefined) {
    const wantAligned = Boolean(body.aligned_to_calendar);
    if (wantAligned && !cadenceOf(plan)) {
      throw new AppError(
        'Only monthly, quarterly or yearly contributions can follow the calendar. Weekly, daily and custom ones keep their own rolling periods.',
        400
      );
    }
    if (wantAligned && !fy) {
      throw new AppError('Set the financial year first - the calendar is drawn inside it.', 409);
    }
    if (wantAligned !== Boolean(plan.schedule?.aligned_to_calendar)) timingsChanged = true;
    plan.schedule.aligned_to_calendar = wantAligned;
  }

  if (body.due_day !== undefined) {
    plan.schedule.due_day = intInRange(body.due_day, 1, 31, 'Due day');
    timingsChanged = true;
  }
  if (body.grace_days !== undefined) {
    plan.schedule.grace_days = intInRange(body.grace_days, 0, 60, 'Grace days');
    timingsChanged = true;
  }
  if (body.reminder_days_before !== undefined) {
    plan.schedule.reminder_days_before = intInRange(body.reminder_days_before, 0, 30, 'Reminder lead time');
  }
  if (body.category !== undefined) plan.schedule.category = validCategory(body.category);

  if (body.start_month !== undefined && body.start_month !== '') {
    const { start, index } = monthKeyToStart(body.start_month, 'Start month');
    if (fy && index > monthIndexOf(fy.end_date)) {
      throw new AppError('That start month is after the financial year ends.', 400);
    }
    plan.start_date = start;
    timingsChanged = true;
  }
  if (body.end_month !== undefined) {
    if (body.end_month === '' || body.end_month === null) {
      plan.end_date = null;
    } else {
      const { index } = monthKeyToStart(body.end_month, 'End month');
      if (plan.start_date && index < monthIndexOf(plan.start_date)) {
        throw new AppError('The end month cannot be before the start month.', 400);
      }
      plan.end_date = endOfMonthIndex(index);
      plan.is_permanent = false; // a permanent plan cannot carry an end date
    }
    timingsChanged = true;
  }

  if (timingsChanged) {
    plan.schedule.timings_reset_at = now;
    plan.schedule.timings_reset_by = actorUserId;
  }
  plan.updated_by = actorUserId;
  await plan.save();

  const outcome = { rescheduled: 0, cancelled: 0, legacy_cancelled: 0, created: 0 };

  if (isCalendarAligned(plan) && fy) {
    if (body.legacy_action === 'cancel_unpaid') {
      outcome.legacy_cancelled = await cancelLegacyUnpaid({ plan, now });
    }
    const applied = await reapplyScheduleToObligations({ plan, now });
    outcome.rescheduled = applied.rescheduled;
    outcome.cancelled = applied.cancelled;
    const gen = await generateObligationsForPlan({ plan, fy, now });
    outcome.created = gen.created;
    await sweepOverdue({ plan, now });
  }

  await createAuditLog({
    actorUserId,
    scopeType: 'CHAMA',
    chamaId,
    action: AUDIT_ACTIONS.CONTRIBUTION_SCHEDULE_UPDATED,
    resourceType: 'ContributionPlan',
    resourceId: plan._id,
    before,
    after: {
      schedule: plan.schedule?.toObject?.() ?? plan.schedule,
      start_date: plan.start_date,
      end_date: plan.end_date,
    },
    metadata: { plan: plan.name, outcome },
  }).catch((err) => console.error('[contributionCalendar] AUDIT NOT WRITTEN (timings):', err.message));

  return { plan, outcome };
};

/** Create a new calendar-aligned contribution (welfare, shares, registration, ...). */
export const createScheduledPlan = async ({ chamaId, actorUserId, body }) => {
  const fy = await getActiveYear(chamaId);
  if (!fy) throw new AppError('Set the financial year first - contributions are scheduled inside it.', 409);

  const name = String(body.name || '').trim();
  if (name.length < 2) throw new AppError('Give the contribution a name.', 400);
  let behavior = body.behavior;
  if (behavior === undefined || behavior === null || behavior === '') {
    // Older clients only send `category`; translate it once, here.
    behavior = behaviorFromLegacy({ name, schedule: { category: validCategory(body.category || 'other') } });
  }
  if (!isBehavior(behavior)) throw new AppError('Unknown contribution behaviour.', 400);
  const category = legacyCategoryOf(behavior, body.category);
  if (behavior === 'rotation' || body.category === 'mgr') {
    throw new AppError(
      'Merry-Go-Round is set up from its own page (it needs a rotation). Set it up there, then align it to the calendar here.',
      400
    );
  }

  const frequency = body.frequency || 'monthly';
  if (!['monthly', 'quarterly', 'yearly'].includes(frequency)) {
    throw new AppError('Calendar contributions are monthly, quarterly or yearly.', 400);
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new AppError('Enter the amount each member pays per period.', 400);

  const duplicate = await ContributionPlan.findOne({
    owner_type: 'Chama',
    owner_id: chamaId,
    name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    status: { $in: ['draft', 'active', 'paused'] },
  }).lean();
  if (duplicate) throw new AppError(`There is already a contribution called "${duplicate.name}".`, 409);

  const startKey = body.start_month || monthKeyOfDate(new Date());
  const { start } = monthKeyToStart(startKey, 'Start month');
  let endDate = null;
  if (body.end_month) {
    const { index } = monthKeyToStart(body.end_month, 'End month');
    if (index < monthIndexOf(start)) throw new AppError('The end month cannot be before the start month.', 400);
    endDate = endOfMonthIndex(index);
  }

  const now = new Date();
  const display = cleanDisplay(body.display);
  const appliesTo = await cleanAppliesTo(chamaId, body.applies_to);
  const overrides = await cleanOverrides(chamaId, body.member_amount_overrides);
  const targetAmount = body.target_amount !== undefined && body.target_amount !== '' ? Number(body.target_amount) : null;
  if (targetAmount !== null && (!Number.isFinite(targetAmount) || targetAmount <= 0)) {
    throw new AppError('The target amount must be more than zero.', 400);
  }

  const latePenalty = cleanLatePenalty(body.late_penalty);
  const templateKey = body.template_key && templateByKey(body.template_key) ? body.template_key : null;

  const plan = await ContributionPlan.create({
    owner_type: 'Chama',
    owner_id: chamaId,
    participant_type: 'ChamaMembership',
    created_by: actorUserId,
    behavior,
    ...(templateKey ? { template_key: templateKey } : {}),
    ...(latePenalty ? { late_penalty: latePenalty } : {}),
    amount_mode: cleanAmountMode(body.amount_mode),
    ...(display ? { display } : {}),
    ...(appliesTo ? { applies_to: appliesTo } : {}),
    ...(overrides ? { member_amount_overrides: overrides } : {}),
    ...(targetAmount !== null ? { target_amount: money(D(targetAmount)) } : {}),
    name,
    description: String(body.description || '').trim().slice(0, 500),
    contribution_type: 'fixed',
    frequency,
    amount,
    start_date: start,
    end_date: endDate,
    is_permanent: !endDate,
    status: 'active',
    activated_at: now,
    activated_by: actorUserId,
    schedule: {
      aligned_to_calendar: true,
      due_day: body.due_day !== undefined ? intInRange(body.due_day, 1, 31, 'Due day') : 5,
      grace_days: body.grace_days !== undefined ? intInRange(body.grace_days, 0, 60, 'Grace days') : 0,
      reminder_days_before:
        body.reminder_days_before !== undefined ? intInRange(body.reminder_days_before, 0, 30, 'Reminder lead time') : 3,
      category,
      timings_reset_at: now,
      timings_reset_by: actorUserId,
    },
  });

  await ensurePlanLedgerAccount(plan, { actorUserId }).catch((err) =>
    console.warn('[contributionCalendar] ledger account not created:', err.message)
  );
  const gen = await generateObligationsForPlan({ plan, fy, now });

  await createAuditLog({
    actorUserId,
    scopeType: 'CHAMA',
    chamaId,
    action: AUDIT_ACTIONS.CONTRIBUTION_PLAN_CREATED,
    resourceType: 'ContributionPlan',
    resourceId: plan._id,
    after: {
      name,
      behavior,
      amount_mode: plan.amount_mode,
      category,
      frequency,
      amount,
      start_date: start,
      end_date: endDate,
      due_day: plan.schedule.due_day,
      grace_days: plan.schedule.grace_days,
      applies_to: plan.applies_to?.toObject?.() ?? plan.applies_to,
      member_amount_overrides: (plan.member_amount_overrides || []).length,
      ledger_account_id: plan.ledger_account_id ? String(plan.ledger_account_id) : null,
      template_key: templateKey,
      late_penalty: latePenalty || null,
    },
  }).catch((err) => console.error('[contributionCalendar] AUDIT NOT WRITTEN (create):', err.message));

  return { plan, generated: gen.created };
};

/**
 * Edit a contribution's name, behaviour, amount, presentation or audience.
 *
 * Money rules:
 *  - A new amount applies from the NEXT period. Obligations already opened,
 *    and anything partly or fully paid, are never rewritten.
 *  - Members with a custom amount keep it.
 *  - Narrowing the audience cancels only unpaid obligations for people removed.
 */
export const updatePlanDetails = async ({ chamaId, planId, actorUserId, body }) => {
  if (!isObjectId(planId)) throw new AppError('Invalid contribution.', 400);
  const plan = await ContributionPlan.findOne({ _id: planId, owner_type: 'Chama', owner_id: chamaId });
  if (!plan) throw new AppError('Contribution not found in this chama.', 404);
  if (plan.status === 'archived') throw new AppError('This contribution is archived. Restore it before editing it.', 409);
  if (['cancelled', 'completed'].includes(plan.status)) {
    throw new AppError(`A ${plan.status} contribution cannot be edited.`, 409);
  }

  const now = new Date();
  const before = {
    name: plan.name,
    behavior: plan.behavior,
    amount_mode: plan.amount_mode,
    amount: plan.amount?.toString?.() ?? null,
    display: plan.display?.toObject?.() ?? plan.display,
    applies_to: plan.applies_to?.toObject?.() ?? plan.applies_to,
    member_amount_overrides: (plan.member_amount_overrides || []).map((o) => ({ participant_id: String(o.participant_id), amount: o.amount?.toString?.() })),
  };

  if (body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (name.length < 2) throw new AppError('Give the contribution a name.', 400);
    if (name.toLowerCase() !== plan.name.toLowerCase()) {
      const clash = await ContributionPlan.findOne({
        _id: { $ne: plan._id },
        owner_type: 'Chama',
        owner_id: chamaId,
        name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        status: { $in: ['draft', 'active', 'paused'] },
      }).lean();
      if (clash) throw new AppError(`There is already a contribution called "${clash.name}".`, 409);
    }
    plan.name = name;
  }
  if (body.description !== undefined) plan.description = String(body.description || '').trim().slice(0, 500);

  if (body.behavior !== undefined && body.behavior !== plan.behavior) {
    if (!isBehavior(body.behavior)) throw new AppError('Unknown contribution behaviour.', 400);
    if (plan.behavior === 'rotation' || body.behavior === 'rotation') {
      throw new AppError('Merry-Go-Round cannot be switched to or from another kind of contribution.', 400);
    }
    if (plan.system_key === 'savings') throw new AppError('The built-in savings contribution cannot change kind.', 400);
    plan.behavior = body.behavior;
    plan.schedule.category = legacyCategoryOf(body.behavior, plan.schedule?.category);
  }

  const display = cleanDisplay(body.display, plan.display?.toObject?.() ?? plan.display ?? {});
  if (display) plan.display = display;

  const appliesTo = await cleanAppliesTo(chamaId, body.applies_to);
  if (appliesTo) plan.applies_to = appliesTo;

  const overrides = await cleanOverrides(chamaId, body.member_amount_overrides);
  if (overrides) plan.member_amount_overrides = overrides;
  const overridesChanged = Boolean(overrides);

  if (body.amount_mode !== undefined) plan.amount_mode = cleanAmountMode(body.amount_mode, plan.amount_mode);

  // Late penalty rule. Applies to penalties from the next sweep on; penalties
  // already raised are never reduced by an edit (waive them instead).
  const penaltyBefore = plan.late_penalty?.toObject?.() ?? plan.late_penalty ?? null;
  const latePenalty = cleanLatePenalty(body.late_penalty, penaltyBefore || {});
  if (latePenalty) {
    if (plan.system_key === 'late_penalties') throw new AppError('Penalties are not charged on the penalties contribution itself.', 400);
    plan.late_penalty = latePenalty;
  }

  let amountChanged = false;
  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new AppError('Enter the amount each member pays per period.', 400);
    if (!plan.amount || !D(plan.amount).equals(D(amount))) {
      plan.amount = money(D(amount));
      amountChanged = true;
    }
  }

  plan.updated_by = actorUserId;
  await plan.save();

  const outcome = { repriced: 0, cancelled: 0, created: 0 };
  const exempt = (plan.member_amount_overrides || []).map((o) => o.participant_id);

  if (amountChanged && isCalendarAligned(plan)) {
    const res = await ContributionObligation.updateMany(
      {
        plan_id: plan._id,
        period_key: { $ne: null },
        period_start: { $gt: now },
        status: 'pending',
        paid_amount: 0,
        participant_id: { $nin: exempt },
      },
      { $set: { expected_amount: money(D(plan.amount)) } }
    );
    outcome.repriced = res.modifiedCount || 0;
  }

  // Per-member amounts: same rule as the plan amount - only future periods that
  // are still untouched. A member with no custom amount falls back to the plan
  // amount; a custom amount of 0 exempts them from those future periods.
  if (overridesChanged && isCalendarAligned(plan)) {
    const planAmt = planAmount(plan);
    const future = { plan_id: plan._id, period_key: { $ne: null }, period_start: { $gt: now }, status: 'pending', paid_amount: 0 };
    const customIds = new Set((plan.member_amount_overrides || []).map((o) => String(o.participant_id)));
    for (const o of plan.member_amount_overrides || []) {
      const amt = D(o.amount);
      const from = o.effective_from ? { period_start: { $gt: now, $gte: new Date(o.effective_from) } } : {};
      if (amt.isZero()) {
        const res = await ContributionObligation.updateMany(
          { ...future, ...from, participant_id: o.participant_id },
          { $set: { status: 'cancelled', cancelled_at: now, cancellation_reason: 'Custom amount of zero set for this member.' } }
        );
        outcome.cancelled += res.modifiedCount || 0;
      } else {
        const res = await ContributionObligation.updateMany(
          { ...future, ...from, participant_id: o.participant_id },
          { $set: { expected_amount: money(amt) } }
        );
        outcome.repriced += res.modifiedCount || 0;
      }
    }
    // Members whose custom amount was removed go back to the plan amount.
    const removed = (before.member_amount_overrides || []).map((o) => o.participant_id).filter((id) => !customIds.has(id));
    if (removed.length && planAmt) {
      const res = await ContributionObligation.updateMany(
        { ...future, participant_id: { $in: removed } },
        { $set: { expected_amount: money(planAmt) } }
      );
      outcome.repriced += res.modifiedCount || 0;
    }
  }

  if (appliesTo?.mode === 'selected') {
    const res = await ContributionObligation.updateMany(
      {
        plan_id: plan._id,
        period_end: { $gt: now },
        status: 'pending',
        paid_amount: 0,
        participant_id: { $nin: appliesTo.participant_ids },
      },
      { $set: { status: 'cancelled', cancelled_at: now, cancellation_reason: 'Member removed from this contribution.' } }
    );
    outcome.cancelled = res.modifiedCount || 0;
  }

  if (isCalendarAligned(plan) && plan.status === 'active') {
    const fy = await getActiveYear(chamaId);
    if (fy) outcome.created = (await generateObligationsForPlan({ plan, fy, now })).created;
  }

  if (body.name !== undefined) await syncPlanLedgerAccountName(plan);

  await createAuditLog({
    actorUserId,
    scopeType: 'CHAMA',
    chamaId,
    action: AUDIT_ACTIONS.CONTRIBUTION_PLAN_UPDATED,
    resourceType: 'ContributionPlan',
    resourceId: plan._id,
    before: { ...before, late_penalty: penaltyBefore },
    after: {
      late_penalty: plan.late_penalty?.toObject?.() ?? plan.late_penalty ?? null,
      name: plan.name,
      behavior: plan.behavior,
      amount_mode: plan.amount_mode,
      amount: plan.amount?.toString?.() ?? null,
      display: plan.display?.toObject?.() ?? plan.display,
      applies_to: plan.applies_to?.toObject?.() ?? plan.applies_to,
      member_amount_overrides: (plan.member_amount_overrides || []).map((o) => ({ participant_id: String(o.participant_id), amount: o.amount?.toString?.() })),
    },
    metadata: { plan: plan.name, outcome, applies_from: 'next period' },
  }).catch((err) => console.error('[contributionCalendar] AUDIT NOT WRITTEN (update):', err.message));

  return { plan, outcome };
};

// ============================================================================
// 7a. LEADERSHIP READ MODEL
// ============================================================================

const scheduleView = (plan) => {
  const s = plan.schedule?.toObject?.() ?? plan.schedule ?? {};
  return {
    aligned_to_calendar: Boolean(s.aligned_to_calendar),
    due_day: s.due_day ?? 5,
    grace_days: s.grace_days ?? 0,
    reminder_days_before: s.reminder_days_before ?? 3,
    category: s.category ?? 'other',
    timings_reset_at: s.timings_reset_at ?? null,
  };
};

const planHeader = (plan) => ({
  id: plan._id,
  name: plan.name,
  description: plan.description,
  category: inferCategory(plan),
  behavior: plan.behavior || behaviorFromLegacy(plan),
  amount_mode: plan.amount_mode || 'fixed',
  system_key: plan.system_key || null,
  display: plan.display?.toObject?.() ?? plan.display ?? { color: null, icon: null, sort_order: 0 },
  applies_to: {
    mode: plan.applies_to?.mode || 'all',
    count: plan.applies_to?.mode === 'selected' ? plan.applies_to.participant_ids?.length || 0 : null,
    participant_ids: plan.applies_to?.mode === 'selected' ? (plan.applies_to.participant_ids || []).map(String) : [],
  },
  member_amount_overrides: (plan.member_amount_overrides || []).map((o) => ({
    participant_id: String(o.participant_id),
    amount: o.amount?.toString?.() ?? null,
    reason: o.reason || '',
  })),
  contribution_type: plan.contribution_type,
  frequency: plan.frequency,
  cadence: cadenceOf(plan),
  amount: plan.amount ? plan.amount.toString() : null,
  status: plan.status,
  template_key: plan.template_key || null,
  late_penalty: latePenaltyView(plan),
  is_system: Boolean(plan.system_key),
  can_pause_or_archive: !plan.system_key && plan.behavior !== 'rotation' && plan.contribution_type !== 'merry_go_round',
  created_at: plan.createdAt || null,
  paused_at: plan.paused_at || null,
  pause_reason: plan.pause_reason || '',
  archived_at: plan.archived_at || null,
  archive_reason: plan.archive_reason || '',
  start_month: plan.start_date ? monthKeyOfDate(plan.start_date) : null,
  end_month: plan.end_date ? monthKeyOfDate(plan.end_date) : null,
  can_align: cadenceOf(plan) !== null,
  schedule: scheduleView(plan),
});

const yearView = (fy) =>
  fy && {
    id: fy._id,
    label: fy.label,
    start_date: fy.start_date,
    end_date: fy.end_date,
    status: fy.status,
    notes: fy.notes,
  };

export const financialYearPresets = (now = new Date()) =>
  Object.entries(FINANCIAL_YEAR_PRESETS).map(([key, preset]) => {
    const startYear = presetStartYear(key, now);
    const { start, end } = yearRange(startYear, preset.startMonth, 12);
    return {
      key,
      label: preset.label,
      description: preset.description,
      start_year: startYear,
      start_month: preset.startMonth + 1,
      start_date: start,
      end_date: end,
      year_label: financialYearLabel(start, end),
    };
  });

export const getLeadershipOverview = async ({ chamaId, yearId = null, now = new Date() }) => {
  const years = await listYears(chamaId, now);
  const fy = await resolveYearForView(chamaId, yearId, now);

  const base = {
    presets: financialYearPresets(now),
    categories: PLAN_CATEGORIES,
    behaviors: CONTRIBUTION_BEHAVIORS,
    templates: CHAMA_TEMPLATES,
    years: years.map(yearView),
    financial_year: yearView(fy),
    needs_financial_year: !fy,
    generated_at: now,
  };
  if (!fy) return { ...base, plans: [], summary: null };

  const plans = await ContributionPlan.find({
    owner_type: 'Chama',
    owner_id: chamaId,
    status: { $in: ['active', 'paused'] },
  }).sort({ createdAt: 1 });

  // Archived plans are out of the engine but stay visible (history intact).
  const archivedPlans = await ContributionPlan.find({
    owner_type: 'Chama',
    owner_id: chamaId,
    status: 'archived',
  }).sort({ archived_at: -1 });

  const alignedPlans = plans.filter(isCalendarAligned);
  const planIds = alignedPlans.map((p) => p._id);

  const agg = planIds.length
    ? await ContributionObligation.aggregate([
        { $match: { plan_id: { $in: planIds }, period_key: { $ne: null }, status: { $ne: 'cancelled' } } },
        {
          $group: {
            _id: { plan: '$plan_id', key: '$period_key' },
            expected: { $sum: { $toDouble: '$expected_amount' } },
            paid: { $sum: { $toDouble: '$paid_amount' } },
            members: { $sum: 1 },
            paid_count: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
            overdue_count: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] } },
          },
        },
      ])
    : [];
  const aggMap = new Map(agg.map((r) => [`${r._id.plan}|${r._id.key}`, r]));

  const legacyPlans = plans.filter((p) => !isCalendarAligned(p));
  const legacyAgg = legacyPlans.length
    ? await ContributionObligation.aggregate([
        {
          $match: {
            plan_id: { $in: legacyPlans.map((p) => p._id) },
            period_key: null,
            status: { $in: ['pending', 'partially_paid', 'overdue'] },
          },
        },
        {
          $group: {
            _id: '$plan_id',
            open_count: { $sum: 1 },
            overdue_count: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] } },
            outstanding: {
              $sum: { $subtract: [{ $toDouble: '$expected_amount' }, { $toDouble: '$paid_amount' }] },
            },
            next_due: { $min: '$due_date' },
          },
        },
      ])
    : [];
  const legacyMap = new Map(legacyAgg.map((r) => [String(r._id), r]));

  let totalOutstanding = 0;
  let totalOverdueMembers = 0;
  let totalCollectedThisMonth = 0;
  let activeObligationCount = 0;
  const currentKey = monthKeyOfDate(now);

  const planViews = plans.map((plan) => {
    const header = planHeader(plan);
    if (!isCalendarAligned(plan)) {
      const legacy = legacyMap.get(String(plan._id)) || null;
      if (legacy) activeObligationCount += 1;
      return {
        ...header,
        aligned: false,
        periods: [],
        current_period_key: null,
        legacy: legacy && {
          open_count: legacy.open_count,
          overdue_count: legacy.overdue_count,
          outstanding: Math.max(0, legacy.outstanding),
          next_due: legacy.next_due,
        },
      };
    }

    const periods = periodsForPlan({ plan, fy }).map((p) => {
      const row = aggMap.get(`${plan._id}|${p.key}`);
      const state = timingState(p, now);
      const expected = row?.expected ?? 0;
      const paid = row?.paid ?? 0;
      if (state !== 'upcoming' && row) {
        totalOutstanding += Math.max(0, expected - paid);
        totalOverdueMembers += row.overdue_count;
      }
      return {
        key: p.key,
        label: p.label,
        start: p.start,
        end: p.end,
        due_date: p.due_date,
        overdue_after: p.overdue_after,
        state,
        expected,
        paid,
        members: row?.members ?? 0,
        paid_count: row?.paid_count ?? 0,
        overdue_count: row?.overdue_count ?? 0,
      };
    });

    const current = periods.find((p) => p.start <= now && now < p.end) || null;
    if (current) {
      activeObligationCount += 1;
      totalCollectedThisMonth += current.paid;
    }

    return { ...header, aligned: true, periods, current_period_key: current?.key ?? null, legacy: null };
  });

  return {
    ...base,
    current_month_key: currentKey,
    plans: planViews,
    archived_plans: archivedPlans.map(planHeader),
    summary: {
      active_obligations: activeObligationCount,
      outstanding_now: Math.round(totalOutstanding),
      overdue_members: totalOverdueMembers,
      collected_this_period: Math.round(totalCollectedThisMonth),
      aligned_plans: alignedPlans.length,
      rolling_plans: legacyPlans.length,
    },
  };
};

/** Members x months grid for one plan (the "who paid which month" view). */
export const getPlanGrid = async ({ chamaId, planId, yearId = null, now = new Date() }) => {
  if (!mongoose.Types.ObjectId.isValid(planId)) throw new AppError('Invalid contribution.', 400);
  const plan = await ContributionPlan.findOne({ _id: planId, owner_type: 'Chama', owner_id: chamaId });
  if (!plan) throw new AppError('Contribution not found in this chama.', 404);
  if (!isCalendarAligned(plan)) {
    throw new AppError('This contribution is not on the calendar yet. Align it to the financial year first.', 409);
  }

  const fy = await resolveYearForView(chamaId, yearId, now);
  if (!fy) throw new AppError('Set the financial year first.', 409);

  const periods = periodsForPlan({ plan, fy });
  const keys = periods.map((p) => p.key);

  const [members, obligations] = await Promise.all([
    ChamaMembership.find({ chama_id: chamaId, status: 'active' })
      .populate('user_id', 'name phone')
      .sort({ payout_position: 1, joined_at: 1 })
      .lean(),
    ContributionObligation.find({ plan_id: plan._id, period_key: { $in: keys }, status: { $ne: 'cancelled' } }).lean(),
  ]);

  const byMember = new Map();
  for (const ob of obligations) {
    const id = String(ob.participant_id);
    if (!byMember.has(id)) byMember.set(id, {});
    byMember.get(id)[ob.period_key] = {
      obligation_id: ob._id,
      status: ob.status,
      expected: asNumber(ob.expected_amount),
      paid: asNumber(ob.paid_amount),
      advance: asNumber(ob.advance_amount),
      carried_out: asNumber(ob.carried_out_amount),
      due_date: ob.due_date,
    };
  }

  const rows = members.map((m) => {
    const cells = byMember.get(String(m._id)) || {};
    let outstanding = 0;
    let paid = 0;
    for (const period of periods) {
      const cell = cells[period.key];
      if (!cell) continue;
      paid += cell.paid;
      if (timingState(period, now) !== 'upcoming') outstanding += Math.max(0, cell.expected - cell.paid);
    }
    return {
      membership_id: m._id,
      name: m.user_id?.name || 'Member',
      phone: m.user_id?.phone || null,
      role: m.role,
      cells,
      paid_total: paid,
      outstanding_total: outstanding,
    };
  });

  return {
    plan: planHeader(plan),
    financial_year: yearView(fy),
    periods: periods.map((p) => ({
      key: p.key,
      label: p.label,
      due_date: p.due_date,
      state: timingState(p, now),
    })),
    rows,
  };
};

// ============================================================================
// 7b. MEMBER READ MODEL
// ============================================================================

const obligationState = (ob, plan, now) => {
  const expected = D(ob.expected_amount);
  const paid = D(ob.paid_amount || 0);
  if (ob.status === 'waived') return 'waived';
  if (paid.greaterThanOrEqualTo(expected)) {
    return D(ob.advance_amount || 0).greaterThanOrEqualTo(expected) ? 'prepaid' : 'paid';
  }
  const graceMs = (Number(plan?.schedule?.grace_days) || 0) * DAY_MS;
  const due = new Date(ob.due_date);
  if (now < new Date(ob.period_start)) return 'upcoming';
  if (now <= due) return 'open';
  if (now.getTime() <= due.getTime() + graceMs) return 'due';
  return 'overdue';
};

const itemMessage = (item, monthLabel) => {
  switch (item.state) {
    case 'paid':
      return item.carried_out > 0
        ? `Paid in full. ${kes(item.carried_out)} extra was carried forward as an advance.`
        : 'Paid in full - this contribution is closed for the month.';
    case 'prepaid':
      return `Covered in advance (${kes(item.advance_in)} paid earlier).`;
    case 'waived':
      return 'Waived by leadership.';
    case 'overdue':
      return `Overdue - ${kes(item.outstanding)} still to pay.`;
    case 'due':
      return `Due now - ${kes(item.outstanding)} to pay (grace period).`;
    case 'open':
      return item.paid > 0
        ? `Part-paid: ${kes(item.outstanding)} left before ${dayLabel(item.due_date)}.`
        : `${kes(item.outstanding)} due by ${dayLabel(item.due_date)}.`;
    default:
      return item.advance_in > 0
        ? `Advance payment: ${kes(item.advance_in)} already paid for ${monthLabel}.`
        : `Opens ${dayLabel(item.period_start)}.`;
  }
};

const SEVERITY = { overdue: 4, due: 3, open: 2, upcoming: 1, paid: 0, prepaid: 0, waived: 0 };

export const getMemberCalendar = async ({ chamaId, membership, yearId = null, now = new Date() }) => {
  const fy = await resolveYearForView(chamaId, yearId, now);
  const empty = {
    financial_year: yearView(fy),
    plans: [],
    months: [],
    reminders: [],
    advance: [],
    summary: { outstanding: 0, overdue: 0, paid_this_year: 0, advance_held: 0, months_closed: 0 },
    generated_at: now,
  };
  if (!fy) return { ...empty, needs_financial_year: true };

  const plans = await ContributionPlan.find({
    owner_type: 'Chama',
    owner_id: chamaId,
    status: 'active',
    'schedule.aligned_to_calendar': true,
  });
  if (!plans.length) return empty;
  const planById = new Map(plans.map((p) => [String(p._id), p]));

  const obligations = await ContributionObligation.find({
    plan_id: { $in: plans.map((p) => p._id) },
    participant_id: membership._id,
    period_key: { $ne: null },
    period_start: { $lte: fy.end_date },
    period_end: { $gte: fy.start_date },
    status: { $ne: 'cancelled' },
  }).sort({ period_start: 1 });

  const payments = obligations.length
    ? await ContributionPayment.find({
        obligation_id: { $in: obligations.map((o) => o._id) },
        status: 'completed',
      })
        .sort({ paid_at: 1 })
        .lean()
    : [];
  const paymentsByObligation = new Map();
  for (const pay of payments) {
    const id = String(pay.obligation_id);
    if (!paymentsByObligation.has(id)) paymentsByObligation.set(id, []);
    paymentsByObligation.get(id).push({
      id: pay._id,
      amount: asNumber(pay.amount),
      method: pay.payment_method,
      reference: pay.reference,
      paid_at: pay.paid_at || pay.completed_at,
    });
  }

  const have = new Set(obligations.map((o) => `${o.plan_id}|${o.period_key}`));
  const keyLabel = (key) => monthLabelOfIndex(parseMonthKey(key).index);

  // Build items from real obligations.
  const items = obligations.map((ob) => {
    const plan = planById.get(String(ob.plan_id));
    const state = obligationState(ob, plan, now);
    const expected = asNumber(ob.expected_amount);
    const paid = asNumber(ob.paid_amount);
    const carriedTo = ob.carried_to_obligation_id
      ? obligations.find((o) => String(o._id) === String(ob.carried_to_obligation_id))
      : null;
    const item = {
      plan_id: ob.plan_id,
      plan_name: plan?.name || 'Contribution',
      category: plan ? inferCategory(plan) : 'other',
      obligation_id: ob._id,
      period_key: ob.period_key,
      period_start: ob.period_start,
      due_date: ob.due_date,
      state,
      status: ob.status,
      expected,
      paid,
      outstanding: Math.max(0, expected - paid),
      advance_in: asNumber(ob.advance_amount),
      advance_sources: (ob.advance_sources || []).map((src) => ({
        period_key: src.period_key,
        period_label: src.period_key ? keyLabel(src.period_key) : null,
        amount: asNumber(src.amount),
        credited_at: src.credited_at,
      })),
      carried_out: asNumber(ob.carried_out_amount),
      carried_to_label: carriedTo ? keyLabel(carriedTo.period_key) : null,
      unallocated_credit: asNumber(ob.unallocated_credit),
      paid_at: ob.paid_at,
      closed_at: ob.closed_at,
      payments: paymentsByObligation.get(String(ob._id)) || [],
    };
    item.message = itemMessage(item, keyLabel(ob.period_key));
    return item;
  });

  // Placeholders: opened periods the job hasn't materialised yet, plus the next one coming.
  for (const plan of plans) {
    const amount = planAmount(plan);
    if (!amount) continue;
    const periods = periodsForPlan({ plan, fy });
    const nextUnopened = periods.find((p) => p.start > now);
    for (const period of periods) {
      const opened = period.start <= now;
      if (!opened && period !== nextUnopened) continue;
      if (have.has(`${plan._id}|${period.key}`)) continue;
      const state = timingState(period, now);
      const item = {
        plan_id: plan._id,
        plan_name: plan.name,
        category: inferCategory(plan),
        obligation_id: null,
        period_key: period.key,
        period_start: period.start,
        due_date: period.due_date,
        state,
        status: 'pending',
        expected: asNumber(amount),
        paid: 0,
        outstanding: asNumber(amount),
        advance_in: 0,
        advance_sources: [],
        carried_out: 0,
        carried_to_label: null,
        unallocated_credit: 0,
        paid_at: null,
        closed_at: null,
        payments: [],
      };
      item.message = itemMessage(item, period.label);
      items.push(item);
    }
  }

  // Group into months.
  const byKey = new Map();
  for (const item of items) {
    if (!byKey.has(item.period_key)) byKey.set(item.period_key, []);
    byKey.get(item.period_key).push(item);
  }

  const months = [...byKey.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => {
      const parsed = parseMonthKey(key);
      const start = monthStartOfIndex(parsed.index);
      const label = keyLabel(key);
      const expected = list.reduce((s, i) => s + i.expected, 0);
      const paid = list.reduce((s, i) => s + i.paid, 0);
      const advanceIn = list.reduce((s, i) => s + i.advance_in, 0);
      const carriedOut = list.reduce((s, i) => s + i.carried_out, 0);
      const settled = list.every((i) => ['paid', 'prepaid', 'waived'].includes(i.state));
      const isFuture = start > now;
      const state = list.reduce((worst, i) => (SEVERITY[i.state] > SEVERITY[worst] ? i.state : worst), 'paid');

      let message;
      if (settled && !isFuture && list.some((i) => i.state === 'paid')) {
        message = `🎉 ${label} is closed - every contribution paid in full. Well done!`;
        if (carriedOut > 0) message += ` ${kes(carriedOut)} extra went forward as an advance.`;
      } else if (settled && isFuture) {
        message = `Advance payment: ${kes(advanceIn)} already paid for ${label}. Records for this month start on ${dayLabel(start)}.`;
      } else if (isFuture && advanceIn > 0) {
        message = `Advance payment: ${kes(advanceIn)} already paid toward ${label}. Records for this month start on ${dayLabel(start)}.`;
      } else if (isFuture) {
        message = `Opens on ${dayLabel(start)}.`;
      } else if (settled) {
        message = `${label} is fully covered.`;
      } else {
        const owed = list.reduce((s, i) => s + i.outstanding, 0);
        message = `${kes(owed)} still to pay for ${label}.`;
      }

      return {
        key,
        label,
        start,
        state: settled ? (isFuture ? 'prepaid' : 'closed') : state,
        is_current: monthKeyOfDate(now) === key,
        is_future: isFuture,
        expected,
        paid,
        outstanding: list.reduce((s, i) => s + i.outstanding, 0),
        advance_in: advanceIn,
        carried_out: carriedOut,
        all_paid: settled,
        message,
        items: list.sort((a, b) => a.plan_name.localeCompare(b.plan_name)),
      };
    });

  // Reminders: everything unpaid whose month has opened, oldest problems first.
  const reminders = items
    .filter((i) => i.obligation_id !== null || i.state !== 'upcoming')
    .filter((i) => ['overdue', 'due', 'open'].includes(i.state) && i.outstanding > 0)
    .map((i) => {
      const plan = planById.get(String(i.plan_id));
      const lead = (Number(plan?.schedule?.reminder_days_before) || 0) * DAY_MS;
      const dueMs = new Date(i.due_date).getTime();
      const monthLabel = keyLabel(i.period_key);
      const isPrevious = new Date(i.period_start).getTime() < monthStartOfIndex(monthIndexOf(now)).getTime();
      const daysLate = Math.max(0, Math.floor((now.getTime() - dueMs) / DAY_MS));
      const daysLeft = Math.max(0, Math.ceil((dueMs - now.getTime()) / DAY_MS));
      return {
        plan_id: i.plan_id,
        plan_name: i.plan_name,
        period_key: i.period_key,
        period_label: monthLabel,
        kind: i.state === 'open' ? 'upcoming' : i.state,
        is_previous_month: isPrevious,
        outstanding: i.outstanding,
        due_date: i.due_date,
        days_late: daysLate,
        days_left: daysLeft,
        show: i.state !== 'open' || dueMs - now.getTime() <= Math.max(lead, 3 * DAY_MS),
        message:
          i.state === 'overdue'
            ? isPrevious
              ? `You did not clear ${i.plan_name} for ${monthLabel}: ${kes(i.outstanding)} is still owed (${daysLate} day${daysLate === 1 ? '' : 's'} late).`
              : `${i.plan_name} for ${monthLabel} is overdue: ${kes(i.outstanding)} still owed.`
            : i.state === 'due'
            ? `${i.plan_name} for ${monthLabel} is due now: ${kes(i.outstanding)}.`
            : `${i.plan_name} for ${monthLabel}: ${kes(i.outstanding)} due in ${daysLeft} day${daysLeft === 1 ? '' : 's'} (${dayLabel(i.due_date)}).`,
      };
    })
    .filter((r) => r.show)
    .sort(
      (a, b) =>
        SEVERITY[b.kind === 'upcoming' ? 'open' : b.kind] - SEVERITY[a.kind === 'upcoming' ? 'open' : a.kind] ||
        new Date(a.due_date) - new Date(b.due_date)
    );

  const advance = items
    .filter((i) => i.advance_in > 0 && new Date(i.period_start) > now)
    .map((i) => ({
      plan_name: i.plan_name,
      period_key: i.period_key,
      period_label: keyLabel(i.period_key),
      amount: i.advance_in,
      starts_on: i.period_start,
      sources: i.advance_sources,
    }));

  const currentItems = items.filter((i) => new Date(i.period_start) <= now);
  const summary = {
    outstanding: currentItems.filter((i) => ['overdue', 'due', 'open'].includes(i.state)).reduce((s, i) => s + i.outstanding, 0),
    overdue: currentItems.filter((i) => i.state === 'overdue').reduce((s, i) => s + i.outstanding, 0),
    paid_this_year: items.reduce((s, i) => s + i.paid, 0),
    advance_held: advance.reduce((s, a) => s + a.amount, 0),
    months_closed: months.filter((m) => m.state === 'closed').length,
  };

  return {
    financial_year: yearView(fy),
    plans: plans.map((p) => ({ ...planHeader(p), timing_note: timingNote(p, fy) })),
    months,
    reminders,
    advance,
    summary,
    generated_at: now,
  };
};

/** One plain-English line for the member's timings card: "MGR starts in March, due by the 5th". */
const timingNote = (plan, fy) => {
  const s = scheduleView(plan);
  const cadence = cadenceOf(plan);
  const startLabel = plan.start_date ? monthLabelOfIndex(monthIndexOf(plan.start_date)) : null;
  const endLabel = plan.end_date ? monthLabelOfIndex(monthIndexOf(plan.end_date)) : null;
  const every = cadence === 'monthly' ? 'every month' : cadence === 'quarterly' ? 'every quarter' : 'once a year';
  const parts = [`Paid ${every}, due by day ${s.due_day}`];
  if (s.grace_days) parts.push(`${s.grace_days}-day grace`);
  if (startLabel) parts.push(`starts ${startLabel}`);
  if (endLabel) parts.push(`ends ${endLabel}`);
  return parts.join(' · ');
};

export default {
  PLAN_CATEGORIES,
  inferCategory,
  generateObligationsForPlan,
  sweepOverdue,
  runCalendarForChama,
  applyCarryForward,
  sendRemindersForPlan,
  sendClosedNotifications,
  scheduleClosedNotification,
  getOrCreateCurrentObligation,
  configureSchedule,
  createScheduledPlan,
  financialYearPresets,
  getLeadershipOverview,
  getPlanGrid,
  getMemberCalendar,
};