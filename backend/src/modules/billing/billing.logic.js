import {
  ALLOWED_MONTHS,
  ANNUAL_FREE_MONTHS,
  CHANGE_WINDOW_DAYS,
  FREE_PLAN,
  GRACE_DAYS,
  READ_ONLY_WRITE_ALLOWLIST,
} from '../../constants/billing.constants.js';

/**
 * Pure billing rules - no database, no HTTP - so the parts that are easy to
 * get subtly wrong (dates, grace, proration, churn) can be unit-tested.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const addDays = (date, days) => new Date(new Date(date).getTime() + days * DAY_MS);

// Calendar-month addition that clamps the day (31 Jan + 1 month = 28/29 Feb).
export const addMonths = (date, months) => {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
};

export const startOfMonthUtc = (date) => {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};

/**
 * Where a subscription stands right now, derived from dates only.
 *   state: free | trial | active | grace | read_only
 */
export function computeAccess(sub, now = new Date()) {
  if (!sub) return { state: 'read_only', access_until: null, grace_until: null, days_left: 0, grace_days_left: 0 };

  if (sub.plan_code === FREE_PLAN && sub.status === 'active') {
    return { state: 'free', access_until: null, grace_until: null, days_left: null, grace_days_left: null };
  }

  const until = sub.status === 'trialing' ? sub.trial_ends_at : sub.current_period_end;
  if (!until) {
    return { state: 'active', access_until: null, grace_until: null, days_left: null, grace_days_left: null };
  }

  const untilDate = new Date(until);
  const graceUntil = addDays(untilDate, GRACE_DAYS);
  const t = new Date(now).getTime();

  if (t <= untilDate.getTime()) {
    return {
      state: sub.status === 'trialing' ? 'trial' : 'active',
      access_until: untilDate,
      grace_until: graceUntil,
      days_left: Math.max(0, Math.ceil((untilDate.getTime() - t) / DAY_MS)),
      grace_days_left: GRACE_DAYS,
    };
  }
  if (t <= graceUntil.getTime()) {
    return {
      state: 'grace',
      access_until: untilDate,
      grace_until: graceUntil,
      days_left: 0,
      grace_days_left: Math.max(0, Math.ceil((graceUntil.getTime() - t) / DAY_MS)),
    };
  }
  return { state: 'read_only', access_until: untilDate, grace_until: graceUntil, days_left: 0, grace_days_left: 0 };
}

/**
 * Decide whether one request may proceed. Returns null to allow, or
 * { status, code, message } to block.
 *   - reads are always allowed (history is never held hostage)
 *   - read_only blocks every write except the allowlist
 *   - a module outside the plan can still be read but not written to
 */
export function evaluateRequest({ method, url, access, plan, moduleKey }) {
  if (SAFE_METHODS.has(String(method || '').toUpperCase())) return null;

  const path = String(url || '').split('?')[0];
  if (READ_ONLY_WRITE_ALLOWLIST.some((re) => re.test(path))) return null;

  if (access?.state === 'read_only') {
    return {
      status: 402,
      code: 'SUBSCRIPTION_REQUIRED',
      message: 'This chama\'s subscription has lapsed, so it is read-only. All records stay available. Renew the plan or switch to Free to make changes.',
    };
  }

  if (plan && moduleKey && Array.isArray(plan.modules) && !plan.modules.includes(moduleKey)) {
    return {
      status: 402,
      code: 'PLAN_UPGRADE_REQUIRED',
      message: `This feature is not included in the ${plan.name} plan. Existing records stay visible; upgrade to add new ones.`,
    };
  }
  return null;
}

const priceOf = (plan) => Math.max(0, Number(plan?.price_monthly) || 0);

/** Unused value of the current plan, credited when moving up to a dearer one. */
export function proratedCredit({ currentPlan, periodEnd, now = new Date() }) {
  if (!currentPlan || !periodEnd) return 0;
  const remainingMs = new Date(periodEnd).getTime() - new Date(now).getTime();
  if (remainingMs <= 0) return 0;
  const remainingDays = Math.min(30, remainingMs / DAY_MS);
  return Math.max(0, Math.min(priceOf(currentPlan), Math.floor((priceOf(currentPlan) * remainingDays) / 30)));
}

/** base = price for the months (12 months bills 10); amount = base - credit. */
export function priceInvoice({ plan, months, credit = 0 }) {
  if (!ALLOWED_MONTHS.includes(months)) throw new Error(`months must be one of ${ALLOWED_MONTHS.join(', ')}`);
  const billedMonths = months === 12 ? 12 - ANNUAL_FREE_MONTHS : months;
  const base = priceOf(plan) * billedMonths;
  // STK Push only accepts whole shillings, so round any decimal price up.
  const amount = Math.ceil(Math.max(0, base - Math.max(0, credit)));
  return { base_amount: base, credit, amount };
}

/** True when moving to `target` would lower the plan while a paid period remains. */
export function isBlockedDowngrade({ currentPlan, targetPlan, access }) {
  if (!currentPlan || !targetPlan) return false;
  if (priceOf(targetPlan) >= priceOf(currentPlan)) return false;
  return access?.state === 'active' && access.days_left > CHANGE_WINDOW_DAYS;
}

/** When a payment lands, where the new paid period starts. */
export function nextPeriodStart({ sub, invoicePlanCode, now = new Date() }) {
  const t = new Date(now);
  if (sub?.status === 'trialing' && sub.trial_ends_at && new Date(sub.trial_ends_at) > t) {
    return new Date(sub.trial_ends_at); // never charge for time still in the trial
  }
  if (
    sub?.status === 'active' && sub.plan_code === invoicePlanCode &&
    sub.current_period_end && new Date(sub.current_period_end) > t
  ) {
    return new Date(sub.current_period_end); // early renewal stacks on the end
  }
  return t;
}

// ---------------------------------------------------------------------------
// Revenue metrics
// ---------------------------------------------------------------------------

const monthlyEquivalent = (inv) => (Number(inv.base_amount) || 0) / Math.max(1, Number(inv.months) || 1);

// The invoice a chama is "on" at a moment: the latest-starting one covering it.
// With `prepaid`, a chama that has already PAID for a period that starts later
// (typically a payment made during the free trial, or a renewal paid early) also
// counts as paying, so a fresh payment shows up straight away instead of only
// once its period begins. A period that has started always wins over a prepaid one.
function coveringInvoices(invoices, at, { prepaid = false } = {}) {
  const t = new Date(at).getTime();
  const byChama = new Map();
  const upcoming = new Map();
  for (const inv of invoices) {
    if (!inv.period_start || !inv.period_end) continue;
    const s = new Date(inv.period_start).getTime();
    const e = new Date(inv.period_end).getTime();
    const key = String(inv.chama_id);
    if (s <= t && t < e) {
      const prev = byChama.get(key);
      if (!prev || new Date(prev.period_start).getTime() < s) byChama.set(key, inv);
    } else if (prepaid && s > t && inv.paid_at && new Date(inv.paid_at).getTime() <= t) {
      const prev = upcoming.get(key);
      if (!prev || new Date(prev.period_start).getTime() > s) upcoming.set(key, inv); // the soonest one
    }
  }
  for (const [key, inv] of upcoming) if (!byChama.has(key)) byChama.set(key, inv);
  return byChama;
}

const round = (n) => Math.round(n * 100) / 100;

/**
 * invoices: PAID invoices only. subscriptions: all. totalChamas: all chamas.
 * Churn in a month = groups paying on the 1st that are not paying at the next
 * boundary (the 1st of the next month, or `now` for the current month).
 */
export function computeRevenueMetrics({ invoices = [], subscriptions = [], totalChamas = 0, now = new Date(), months = 6 }) {
  const nowDate = new Date(now);
  const rows = [];
  const thisMonth = startOfMonthUtc(nowDate);

  for (let i = months - 1; i >= 0; i--) {
    const start = addMonths(thisMonth, -i);
    const nextStart = addMonths(start, 1);
    const partial = nextStart > nowDate;
    const end = partial ? nowDate : nextStart;

    const atStart = coveringInvoices(invoices, start);
    const atEnd = coveringInvoices(invoices, end, { prepaid: partial });

    // A finished month reports where it started; the month still running reports
    // where it stands now, so a payment made today is visible today.
    const shown = partial ? atEnd : atStart;
    let mrr = 0;
    for (const inv of shown.values()) mrr += monthlyEquivalent(inv);

    let churned = 0;
    for (const key of atStart.keys()) if (!atEnd.has(key)) churned += 1;
    let added = 0;
    for (const key of atEnd.keys()) if (!atStart.has(key)) added += 1;

    const collected = invoices
      .filter((inv) => inv.paid_at && new Date(inv.paid_at) >= start && new Date(inv.paid_at) < nextStart)
      .reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);

    rows.push({
      month: start.toISOString().slice(0, 7),
      partial,
      mrr: round(mrr),
      paying_groups: shown.size,
      new_paying: added,
      churned,
      churn_rate: atStart.size ? round((churned / atStart.size) * 100) : 0,
      collected: round(collected),
    });
  }

  const nowCover = coveringInvoices(invoices, nowDate, { prepaid: true });
  let mrrNow = 0;
  const byPlan = {};
  for (const inv of nowCover.values()) {
    const m = monthlyEquivalent(inv);
    mrrNow += m;
    byPlan[inv.plan_code] = byPlan[inv.plan_code] || { groups: 0, mrr: 0 };
    byPlan[inv.plan_code].groups += 1;
    byPlan[inv.plan_code].mrr = round(byPlan[inv.plan_code].mrr + m);
  }

  const states = { trial: 0, active: 0, grace: 0, read_only: 0, free: 0 };
  for (const sub of subscriptions) {
    const s = computeAccess(sub, nowDate).state;
    states[s] = (states[s] || 0) + 1;
  }

  const everPaid = new Set(invoices.map((inv) => String(inv.chama_id))).size;
  const paying = nowCover.size;

  return {
    generated_at: nowDate.toISOString(),
    current: {
      mrr: round(mrrNow),
      arr: round(mrrNow * 12),
      paying_groups: paying,
      total_groups: totalChamas,
      arpu_paying: paying ? round(mrrNow / paying) : 0,
      arpu_all_groups: totalChamas ? round(mrrNow / totalChamas) : 0,
      ever_paid_groups: everPaid,
      paid_share_pct: subscriptions.length ? round((everPaid / subscriptions.length) * 100) : 0,
      states,
      by_plan: byPlan,
    },
    months: rows,
  };
}