import mongoose from 'mongoose';
import FineShareout from '../../models/FineShareout.js';
import ContributionPayment from '../../models/ContributionPayment.js';
import ContributionPlan from '../../models/ContributionPlan.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import ChamaFine from '../../models/ChamaFine.js';
import AppError from '../../utils/AppError.js';
import { accountingService, creditMemberWallet } from '../finance/index.js';
import { toDecimal } from '../../shared/decimal.js';

const DISBURSEMENT_METHODS = ['cash', 'bank', 'mpesa', 'wallet'];
const decimalText = (value) => value?.toString?.() ?? String(value ?? 0);
const toCents = (value) => BigInt(Math.round(Number(decimalText(value)) * 100));
const fromCents = (value) => (Number(value) / 100).toFixed(2);
const canUseTransactions = () => ['ReplicaSetWithPrimary', 'Sharded'].includes(mongoose.connection?.client?.topology?.description?.type);

async function getFinePlan(chamaId) {
  const plan = await ContributionPlan.findOne({ owner_type: 'Chama', owner_id: chamaId, system_key: 'late_penalties', status: 'active' });
  if (!plan) throw new AppError('No fine contribution plan exists for this Chama yet', 409);
  return plan;
}

async function availablePool(plan, chamaId, asOfDate = new Date()) {
  const [payments, batches] = await Promise.all([
    ContributionPayment.aggregate([
      { $match: { owner_type: 'Chama', owner_id: new mongoose.Types.ObjectId(String(chamaId)), plan_id: plan._id, status: 'completed', $or: [{ paid_at: { $lte: asOfDate } }, { paid_at: null, createdAt: { $lte: asOfDate } }] } },
      { $group: { _id: null, total: { $sum: { $toDecimal: '$amount' } } } },
    ]),
    FineShareout.find({ chama_id: chamaId, status: { $ne: 'cancelled' } }).select('total_amount').lean(),
  ]);
  const collected = toDecimal(payments[0]?.total ?? 0);
  const reserved = batches.reduce((sum, batch) => sum.plus(toDecimal(batch.total_amount || 0)), toDecimal(0));
  const available = collected.minus(reserved);
  return available.greaterThan(0) ? available : toDecimal(0);
}

async function buildItems(chamaId, total, basis) {
  let memberships;
  if (basis === 'fines_paid') {
    const paidByMember = await ChamaFine.aggregate([
      { $match: { chama_id: new mongoose.Types.ObjectId(String(chamaId)), paid_amount: { $gt: 0 } } },
      { $group: { _id: '$member_id', weight: { $sum: '$paid_amount' } } },
      { $sort: { _id: 1 } },
    ]);
    const active = new Set((await ChamaMembership.find({ chama_id: chamaId, status: 'active' }).select('_id').lean()).map((m) => String(m._id)));
    memberships = paidByMember.filter((row) => active.has(String(row._id)));
    if (!memberships.length) throw new AppError('No active members have paid fines to use for this distribution rule', 400);
    const totalWeight = memberships.reduce((sum, row) => sum + Number(row.weight || 0), 0);
    const totalCents = toCents(total);
    let allocated = 0n;
    return memberships.map((row, index) => {
      const cents = index === memberships.length - 1 ? totalCents - allocated : BigInt(Math.floor(Number(totalCents) * Number(row.weight) / totalWeight));
      allocated += cents;
      return { member_id: row._id, amount: fromCents(cents), share_percentage_applied: totalWeight ? Number(row.weight) / totalWeight * 100 : 0, status: 'pending' };
    }).filter((item) => Number(item.amount) > 0);
  }

  memberships = await ChamaMembership.find({ chama_id: chamaId, status: 'active' }).sort({ _id: 1 }).select('_id').lean();
  if (!memberships.length) throw new AppError('No active members are eligible for this share-out', 400);
  const totalCents = toCents(total);
  const base = totalCents / BigInt(memberships.length);
  let remainder = totalCents % BigInt(memberships.length);
  return memberships.map((member) => {
    const cents = base + (remainder-- > 0n ? 1n : 0n);
    return { member_id: member._id, amount: fromCents(cents), share_percentage_applied: 100 / memberships.length, status: 'pending' };
  }).filter((item) => Number(item.amount) > 0);
}

export async function createFineShareout({ chamaId, createdBy, periodLabel = '', distributionBasis = 'equal', asOfDate = null }) {
  if (!['equal', 'fines_paid'].includes(distributionBasis)) throw new AppError('Choose equal sharing or sharing by fines paid', 400);
  const plan = await getFinePlan(chamaId);
  const cutoff = asOfDate ? new Date(asOfDate) : new Date();
  if (Number.isNaN(cutoff.getTime())) throw new AppError('Enter a valid share-out date', 400);
  const total = await availablePool(plan, chamaId, cutoff);
  if (!total.greaterThan(0)) throw new AppError('There are no collected fines available to share out', 400);
  const items = await buildItems(chamaId, total, distributionBasis);
  const batchTotal = items.reduce((sum, item) => sum + toCents(item.amount), 0n);
  return FineShareout.create({
    chama_id: chamaId, contribution_plan_id: plan._id, period_label: periodLabel,
    distribution_basis: distributionBasis, as_of_date: cutoff,
    total_amount: fromCents(batchTotal), currency: plan.currency || 'KES',
    items, status: 'pending_approval', created_by: createdBy,
  });
}

export async function listFineShareouts(chamaId) {
  return FineShareout.find({ chama_id: chamaId }).populate({ path: 'items.member_id', select: 'role user_id', populate: { path: 'user_id', select: 'name' } }).sort({ createdAt: -1 });
}

export async function approveFineShareout({ chamaId, shareoutId, approvedBy, approverMembership }) {
  const session = await mongoose.startSession();
  const useTxn = canUseTransactions();
  try {
    if (useTxn) session.startTransaction();
    const shareout = await FineShareout.findOne({ _id: shareoutId, chama_id: chamaId }).session(session);
    if (!shareout || shareout.status !== 'pending_approval') throw new AppError('Pending fine share-out not found', 404);
    if (approverMembership?.role !== 'chairperson') throw new AppError('Only the chairperson can approve a fine share-out', 403);
    const result = await accountingService.post({
      referenceType: 'FINE_SHAREOUT_OBLIGATION', owner_type: 'Chama', owner_id: chamaId,
      amount: toDecimal(shareout.total_amount), currency: shareout.currency,
      source_type: 'FineShareout', source_id: shareout._id, plan_id: shareout.contribution_plan_id,
      description: `Fine share-out for ${shareout.items.length} members`, created_by: approvedBy, posted_by: approvedBy, session,
    }, session);
    shareout.obligation_transaction_id = result.transactionId; shareout.status = 'approved';
    shareout.approvals.push({ approved_by: approverMembership._id, approved_at: new Date() });
    await shareout.save({ session });
    if (useTxn) await session.commitTransaction();
    return shareout;
  } catch (error) { if (useTxn && session.inTransaction()) await session.abortTransaction(); throw error; }
  finally { await session.endSession(); }
}

export async function payFineShareoutItem({ chamaId, shareoutId, itemId, method, externalReference, postedBy }) {
  if (!DISBURSEMENT_METHODS.includes(method)) throw new AppError('Choose cash, bank, M-Pesa or member wallet', 400);
  const session = await mongoose.startSession(); const useTxn = canUseTransactions();
  try {
    if (useTxn) session.startTransaction();
    const shareout = await FineShareout.findOne({ _id: shareoutId, chama_id: chamaId }).session(session);
    if (!shareout || shareout.status !== 'approved') throw new AppError('Approved fine share-out not found', 404);
    const item = shareout.items.id(itemId);
    if (!item || item.status !== 'pending') throw new AppError('Pending member share not found', 404);
    const result = await accountingService.post({
      referenceType: 'FINE_SHAREOUT_SETTLEMENT', owner_type: 'Chama', owner_id: chamaId,
      amount: toDecimal(item.amount), currency: shareout.currency,
      source_type: 'FineShareout', source_id: shareout._id,
      disbursement_method: method === 'wallet' ? 'mpesa' : method,
      description: `Fine share-out paid to member ${item.member_id}`,
      created_by: postedBy, posted_by: postedBy, session,
    }, session);
    item.status = 'paid'; item.disbursement_method = method; item.external_reference = externalReference || null;
    item.financial_transaction_id = result.transactionId; item.paid_at = new Date();
    if (method === 'wallet') {
      const member = await ChamaMembership.findById(item.member_id).select('user_id').session(session).lean();
      await creditMemberWallet({ userId: member?.user_id, amount: item.amount, sourceType: 'FineShareoutItem', sourceId: item._id, createdBy: postedBy, externalReference: `FINE-SHAREOUT-${shareout._id}-${item._id}`, session });
    }
    if (shareout.items.every((entry) => entry.status === 'paid')) shareout.status = 'completed';
    await shareout.save({ session });
    if (useTxn) await session.commitTransaction();
    return shareout;
  } catch (error) { if (useTxn && session.inTransaction()) await session.abortTransaction(); throw error; }
  finally { await session.endSession(); }
}

// Batch settlements deliberately reuse the single-item accounting path so each
// wallet credit and ledger entry is recorded exactly like an individual payout.
// Failures are isolated per member, allowing the treasurer to retry only those
// items while preserving successful settlements.
export async function payFineShareoutItems({ chamaId, shareoutId, items, itemIds, method, postedBy }) {
  const requestedItems = Array.isArray(items) ? items : (Array.isArray(itemIds) ? itemIds.map((itemId) => ({ item_id: itemId, method })) : []);
  if (!requestedItems.length) throw new AppError('Select at least one pending member share', 400);
  const normalized = requestedItems.map((entry) => ({ itemId: String(entry.item_id), method: entry.method }));
  if (normalized.some((entry) => !DISBURSEMENT_METHODS.includes(entry.method))) throw new AppError('Choose cash, bank, M-Pesa or member wallet for every selected share', 400);
  const ids = [...new Set(normalized.map((entry) => entry.itemId))];
  if (ids.length !== normalized.length) throw new AppError('A member share was selected more than once', 400);
  const shareout = await FineShareout.findOne({ _id: shareoutId, chama_id: chamaId });
  if (!shareout || shareout.status !== 'approved') throw new AppError('Approved fine share-out not found', 404);
  const selected = ids.map((id) => shareout.items.id(id));
  if (selected.some((item) => !item || item.status !== 'pending')) throw new AppError('Every selected share must be pending in this share-out', 409);

  const paid = [];
  const failed = [];
  for (const { itemId, method: itemMethod } of normalized) {
    try {
      await payFineShareoutItem({ chamaId, shareoutId, itemId, method: itemMethod, postedBy });
      paid.push(itemId);
    } catch (error) {
      failed.push({ item_id: itemId, message: error.message || 'Payment failed' });
    }
  }
  return { shareout: await FineShareout.findOne({ _id: shareoutId, chama_id: chamaId }).populate({ path: 'items.member_id', select: 'role user_id', populate: { path: 'user_id', select: 'name' } }), paid, failed };
}

export async function cancelFineShareout({ chamaId, shareoutId, cancelledBy }) {
  const session = await mongoose.startSession(); const useTxn = canUseTransactions();
  try {
    if (useTxn) session.startTransaction();
    const shareout = await FineShareout.findOne({ _id: shareoutId, chama_id: chamaId }).session(session);
    if (!shareout || !['pending_approval', 'approved'].includes(shareout.status)) throw new AppError('This fine share-out cannot be cancelled', 409);
    if (shareout.items.some((item) => item.status === 'paid')) throw new AppError('A share-out with paid items cannot be cancelled', 409);
    if (shareout.status === 'approved') await accountingService.post({
      referenceType: 'FINE_SHAREOUT_CANCELLATION', owner_type: 'Chama', owner_id: chamaId,
      amount: toDecimal(shareout.total_amount), currency: shareout.currency,
      source_type: 'FineShareout', source_id: shareout._id, plan_id: shareout.contribution_plan_id,
      description: 'Fine share-out cancelled', created_by: cancelledBy, posted_by: cancelledBy, session,
    }, session);
    shareout.status = 'cancelled'; shareout.cancelled_at = new Date(); await shareout.save({ session });
    if (useTxn) await session.commitTransaction();
    return shareout;
  } catch (error) { if (useTxn && session.inTransaction()) await session.abortTransaction(); throw error; }
  finally { await session.endSession(); }
}
