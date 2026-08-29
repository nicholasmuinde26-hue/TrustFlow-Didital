import crypto from 'node:crypto';
import mongoose from 'mongoose';
import ContributionGroup from '../../models/ContributionGroup.js';
import ContributionGroupMember from '../../models/ContributionGroupMember.js';
import ContributionPlan from '../../models/ContributionPlan.js';
import ContributionObligation from '../../models/ContributionObligation.js';
import ContributionPayment from '../../models/ContributionPayment.js';
import PaymentIntent from '../../models/PaymentIntent.js';
import ContributionPledge from '../../models/ContributionPledge.js';
import ContributionReminder from '../../models/ContributionReminder.js';
import Notification from '../../models/Notification.js';
import AppError from '../../utils/AppError.js';
import paymentService from '../../payment/payment.service.js';
import { PAYMENT_PROVIDER } from '../../payment/payment.constants.js';
import mpesaService from '../../payment/providers/mpesa/mpesa.service.js';

const id = (value, field = 'ID') => {
  if (!mongoose.Types.ObjectId.isValid(value)) throw new AppError(`Invalid ${field}`, 400);
  return value;
};
const money = (value) => Number(value?.toString?.() ?? value ?? 0);
const isManager = (membership) => ['organizer', 'co_organizer'].includes(membership.role);
const isCashOfficer = (membership) => ['organizer', 'co_organizer', 'treasurer'].includes(membership.role);

async function groupOrThrow(groupId) {
  const group = await ContributionGroup.findById(id(groupId, 'contribution group ID'));
  if (!group) throw new AppError('Contribution group not found', 404);
  return group;
}

async function pledgeWithObligation(groupId, pledgeId) {
  const pledge = await ContributionPledge.findOne({ _id: id(pledgeId, 'pledge ID'), contribution_group_id: groupId });
  if (!pledge) throw new AppError('Pledge not found in this contribution group', 404);
  const obligation = await ContributionObligation.findById(pledge.obligation_id);
  if (!obligation) throw new AppError('Pledge obligation is missing', 409);
  return { pledge, obligation };
}

async function getOrCreatePledgePlan(group, userId) {
  let plan = await ContributionPlan.findOne({ owner_type: 'ContributionGroup', owner_id: group._id, name: 'Member pledges', status: { $in: ['draft', 'active'] } });
  if (plan) return plan;
  return ContributionPlan.create({
    owner_type: 'ContributionGroup', owner_id: group._id,
    participant_type: 'ContributionGroupMember', created_by: userId, updated_by: userId,
    name: 'Member pledges', description: 'One-time member pledges for this contribution fund',
    contribution_type: 'free_will', frequency: 'once', start_date: group.start_date || new Date(),
    end_date: group.contribution_end_date || null, is_permanent: !group.contribution_end_date,
    status: 'active', activated_at: new Date(), activated_by: userId
  });
}

function assertGroupOpen(group) {
  if (!['active', 'closing_review'].includes(group.status)) throw new AppError('This contribution group is no longer accepting pledges or payments', 409);
}

export async function updateFundDetails(req, res, next) {
  try {
    const group = await groupOrThrow(req.params.groupId);
    const { target_amount, contribution_end_date, beneficiary, grace_period_days, reminder_policy, description, event_date, location } = req.body;
    if (target_amount !== undefined && (!Number.isFinite(Number(target_amount)) || Number(target_amount) < 0)) throw new AppError('Target amount must be zero or more', 400);
    if (contribution_end_date !== undefined && contribution_end_date && Number.isNaN(new Date(contribution_end_date).getTime())) throw new AppError('Invalid contribution end date', 400);
    if (grace_period_days !== undefined && (!Number.isInteger(Number(grace_period_days)) || Number(grace_period_days) < 1 || Number(grace_period_days) > 90)) throw new AppError('Grace period must be between 1 and 90 days', 400);
    for (const key of ['target_amount', 'beneficiary', 'grace_period_days', 'description', 'event_date', 'location']) if (req.body[key] !== undefined) group[key] = req.body[key] || null;
    if (contribution_end_date !== undefined) group.contribution_end_date = contribution_end_date || null;
    if (reminder_policy !== undefined) group.reminder_policy = { ...group.reminder_policy?.toObject?.(), ...reminder_policy };
    await group.save();
    res.json({ success: true, data: { group } });
  } catch (error) { next(error); }
}

export async function extendFund(req, res, next) {
  try {
    const group = await groupOrThrow(req.params.groupId);
    const end = new Date(req.body.contribution_end_date);
    if (Number.isNaN(end.getTime()) || end <= new Date()) throw new AppError('New contribution end date must be in the future', 400);
    group.contribution_end_date = end; group.status = 'active'; group.extended_at = new Date(); group.extended_by = req.user._id; group.archive_reason = null;
    await group.save();
    res.json({ success: true, message: 'Contribution period extended', data: { group } });
  } catch (error) { next(error); }
}

export async function createOrUpdateMyPledge(req, res, next) {
  try {
    const group = await groupOrThrow(req.params.groupId); assertGroupOpen(group);
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new AppError('Pledge amount must be greater than zero', 400);
    const member = req.groupMembership;
    let pledge = await ContributionPledge.findOne({ contribution_group_id: group._id, member_id: member._id, status: { $in: ['pledged', 'partially_paid'] } });
    if (pledge) {
      const obligation = await ContributionObligation.findById(pledge.obligation_id);
      if (amount < money(obligation.paid_amount)) throw new AppError('A pledge cannot be reduced below the amount already received', 409);
      pledge.pledged_amount = amount; pledge.amended_by = req.user._id; pledge.amendment_reason = req.body.reason || '';
      obligation.expected_amount = amount; obligation.status = money(obligation.paid_amount) >= amount ? 'paid' : money(obligation.paid_amount) > 0 ? 'partially_paid' : 'pending';
      await Promise.all([pledge.save(), obligation.save()]);
    } else {
      const plan = await getOrCreatePledgePlan(group, req.user._id);
      const obligation = await ContributionObligation.create({ plan_id: plan._id, owner_type: 'ContributionGroup', owner_id: group._id, participant_type: 'ContributionGroupMember', participant_id: member._id, expected_amount: amount, currency: 'KES', due_date: group.contribution_end_date || new Date(Date.now() + 30 * 86400000), period_start: group.start_date || new Date(), period_end: group.contribution_end_date || new Date(Date.now() + 30 * 86400000), status: 'pending' });
      pledge = await ContributionPledge.create({ contribution_group_id: group._id, member_id: member._id, plan_id: plan._id, obligation_id: obligation._id, pledged_amount: amount, currency: 'KES' });
    }
    res.status(201).json({ success: true, data: { pledge } });
  } catch (error) { next(error); }
}

export async function listPledges(req, res, next) {
  try {
    const query = { contribution_group_id: req.params.groupId };
    if (!isManager(req.groupMembership) && req.groupMembership.role !== 'treasurer') query.member_id = req.groupMembership._id;
    const pledges = await ContributionPledge.find(query).populate({ path: 'member_id', populate: { path: 'user_id', select: 'name phone' } }).populate('obligation_id').sort({ createdAt: -1 });
    const rows = pledges.map((pledge) => ({ ...pledge.toJSON(), paid_amount: pledge.obligation_id?.paid_amount?.toString?.() || '0', balance: Math.max(0, money(pledge.pledged_amount) - money(pledge.obligation_id?.paid_amount)).toString(), payment_status: pledge.obligation_id?.status || pledge.status }));
    res.json({ success: true, data: { pledges: rows } });
  } catch (error) { next(error); }
}

async function initiatePledgePayment({ req, method }) {
  const group = await groupOrThrow(req.params.groupId); assertGroupOpen(group);
  const { pledge, obligation } = await pledgeWithObligation(group._id, req.params.pledgeId);
  const ownerIsPledger = String(pledge.member_id) === String(req.groupMembership._id);
  if (method === 'mpesa' && !ownerIsPledger) throw new AppError('Members may initiate M-Pesa only for their own pledge', 403);
  if (method === 'cash' && !isCashOfficer(req.groupMembership)) throw new AppError('Only the organizer, co-organizer, or treasurer can record cash', 403);
  const amount = Number(req.body.amount); const balance = Math.max(0, money(obligation.expected_amount) - money(obligation.paid_amount));
  if (!Number.isFinite(amount) || amount <= 0 || amount > balance) throw new AppError(`Payment amount must be greater than zero and no more than KES ${balance}`, 400);
  const phoneNumber = method === 'mpesa' ? mpesaService.normalizePhoneNumber(req.body.phoneNumber) : null;
  if (method === 'mpesa' && !phoneNumber) throw new AppError('Phone number is required for M-Pesa', 400);
  const idempotencyKey = req.body.idempotencyKey || crypto.createHash('sha256').update(`${req.user._id}:${pledge._id}:${amount}:${method}`).digest('hex');
  const existingIntent = await PaymentIntent.findOne({ idempotency_key: idempotencyKey, owner_type: 'ContributionGroup', owner_id: group._id });
  if (existingIntent) return { result: { duplicate: true, paymentIntentId: existingIntent._id, status: existingIntent.status, reference: existingIntent.reference }, pledge, method };
  const result = await paymentService.initiate({ type: 'contribution', amount, currency: 'KES', provider: { name: method === 'mpesa' ? PAYMENT_PROVIDER.MPESA : PAYMENT_PROVIDER.CASH }, ownerType: 'ContributionGroup', ownerId: group._id, participantType: 'ContributionGroupMember', participantId: pledge.member_id, obligationId: obligation._id, planId: pledge.plan_id, actorId: req.user._id, phoneNumber, participant: { id: pledge.member_id, phoneNumber }, reference: `CG-${String(group._id).slice(-6)}-${Date.now()}`, displayReference: `Pledge payment: ${group.name}`, idempotencyKey, metadata: { contributionGroupId: String(group._id), pledgeId: String(pledge._id), paymentMethod: method, cashReference: req.body.cash_reference || null } });
  return { result, pledge, method };
}

export async function initiatePledgeStk(req, res, next) {
  try { const { result } = await initiatePledgePayment({ req, method: 'mpesa' }); res.status(201).json({ success: true, message: 'M-Pesa prompt sent', data: result }); } catch (error) { next(error); }
}
export async function recordCashPledgePayment(req, res, next) {
  try { const { result } = await initiatePledgePayment({ req, method: 'cash' }); res.status(201).json({ success: true, message: 'Cash payment recorded', data: result }); } catch (error) { next(error); }
}

export async function sendPledgeReminders(req, res, next) {
  try {
    const group = await groupOrThrow(req.params.groupId);
    const pledges = await ContributionPledge.find({ contribution_group_id: group._id, status: { $in: ['pledged', 'partially_paid'] } }).populate('obligation_id').populate('member_id');
    const reminders = [];
    for (const pledge of pledges) {
      const balance = Math.max(0, money(pledge.pledged_amount) - money(pledge.obligation_id?.paid_amount));
      if (!balance || !pledge.member_id?.user_id) continue;
      const key = `manual-payment:${group._id}:${pledge._id}:${new Date().toISOString().slice(0, 10)}`;
      try {
        const reminder = await ContributionReminder.create({ contribution_group_id: group._id, pledge_id: pledge._id, obligation_id: pledge.obligation_id._id, recipient_id: pledge.member_id.user_id, kind: 'payment_due', channel: 'in_app', message: `Reminder: KES ${balance.toLocaleString()} remains on your pledge to ${group.name}.`, sent_at: new Date(), status: 'sent', idempotency_key: key, created_by: req.user._id });
        await Notification.create({ user_id: pledge.member_id.user_id, title: `Contribution reminder: ${group.name}`, message: reminder.message, category: 'system', link: `/workspace/${group._id}/contributions`, metadata: { type: 'contribution_reminder', reminder_id: reminder._id } }); reminders.push(reminder);
      } catch (error) { if (error?.code !== 11000) throw error; }
    }
    res.json({ success: true, data: { sent: reminders.length, reminders } });
  } catch (error) { next(error); }
}

export async function getFundDashboard(req, res, next) {
  try {
    const group = await groupOrThrow(req.params.groupId);
    const pledges = await ContributionPledge.find({ contribution_group_id: group._id, status: { $ne: 'cancelled' } }).populate('obligation_id');
    const pledged = pledges.reduce((sum, p) => sum + money(p.pledged_amount), 0); const collected = pledges.reduce((sum, p) => sum + money(p.obligation_id?.paid_amount), 0);
    const pendingPayments = await PaymentIntent.countDocuments({ owner_type: 'ContributionGroup', owner_id: group._id, status: { $in: ['pending', 'processing'] } });
    const myPledge = pledges.find((p) => String(p.member_id) === String(req.groupMembership._id));
    res.json({ success: true, data: { group, totals: { target: money(group.target_amount), pledged, collected, outstanding: Math.max(0, pledged - collected), target_balance: Math.max(0, money(group.target_amount) - collected) }, pending_payments: pendingPayments, my_pledge: myPledge || null } });
  } catch (error) { next(error); }
}
