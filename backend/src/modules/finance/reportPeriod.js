import AppError from '../../utils/AppError.js';

// ============================================================================
// REPORT PERIOD PARSING (pure - no database)
// ============================================================================
//
// One place that turns the `from` / `to` / `asAtDate` query values into the
// [from, to] window a report runs over.
//
//   - A date-only string ("2025-12-31") means the whole LOCAL day: `from`
//     starts at 00:00:00.000, `to` ends at 23:59:59.999. (new Date("2025-12-31")
//     is UTC midnight, which lands on the wrong day on a server west of UTC, so
//     date-only strings are parsed from their parts instead.)
//   - A full timestamp is used exactly as given. This lets a caller pass a
//     financial year's own start_date / end_date and get the same window the
//     year-end snapshot used.
//   - `to` falls back to `asAtDate` (the old single-date parameter), then to now.
//   - `from` is optional. null means "from the beginning", which is what the
//     reports did before ranges existed.
// ============================================================================

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseOne = (value, edge, label) => {
  if (value === null || value === undefined || value === '') return null;

  let date;
  const text = String(value).trim();
  const m = DATE_ONLY.exec(text);
  if (m) {
    const [, y, mo, d] = m.map(Number);
    date = new Date(y, mo - 1, d);
    // new Date(2025, 1, 31) silently rolls over to March 3rd; reject that.
    if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
      throw new AppError(`${label} is not a real calendar date: ${text}`, 400);
    }
    if (edge === 'end') date.setHours(23, 59, 59, 999);
    else date.setHours(0, 0, 0, 0);
  } else {
    date = new Date(text);
    if (Number.isNaN(date.getTime())) {
      throw new AppError(`${label} is not a valid date: ${text}`, 400);
    }
  }
  return date;
};

export const parseReportPeriod = ({ from = null, to = null, asAtDate = null, now = new Date() } = {}) => {
  const toDate = parseOne(to, 'end', 'to') || parseOne(asAtDate, 'end', 'asAtDate');
  const resolvedTo = toDate || new Date(now);
  if (!toDate) resolvedTo.setHours(23, 59, 59, 999);

  const resolvedFrom = parseOne(from, 'start', 'from');
  if (resolvedFrom && resolvedFrom > resolvedTo) {
    throw new AppError('from must not be after to', 400);
  }
  return { from: resolvedFrom, to: resolvedTo };
};
