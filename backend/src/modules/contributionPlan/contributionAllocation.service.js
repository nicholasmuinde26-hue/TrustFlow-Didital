/**
 * ============================================================================
 * CONTRIBUTION ALLOCATION SERVICE
 * ============================================================================
 *
 * ONE payment product - "contribution" - carrying { planId, period_key? }.
 *
 *   period_key given   SPECIFIC MONTH. The money goes to that month of that
 *                      contribution. Anything beyond what the month needs
 *                      flows forward as an advance (carry-forward).
 *
 *   period_key absent  LUMP SUM. The money clears what the member owes on that
 *                      contribution OLDEST FIRST (arrears, then the current
 *                      month). Anything left over flows forward as an advance.
 *
 * A payment is still ONE M-Pesa transaction and ONE ledger posting - the split
 * across months is bookkeeping on the obligations, recorded on the payment in
 * metadata.allocations so statements and receipts can show it.
 *
 * MONEY INVARIANT
 * ---------------
 * applied to months + carried forward + unallocated === the amount paid.
 * Nothing is created or lost (same rule as contributioncalendar.service.js).
 *
 * Two entry points:
 *   previewContributionPayment()  read-only, used before the STK push
 *   applyContributionPayment()    writes, used when the payment settles
 * ============================================================================
 */

import mongoose from 'mongoose';
import ContributionPlan from '../../models/ContributionPlan.js';
import ContributionObligation from '../../models/ContributionObligation.js';
import ContributionPayment from '../../models/ContributionPayment.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import AppError from '../../utils/AppError.js';
import { toDecimal } from '../../shared/decimal.js';
import {
  isCalendarAligned,
  monthKeyOfDate,
  monthLabelOfIndex,
  parseMonthKey,
} from '../../models/Calendarperiods.js';
import {
  applyCarryForward,
  ensureObligationForPeriod,
  getOrCreateCurrentObligation,
  currentPlanPeriod,
  findPlanPeriod,
  futurePeriodsAfter,
  planAmount,
  memberAmountFor,
  scheduleClosedNotification,
} from './contributioncalendar.service.js';

const D = toDecimal;
const money = (decimal) => decimal.toFixed(2);
const num = (value) => Number(value?.toString?.() ?? value ?? 0);
const OPEN_STATUSES = ['pending', 'partially_paid', 'overdue'];

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === 'ReplicaSetWithPrimary' || topology?.description?.type === 'Sharded';
};
const optsOf = (session) => (canUseTransactions() && session ? { session } : {});
const withSession = (query, session) => (canUseTransactions() && session ? query.session(session) : query);

const labelOfKey = (key) => {
  const parsed = parseMonthKey(key);
  return parsed ? monthLabelOfIndex(parsed.index) : key || 'this period';
};

// ---------------------------------------------------------------------------
// Serialise allocations for one member + contribution. Two payments settling at
// the same moment would otherwise both read the same balances and each credit
// the same month. (In-process lock: enough for one Node instance. Running
// several instances needs a database-level lock instead.)
// ---------------------------------------------------------------------------
const locks = new Map();
const withLock = async (key, fn) => {
  const prev = locks.get(key) || Promise.resolve();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const tail = prev.then(() => gate);
  locks.set(key, tail);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === tail) locks.delete(key);
  }
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const loadPlanAndMember = async ({ chamaId, planId, membershipId, session = null }) => {
  if (!mongoose.Types.ObjectId.isValid(planId)) throw new AppError('Choose which contribution you are paying.', 400);
  if (!mongoose.Types.ObjectId.isValid(membershipId)) throw new AppError('Member not found.', 400);

  const plan = await withSession(
    ContributionPlan.findOne({ _id: planId, owner_type: 'Chama', owner_id: chamaId }),
    session
  );
  if (!plan) throw new AppError('Contribution not found in this chama.', 404);
  if (plan.status !== 'active') {
    throw new AppError(`This contribution is ${plan.status} and is not taking payments.`, 409);
  }
  if (plan.contribution_type === 'merry_go_round') {
    throw new AppError('Merry-go-round contributions are paid per round, against the round obligation.', 400);
  }

  const member = await withSession(
    ChamaMembership.findOne({ _id: membershipId, chama_id: chamaId }).select('status role'),
    session
  );
  if (!member) throw new AppError('That member does not belong to this chama.', 404);
  if (member.status !== 'active') throw new AppError('Only an active member can make contribution payments.', 409);

  return { plan, member };
};

// ---------------------------------------------------------------------------
// Planning: which months does this money go to?
// ---------------------------------------------------------------------------

const lineOf = (ob, plan, now) => {
  const expected = D(ob.expected_amount);
  const paid = D(ob.paid_amount || 0);
  const isVirtual = !ob._id;
  const start = ob.period_start ? new Date(ob.period_start) : null;
  const end = ob.period_end ? new Date(ob.period_end) : null;
  let kind = 'current';
  if (end && end <= now) kind = 'arrears';
  else if (start && start > now) kind = 'advance';
  return {
    obligation: isVirtual ? null : ob,
    obligation_id: isVirtual ? null : ob._id,
    period_key: ob.period_key || null,
    label: ob.period_key ? labelOfKey(ob.period_key) : ob.notes || plan.name,
    due_date: ob.due_date || null,
    period_start: start,
    period_end: end,
    expected,
    paid_before: paid,
    outstanding: expected.minus(paid).max(0),
    kind,
    virtual: isVirtual,
  };
};

/** A not-yet-created obligation for a scheduled period, used only for previews. */
const virtualObligation = async ({ plan, membershipId, periodKey }) => {
  const period = await findPlanPeriod(plan, periodKey);
  const base = planAmount(plan);
  if (!period || !base) return null;
  return {
    _id: null,
    period_key: period.key,
    period_start: period.start,
    period_end: period.end,
    due_date: period.due_date,
    expected_amount: money(memberAmountFor(plan, membershipId, period, base)),
    paid_amount: 0,
    status: 'pending',
  };
};

const planAllocation = async ({ plan, membershipId, amount, periodKey = null, now, create, session }) => {
  const total = D(amount);
  if (!total.greaterThan(0)) throw new AppError('Enter an amount greater than zero.', 400);

  // -------------------------------------------------------------- SPECIFIC
  if (periodKey) {
    if (!parseMonthKey(periodKey)) throw new AppError('period_key must look like 2026-09.', 400);

    let ob = await withSession(
      ContributionObligation.findOne({ plan_id: plan._id, participant_id: membershipId, period_key: periodKey }),
      session
    );
    if (!ob) {
      ob = create
        ? await ensureObligationForPeriod({ plan, membershipId, periodKey, session })
        : await virtualObligation({ plan, membershipId, periodKey });
    }
    if (!ob) {
      throw new AppError(`${labelOfKey(periodKey)} is not part of this contribution's schedule for this member.`, 400);
    }
    if (['waived', 'cancelled'].includes(ob.status)) {
      throw new AppError(`${labelOfKey(periodKey)} is ${ob.status}, so it cannot be paid.`, 409);
    }

    const line = lineOf(ob, plan, now);
    if (!line.outstanding.greaterThan(0)) {
      throw new AppError(`${labelOfKey(periodKey)} is already paid in full.`, 409);
    }

    // The whole amount is aimed at this month. Up to what it needs is applied
    // here; any excess flows forward from it (carry-forward).
    const applyHere = line.outstanding.lessThan(total) ? line.outstanding : total;
    return {
      mode: 'specific',
      total,
      applied: [{ ...line, applied: applyHere }],
      remaining: total.minus(applyHere),
      anchor: line,
    };
  }

  // ------------------------------------------------------------- LUMP SUM
  const openDocs = await withSession(
    ContributionObligation.find({
      plan_id: plan._id,
      participant_id: membershipId,
      status: { $in: OPEN_STATUSES },
      $or: [{ period_start: { $lte: now } }, { period_start: null }],
    }).sort({ period_start: 1, due_date: 1, createdAt: 1 }),
    session
  );
  const lines = openDocs.map((ob) => lineOf(ob, plan, now)).filter((l) => l.outstanding.greaterThan(0));

  // The current month must exist so a fully-paid-up member can still pay ahead,
  // and so there is always an anchor for the advance to flow forward from.
  let currentLine = lines.find((l) => l.kind === 'current') || null;
  if (!currentLine && isCalendarAligned(plan)) {
    const period = await currentPlanPeriod(plan, now);
    if (period) {
      let ob = await withSession(
        ContributionObligation.findOne({ plan_id: plan._id, participant_id: membershipId, period_key: period.key }),
        session
      );
      if (!ob) {
        ob = create
          ? await ensureObligationForPeriod({ plan, membershipId, periodKey: period.key, session })
          : await virtualObligation({ plan, membershipId, periodKey: period.key });
      }
      if (ob && !['waived', 'cancelled'].includes(ob.status)) currentLine = lineOf(ob, plan, now);
    }
  }

  let remaining = total;
  const applied = [];
  for (const line of lines) {
    if (!remaining.greaterThan(0)) break;
    const give = line.outstanding.lessThan(remaining) ? line.outstanding : remaining;
    applied.push({ ...line, applied: give });
    remaining = remaining.minus(give);
  }

  const anchor = applied.length ? applied[applied.length - 1] : currentLine;
  if (!anchor) throw new AppError('Nothing is due on this contribution right now.', 409);

  return { mode: 'oldest_first', total, applied, remaining, anchor };
};

// ---------------------------------------------------------------------------
// Preview (read-only)
// ---------------------------------------------------------------------------

/** Walk the future months the advance would land on, without writing anything. */
const simulateAdvance = async ({ plan, membershipId, anchor, remaining }) => {
  const out = [];
  let left = remaining;
  if (!left.greaterThan(0) || !isCalendarAligned(plan) || !planAmount(plan) || !anchor.period_end) {
    return { lines: out, unallocated: left };
  }
  const future = await futurePeriodsAfter(plan, { period_end: anchor.period_end });
  for (const period of future) {
    if (!left.greaterThan(0)) break;
    const existing = await ContributionObligation.findOne({
      plan_id: plan._id,
      participant_id: membershipId,
      period_key: period.key,
    }).lean();
    if (existing && ['waived', 'cancelled'].includes(existing.status)) continue;
    const expected = existing ? D(existing.expected_amount) : memberAmountFor(plan, membershipId, period, planAmount(plan));
    const need = expected.minus(D(existing?.paid_amount || 0));
    if (!need.greaterThan(0)) continue;
    const give = need.lessThan(left) ? need : left;
    out.push({ period_key: period.key, label: labelOfKey(period.key), applied: num(give), kind: 'advance' });
    left = left.minus(give);
  }
  return { lines: out, unallocated: left };
};

const publicLine = (l) => ({
  obligation_id: l.obligation_id,
  period_key: l.period_key,
  label: l.label,
  kind: l.kind,
  due_date: l.due_date,
  expected: num(l.expected),
  paid_before: num(l.paid_before),
  applied: num(l.applied),
  remaining_after: num(l.outstanding.minus(l.applied).max(0)),
});

/**
 * What would this payment do? Nothing is written. Also returns the obligation to
 * anchor the payment on (its first existing month), which may be null when the
 * month does not exist yet.
 */
export const previewContributionPayment = async ({ chamaId, planId, membershipId, amount, periodKey = null, now = new Date() }) => {
  const { plan } = await loadPlanAndMember({ chamaId, planId, membershipId });
  const result = await planAllocation({ plan, membershipId, amount, periodKey, now, create: false });
  const advance = await simulateAdvance({ plan, membershipId, anchor: result.anchor, remaining: result.remaining });

  const firstExisting = [...result.applied, result.anchor].find((l) => l && l.obligation_id) || null;

  return {
    plan: { id: plan._id, name: plan.name },
    mode: result.mode,
    period_key: periodKey,
    amount: num(result.total),
    lines: result.applied.map(publicLine),
    advance: advance.lines,
    unallocated: num(advance.unallocated),
    anchor_obligation_id: firstExisting ? firstExisting.obligation_id : null,
  };
};

// ---------------------------------------------------------------------------
// Apply (settlement)
// ---------------------------------------------------------------------------

/**
 * Called by the FinanceEngine when a contribution payment settles, in place of
 * the old single-obligation markPaid. Idempotent: a payment is applied once.
 *
 * Returns { applied: true, allocations } or { skipped: true }.
 */
export const applyContributionPayment = async ({ paymentId, session = null, now = new Date() }) => {
  const opts = optsOf(session);

  const payment = await ContributionPayment.findById(paymentId, null, opts);
  if (!payment) throw new Error(`applyContributionPayment: payment ${paymentId} not found`);
  if (!payment.plan_id) return { skipped: true, reason: 'no_plan' };

  // Claim the payment so a retry / duplicate event can never credit it twice.
  const claimed = await ContributionPayment.findOneAndUpdate(
    { _id: payment._id, 'metadata.allocation_applied': { $ne: true } },
    { $set: { 'metadata.allocation_applied': true } },
    { returnDocument: 'after', ...opts }
  );
  if (!claimed) return { skipped: true, reason: 'already_applied' };

  const chamaId = payment.owner_id;
  const membershipId = payment.participant_id;
  const periodKey = payment.metadata?.allocation?.period_key || null;
  let progressed = false;

  try {
    return await withLock(`${payment.plan_id}:${membershipId}`, async () => {
      const plan = await withSession(ContributionPlan.findById(payment.plan_id), session);
      if (!plan) throw new Error('Contribution plan not found for payment');

      const result = await planAllocation({
        plan,
        membershipId,
        amount: payment.amount,
        periodKey,
        now,
        create: true,
        session,
      });

      // 1) Months that can be settled directly (specific month, or arrears then current).
      for (const line of result.applied) {
        const ob = line.obligation;
        const newPaid = D(ob.paid_amount || 0).plus(line.applied);
        ob.paid_amount = money(newPaid);
        if (newPaid.greaterThanOrEqualTo(D(ob.expected_amount))) {
          ob.status = 'paid';
          ob.paid_at = now;
          if (ob.period_key) ob.closed_at = now;
        } else {
          ob.status = 'partially_paid';
        }
        // A month paid before it opens is an advance, and is shown as one.
        if (line.kind === 'advance') {
          ob.advance_amount = money(D(ob.advance_amount || 0).plus(line.applied));
          ob.advance_sources.push({
            obligation_id: null,
            period_key: monthKeyOfDate(now),
            amount: money(line.applied),
            credited_at: now,
          });
        }
        await ob.save(opts);
        progressed = true;
      }

      // 2) Whatever is left flows forward from the anchor month as an advance.
      const carryStartedAt = new Date();
      let carried = D(0);
      let unallocated = D(0);
      const advanceLines = [];

      if (result.remaining.greaterThan(0)) {
        const anchor = result.anchor.obligation;
        anchor.paid_amount = money(D(anchor.paid_amount || 0).plus(result.remaining));
        if (D(anchor.paid_amount).greaterThanOrEqualTo(D(anchor.expected_amount))) {
          anchor.status = 'paid';
          anchor.paid_at = anchor.paid_at || now;
          if (anchor.period_key) anchor.closed_at = anchor.closed_at || now;
        }
        await anchor.save(opts);
        progressed = true;

        if (anchor.period_key && isCalendarAligned(plan)) {
          const before = D(anchor.carried_out_amount || 0);
          const after = await applyCarryForward(anchor._id, session);
          carried = D(after.carried_out_amount || 0).minus(before);
          unallocated = result.remaining.minus(carried);

          const targets = await ContributionObligation.find({
            plan_id: plan._id,
            participant_id: membershipId,
            'advance_sources.obligation_id': anchor._id,
          }).lean();
          for (const t of targets) {
            for (const src of t.advance_sources || []) {
              if (String(src.obligation_id) === String(anchor._id) && new Date(src.credited_at) >= carryStartedAt) {
                advanceLines.push({
                  obligation_id: t._id,
                  period_key: t.period_key,
                  label: labelOfKey(t.period_key),
                  applied: num(src.amount),
                  kind: 'advance',
                });
              }
            }
          }
        } else {
          // Not a calendar contribution: nothing to carry into. Keep the credit visible.
          anchor.unallocated_credit = money(D(anchor.unallocated_credit || 0).plus(result.remaining));
          await anchor.save(opts);
          unallocated = result.remaining;
        }
      }

      const allocations = [
        ...result.applied.map((l) => ({
          obligation_id: l.obligation_id || l.obligation?._id,
          period_key: l.period_key,
          label: l.label,
          kind: l.kind,
          applied: num(l.applied),
        })),
        ...advanceLines,
      ];

      // 3) Record the split on the payment, and link it to a month if it had none.
      const anchorId = result.applied[0]?.obligation?._id || result.anchor.obligation?._id || null;
      const $set = {
        'metadata.allocations': allocations,
        'metadata.allocation_summary': {
          mode: result.mode,
          total: num(result.total),
          applied_to_months: num(result.total.minus(result.remaining)),
          carried_forward: num(carried),
          unallocated: num(unallocated),
        },
      };
      if (!payment.obligation_id && anchorId) $set.obligation_id = anchorId;
      await ContributionPayment.updateOne({ _id: payment._id }, { $set }, opts);

      scheduleClosedNotification(chamaId);
      return { applied: true, allocations };
    });
  } catch (err) {
    // Give the payment back for retry only if nothing has been written yet;
    // after a partial write a retry would double-credit, so leave it claimed
    // and flag it for a human.
    if (!progressed) {
      await ContributionPayment.updateOne(
        { _id: payment._id },
        { $set: { 'metadata.allocation_applied': false } },
        opts
      ).catch(() => {});
    } else {
      await ContributionPayment.updateOne(
        { _id: payment._id },
        { $set: { 'metadata.allocation_error': String(err.message || err).slice(0, 300) } },
        opts
      ).catch(() => {});
      console.error(`[contributionAllocation] PARTIAL allocation for payment ${payment._id}:`, err);
    }
    throw err;
  }
};

export default { previewContributionPayment, applyContributionPayment };