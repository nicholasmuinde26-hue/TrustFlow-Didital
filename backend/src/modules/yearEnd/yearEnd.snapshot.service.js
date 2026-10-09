import mongoose from 'mongoose';
import FinancialAccount from '../../models/FinancialAccount.js';
import LedgerEntry from '../../models/LedgerEntry.js';
import FinancialTransaction from '../../models/FinancialTransaction.js';
import YearEndClose from '../../models/YearEndClose.js';
import YearEndSnapshot from '../../models/YearEndSnapshot.js';
import YearOpeningBalance from '../../models/YearOpeningBalance.js';
import {
  toScaled, fromScaled, signedEffect, classifyBucket, resolveSettlement,
  buildRow, hashSnapshot, summarizeRows,
} from './yearEnd.calc.js';
import { BUCKETS, RUN_STATES } from './yearEnd.constants.js';

const { Decimal128 } = mongoose.Types;
const OWNER_TYPE = 'Chama';

const ownerMatch = (chamaId) => ({
  owner_type: OWNER_TYPE,
  owner_id: new mongoose.Types.ObjectId(String(chamaId)),
  status: 'posted',
});

const sumByAccountAndSide = async (match) => {
  const grouped = await LedgerEntry.aggregate([
    { $match: match },
    { $group: { _id: { a: '$account_id', t: '$entry_type' }, total: { $sum: '$amount' } } },
  ]);
  return grouped;
};

// Latest sealed close that ended before this year started. Its presence flips
// opening balances from "sum the ledger" to "use what was carried".
export const findPreviousSealedClose = (chamaId, year) =>
  YearEndClose.findOne({
    chama_id: chamaId,
    state: RUN_STATES.SEALED,
    period_end: { $lt: year.start_date },
  }).sort({ period_end: -1 });

// Ledger rows the close cannot be trusted on: a pending transaction dated in
// or before the period means part of the year's money isn't in the ledger yet.
export const countPendingTransactions = (chamaId, year) =>
  FinancialTransaction.countDocuments({
    owner_type: OWNER_TYPE,
    owner_id: chamaId,
    status: 'pending',
    createdAt: { $lte: year.end_date },
  });

/**
 * Compute (never persist) the per-account snapshot for a year.
 * Used both to create the snapshot and to re-verify it at approval time, so
 * both go through exactly the same code.
 */
export const computeSnapshot = async ({ chamaId, year, overrides = {} }) => {
  const accounts = await FinancialAccount.find({ owner_type: OWNER_TYPE, owner_id: chamaId }).lean();

  const previousClose = await findPreviousSealedClose(chamaId, year);
  let seedMap = null;
  if (previousClose) {
    const seeds = await YearOpeningBalance.find({ year_id: year._id }).lean();
    seedMap = new Map(seeds.map((s) => [String(s.account_id), toScaled(s.amount)]));
  }

  const [beforeRaw, allRaw, periodRaw] = await Promise.all([
    sumByAccountAndSide({ ...ownerMatch(chamaId), posted_at: { $lt: year.start_date } }),
    sumByAccountAndSide(ownerMatch(chamaId)),
    LedgerEntry.aggregate([
      { $match: { ...ownerMatch(chamaId), posted_at: { $gte: year.start_date, $lte: year.end_date } } },
      { $lookup: { from: FinancialTransaction.collection.name, localField: 'transaction_id', foreignField: '_id', as: 'tx' } },
      { $group: {
          _id: { a: '$account_id', t: '$entry_type', tx: { $arrayElemAt: ['$tx.transaction_type', 0] } },
          total: { $sum: '$amount' },
      } },
    ]),
  ]);

  const byAccount = new Map();
  const slot = (id) => {
    const k = String(id);
    if (!byAccount.has(k)) byAccount.set(k, { before: 0n, all: 0n, movements: Object.fromEntries(BUCKETS.map((b) => [b, 0n])) });
    return byAccount.get(k);
  };
  const accountById = new Map(accounts.map((a) => [String(a._id), a]));

  for (const g of beforeRaw) {
    const a = accountById.get(String(g._id.a)); if (!a) continue;
    slot(g._id.a).before += signedEffect(a.normal_balance, g._id.t, toScaled(g.total));
  }
  for (const g of allRaw) {
    const a = accountById.get(String(g._id.a)); if (!a) continue;
    slot(g._id.a).all += signedEffect(a.normal_balance, g._id.t, toScaled(g.total));
  }
  for (const g of periodRaw) {
    const a = accountById.get(String(g._id.a)); if (!a) continue;
    const bucket = classifyBucket({ accountType: a.account_type, transactionType: g._id.tx });
    slot(g._id.a).movements[bucket] += signedEffect(a.normal_balance, g._id.t, toScaled(g.total));
  }

  const rows = [];
  let driftAccounts = 0;
  for (const account of accounts) {
    const ledger = slot(account._id);
    const settlement = resolveSettlement(account, overrides);
    const seeded = seedMap ? (seedMap.get(String(account._id)) ?? 0n) : null;
    const row = buildRow({ account, settlement, ledger, seededOpening: seeded });
    const current = toScaled(account.current_balance ?? 0);
    row.current_balance_at_snapshot = current;
    row.drift = current - ledger.all;
    if (row.drift !== 0n) driftAccounts += 1;
    // Skip accounts that never had any activity and carry nothing.
    const idle = row.opening === 0n && row.closing === 0n && row.ledger_closing === 0n
      && BUCKETS.every((b) => row[b] === 0n) && row.current_balance_at_snapshot === 0n;
    if (!idle) rows.push(row);
  }

  const hash = hashSnapshot({
    chamaId, yearId: year._id, startDate: year.start_date, endDate: year.end_date, rows,
  });
  return { rows, hash, summary: summarizeRows(rows), driftAccounts, seeded: Boolean(previousClose) };
};

const dec = (scaled) => Decimal128.fromString(fromScaled(scaled));

export const persistSnapshot = async ({ closeId, chamaId, yearId, rows }) => {
  const docs = rows.map((r) => ({
    close_id: closeId,
    chama_id: chamaId,
    year_id: yearId,
    account_id: r.account_id,
    account_code: r.account_code,
    name: r.name,
    account_type: r.account_type,
    account_category: r.account_category,
    settlement: r.settlement,
    opening: dec(r.opening),
    contributions: dec(r.contributions),
    income: dec(r.income),
    expenses: dec(r.expenses),
    payouts: dec(r.payouts),
    other: dec(r.other),
    closing: dec(r.closing),
    carry_forward: dec(r.carry_forward),
    ledger_closing: dec(r.ledger_closing),
    current_balance_at_snapshot: dec(r.current_balance_at_snapshot),
    drift: dec(r.drift),
  }));
  if (docs.length) await YearEndSnapshot.insertMany(docs);
  return docs.length;
};

// Load stored rows back into the scaled form the calc layer hashes.
export const loadSnapshotRows = async (closeId) => {
  const stored = await YearEndSnapshot.find({ close_id: closeId }).lean();
  return stored.map((r) => ({
    account_id: String(r.account_id),
    account_code: r.account_code ?? null,
    name: r.name,
    account_type: r.account_type,
    account_category: r.account_category,
    settlement: r.settlement,
    opening: toScaled(r.opening),
    contributions: toScaled(r.contributions),
    income: toScaled(r.income),
    expenses: toScaled(r.expenses),
    payouts: toScaled(r.payouts),
    other: toScaled(r.other),
    closing: toScaled(r.closing),
    carry_forward: toScaled(r.carry_forward),
    ledger_closing: toScaled(r.ledger_closing),
  }));
};

// Re-hash what is STORED for a run (detects edits to snapshot rows after the
// fact). This is independent of re-computing from the live ledger.
export const verifyStoredSnapshot = async ({ close, year }) => {
  const rows = await loadSnapshotRows(close._id);
  const hash = hashSnapshot({
    chamaId: close.chama_id, yearId: close.year_id,
    startDate: year.start_date, endDate: year.end_date, rows,
  });
  return { ok: hash === close.snapshot_hash, hash, rows };
};
