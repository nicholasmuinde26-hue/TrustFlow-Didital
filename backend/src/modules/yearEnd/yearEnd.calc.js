// ============================================================================
// YEAR-END CALC (pure - no database, no mongoose)
// ============================================================================
//
// Everything that decides WHAT a snapshot says lives here, so it can be unit
// tested and so the approval-time re-check recomputes with exactly the same
// code path that produced the snapshot.
//
// Money is handled as BigInt at a fixed scale (1e-6) parsed from strings, never
// as floating point. Output amounts are canonical strings with at least 2
// decimals so the snapshot hash is byte-stable.
// ============================================================================

import { stableStringify, sha256Hex } from '../../utils/hashChain.js';
import {
  BUCKETS,
  CONTRIBUTION_TX_TYPES,
  PAYOUT_TX_TYPES,
  SETTLEMENTS,
} from './yearEnd.constants.js';

const SCALE_DIGITS = 6;
const SCALE = 10n ** BigInt(SCALE_DIGITS);

export const toScaled = (value) => {
  if (value === null || value === undefined || value === '') return 0n;
  const raw = typeof value === 'object' && typeof value.toString === 'function'
    ? value.toString()
    : String(value);
  let text = raw.trim();
  // Decimal128 may print exponent form (e.g. "0E-2", "1.5E+3"); expand it.
  const exp = /^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(text);
  if (exp) {
    const [, sgn, w, f = '', e] = exp;
    const digits = w + f;
    const point = w.length + Number(e);
    const padded = point <= 0 ? '0'.repeat(1 - point) + digits : digits.padEnd(point, '0');
    const at = point <= 0 ? 1 : point;
    text = `${sgn}${padded.slice(0, at)}${padded.slice(at) ? '.' + padded.slice(at) : ''}`;
  }
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new Error(`Invalid money value: ${raw}`);
  const [, sign, whole, frac = ''] = match;
  const fracPadded = (frac + '0'.repeat(SCALE_DIGITS)).slice(0, SCALE_DIGITS);
  if (frac.length > SCALE_DIGITS && /[1-9]/.test(frac.slice(SCALE_DIGITS))) {
    throw new Error(`Money value has more than ${SCALE_DIGITS} decimals: ${raw}`);
  }
  const n = BigInt(whole) * SCALE + BigInt(fracPadded);
  return sign === '-' ? -n : n;
};

export const fromScaled = (n) => {
  const negative = n < 0n;
  const abs = negative ? -n : n;
  const whole = abs / SCALE;
  let frac = (abs % SCALE).toString().padStart(SCALE_DIGITS, '0').replace(/0+$/, '');
  if (frac.length < 2) frac = frac.padEnd(2, '0');
  return `${negative ? '-' : ''}${whole}.${frac}`;
};

// Effect of one ledger entry on an account, in that account's normal-balance
// direction: a debit raises a debit-normal account, a credit lowers it, and the
// reverse for credit-normal accounts.
export const signedEffect = (normalBalance, entryType, amountScaled) =>
  entryType === normalBalance ? amountScaled : -amountScaled;

export const classifyBucket = ({ accountType, transactionType }) => {
  if (accountType === 'income') return 'income';
  if (accountType === 'expense') return 'expenses';
  if (CONTRIBUTION_TX_TYPES.includes(transactionType)) return 'contributions';
  if (PAYOUT_TX_TYPES.includes(transactionType)) return 'payouts';
  return 'other';
};

// Default settlement by account; overrides are keyed by account_code or _id.
export const resolveSettlement = (account, overrides = {}) => {
  const override =
    overrides[account.account_code] ?? overrides[String(account._id)] ?? null;
  if (override) {
    if (!Object.values(SETTLEMENTS).includes(override)) {
      throw new Error(`Unknown settlement "${override}" for account ${account.account_code || account._id}`);
    }
    return override;
  }
  return ['income', 'expense'].includes(account.account_type)
    ? SETTLEMENTS.CLEARED
    : SETTLEMENTS.RETAINED;
};

// Build one snapshot row.
//   ledger.before            - signed sum of posted entries before period start
//   ledger.movements[bucket] - signed sum of in-period entries per bucket
//   seededOpening            - carried opening from the previous sealed close,
//                              or null when none exists (first year on the
//                              system: opening comes from the ledger)
export const buildRow = ({ account, settlement, ledger, seededOpening = null }) => {
  const opening = seededOpening !== null ? seededOpening : ledger.before;
  const movements = {};
  let movementTotal = 0n;
  for (const bucket of BUCKETS) {
    movements[bucket] = ledger.movements?.[bucket] ?? 0n;
    movementTotal += movements[bucket];
  }
  const closing = opening + movementTotal;
  const ledgerClosing = ledger.before + movementTotal;
  const carry = settlement === SETTLEMENTS.RETAINED ? closing : 0n;

  return {
    account_id: String(account._id),
    account_code: account.account_code || null,
    name: account.name,
    account_type: account.account_type,
    account_category: account.account_category,
    settlement,
    opening,
    ...movements,
    closing,
    carry_forward: carry,
    ledger_closing: ledgerClosing,
  };
};

const ROW_MONEY_FIELDS = [
  'opening', ...BUCKETS, 'closing', 'carry_forward', 'ledger_closing',
];

export const rowToCanonical = (row) => {
  const out = {
    account_id: row.account_id,
    account_code: row.account_code,
    settlement: row.settlement,
  };
  for (const f of ROW_MONEY_FIELDS) out[f] = fromScaled(toScaled(row[f]));
  return out;
};

export const hashSnapshot = ({ chamaId, yearId, startDate, endDate, rows }) => {
  const sorted = [...rows]
    .map(rowToCanonical)
    .sort((a, b) => a.account_id.localeCompare(b.account_id));
  return sha256Hex(
    stableStringify({
      v: 1,
      chama_id: String(chamaId),
      year_id: String(yearId),
      start: new Date(startDate).toISOString(),
      end: new Date(endDate).toISOString(),
      rows: sorted,
    })
  );
};

export const summarizeRows = (rows) => {
  const totals = { opening: 0n, closing: 0n, carry_forward: 0n };
  for (const b of BUCKETS) totals[b] = 0n;
  let netResult = 0n; // income - expenses on cleared (nominal) accounts
  for (const r of rows) {
    totals.opening += r.opening; totals.closing += r.closing;
    totals.carry_forward += r.carry_forward;
    for (const b of BUCKETS) totals[b] += r[b];
    if (r.account_type === 'income') netResult += r.closing;
    if (r.account_type === 'expense') netResult -= r.closing;
  }
  const out = { net_result: fromScaled(netResult) };
  for (const k of Object.keys(totals)) out[k] = fromScaled(totals[k]);
  return out;
};

// Accounts marked 'distributed' must be empty at close, otherwise the close
// would drop money that was never actually paid out.
export const findUndistributed = (rows) =>
  rows.filter((r) => r.settlement === SETTLEMENTS.DISTRIBUTED && r.closing !== 0n);
