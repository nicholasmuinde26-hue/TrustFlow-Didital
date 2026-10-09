import mongoose from 'mongoose';
import ContributionPlan from '../../models/ContributionPlan.js';
import ContributionObligation from '../../models/ContributionObligation.js';
import ContributionPayment from '../../models/ContributionPayment.js';
import AppError from '../../utils/AppError.js';
import { listYears, resolveYearForView } from './financialYear.service.js';
import {
  parseMonthKey,
  monthStartOfIndex,
  monthKeyOfDate,
  monthKeyOfIndex,
  monthLabelOfIndex,
  monthIndexOf,
  monthIndexesBetween,
} from '../../models/Calendarperiods.js';
import { behaviorMeta, behaviorFromLegacy } from '../../constants/contributionBehavior.constants.js';

/**
 * ============================================================================
 * CONTRIBUTIONS DASHBOARD + MEMBER MONTH VIEW
 * ============================================================================
 *
 * Two read models that treat every contribution the chama runs as an equal:
 * no plan is special-cased by name or type. Create a new contribution and it
 * appears here, with figures, the moment it exists.
 *
 *   getContributionDashboard  leadership: every plan, one month, with figures
 *   getMemberMonthView        member: my rows for one month + a year matrix
 *
 * "Month" means the month a period BELONGS to (an obligation whose period
 * overlaps the month), so monthly plans line up exactly, a quarterly plan
 * shows in each month its quarter covers, and rolling weekly plans show every
 * obligation falling due in the month.
 * ============================================================================
 */

const num = (v) => Number(v?.toString?.() ?? v ?? 0) || 0;
const round2 = (v) => Math.round(v * 100) / 100;
const pct = (paid, expected) => (expected > 0 ? Math.min(100, Math.round((paid / expected) * 100)) : null);
const effectiveBehavior = (plan) => plan.behavior || behaviorFromLegacy(plan);

export const resolveMonth = (key, now) => {
  const k = key || monthKeyOfDate(now);
  const parsed = parseMonthKey(k);
  if (!parsed) throw new AppError('Month must look like 2026-09.', 400);
  const start = monthStartOfIndex(parsed.index);
  const end = monthStartOfIndex(parsed.index + 1);
  const currentKey = monthKeyOfDate(now);
  return {
    key: k,
    label: monthLabelOfIndex(parsed.index),
    index: parsed.index,
    start,
    end,
    is_current: k === currentKey,
    is_future: start > now,
  };
};

/** The months to offer in the toggle: the financial year, else the last 12 months. */
export const monthOptions = (fy, now, selected) => {
  const currentIndex = monthIndexOf(now);
  let indexes;
  if (fy?.start_date && fy?.end_date) {
    indexes = monthIndexesBetween(fy.start_date, fy.end_date);
  } else {
    indexes = Array.from({ length: 12 }, (_, i) => currentIndex - 11 + i);
  }
  if (!indexes.includes(selected.index)) indexes = [...indexes, selected.index].sort((a, b) => a - b);
  return indexes.map((i) => ({
    key: monthKeyOfIndex(i),
    label: monthLabelOfIndex(i),
    is_current: i === currentIndex,
    is_future: i > currentIndex,
  }));
};

export const fyView = (fy) =>
  fy && { id: fy._id, label: fy.label, start_date: fy.start_date, end_date: fy.end_date, status: fy.status };

export const plansForMonth = (chamaId, month, statuses = ['active', 'paused', 'completed']) =>
  ContributionPlan.find({
    owner_type: 'Chama',
    owner_id: chamaId,
    status: { $in: statuses },
    start_date: { $lt: month.end },
    $or: [{ end_date: null }, { end_date: { $gte: month.start } }],
  })
    .sort({ 'display.sort_order': 1, createdAt: 1 })
    .lean();

export const monthObligationMatch = (planIds, month) => ({
  plan_id: { $in: planIds },
  status: { $ne: 'cancelled' },
  $or: [
    { period_start: { $lt: month.end }, period_end: { $gt: month.start } },
    { period_start: null, due_date: { $gte: month.start, $lt: month.end } },
  ],
});

export const planCore = (plan) => {
  const behavior = effectiveBehavior(plan);
  return {
    id: plan._id,
    name: plan.name,
    description: plan.description || '',
    behavior,
    behavior_label: behaviorMeta(behavior).label,
    display: plan.display || { color: null, icon: null, sort_order: 0 },
    status: plan.status,
    frequency: plan.frequency,
    contribution_type: plan.contribution_type,
    amount: plan.amount ? plan.amount.toString() : null,
    is_system_plan: Boolean(plan.system_key),
  };
};

// ---------------------------------------------------------------------------
// LEADERSHIP DASHBOARD
// ---------------------------------------------------------------------------

export const getContributionDashboard = async ({
  chamaId,
  month = null,
  yearId = null,
  statuses = undefined,
  now = new Date(),
}) => {
  const m = resolveMonth(month, now);
  const fy = await resolveYearForView(chamaId, yearId, now);
  const years = await listYears(chamaId);
  const plans = await plansForMonth(chamaId, m, statuses);
  const planIds = plans.map((p) => p._id);

  const base = {
    month: { key: m.key, label: m.label, start: m.start, end: m.end, is_current: m.is_current, is_future: m.is_future },
    months: monthOptions(fy, now, m),
    financial_year: fyView(fy),
    years: years.map(fyView),
    generated_at: now,
  };
  if (!planIds.length) {
    return {
      ...base,
      plans: [],
      by_behavior: [],
      totals: { expected: 0, paid: 0, outstanding: 0, collected_in_month: 0, percent_collected: null, overdue_members: 0, plans: 0 },
    };
  }

  const expectedExpr = { $cond: [{ $eq: ['$status', 'waived'] }, 0, { $toDouble: '$expected_amount' }] };
  const paidExpr = { $toDouble: '$paid_amount' };

  const [obligationRows, paymentRows] = await Promise.all([
    ContributionObligation.aggregate([
      { $match: monthObligationMatch(planIds, m) },
      {
        $group: {
          _id: '$plan_id',
          expected: { $sum: expectedExpr },
          // Paid is capped at what was expected so one overpaying member cannot
          // hide someone else's shortfall; the excess is reported as overpaid.
          paid: { $sum: { $min: [paidExpr, expectedExpr] } },
          overpaid: { $sum: { $max: [0, { $subtract: [paidExpr, expectedExpr] }] } },
          outstanding: { $sum: { $max: [0, { $subtract: [expectedExpr, paidExpr] }] } },
          participants: { $addToSet: '$participant_id' },
          paid_count: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
          partial_count: { $sum: { $cond: [{ $eq: ['$status', 'partially_paid'] }, 1, 0] } },
          overdue_count: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] } },
          pending_count: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          waived_count: { $sum: { $cond: [{ $eq: ['$status', 'waived'] }, 1, 0] } },
          next_due: { $min: '$due_date' },
        },
      },
    ]),
    ContributionPayment.aggregate([
      { $match: { plan_id: { $in: planIds }, status: 'completed', paid_at: { $gte: m.start, $lt: m.end } } },
      { $group: { _id: '$plan_id', total: { $sum: { $toDouble: '$amount' } }, count: { $sum: 1 } } },
    ]),
  ]);
  const obByPlan = new Map(obligationRows.map((r) => [String(r._id), r]));
  const payByPlan = new Map(paymentRows.map((r) => [String(r._id), r]));

  const planViews = plans.map((plan) => {
    const ob = obByPlan.get(String(plan._id));
    const pay = payByPlan.get(String(plan._id));
    const expected = round2(ob?.expected ?? 0);
    const paid = round2(ob?.paid ?? 0);
    return {
      ...planCore(plan),
      has_obligations: Boolean(ob),
      expected,
      paid,
      outstanding: round2(ob?.outstanding ?? 0),
      overpaid: round2(ob?.overpaid ?? 0),
      collected_in_month: round2(pay?.total ?? 0),
      payments_in_month: pay?.count ?? 0,
      percent_collected: pct(paid, expected),
      members: {
        total: ob?.participants?.length ?? 0,
        paid: ob?.paid_count ?? 0,
        partial: ob?.partial_count ?? 0,
        pending: ob?.pending_count ?? 0,
        overdue: ob?.overdue_count ?? 0,
        waived: ob?.waived_count ?? 0,
      },
      next_due: ob?.next_due ?? null,
    };
  });

  const sum = (key) => round2(planViews.reduce((a, p) => a + p[key], 0));
  const totalsExpected = sum('expected');
  const totalsPaid = sum('paid');

  const groups = new Map();
  for (const p of planViews) {
    const g = groups.get(p.behavior) || { behavior: p.behavior, label: p.behavior_label, plans: 0, expected: 0, paid: 0, outstanding: 0 };
    g.plans += 1;
    g.expected = round2(g.expected + p.expected);
    g.paid = round2(g.paid + p.paid);
    g.outstanding = round2(g.outstanding + p.outstanding);
    groups.set(p.behavior, g);
  }

  return {
    ...base,
    plans: planViews,
    by_behavior: [...groups.values()],
    totals: {
      expected: totalsExpected,
      paid: totalsPaid,
      outstanding: sum('outstanding'),
      collected_in_month: sum('collected_in_month'),
      percent_collected: pct(totalsPaid, totalsExpected),
      overdue_members: planViews.reduce((a, p) => a + p.members.overdue, 0),
      plans: planViews.length,
    },
  };
};

// ---------------------------------------------------------------------------
// MEMBER MONTH VIEW
// ---------------------------------------------------------------------------

const rowState = (ob) => {
  if (ob.status === 'waived') return 'waived';
  if (ob.status === 'paid') return 'paid';
  if (ob.status === 'overdue') return 'overdue';
  if (ob.status === 'partially_paid') return 'partial';
  return 'pending';
};

export const cellStatus = (expected, paid, statuses) => {
  if (statuses.length && statuses.every((s) => s === 'waived')) return 'waived';
  if (expected > 0 && paid >= expected) return 'paid';
  if (statuses.includes('overdue')) return 'overdue';
  if (paid > 0) return 'partial';
  return 'pending';
};

export const getMemberMonthView = async ({ chamaId, membership, month = null, yearId = null, now = new Date() }) => {
  const m = resolveMonth(month, now);
  const fy = await resolveYearForView(chamaId, yearId, now);
  const participantId = membership._id;

  const base = {
    month: { key: m.key, label: m.label, start: m.start, end: m.end, is_current: m.is_current, is_future: m.is_future },
    months: monthOptions(fy, now, m),
    financial_year: fyView(fy),
    generated_at: now,
  };

  // ---- this month ----
  const plans = await plansForMonth(chamaId, m);
  const planIds = plans.map((p) => p._id);
  const planById = new Map(plans.map((p) => [String(p._id), p]));

  const obligations = planIds.length
    ? await ContributionObligation.find({ ...monthObligationMatch(planIds, m), participant_id: participantId }).sort({ due_date: 1 }).lean()
    : [];

  const payments = obligations.length
    ? await ContributionPayment.find({ obligation_id: { $in: obligations.map((o) => o._id) }, status: 'completed' })
        .sort({ paid_at: 1 })
        .lean()
    : [];
  const payByOb = new Map();
  for (const p of payments) {
    const k = String(p.obligation_id);
    if (!payByOb.has(k)) payByOb.set(k, []);
    payByOb.get(k).push({
      id: p._id,
      amount: num(p.amount),
      method: p.payment_method,
      reference: p.reference,
      paid_at: p.paid_at,
    });
  }

  const items = obligations.map((ob) => {
    const plan = planById.get(String(ob.plan_id));
    const expected = ob.status === 'waived' ? 0 : num(ob.expected_amount);
    const paid = num(ob.paid_amount);
    return {
      ...planCore(plan),
      plan_id: ob.plan_id,
      obligation_id: ob._id,
      period_key: ob.period_key || null,
      due_date: ob.due_date,
      status: ob.status,
      state: rowState(ob),
      expected: round2(expected),
      paid: round2(paid),
      outstanding: round2(Math.max(0, expected - paid)),
      advance_in: round2(num(ob.advance_amount)),
      carried_out: round2(num(ob.carried_out_amount)),
      paid_at: ob.paid_at || null,
      payments: payByOb.get(String(ob._id)) || [],
    };
  });

  const totals = {
    expected: round2(items.reduce((a, i) => a + i.expected, 0)),
    paid: round2(items.reduce((a, i) => a + i.paid, 0)),
    outstanding: round2(items.reduce((a, i) => a + i.outstanding, 0)),
    overdue: items.filter((i) => i.state === 'overdue').length,
    contributions: items.length,
  };

  // ---- year matrix: every month x every contribution ----
  const windowStart = fy?.start_date ? new Date(fy.start_date) : monthStartOfIndex(monthIndexOf(now) - 11);
  const windowEnd = fy?.end_date ? new Date(fy.end_date) : monthStartOfIndex(monthIndexOf(now) + 1);

  const yearObs = await ContributionObligation.find({
    participant_id: participantId,
    status: { $ne: 'cancelled' },
    $or: [
      { period_start: { $lte: windowEnd }, period_end: { $gte: windowStart } },
      { period_start: null, due_date: { $gte: windowStart, $lte: windowEnd } },
    ],
  }).lean();

  const yearPlanIds = [...new Set(yearObs.map((o) => String(o.plan_id)))];
  const yearPlans = yearPlanIds.length
    ? await ContributionPlan.find({ _id: { $in: yearPlanIds }, owner_type: 'Chama', owner_id: chamaId }).lean()
    : [];
  const yearPlanById = new Map(yearPlans.map((p) => [String(p._id), p]));

  const matrixPlans = new Map();
  for (const ob of yearObs) {
    const plan = yearPlanById.get(String(ob.plan_id));
    if (!plan) continue; // not this chama's plan
    const key = ob.period_key || monthKeyOfDate(ob.period_start || ob.due_date);
    let row = matrixPlans.get(String(plan._id));
    if (!row) {
      row = { ...planCore(plan), plan_id: plan._id, cells: {}, totals: { expected: 0, paid: 0 } };
      matrixPlans.set(String(plan._id), row);
    }
    const cell = row.cells[key] || { expected: 0, paid: 0, statuses: [] };
    cell.expected += ob.status === 'waived' ? 0 : num(ob.expected_amount);
    cell.paid += num(ob.paid_amount);
    cell.statuses.push(ob.status);
    row.cells[key] = cell;
  }
  const matrixRows = [...matrixPlans.values()].map((row) => {
    const cells = {};
    for (const [key, c] of Object.entries(row.cells)) {
      cells[key] = { expected: round2(c.expected), paid: round2(c.paid), status: cellStatus(c.expected, c.paid, c.statuses) };
      row.totals.expected += c.expected;
      row.totals.paid += c.paid;
    }
    return { ...row, cells, totals: { expected: round2(row.totals.expected), paid: round2(row.totals.paid) } };
  });

  return {
    ...base,
    items,
    totals,
    matrix: { months: base.months, plans: matrixRows },
  };
};