import mongoose from 'mongoose';
import FinancialAccount from '../../models/FinancialAccount.js';
import FinancialTransaction from '../../models/FinancialTransaction.js';
import LedgerEntry from '../../models/LedgerEntry.js';
import accountingService from './accounting/accounting.service.js';
import financeTransactionService from './financeTransaction.service.js';
import {
  FUND_SCOPES,
  PROFIT_WALLET_PAYABLE_CODE,
  POOLED_ACCOUNT_BY_BUSINESS_FUND,
  isBusinessFundAccount,
} from './accounting/businessFunds.constants.js';

/**
 * Moves business and property money that was posted into the pooled chama accounts
 * (before the business fund existed) into the business fund.
 *
 *   preview(chamaId)           what would move, nothing written
 *   apply(chamaId, userId)     marks the business accounts and posts one balanced
 *                              journal per pooled account (DR BIZ_x, CR pooled x)
 *
 * No past entry is edited or deleted. Idempotent: amounts moved by an earlier run are
 * subtracted, so a second run posts nothing. Used by the dashboard banner and by
 * scripts/separateBusinessFunds.js.
 */

const toNum = (d) => Number(d?.toString?.() ?? d ?? 0);
const round2 = (n) => Math.round(n * 100) / 100;

const sumEntries = async (match) => {
  const rows = await LedgerEntry.aggregate([
    { $match: match },
    { $group: { _id: { a: '$account_id', t: '$entry_type' }, total: { $sum: { $toDecimal: '$amount' } } } },
  ]);
  return rows.map((r) => ({ account_id: String(r._id.a), entry_type: r._id.t, total: toNum(r.total) }));
};

export async function previewSeparation(chamaId) {
  const ownerOid = new mongoose.Types.ObjectId(String(chamaId));
  const all = await FinancialAccount.find({ owner_type: 'Chama', owner_id: ownerOid }).select('account_code fund_scope').lean();

  const businessAccounts = all.filter(isBusinessFundAccount);
  // Only the per-asset and payable accounts mark historic business activity; the BIZ_
  // accounts themselves only ever receive new, already-separated postings.
  const legacyMarkers = businessAccounts.filter((a) => /^(ASI_|ASE_)/.test(a.account_code) || a.account_code === PROFIT_WALLET_PAYABLE_CODE);
  const accountsToMark = legacyMarkers.filter((a) => a.fund_scope !== FUND_SCOPES.BUSINESS);
  const pooled = all.filter((a) => Object.values(POOLED_ACCOUNT_BY_BUSINESS_FUND).includes(a.account_code));
  const result = { accountsToMark: accountsToMark.map((a) => a._id), moves: [], pending: 0 };
  if (!legacyMarkers.length || !pooled.length) return result;

  const codeByPooledId = new Map(pooled.map((a) => [String(a._id), a.account_code]));
  const pooledIds = pooled.map((a) => a._id);
  const base = { owner_type: 'Chama', owner_id: ownerOid, status: 'posted' };

  const bizTxIds = await LedgerEntry.distinct('transaction_id', { ...base, account_id: { $in: legacyMarkers.map((a) => a._id) } });
  const netByCode = {};
  if (bizTxIds.length) {
    for (const e of await sumEntries({ ...base, transaction_id: { $in: bizTxIds }, account_id: { $in: pooledIds } })) {
      const code = codeByPooledId.get(e.account_id);
      netByCode[code] = (netByCode[code] ?? 0) + (e.entry_type === 'debit' ? e.total : -e.total);
    }
  }

  // A reclass journal's ledger entries are written and balances applied at post time, but the
  // parent transaction used to be left 'pending' (nothing marked it posted). Filtering on
  // 'posted' alone therefore never saw earlier moves, so every click moved the money again.
  // Count both; failed / cancelled / reversed transactions are excluded.
  const priorTx = await FinancialTransaction.find({ owner_type: 'Chama', owner_id: ownerOid, transaction_type: 'business_funds_reclass', status: { $in: ['pending', 'posted'] } }).select('_id').lean();
  const movedByCode = {};
  if (priorTx.length) {
    for (const e of await sumEntries({ ...base, transaction_id: { $in: priorTx.map((t) => t._id) }, account_id: { $in: pooledIds } })) {
      const code = codeByPooledId.get(e.account_id);
      movedByCode[code] = (movedByCode[code] ?? 0) + (e.entry_type === 'credit' ? e.total : -e.total);
    }
  }

  for (const [fundCode, pooledCode] of Object.entries(POOLED_ACCOUNT_BY_BUSINESS_FUND)) {
    const remaining = round2((netByCode[pooledCode] ?? 0) - (movedByCode[pooledCode] ?? 0));
    if (Math.abs(remaining) < 0.005) continue;
    result.moves.push({ fundAccountCode: fundCode, pooledAccountCode: pooledCode, direction: remaining > 0 ? 'to_business' : 'to_pooled', amount: Math.abs(remaining), signed: remaining });
    result.pending += remaining;
  }
  result.pending = round2(result.pending);
  return result;
}

// Two overlapping requests (double click, two officials) would both read the same preview and
// both post the move. One apply per chama at a time.
const applying = new Set();

export async function applySeparation(chamaId, userId) {
  if (!userId) throw new Error('A user id is required to post the separation');
  const lockKey = String(chamaId);
  if (applying.has(lockKey)) throw new Error('A business fund separation is already running. Please wait a moment and refresh.');
  applying.add(lockKey);
  try {
    return await runApply(chamaId, userId);
  } finally {
    applying.delete(lockKey);
  }
}

async function runApply(chamaId, userId) {
  const ownerOid = new mongoose.Types.ObjectId(String(chamaId));
  const plan = await previewSeparation(chamaId);

  if (plan.accountsToMark.length) {
    await FinancialAccount.updateMany({ _id: { $in: plan.accountsToMark } }, { $set: { fund_scope: FUND_SCOPES.BUSINESS } });
  }
  let posted = 0;
  for (const move of plan.moves) {
    const result = await accountingService.post({
      referenceType: 'BUSINESS_FUNDS_RECLASS',
      transactionType: 'business_funds_reclass',
      source_type: 'BusinessFundsReclass',
      source_id: new mongoose.Types.ObjectId(),
      owner_type: 'Chama',
      owner_id: ownerOid,
      chamaId: ownerOid,
      fundAccountCode: move.fundAccountCode,
      direction: move.direction,
      amount: move.amount,
      currency: 'KES',
      recordedBy: userId,
      created_by: userId,
      description: `Move business and property money out of ${move.pooledAccountCode} into ${move.fundAccountCode}`,
    });
    // accountingService.post leaves the transaction 'pending'; mark it posted so it is not
    // reported as an open transaction and is recognised as already moved.
    await financeTransactionService.markCompleted(result.transactionId);
    posted += 1;
  }

  // Earlier runs left their reclass transactions 'pending' even though the journals were posted
  // and the balances applied. Mark those posted too.
  await FinancialTransaction.updateMany(
    { owner_type: 'Chama', owner_id: ownerOid, transaction_type: 'business_funds_reclass', status: 'pending' },
    { $set: { status: 'posted', posted_at: new Date() } }
  );

  return { ...plan, journalsPosted: posted, applied: true };
}