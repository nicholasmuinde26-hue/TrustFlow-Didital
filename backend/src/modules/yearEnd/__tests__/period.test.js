import test from 'node:test';
import assert from 'node:assert/strict';
import {
  yearEffectiveEnd, yearsOverlap, closedYearFilter, asObjectIdString,
} from '../yearEnd.period.js';
import {
  assertPeriodOpen, resolvePostingDate, resolveChamaId, PERIOD_CLOSED,
} from '../../finance/accounting/periodGuard.logic.js';

const CHAMA = 'a'.repeat(24);
const d = (s) => new Date(`${s}T00:00:00.000Z`);
const closedYear = (o = {}) => ({
  _id: 'y1', label: 'FY2026', status: 'closed',
  start_date: d('2026-01-01'), end_date: d('2026-12-31'), closed_at: d('2027-01-05'), ...o,
});

// Minimal evaluator for exactly the operators closedYearFilter uses.
const matches = (year, f) => {
  const ok = (v, c) => (c && typeof c === 'object' && !(c instanceof Date) && !Array.isArray(c))
    ? (('$lte' in c ? v <= c.$lte : true) && ('$gte' in c ? v >= c.$gte : true) && ('$ne' in c ? v !== c.$ne : true))
    : v === c;
  if (year.status !== f.status) return false;
  if (!ok(year.start_date, f.start_date) || !ok(year.end_date, f.end_date)) return false;
  return f.$or.some((clause) => Object.entries(clause).every(([k, c]) => ok(year[k] ?? null, c)));
};
const finderFor = (years) => async (filter) => years.find((y) => matches(y, filter)) || null;

test('effective end: normal, early-closed, and non-closed years', () => {
  assert.equal(yearEffectiveEnd(closedYear()).toISOString(), d('2026-12-31').toISOString()); // closed after end
  assert.equal(yearEffectiveEnd(closedYear({ closed_at: d('2026-09-30') })).toISOString(), d('2026-09-30').toISOString());
  assert.equal(yearEffectiveEnd({ status: 'active', start_date: d('2026-01-01'), end_date: d('2026-12-31'), closed_at: null }).toISOString(), d('2026-12-31').toISOString());
});

test('guard rejects a date inside a closed year with PERIOD_CLOSED / 409', async () => {
  const years = [closedYear()];
  await assert.rejects(
    assertPeriodOpen({ context: { owner_type: 'Chama', owner_id: CHAMA, postingDate: d('2026-06-15') }, findClosedYear: finderFor(years) }),
    (e) => e.code === PERIOD_CLOSED && e.statusCode === 409 && /FY2026/.test(e.message) && /2026-06-15/.test(e.message)
  );
});

test('guard allows dates outside closed years, and boundaries are inclusive', async () => {
  const years = [closedYear()];
  const run = (date) => assertPeriodOpen({ context: { owner_type: 'Chama', owner_id: CHAMA, postingDate: date }, findClosedYear: finderFor(years) });
  await run(d('2027-01-06'));                       // after the year: fine
  await run(d('2025-12-31'));                       // before the year: fine
  await assert.rejects(run(d('2026-01-01')));       // first day blocked
  await assert.rejects(run(d('2026-12-31')));       // last day blocked
});

test('year closed early does not freeze the rest of its nominal range', async () => {
  const years = [closedYear({ closed_at: d('2026-09-30') })];
  const run = (date) => assertPeriodOpen({ context: { owner_type: 'Chama', owner_id: CHAMA, postingDate: date }, findClosedYear: finderFor(years) });
  await assert.rejects(run(d('2026-09-30')));
  await run(d('2026-10-01'));
  await run(d('2026-12-15'));
});

test('no explicit date means now; a year that is still open never blocks', async () => {
  const active = { ...closedYear(), status: 'active', closed_at: null };
  const before = Date.now();
  const got = await assertPeriodOpen({ context: { owner_type: 'Chama', owner_id: CHAMA }, findClosedYear: finderFor([active]) });
  assert.ok(got.getTime() >= before);
});

test('non-chama owners and missing/invalid ids are skipped, not blocked', async () => {
  let called = 0;
  const finder = async () => { called += 1; return closedYear(); };
  await assertPeriodOpen({ context: { owner_type: 'ContributionGroup', owner_id: CHAMA }, findClosedYear: finder });
  await assertPeriodOpen({ context: { owner_type: 'Business', owner_id: CHAMA }, findClosedYear: finder });
  await assertPeriodOpen({ context: { owner_type: 'Chama', owner_id: 'not-an-id' }, findClosedYear: finder });
  await assertPeriodOpen({ context: {}, findClosedYear: finder });
  assert.equal(called, 0);
  assert.equal(resolveChamaId({ chama: { _id: CHAMA } }), CHAMA);
  assert.equal(resolveChamaId({ chamaId: CHAMA }), CHAMA);
});

test('invalid posting date is a 400, not a silent "now"', () => {
  assert.throws(() => resolvePostingDate({ postingDate: 'garbage' }), (e) => e.statusCode === 400);
  assert.equal(resolvePostingDate({ posting_date: '2026-03-01' }).toISOString().slice(0, 10), '2026-03-01');
});

test('overlap: adjacent years fine, overlapping rejected, early close frees the tail', () => {
  const fy26 = closedYear({ closed_at: d('2027-01-05') });
  const next = (s, e) => ({ status: 'upcoming', start_date: d(s), end_date: d(e) });
  assert.equal(yearsOverlap(fy26, next('2027-01-01', '2027-12-31')), false);
  assert.equal(yearsOverlap(fy26, next('2026-12-31', '2027-12-30')), true);
  const early = closedYear({ closed_at: d('2026-09-30') });
  assert.equal(yearsOverlap(early, next('2026-10-01', '2027-09-30')), false);
  assert.equal(yearsOverlap(early, next('2026-09-30', '2027-09-30')), true);
});

test('filter and overlap rules agree on every day of an early-closed year', async () => {
  const y = closedYear({ closed_at: d('2026-09-30') });
  for (let t = d('2025-12-25').getTime(); t <= d('2027-01-10').getTime(); t += 86400000) {
    const date = new Date(t);
    const blocked = matches(y, closedYearFilter(CHAMA, date));
    const inRange = date >= y.start_date && date <= yearEffectiveEnd(y);
    assert.equal(blocked, inRange, date.toISOString());
  }
});

test('asObjectIdString', () => {
  assert.equal(asObjectIdString(CHAMA), CHAMA);
  assert.equal(asObjectIdString({ _id: CHAMA }), CHAMA);
  assert.equal(asObjectIdString('x'), null);
  assert.equal(asObjectIdString(null), null);
});
