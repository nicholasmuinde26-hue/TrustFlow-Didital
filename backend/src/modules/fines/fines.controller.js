import mongoose from 'mongoose';
import Chama from '../../models/Chama.js';
import ChamaFine from '../../models/ChamaFine.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import ContributionObligation from '../../models/ContributionObligation.js';
import ContributionPayment from '../../models/ContributionPayment.js';
import ContributionPlan from '../../models/ContributionPlan.js';
import notificationService from '../../services/notification.service.js';
import AppError from '../../utils/AppError.js';
import { ensurePenaltyPlan, ensurePlanLedgerAccount } from '../contributionPlan/index.js';

async function getContext(workspaceId, userId) {
  if (!mongoose.Types.ObjectId.isValid(workspaceId)) throw new AppError('Invalid workspace ID', 400);
  const chama = await Chama.findById(workspaceId);
  if (!chama) throw new AppError('Fines are only available for Chama workspaces', 404);
  const membership = await ChamaMembership.findOne({ chama_id: workspaceId, user_id: userId, status: 'active' });
  if (!membership) throw new AppError('You are not an active member of this Chama', 403);
  const isOfficial = ['treasurer', 'chairperson'].includes(membership.role);
  return { chama, membership, isOfficial };
}

function fineDto(fine) {
  return {
    id: String(fine._id), memberId: String(fine.member_id?._id || fine.member_id),
    memberName: fine.member_id?.user_id?.name || [fine.member_id?.user_id?.first_name, fine.member_id?.user_id?.last_name].filter(Boolean).join(' ') || 'Member',
    memberPhone: fine.member_id?.user_id?.phone || '',
    reasonType: fine.reason_type, reason: fine.reason, amount: fine.amount,
    dueDate: fine.due_date, status: fine.status, issuedAt: fine.createdAt,
    paidAmount: Number(fine.paid_amount || 0),
    outstanding: Math.max(0, Number(fine.amount || 0) - Number(fine.paid_amount || 0)),
    obligationId: fine.obligation_id ? String(fine.obligation_id) : null,
    reminderCount: fine.reminder_count, lastRemindedAt: fine.last_reminded_at,
  };
}

async function notifyMember({ chamaId, membershipId, fine, reminder = false, sentBy }) {
  try {
    await notificationService.createNotification({
    chamaId,
    recipientMembershipId: membershipId,
    notificationType: 'FINE_APPLIED',
    title: reminder ? 'Fine payment reminder' : 'A fine has been added to your account',
    message: `${reminder ? 'Reminder: ' : ''}${fine.reason} — KES ${Number(fine.amount).toLocaleString()}. Please arrange payment${fine.due_date ? ` by ${new Date(fine.due_date).toLocaleDateString()}` : ''}.`,
    description: reminder ? 'Your Chama leadership sent a reminder about this outstanding fine.' : 'This fine was recorded by your Chama leadership.',
    metadata: { fineId: String(fine._id), amount: fine.amount, reasonType: fine.reason_type, status: fine.status },
    relatedEntityType: 'ChamaFine', relatedEntityId: fine._id,
    actionUrl: `/workspace/${chamaId}/my-chama`, actionText: 'View fine', sentBy,
    });
  } catch (error) {
    // Keep a recorded fine/reminder action successful if a delivery channel
    // is temporarily unavailable. The fine remains visible on the dashboard.
    console.error('[fines] Member notification failed:', error.message);
  }
}

export async function listFines(req, res, next) {
  try {
    const { chama, membership, isOfficial } = await getContext(req.params.workspaceId, req.user._id);
    const finePlan = await ContributionPlan.findOne({ owner_type: 'Chama', owner_id: chama._id, system_key: 'late_penalties' });
    if (finePlan) await ensurePlanLedgerAccount(finePlan, { actorUserId: req.user._id }).catch((error) => console.warn('[fines] Fine ledger reconciliation skipped:', error.message));
    const query = { chama_id: req.params.workspaceId };
    if (!isOfficial) query.member_id = membership._id;
    // Older fines may predate the contribution-obligation integration. Link
    // them lazily so they use the same receipted payment flow as every due.
    const unlinkedFines = await ChamaFine.find({ ...query, status: 'outstanding', $or: [{ obligation_id: null }, { obligation_id: { $exists: false } }] });
    if (unlinkedFines.length) {
      const plan = await ensurePenaltyPlan({ chamaId: chama._id, actorUserId: req.user._id });
      for (const fine of unlinkedFines) {
        const obligation = await ContributionObligation.create({
          plan_id: plan._id, owner_type: 'Chama', owner_id: chama._id,
          participant_type: 'ChamaMembership', participant_id: fine.member_id,
          expected_amount: mongoose.Types.Decimal128.fromString(Number(fine.amount).toFixed(2)),
          paid_amount: mongoose.Types.Decimal128.fromString(Number(fine.paid_amount || 0).toFixed(2)),
          currency: 'KES', due_date: fine.due_date || new Date(),
          status: Number(fine.paid_amount || 0) > 0 ? 'partially_paid' : 'pending',
          notes: fine.reason,
        });
        const linked = await ChamaFine.updateOne({ _id: fine._id, $or: [{ obligation_id: null }, { obligation_id: { $exists: false } }] }, { $set: { obligation_id: obligation._id } });
        if (!linked.modifiedCount) await ContributionObligation.deleteOne({ _id: obligation._id });
      }
    }
    const fines = await ChamaFine.find(query).populate({ path: 'member_id', select: 'user_id', populate: { path: 'user_id', select: 'name first_name last_name phone' } }).sort({ createdAt: -1 }).lean();
    const plan = await ContributionPlan.findOne({ owner_type: 'Chama', owner_id: req.params.workspaceId, system_key: 'late_penalties' }).select('_id').lean();
    const [collectedRows, shareouts] = await Promise.all([
      plan ? ContributionPayment.aggregate([{ $match: { owner_type: 'Chama', owner_id: chama._id, plan_id: plan._id, status: 'completed' } }, { $group: { _id: null, total: { $sum: { $toDouble: '$amount' } } } }]) : [],
      (await import('../../models/FineShareout.js')).default.find({ chama_id: chama._id, status: { $ne: 'cancelled' } }).select('total_amount status').lean(),
    ]);
    const collected = Number(collectedRows[0]?.total || 0);
    const distributed = shareouts.reduce((sum, batch) => sum + Number(batch.total_amount?.toString?.() ?? batch.total_amount ?? 0), 0);
    res.json({ success: true, data: { fines: fines.map(fineDto), totals: {
      assessed: fines.reduce((sum, fine) => sum + Number(fine.amount || 0), 0),
      collected, distributed, availableForShareout: Math.max(0, collected - distributed),
      outstanding: fines.filter((fine) => fine.status === 'outstanding').reduce((sum, fine) => sum + Math.max(0, Number(fine.amount || 0) - Number(fine.paid_amount || 0)), 0),
      count: fines.length,
    } } });
  } catch (error) { next(error); }
}

export async function createFine(req, res, next) {
  try {
    const { chama, isOfficial } = await getContext(req.params.workspaceId, req.user._id);
    if (!isOfficial) throw new AppError('Only the treasurer or chairperson can issue fines', 403);
    const { memberId, reasonType, reason, amount, dueDate } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(memberId)) throw new AppError('Choose a valid active member', 400);
    if (!['late_payment', 'meeting_absence', 'custom'].includes(reasonType)) throw new AppError('Choose a valid fine type', 400);
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100000000) throw new AppError('Enter a valid fine amount', 400);
    if (typeof reason !== 'string' || reason.trim().length < 3) throw new AppError('Add a short explanation for this fine', 400);
    const member = await ChamaMembership.findOne({ _id: memberId, chama_id: chama._id, status: 'active' });
    if (!member) throw new AppError('That member is not active in this Chama', 404);
    let parsedDueDate = null;
    if (dueDate) { parsedDueDate = new Date(dueDate); if (Number.isNaN(parsedDueDate.getTime())) throw new AppError('Enter a valid due date', 400); }
    const dueAt = parsedDueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const finePlan = await ensurePenaltyPlan({ chamaId: chama._id, actorUserId: req.user._id });
    const obligation = await ContributionObligation.create({
      plan_id: finePlan._id, owner_type: 'Chama', owner_id: chama._id,
      participant_type: 'ChamaMembership', participant_id: member._id,
      expected_amount: mongoose.Types.Decimal128.fromString(parsedAmount.toFixed(2)),
      paid_amount: 0, currency: 'KES', due_date: dueAt, status: 'pending',
      notes: reason.trim().slice(0, 500),
    });
    let fine;
    try {
      fine = await ChamaFine.create({ chama_id: chama._id, member_id: member._id, reason_type: reasonType, reason: reason.trim(), amount: parsedAmount, due_date: dueAt, issued_by: req.user._id, obligation_id: obligation._id });
    } catch (error) {
      await ContributionObligation.deleteOne({ _id: obligation._id });
      throw error;
    }
    await notifyMember({ chamaId: chama._id, membershipId: member._id, fine, sentBy: req.user._id });
    res.status(201).json({ success: true, data: { fine: fineDto(fine) } });
  } catch (error) { next(error); }
}

export async function remindFine(req, res, next) {
  try {
    const { chama, isOfficial } = await getContext(req.params.workspaceId, req.user._id);
    if (!isOfficial) throw new AppError('Only the treasurer or chairperson can send fine reminders', 403);
    if (!mongoose.Types.ObjectId.isValid(req.params.fineId)) throw new AppError('Invalid fine ID', 400);
    const fine = await ChamaFine.findOne({ _id: req.params.fineId, chama_id: chama._id, status: 'outstanding' });
    if (!fine) throw new AppError('Outstanding fine not found', 404);
    fine.reminder_count += 1; fine.last_reminded_at = new Date(); await fine.save();
    await notifyMember({ chamaId: chama._id, membershipId: fine.member_id, fine, reminder: true, sentBy: req.user._id });
    res.json({ success: true, data: { fine: fineDto(fine) } });
  } catch (error) { next(error); }
}