import mongoose from 'mongoose';
import ChamaFinancialYear from '../../models/Chamafinancialyear.js';
import YearEndClose from '../../models/YearEndClose.js';
import YearOpeningBalance from '../../models/YearOpeningBalance.js';
import AppError from '../../utils/AppError.js';
import { toScaled, fromScaled } from './yearEnd.calc.js';
import { RUN_STATES, SETTLEMENTS } from './yearEnd.constants.js';
import { loadSnapshotRows, verifyStoredSnapshot } from './yearEnd.snapshot.service.js';

const { Decimal128 } = mongoose.Types;

/** The year that follows `year` (first one starting after it ends), if any. */
export const findNextYear = (chamaId, year) =>
  ChamaFinancialYear.findOne({
    chama_id: chamaId,
    start_date: { $gt: year.end_date },
  }).sort({ start_date: 1 });

/**
 * Seed `targetYear`'s opening balances from the most recent SEALED close that
 * ended before it began. Only accounts whose settlement is `retained` carry;
 * cleared and distributed accounts start the year at zero.
 *
 * Safe to call repeatedly: existing rows are verified, never overwritten. The
 * source snapshot is re-hashed first, so a tampered snapshot cannot seed money.
 */
export const seedOpeningBalances = async ({ chamaId, targetYear }) => {
  const source = await YearEndClose.findOne({
    chama_id: chamaId,
    state: RUN_STATES.SEALED,
    period_end: { $lt: targetYear.start_date },
  }).sort({ period_end: -1 });
  if (!source) return { seeded: 0, source: null };

  const sourceYear = await ChamaFinancialYear.findById(source.year_id);
  const check = await verifyStoredSnapshot({ close: source, year: sourceYear });
  if (!check.ok) {
    throw new AppError(
      'The sealed year-end snapshot no longer matches its sealed hash. Opening balances were not seeded.',
      409
    );
  }

  const carrying = check.rows.filter(
    (r) => r.settlement === SETTLEMENTS.RETAINED && r.carry_forward !== 0n
  );

  const existing = await YearOpeningBalance.find({ year_id: targetYear._id }).lean();
  const existingByAccount = new Map(existing.map((e) => [String(e.account_id), e]));

  const toInsert = [];
  for (const row of carrying) {
    const prior = existingByAccount.get(row.account_id);
    if (prior) {
      if (toScaled(prior.amount) !== row.carry_forward) {
        throw new AppError(
          `Opening balance for account ${row.account_code || row.account_id} already exists with a different amount.`,
          409
        );
      }
      continue;
    }
    toInsert.push({
      chama_id: chamaId,
      year_id: targetYear._id,
      account_id: row.account_id,
      amount: Decimal128.fromString(fromScaled(row.carry_forward)),
      source_year_id: source.year_id,
      source_close_id: source._id,
      source_snapshot_hash: source.snapshot_hash,
    });
  }
  if (toInsert.length) await YearOpeningBalance.insertMany(toInsert);
  return { seeded: toInsert.length, source: source._id };
};

export const getOpeningBalances = (chamaId, yearId) =>
  YearOpeningBalance.find({ chama_id: chamaId, year_id: yearId }).lean();

export { loadSnapshotRows };
