import crypto from 'node:crypto';
import AppError from '../../utils/AppError.js';
import ContributionPlan from '../../models/ContributionPlan.js';
import ContributionObligation from '../../models/ContributionObligation.js';
import PaymentIntent from '../../models/PaymentIntent.js';
import MpesaAttempt from '../../models/MpesaAttempt.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import MgrReminder from '../../models/MgrReminder.js';
import mpesaService from '../../payment/providers/mpesa/mpesa.service.js';
import contributionPaymentService from '../contributionPlan/contributionPayment.service.js';
import { startPayout } from '../payout/payout.service.js';

// helper to generate unique reference for DB
const generateUniqueReference = (displayRef) => {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${displayRef}-${ts}-${rand}`.slice(0, 100);
};

const periodFor = (frequency, customDays = null, from = new Date()) => {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  if (frequency === 'daily') end.setDate(end.getDate() + 1);
  else if (frequency === 'weekly') end.setDate(end.getDate() + 7);
  else if (frequency === 'monthly') end.setMonth(end.getMonth() + 1);
  else if (frequency === 'quarterly') end.setMonth(end.getMonth() + 3);
  else if (frequency === 'yearly') end.setFullYear(end.getFullYear() + 1);
  else if (frequency === 'custom') end.setDate(end.getDate() + Number(customDays));
  else end.setDate(end.getDate() + 1);
  return { start, end };
};

const currentMgrPeriod = (plan, now = new Date()) => {
  let period = periodFor(plan.merry_go_round.payout_interval, plan.merry_go_round.payout_interval_days, plan.start_date);
  while (period.end <= now) {
    period = periodFor(plan.merry_go_round.payout_interval, plan.merry_go_round.payout_interval_days, period.end);
  }
  return period;
};

const activeMembers = (chamaId) => ChamaMembership.find({ chama_id: chamaId, status: 'active' }).sort({ payout_position: 1, joined_at: 1 });

export const getOrCreateSavingsPlan = async ({ chama, userId }) => {
  let plan = await ContributionPlan.findOne({ owner_type: 'Chama', owner_id: chama._id, contribution_type: 'fixed', name: 'Savings' });
  if (!plan) {
    plan = await ContributionPlan.create({
      owner_type: 'Chama', owner_id: chama._id, participant_type: 'ChamaMembership', created_by: userId,
      name: 'Savings', description: 'Member savings deposits', contribution_type: 'fixed', frequency: 'monthly',
      amount: chama.monthly_savings, start_date: new Date(), is_permanent: true, status: 'active', activated_at: new Date(),
    });
  }
  return plan;
};

const getOrCreateObligation = async ({ plan, membership, amount, period, notes }) => {
  const filter = { plan_id: plan._id, participant_id: membership._id, period_start: period.start, period_end: period.end };
  let obligation = await ContributionObligation.findOne(filter);
  if (!obligation) {
    obligation = await ContributionObligation.create({
      plan_id: plan._id, owner_type: 'Chama', owner_id: plan.owner_id, participant_type: 'ChamaMembership', participant_id: membership._id,
      expected_amount: amount, paid_amount: 0, currency: 'KES', due_date: period.end, period_start: period.start, period_end: period.end, notes,
    });
  }
  return obligation;
};

export const initiateSavingsDeposit = async ({ chama, membership, userId, amount, phoneNumber, idempotencyKey }) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) throw new AppError('Amount must be a positive whole number of KES', 400);
  if (!phoneNumber) throw new AppError('M-Pesa phone number is required', 400);
  const plan = await getOrCreateSavingsPlan({ chama, userId });
  const obligation = await getOrCreateObligation({ plan, membership, amount: Math.max(value, Number(plan.amount.toString())), period: periodFor('monthly'), notes: 'Savings deposit' });
  const key = idempotencyKey || crypto.randomUUID();
  const existing = await PaymentIntent.findOne({ idempotency_key: key });
  if (existing) return { intent: existing, reused: true };

  const temporaryRequestId = `pending_${crypto.randomUUID()}`;
  const normalizedPhone = mpesaService.normalizePhoneNumber(phoneNumber);
  const displayRef = 'CHAMA-SAVE'.slice(0, 20);
  const uniqueRef = generateUniqueReference(displayRef);

  const intent = await PaymentIntent.create({
    obligation_id: obligation._id, plan_id: plan._id, owner_type: 'Chama', owner_id: chama._id,
    participant_type: 'ChamaMembership', participant_id: membership._id, amount: value, currency: 'KES',
    payment_method: 'mpesa', phone_number: normalizedPhone, reference: uniqueRef, display_reference: displayRef,
    idempotency_key: key, provider: 'mpesa', provider_request_id: temporaryRequestId, status: 'pending', created_by: userId,
  });

  try {
    const result = await mpesaService.initiateStkPush({
      amount: value, phoneNumber: normalizedPhone, accountReference: intent.reference,
      displayReference: intent.display_reference, transactionDescription: 'Chama savings deposit',
    });
    intent.provider_request_id = result.checkoutRequestId;
    intent.provider_response_id = result.merchantRequestId;
    intent.provider_response = result.rawResponse;
    intent.status = 'processing';
    await intent.save();
    await MpesaAttempt.create({
      obligation_id: obligation._id, payment_intent_id: intent._id, amount: value, phone_number: intent.phone_number,
      initiated_by: userId, checkout_request_id: result.checkoutRequestId, merchant_request_id: result.merchantRequestId,
    });
    return { intent, stk: result };
  } catch (error) {
    intent.status = 'failed'; intent.failure_reason = error.message; intent.failed_at = new Date();
    await intent.save();
    throw error;
  }
};

export const reconcileSavingsCallback = async (callback) => {
  // FIX 1: replace new:true with returnDocument
  const attempt = await MpesaAttempt.findOneAndUpdate(
    { checkout_request_id: callback.checkoutRequestId, payment_intent_id: { $ne: null }, status: 'pending' },
    { $set: { status: callback.success ? 'processing' : 'failed' } },
    { returnDocument: 'after' } // was new:true
  );

  if (!attempt) return false;
  const intent = await PaymentIntent.findById(attempt.payment_intent_id);
  if (!intent) throw new AppError('Payment intent missing for M-Pesa attempt', 500);

  if (!callback.success || Number(callback.amount) !== Number(attempt.amount.toString()) || (callback.phoneNumber && callback.phoneNumber !== attempt.phone_number)) {
    attempt.status = 'failed'; await attempt.save();
    const status = Number(callback.resultCode) === 1032 ? 'cancelled' : 'failed';
    await PaymentIntent.findByIdAndUpdate(intent._id, {
      status, failure_code: String(callback.resultCode), failure_reason: callback.resultDescription,
      failed_at: new Date(), provider_response: callback.rawCallback,
    });
    return true;
  }

  const result = await contributionPaymentService.processPayment({
    obligationId: attempt.obligation_id, amount: callback.amount, paymentMethod: 'mpesa',
    processingMode: 'webhook', createdBy: attempt.initiated_by, providerPaymentId: callback.checkoutRequestId,
    externalReference: callback.mpesaReceiptNumber, displayReference: intent.display_reference,
  });

  attempt.status = 'completed'; attempt.mpesa_receipt_number = callback.mpesaReceiptNumber; await attempt.save();

  await PaymentIntent.findByIdAndUpdate(intent._id, {
    status: 'completed', external_reference: callback.mpesaReceiptNumber, contribution_payment_id: result.payment._id,
    financial_transaction_id: result.accounting.transactionId || null, completed_at: new Date(), provider_response: callback.rawCallback,
  });

  await maybeCreateMgrPayoutForChama(intent.owner_id, attempt.initiated_by);
  return true;
};

export const reconcileSavingsIntent = async ({ intentId, chamaId }) => {
  const intent = await PaymentIntent.findOne({ _id: intentId, owner_type: 'Chama', owner_id: chamaId });
  if (!intent || ['completed', 'failed', 'cancelled'].includes(intent.status)) return intent;
  const attempt = await MpesaAttempt.findOne({ payment_intent_id: intent._id });
  if (!attempt?.checkout_request_id) return intent;
  const query = await mpesaService.queryStkPush({ checkoutRequestId: attempt.checkout_request_id });
  if (query.resultCode === null || query.resultCode === undefined) return intent;
  const successful = Number(query.resultCode) === 0;
  await reconcileSavingsCallback({
    checkoutRequestId: attempt.checkout_request_id, resultCode: Number(query.resultCode),
    resultDescription: query.resultDescription || 'M-Pesa STK status received', success: successful,
    amount: successful ? Number(attempt.amount.toString()) : null, phoneNumber: successful ? attempt.phone_number : null,
    mpesaReceiptNumber: null, rawCallback: query.rawResponse,
  });
  return PaymentIntent.findById(intent._id);
};

export const upsertMgrSettings = async ({ chama, userId, amount, frequency, payoutInterval, payoutIntervalDays }) => {
  if (!['weekly', 'monthly', 'quarterly', 'yearly', 'custom'].includes(payoutInterval)) throw new AppError('Invalid payout interval', 400);
  if (payoutInterval === 'custom' && (!Number.isInteger(Number(payoutIntervalDays)) || Number(payoutIntervalDays) < 1)) throw new AppError('Custom payout interval requires payoutIntervalDays', 400);
  if (!['weekly', 'monthly', 'quarterly', 'yearly', 'custom'].includes(frequency)) throw new AppError('Invalid contribution frequency', 400);
  const value = Number(amount); if (!Number.isFinite(value) || value <= 0) throw new AppError('Amount must be greater than zero', 400);
  const settings = { enabled: true, payout_interval: payoutInterval, payout_interval_days: payoutInterval === 'custom' ? Number(payoutIntervalDays) : null };
  let plan = await ContributionPlan.findOne({ owner_type: 'Chama', owner_id: chama._id, contribution_type: 'merry_go_round' });
  if (!plan) plan = new ContributionPlan({ owner_type: 'Chama', owner_id: chama._id, participant_type: 'ChamaMembership', created_by: userId, name: 'Merry-Go-Round', description: 'Rotating member payout plan', contribution_type: 'merry_go_round', frequency, amount: value, start_date: new Date(), is_permanent: true, merry_go_round: settings, status: 'active', activated_at: new Date() });
  else Object.assign(plan, { amount: value, frequency, merry_go_round: settings, status: 'active', updated_by: userId });
  await plan.save();
  await ensureMgrRound(plan);
  return plan;
};

export const ensureMgrRound = async (plan) => {
  const period = currentMgrPeriod(plan);
  const members = await activeMembers(plan.owner_id);
  await Promise.all(members.map(member => getOrCreateObligation({ plan, membership: member, amount: plan.amount, period, notes: `MGR round starting ${period.start.toISOString().slice(0, 10)}` })));
  return { period, members };
};


export const getMgrOverview = async (chamaId) => {
  const plan = await ContributionPlan.findOne({
    owner_type: 'Chama',
    owner_id: chamaId,
    contribution_type: 'merry_go_round',
  });

  const members = await activeMembers(chamaId)
    .populate('user_id', 'name phone');

  const round = plan
    ? await ensureMgrRound(plan)
    : null;

  const obligations = plan
    ? await ContributionObligation.find({
        plan_id: plan._id,
        participant_id: {
          $in: members.map(({ _id }) => _id),
        },
        period_start: round.period.start,
        period_end: round.period.end,
      })
    : [];

  const obligationByMember = new Map(
    obligations.map((item) => [
      String(item.participant_id),
      item,
    ])
  );

  const reminders = obligations.length
    ? await MgrReminder.aggregate([
        {
          $match: {
            obligation_id: {
              $in: obligations.map(
                ({ _id }) => _id
              ),
            },
          },
        },
        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $group: {
            _id: '$obligation_id',
            channel: {
              $first: '$channel',
            },
            createdAt: {
              $first: '$createdAt',
            },
          },
        },
      ])
    : [];

  const reminderByObligation = new Map(
    reminders.map((item) => [
      String(item._id),
      {
        channel: item.channel,
        sent_at: item.createdAt,
      },
    ])
  );

  const currentPayout =
    await (
      await import('../../models/Payout.js')
    ).default
      .findOne({
        chama_id: chamaId,
        contribution_plan_id: plan?._id,
        status: 'pending',
      })
      .populate(
        'member_id',
        'payout_position user_id'
      );

  return {
    plan,
    members,
    currentPayout,

    round: round
      ? {
          start: round.period.start,
          end: round.period.end,
        }
      : null,

    obligations: members.map((member) => ({
      member_id: member._id,

      member_name:
        member.user_id?.name || 'Member',

      phone:
        member.user_id?.phone || null,

      payout_position:
        member.payout_position,

      obligation:
        obligationByMember.get(
          String(member._id)
        ) || null,

      last_reminder:
        reminderByObligation.get(
          String(
            obligationByMember.get(
              String(member._id)
            )?._id
          )
        ) || null,
    })),
  };
};


export const recordMgrReminder = async ({ chamaId, obligationId, channel, userId, message }) => {
  if (!['sms', 'whatsapp'].includes(channel)) throw new AppError('Reminder channel must be sms or whatsapp', 400);
  const obligation = await ContributionObligation.findOne({ _id: obligationId, owner_type: 'Chama', owner_id: chamaId });
  if (!obligation) throw new AppError('MGR contribution obligation not found', 404);
  if (obligation.status === 'paid') throw new AppError('This member has already paid the current MGR round', 409);
  const plan = await ContributionPlan.findOne({ _id: obligation.plan_id, contribution_type: 'merry_go_round' });
  if (!plan) throw new AppError('Reminder is only available for an MGR obligation', 400);
  return MgrReminder.create({ chama_id: chamaId, obligation_id: obligation._id, participant_id: obligation.participant_id, channel, created_by: userId, message });
};

export const maybeCreateMgrPayoutForChama = async (chamaId, userId) => {
  const plan = await ContributionPlan.findOne({ owner_type: 'Chama', owner_id: chamaId, contribution_type: 'merry_go_round', status: 'active' });
  if (!plan) return null;
  const { period, members } = await ensureMgrRound(plan);
  if (!members.length) return null;
  const obligations = await ContributionObligation.find({ plan_id: plan._id, participant_id: { $in: members.map(({ _id }) => _id) }, period_start: period.start, period_end: period.end });
  if (obligations.length !== members.length || obligations.some(({ status }) => status !== 'paid')) return null;
  return startPayout({ chamaId, created_by: userId, contributionPlanId: plan._id, amount: Number(plan.amount.toString()) * members.length, roundStart: period.start });
};