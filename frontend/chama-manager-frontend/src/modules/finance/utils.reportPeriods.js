// Shared by the statement pages: turn a period choice into the { from, to } the
// server expects. Dates are local calendar dates (YYYY-MM-DD); toISOString() would
// shift them to UTC and land on the wrong day in the evening in Kenya.

export const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const PERIOD_OPTIONS = ["This Month", "Last Month", "This Year", "Last Year"];

export const periodRange = (label, now = new Date()) => {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (label === "Last Month") return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
  if (label === "This Year") return { from: `${y}-01-01`, to: ymd(now) };
  if (label === "Last Year") return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
  return { from: ymd(new Date(y, m, 1)), to: ymd(now) }; // This Month
};
