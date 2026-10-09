// ============================================================================
// FINANCIAL-YEAR PERIOD HELPERS (pure - no database)
// ============================================================================
//
// A closed year covers [start_date, min(end_date, closed_at)]. The closed_at
// cap matters for years closed EARLY (end_date still in the future): without
// it, closing a year in September would freeze posting until its nominal
// December end_date.

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

export const asObjectIdString = (value) => {
  if (!value) return null;
  const raw = typeof value === 'object' && value._id ? value._id : value;
  const text = String(raw);
  return OBJECT_ID.test(text) ? text : null;
};

export const yearEffectiveEnd = (year) => {
  const end = new Date(year.end_date);
  if (year.status === 'closed' && year.closed_at) {
    const closedAt = new Date(year.closed_at);
    if (closedAt < end) return closedAt;
  }
  return end;
};

export const yearsOverlap = (a, b) =>
  new Date(a.start_date) <= yearEffectiveEnd(b) && new Date(b.start_date) <= yearEffectiveEnd(a);

// Mongo filter for "a closed year containing `date`".
export const closedYearFilter = (chamaId, date) => ({
  chama_id: chamaId,
  status: 'closed',
  start_date: { $lte: date },
  end_date: { $gte: date },
  $or: [{ closed_at: null }, { closed_at: { $gte: date } }],
});
