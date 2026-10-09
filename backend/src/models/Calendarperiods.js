/**
 * ============================================================================
 * CALENDAR PERIODS
 * ============================================================================
 *
 * Pure date maths for the Contribution Calendar. No database, no Mongoose —
 * everything here is a function of its arguments, which is what makes it safe
 * to unit-test and safe for the job, the leadership grid and the member
 * dashboard to all agree on what "September" means.
 *
 * TIME ZONE
 * ---------
 * Kenya is UTC+3 all year (no daylight saving). "The 1st of the month" must
 * be midnight in Nairobi, not midnight UTC, otherwise a member paying at
 * 01:00 on the 1st is in the previous month for half the system. Every month
 * boundary below is therefore an Africa/Nairobi boundary, expressed as a UTC
 * instant.
 *
 * PERIOD MODEL
 * ------------
 * A period is [start, end) — start inclusive, end exclusive — matching the
 * period_start / period_end convention the existing obligations already use.
 *
 *   monthly    one period per calendar month
 *   quarterly  three months, anchored to the START of the financial year
 *              (a July–June year has quarters Jul–Sep, Oct–Dec, ...)
 *   yearly     one period per financial year
 *
 * Weekly / daily / custom cadences are deliberately not calendar-aligned;
 * they keep their rolling periods.
 * ============================================================================
 */

export const TZ_OFFSET_MS = 3 * 60 * 60 * 1000; // Africa/Nairobi, UTC+3
const DAY_MS = 24 * 60 * 60 * 1000;

export const CADENCE_MONTHS = Object.freeze({
  monthly: 1,
  quarterly: 3,
  yearly: 12,
});

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT = MONTH_NAMES.map((name) => name.slice(0, 3));

// ----------------------------------------------------------------------------
// Month index helpers.  A "month index" is year * 12 + monthZeroBased, which
// turns month arithmetic (including crossing year ends) into plain integers.
// ----------------------------------------------------------------------------

export const eatParts = (date) => {
  const shifted = new Date(new Date(date).getTime() + TZ_OFFSET_MS);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
  };
};

export const monthIndexOf = (date) => {
  const { y, m } = eatParts(date);
  return y * 12 + m;
};

export const yearOfIndex = (index) => Math.floor(index / 12);
export const monthOfIndex = (index) => ((index % 12) + 12) % 12;

/** Start (00:00 Nairobi) of the month at `index`, as a UTC instant. */
export const monthStartOfIndex = (index) =>
  new Date(Date.UTC(yearOfIndex(index), monthOfIndex(index), 1) - TZ_OFFSET_MS);

export const monthKeyOfIndex = (index) =>
  `${yearOfIndex(index)}-${String(monthOfIndex(index) + 1).padStart(2, '0')}`;

export const monthKeyOfDate = (date) => monthKeyOfIndex(monthIndexOf(date));

export const parseMonthKey = (key) => {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(key || ''));
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, index: Number(match[1]) * 12 + Number(match[2]) - 1 };
};

export const daysInMonthOfIndex = (index) =>
  new Date(Date.UTC(yearOfIndex(index), monthOfIndex(index) + 1, 0)).getUTCDate();

/**
 * Due date for a period: the last instant (23:59:59.999 Nairobi) of `dueDay`
 * in the month at `index`. A due day of 31 in February clamps to the 28th/29th
 * rather than spilling into March.
 */
export const dueDateOfIndex = (index, dueDay) => {
  const day = Math.min(Math.max(1, Number(dueDay) || 1), daysInMonthOfIndex(index));
  return new Date(
    Date.UTC(yearOfIndex(index), monthOfIndex(index), day, 23, 59, 59, 999) - TZ_OFFSET_MS
  );
};

export const monthLabelOfIndex = (index) => `${MONTH_NAMES[monthOfIndex(index)]} ${yearOfIndex(index)}`;

// ----------------------------------------------------------------------------
// Financial year helpers
// ----------------------------------------------------------------------------

export const FINANCIAL_YEAR_PRESETS = Object.freeze({
  calendar: { label: 'Calendar year', startMonth: 0, description: 'January – December' },
  government: { label: 'Government year', startMonth: 6, description: 'July – June (Kenya public sector)' },
});

/**
 * Build a year range from a starting month and a length in months.
 * `start` is 00:00 on the 1st; `end` is the last millisecond of the final day,
 * matching how ChamaFinancialYear stores end_date.
 */
export const yearRange = (startYear, startMonthZeroBased, months = 12) => {
  const startIndex = startYear * 12 + startMonthZeroBased;
  return {
    start: monthStartOfIndex(startIndex),
    end: new Date(monthStartOfIndex(startIndex + months).getTime() - 1),
  };
};

/** The year (as start-year) a preset currently puts `now` in. */
export const presetStartYear = (presetKey, now = new Date()) => {
  const preset = FINANCIAL_YEAR_PRESETS[presetKey];
  if (!preset) return null;
  const { y, m } = eatParts(now);
  return m >= preset.startMonth ? y : y - 1;
};

export const financialYearLabel = (start, end) => {
  const s = eatParts(start);
  const e = eatParts(end);
  if (s.y === e.y) return `FY ${s.y}`;
  return `FY ${s.y}/${String(e.y).slice(2)}`;
};

/** Every month index inside [start, end], for drawing calendar columns. */
export const monthIndexesBetween = (start, end) => {
  const first = monthIndexOf(start);
  const last = monthIndexOf(end);
  const out = [];
  for (let i = first; i <= last; i += 1) out.push(i);
  return out;
};

// ----------------------------------------------------------------------------
// Plan -> periods
// ----------------------------------------------------------------------------

const num = (value) => {
  if (value === null || value === undefined) return null;
  const n = Number(value?.toString?.() ?? value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Which calendar cadence a plan follows, or null when it cannot be
 * calendar-aligned. A Merry-Go-Round's cadence is its payout interval (that is
 * what the existing round engine periods by); everything else follows its
 * contribution frequency.
 */
export const cadenceOf = (plan) => {
  const raw =
    plan?.contribution_type === 'merry_go_round'
      ? plan?.merry_go_round?.payout_interval
      : plan?.frequency;
  return Object.prototype.hasOwnProperty.call(CADENCE_MONTHS, raw) ? raw : null;
};

export const isCalendarAligned = (plan) =>
  Boolean(plan?.schedule?.aligned_to_calendar) && cadenceOf(plan) !== null;

const decoratePeriod = ({ firstIndex, step, dueDay, graceDays, cadence }) => {
  const start = monthStartOfIndex(firstIndex);
  const end = monthStartOfIndex(firstIndex + step);
  const due = dueDateOfIndex(firstIndex, dueDay);
  const overdueAfter = new Date(due.getTime() + (Number(graceDays) || 0) * DAY_MS);

  let label = monthLabelOfIndex(firstIndex);
  if (cadence === 'quarterly') {
    const lastIndex = firstIndex + step - 1;
    label = `${MONTH_SHORT[monthOfIndex(firstIndex)]}–${MONTH_SHORT[monthOfIndex(lastIndex)]} ${yearOfIndex(lastIndex)}`;
  } else if (cadence === 'yearly') {
    label = financialYearLabel(start, new Date(end.getTime() - 1));
  }

  return {
    key: monthKeyOfIndex(firstIndex),
    index: firstIndex,
    span: step,
    cadence,
    start,
    end,
    due_date: due,
    overdue_after: overdueAfter,
    label,
  };
};

/**
 * All periods of `plan` that fall inside its window, where the window is the
 * plan's own start/end intersected with the financial year.
 *
 * @param {object}  args.plan
 * @param {object}  args.fy          { start_date, end_date }
 * @param {Date}    [args.upTo]      only periods that have OPENED by this instant
 * @param {object}  [args.scheduleOverride]  evaluate a proposed schedule (preview)
 */
export const periodsForPlan = ({ plan, fy, upTo = null, scheduleOverride = null }) => {
  const cadence = cadenceOf(plan);
  if (!cadence || !fy?.start_date || !fy?.end_date) return [];

  const schedule = { ...(plan.schedule?.toObject?.() ?? plan.schedule ?? {}), ...(scheduleOverride || {}) };
  const step = CADENCE_MONTHS[cadence];
  const dueDay = num(schedule.due_day) ?? 5;
  const graceDays = num(schedule.grace_days) ?? 0;

  const anchor = monthIndexOf(fy.start_date);
  const planStart = plan.start_date ? new Date(plan.start_date) : new Date(fy.start_date);
  const windowStart = planStart > new Date(fy.start_date) ? planStart : new Date(fy.start_date);

  const fyEnd = new Date(fy.end_date);
  const planEnd = plan.end_date ? new Date(plan.end_date) : null;
  const windowEnd = planEnd && planEnd < fyEnd ? planEnd : fyEnd;

  if (windowEnd < windowStart) return [];

  const windowStartIndex = monthIndexOf(windowStart);
  const windowEndIndex = monthIndexOf(windowEnd);

  // First period is the one that CONTAINS the window start.
  let firstIndex = anchor + Math.floor((windowStartIndex - anchor) / step) * step;
  if (firstIndex < anchor) firstIndex = anchor;

  const periods = [];
  for (let index = firstIndex; index <= windowEndIndex; index += step) {
    const period = decoratePeriod({ firstIndex: index, step, dueDay, graceDays, cadence });
    if (upTo && period.start > new Date(upTo)) break;
    periods.push(period);
  }
  return periods;
};

/** The period of `plan` that `now` falls in, or null (before / after the window). */
export const currentPeriodForPlan = ({ plan, fy, now = new Date(), scheduleOverride = null }) => {
  const at = new Date(now);
  return (
    periodsForPlan({ plan, fy, scheduleOverride }).find((p) => p.start <= at && at < p.end) || null
  );
};

/** The period immediately after `period` inside the plan window, or null. */
export const nextPeriodAfter = ({ plan, fy, period, scheduleOverride = null }) =>
  periodsForPlan({ plan, fy, scheduleOverride }).find((p) => p.index === period.index + period.span) || null;

/**
 * Where a period stands right now, from the member's side of the table.
 *   upcoming  hasn't opened yet
 *   open      opened, due date not reached
 *   due       past the due date but still inside the grace window
 *   overdue   past due date + grace
 */
export const timingState = (period, now = new Date()) => {
  const at = new Date(now);
  if (at < period.start) return 'upcoming';
  if (at <= period.due_date) return 'open';
  if (at <= period.overdue_after) return 'due';
  return 'overdue';
};

export const daysBetween = (from, to) => Math.floor((new Date(to) - new Date(from)) / DAY_MS);