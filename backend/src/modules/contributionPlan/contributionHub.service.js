import mongoose from 'mongoose';
import ContributionPlan from '../../models/ContributionPlan.js';
import ContributionObligation from '../../models/ContributionObligation.js';
import ContributionPayment from '../../models/ContributionPayment.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import Chama from '../../models/Chama.js';
import AppError from '../../utils/AppError.js';
import { buildPdf } from '../../utils/simplePdf.js';
import { resolveYearForView } from './financialYear.service.js';
import {
  getContributionDashboard,
  resolveMonth,
  monthOptions,
  fyView,
  plansForMonth,
  monthObligationMatch,
  planCore,
  cellStatus,
} from './contributionDashboard.service.js';
import { buildWidgets } from './contributionWidgets.service.js';

/**
 * ============================================================================
 * CONTRIBUTIONS HUB READ MODELS
 * ============================================================================
 *   getHubDashboard   GET /finance/contribution-dashboard   every active plan
 *   getMonthMatrix    GET /finance/contribution-matrix      members x plans
 *   getStatement      GET /finance/contribution-statement   per member, JSON/CSV/PDF
 *
 * All three sit on the same month/obligation rules as getContributionDashboard
 * so the figures on the hub, the matrix and the statement always agree.
 * ============================================================================
 */

const num = (v) => Number(v?.toString?.() ?? v ?? 0) || 0;
const round2 = (v) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------------------
// HUB DASHBOARD
// ---------------------------------------------------------------------------

/**
 * One card per active plan, in the flat shape the generic PlanCard maps over:
 * expected, collected, outstanding, overdue_count, percent_collected,
 * members_paid / members_total - plus `widgets` for behaviour extras.
 *
 * `collected` is what has been applied to this month's obligations (capped at
 * expected, so one member overpaying cannot mask another's shortfall);
 * `received_in_month` is cash actually received in the month, which can differ
 * when members pay ahead or settle arrears.
 */
export const getHubDashboard = async ({ chamaId, month = null, yearId = null, includeInactive = false, now = new Date() }) => {
  const dash = await getContributionDashboard({
    chamaId,
    month,
    yearId,
    statuses: includeInactive ? undefined : ['active'],
    now,
  });

  const widgets = await buildWidgets({ chamaId, plans: dash.plans.map((p) => ({ _id: p.id, behavior: p.behavior })) });

  const plans = dash.plans.map((p) => ({
    ...p,
    collected: p.paid,
    overdue_count: p.members.overdue,
    members_paid: p.members.paid,
    members_total: p.members.total,
    received_in_month: p.collected_in_month,
    widgets: widgets.get(String(p.id)) || [],
  }));

  return {
    month: dash.month,
    months: dash.months,
    financial_year: dash.financial_year,
    years: dash.years,
    generated_at: dash.generated_at,
    plans,
    by_behavior: dash.by_behavior,
    totals: {
      ...dash.totals,
      collected: dash.totals.paid,
    },
  };
};

// ---------------------------------------------------------------------------
// TREASURER MATRIX: member x contribution, one month
// ---------------------------------------------------------------------------

export const getMonthMatrix = async ({ chamaId, month = null, yearId = null, now = new Date() }) => {
  const m = resolveMonth(month, now);
  const fy = await resolveYearForView(chamaId, yearId, now);
  const plans = await plansForMonth(chamaId, m, ['active']);
  const planIds = plans.map((p) => p._id);

  const [members, obligations] = await Promise.all([
    ChamaMembership.find({ chama_id: chamaId, status: 'active' })
      .populate('user_id', 'name phone')
      .sort({ payout_position: 1, joined_at: 1 })
      .lean(),
    planIds.length ? ContributionObligation.find(monthObligationMatch(planIds, m)).lean() : [],
  ]);

  // participant -> plan -> accumulated cell
  const acc = new Map();
  for (const ob of obligations) {
    const pid = String(ob.participant_id);
    const plid = String(ob.plan_id);
    if (!acc.has(pid)) acc.set(pid, new Map());
    const cells = acc.get(pid);
    const c = cells.get(plid) || { expected: 0, paid: 0, advance: 0, statuses: [], obligation_ids: [], due_date: null };
    c.expected += ob.status === 'waived' ? 0 : num(ob.expected_amount);
    c.paid += num(ob.paid_amount);
    c.advance += num(ob.advance_amount);
    c.statuses.push(ob.status);
    c.obligation_ids.push(ob._id);
    if (!c.due_date || ob.due_date < c.due_date) c.due_date = ob.due_date;
    cells.set(plid, c);
  }

  const columnTotals = new Map(planIds.map((id) => [String(id), { expected: 0, paid: 0, outstanding: 0 }]));

  const rows = members.map((mem) => {
    const cells = {};
    const total = { expected: 0, paid: 0, outstanding: 0 };
    for (const [plid, c] of acc.get(String(mem._id)) || []) {
      const outstanding = Math.max(0, c.expected - c.paid);
      cells[plid] = {
        expected: round2(c.expected),
        paid: round2(c.paid),
        outstanding: round2(outstanding),
        advance: round2(c.advance),
        status: cellStatus(c.expected, c.paid, c.statuses),
        due_date: c.due_date,
        obligation_ids: c.obligation_ids,
      };
      total.expected += c.expected;
      total.paid += Math.min(c.paid, c.expected);
      total.outstanding += outstanding;
      const col = columnTotals.get(plid);
      if (col) {
        col.expected += c.expected;
        col.paid += Math.min(c.paid, c.expected);
        col.outstanding += outstanding;
      }
    }
    return {
      membership_id: mem._id,
      name: mem.user_id?.name || 'Member',
      phone: mem.user_id?.phone || null,
      role: mem.role,
      cells,
      totals: { expected: round2(total.expected), paid: round2(total.paid), outstanding: round2(total.outstanding) },
    };
  });

  const grand = { expected: 0, paid: 0, outstanding: 0 };
  const columns = plans.map((p) => {
    const t = columnTotals.get(String(p._id));
    grand.expected += t.expected;
    grand.paid += t.paid;
    grand.outstanding += t.outstanding;
    return {
      ...planCore(p),
      totals: { expected: round2(t.expected), paid: round2(t.paid), outstanding: round2(t.outstanding) },
    };
  });

  return {
    month: { key: m.key, label: m.label, start: m.start, end: m.end, is_current: m.is_current, is_future: m.is_future },
    months: monthOptions(fy, now, m),
    financial_year: fyView(fy),
    generated_at: now,
    plans: columns,
    rows,
    totals: { expected: round2(grand.expected), paid: round2(grand.paid), outstanding: round2(grand.outstanding) },
  };
};

// ---------------------------------------------------------------------------
// STATEMENTS
// ---------------------------------------------------------------------------

const dateLabel = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const kes = (n) => n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Everything a statement shows, for one member and one month or financial year. */
export const getStatement = async ({ chamaId, membershipId, scope = 'month', month = null, yearId = null, now = new Date() }) => {
  if (!['month', 'year'].includes(scope)) throw new AppError("scope must be 'month' or 'year'.", 400);
  if (!mongoose.Types.ObjectId.isValid(membershipId)) throw new AppError('Invalid member.', 400);

  const member = await ChamaMembership.findOne({ _id: membershipId, chama_id: chamaId })
    .populate('user_id', 'name phone')
    .lean();
  if (!member) throw new AppError('Member not found in this chama.', 404);
  const chama = await Chama.findById(chamaId).select('name').lean();

  let window;
  let periodLabel;
  if (scope === 'month') {
    const m = resolveMonth(month, now);
    window = { start: m.start, end: m.end };
    periodLabel = m.label;
  } else {
    const fy = await resolveYearForView(chamaId, yearId, now);
    if (!fy) throw new AppError('Set the financial year first.', 409);
    window = { start: new Date(fy.start_date), end: new Date(fy.end_date) };
    periodLabel = fy.label || `${dateLabel(fy.start_date)} to ${dateLabel(fy.end_date)}`;
  }

  const obligations = await ContributionObligation.find({
    participant_id: member._id,
    status: { $ne: 'cancelled' },
    $or: [
      { period_start: { $lt: window.end }, period_end: { $gt: window.start } },
      { period_start: null, due_date: { $gte: window.start, $lt: window.end } },
    ],
  })
    .sort({ due_date: 1 })
    .lean();

  const planIds = [...new Set(obligations.map((o) => String(o.plan_id)))];
  const plans = planIds.length
    ? await ContributionPlan.find({ _id: { $in: planIds }, owner_type: 'Chama', owner_id: chamaId }).lean()
    : [];
  const planById = new Map(plans.map((p) => [String(p._id), p]));
  // Only this chama's contributions, whatever the obligation collection holds.
  const owned = obligations.filter((o) => planById.has(String(o.plan_id)));

  const payments = owned.length
    ? await ContributionPayment.find({ obligation_id: { $in: owned.map((o) => o._id) }, status: 'completed' })
        .sort({ paid_at: 1 })
        .lean()
    : [];
  const obById = new Map(owned.map((o) => [String(o._id), o]));

  const summaryMap = new Map();
  for (const ob of owned) {
    const key = String(ob.plan_id);
    const row = summaryMap.get(key) || { plan_id: ob.plan_id, name: planById.get(key).name, expected: 0, paid: 0, periods: 0 };
    row.expected += ob.status === 'waived' ? 0 : num(ob.expected_amount);
    row.paid += num(ob.paid_amount);
    row.periods += 1;
    summaryMap.set(key, row);
  }
  const summary = [...summaryMap.values()].map((r) => ({
    ...r,
    expected: round2(r.expected),
    paid: round2(r.paid),
    balance: round2(Math.max(0, r.expected - r.paid)),
  }));

  const rows = payments.map((p) => {
    const ob = obById.get(String(p.obligation_id));
    return {
      date: p.paid_at,
      contribution: planById.get(String(ob.plan_id)).name,
      period: ob.period_key || '',
      method: p.payment_method || '',
      reference: p.reference || p.external_reference || '',
      amount: round2(num(p.amount)),
    };
  });

  const totals = summary.reduce(
    (a, r) => ({ expected: round2(a.expected + r.expected), paid: round2(a.paid + r.paid), balance: round2(a.balance + r.balance) }),
    { expected: 0, paid: 0, balance: 0 }
  );

  return {
    scope,
    period_label: periodLabel,
    window,
    chama_name: chama?.name || 'Chama',
    member: { id: member._id, name: member.user_id?.name || 'Member', phone: member.user_id?.phone || null, role: member.role },
    generated_at: now,
    summary,
    payments: rows,
    totals,
  };
};

// CSV cells that start with a formula character are prefixed so a spreadsheet
// never executes a member-supplied reference as a formula.
const csvCell = (v) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvLine = (cells) => cells.map(csvCell).join(',');

export const statementToCsv = (st) => {
  const lines = [
    csvLine([st.chama_name]),
    csvLine(['Contribution statement', st.period_label]),
    csvLine(['Member', st.member.name]),
    csvLine(['Generated', dateLabel(st.generated_at)]),
    '',
    csvLine(['Summary']),
    csvLine(['Contribution', 'Expected', 'Paid', 'Balance']),
    ...st.summary.map((r) => csvLine([r.name, r.expected, r.paid, r.balance])),
    csvLine(['Total', st.totals.expected, st.totals.paid, st.totals.balance]),
    '',
    csvLine(['Payments']),
    csvLine(['Date', 'Contribution', 'Period', 'Method', 'Reference', 'Amount']),
    ...st.payments.map((p) => csvLine([dateLabel(p.date), p.contribution, p.period, p.method, p.reference, p.amount])),
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`; // BOM so Excel reads UTF-8 names correctly
};

export const statementToPdf = (st) =>
  buildPdf({
    title: `${st.chama_name}`,
    subtitle: `Contribution statement - ${st.period_label}`,
    meta: [
      ['Member', st.member.name],
      ['Generated', dateLabel(st.generated_at)],
    ],
    footer: `${st.chama_name} - ${st.member.name}`,
    sections: [
      {
        heading: 'Summary',
        columns: [
          { key: 'name', label: 'Contribution', width: 4 },
          { key: 'expected', label: 'Expected (KES)', width: 2, align: 'right' },
          { key: 'paid', label: 'Paid (KES)', width: 2, align: 'right' },
          { key: 'balance', label: 'Balance (KES)', width: 2, align: 'right' },
        ],
        rows: st.summary.map((r) => ({ name: r.name, expected: kes(r.expected), paid: kes(r.paid), balance: kes(r.balance) })),
        totalsRow: { name: 'Total', expected: kes(st.totals.expected), paid: kes(st.totals.paid), balance: kes(st.totals.balance) },
        emptyText: 'No contributions fell in this period.',
      },
      {
        heading: 'Payments',
        columns: [
          { key: 'date', label: 'Date', width: 2 },
          { key: 'contribution', label: 'Contribution', width: 3 },
          { key: 'period', label: 'Period', width: 1.6 },
          { key: 'method', label: 'Method', width: 1.6 },
          { key: 'reference', label: 'Reference', width: 2.4 },
          { key: 'amount', label: 'Amount (KES)', width: 2, align: 'right' },
        ],
        rows: st.payments.map((p) => ({ ...p, date: dateLabel(p.date), amount: kes(p.amount) })),
        emptyText: 'No payments recorded in this period.',
      },
    ],
  });

export const statementFilename = (st, ext) => {
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `statement-${slug(st.member.name)}-${slug(st.period_label)}.${ext}`;
};

export default { getHubDashboard, getMonthMatrix, getStatement, statementToCsv, statementToPdf, statementFilename };
