import crypto from 'node:crypto';
import PublicGivingReport from '../../models/PublicGivingReport.js';
import { createAuditLog } from '../../services/audit.service.js';
import ContributionDonor from '../../models/ContributionDonor.js';
import ContributionGroup from '../../models/ContributionGroup.js';
import ContributionPlan from '../../models/ContributionPlan.js';
import ContributionObligation from '../../models/ContributionObligation.js';
import ContributionPledge from '../../models/ContributionPledge.js';
import PaymentIntent from '../../models/PaymentIntent.js';
import AppError from '../../utils/AppError.js';
import paymentService from '../../payment/payment.service.js';
import { PAYMENT_PROVIDER } from '../../payment/payment.constants.js';
import mpesaService from '../../payment/providers/mpesa/mpesa.service.js';
import { getPublicGroupPreviewByJoinCode } from '../../shared/contributions-core/publicGroupPreview.js';
import { sendPublicGivingReceipt } from '../../services/publicGivingReceipt.service.js';
import { expectedDonationTotal, idempotentIntentMatches, isAttemptInFlight, isPublicGivingIntent } from './publicGiving.logic.js';

const asMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : NaN;
};

const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');
export async function getGivingPreview(req, res, next) {
  try {
    const cacheKey = String(req.params.joinCode || '').trim().toUpperCase();
    const preview = await getPublicGroupPreviewByJoinCode(cacheKey, { requirePublicGiving: true });
    res.json({ success: true, data: preview });
  } catch (error) {
    next(error);
  }
}

export async function reportPublicCause(req, res, next) {
  try {
    const joinCode = String(req.params.joinCode || '').trim().toUpperCase();
    const preview = await getPublicGroupPreviewByJoinCode(joinCode, { requirePublicGiving: true });
    const groupId = preview.group.id;
    const category = String(req.body?.category || 'other');
    const allowed = ['misleading', 'impersonation', 'payout_concern', 'harmful_or_illegal', 'other'];
    if (!allowed.includes(category)) throw new AppError('Choose a valid report reason.', 400);
    const details = String(req.body?.details || '').trim().slice(0, 1000);
    const reporterKey = crypto.createHash('sha256').update(`${req.ip || ''}:${req.get('user-agent') || ''}`).digest('hex');
    try {
      await PublicGivingReport.create({ contribution_group_id: groupId, reporter_key: reporterKey, category, details });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      return res.json({ success: true, data: { received: true } });
    }

    const openReports = await PublicGivingReport.countDocuments({ contribution_group_id: groupId, status: 'open' });
    if (openReports >= 5) {
      const group = await ContributionGroup.findById(groupId);
      if (group && group.status === 'active') {
        const before = { status: group.status, public_giving_enabled: group.verification?.public_giving_enabled === true };
        group.status = 'suspended';
        group.verification.status = 'suspended';
        group.verification.public_giving_enabled = false;
        await group.save();
        await createAuditLog({
          isSystemGenerated: true,
          scopeType: 'CONTRIBUTION_GROUP',
          contributionGroupId: group._id,
          action: 'PUBLIC_GIVING_AUTO_SUSPENDED',
          resourceType: 'ContributionGroup',
          resourceId: group._id,
          before,
          after: { status: group.status, public_giving_enabled: false },
          metadata: { openReportCount: openReports, threshold: 5 },
        });
      }
    }
    res.status(201).json({ success: true, data: { received: true } });
  } catch (error) {
    next(error);
  }
}

async function getOrCreateDonationPlan(group) {
  let plan = await ContributionPlan.findOne({
    owner_type: 'ContributionGroup',
    owner_id: group._id,
    name: 'Public donations',
    participant_type: 'ContributionDonor',
    status: 'active',
  });
  if (plan) return plan;

  return ContributionPlan.create({
    owner_type: 'ContributionGroup',
    owner_id: group._id,
    participant_type: 'ContributionDonor',
    created_by: group.created_by,
    updated_by: group.created_by,
    name: 'Public donations',
    description: 'One-time donations from public supporters',
    contribution_type: 'free_will',
    frequency: 'once',
    start_date: group.start_date || new Date(),
    end_date: group.contribution_end_date || null,
    is_permanent: !group.contribution_end_date,
    status: 'active',
    activated_at: new Date(),
    activated_by: group.created_by,
  });
}

async function createDonationRecords({ group, donor, amount }) {
  let pledge = donor.pledge_id ? await ContributionPledge.findById(donor.pledge_id) : null;
  let obligation = donor.obligation_id ? await ContributionObligation.findById(donor.obligation_id) : null;
  if (pledge && obligation) {
    const paid = Number(obligation.paid_amount?.toString?.() ?? obligation.paid_amount ?? 0);
    // Only settled money and the new attempt belong in the expected total.
    // Failed/cancelled STK prompts are excluded so retries cannot inflate it.
    const pending = await PaymentIntent.aggregate([
      { $match: { obligation_id: obligation._id, $or: [
        { status: { $in: ['pending', 'processing'] } },
        { status: 'failed', failure_reason: /^Amount mismatch:/ },
      ] } },
      { $group: { _id: null, amount: { $sum: { $toDouble: '$amount' } } } },
    ]);
    const nextExpected = expectedDonationTotal({ paid, pending: pending[0]?.amount, attempt: amount });
    const nextPledge = nextExpected;
    pledge.pledged_amount = nextPledge;
    pledge.status = paid >= nextPledge ? 'paid' : paid > 0 ? 'partially_paid' : 'pledged';
    obligation.expected_amount = nextExpected;
    obligation.status = paid >= nextExpected ? 'paid' : paid > 0 ? 'partially_paid' : 'pending';
    if (obligation.status !== 'paid') obligation.paid_at = null;
    await Promise.all([pledge.save(), obligation.save()]);
    return { pledge, obligation };
  }

  if (!obligation) {
    obligation = await ContributionObligation.findOne({
      owner_type: 'ContributionGroup',
      owner_id: group._id,
      participant_type: 'ContributionDonor',
      participant_id: donor._id,
    });
  }
  if (obligation && !pledge) pledge = await ContributionPledge.findOne({ donor_id: donor._id, obligation_id: obligation._id });
  if (pledge && obligation) {
    donor.pledge_id = pledge._id;
    donor.obligation_id = obligation._id;
    await donor.save();
    return createDonationRecords({ group, donor, amount });
  }

  const plan = await getOrCreateDonationPlan(group);
  const now = new Date();
  obligation = await ContributionObligation.create({
    plan_id: plan._id,
    owner_type: 'ContributionGroup',
    owner_id: group._id,
    participant_type: 'ContributionDonor',
    participant_id: donor._id,
    expected_amount: amount,
    currency: 'KES',
    due_date: group.contribution_end_date || now,
    period_start: now,
    period_end: now,
    status: 'pending',
  });
  pledge = await ContributionPledge.create({
    contribution_group_id: group._id,
    donor_id: donor._id,
    plan_id: plan._id,
    obligation_id: obligation._id,
    pledged_amount: amount,
    currency: 'KES',
  });
  donor.pledge_id = pledge._id;
  donor.obligation_id = obligation._id;
  await donor.save();
  return { pledge, obligation };
}

export async function createPublicDonation(req, res, next) {
  try {
    const { joinCode } = req.params;
    const displayName = String(req.body?.donor_name || '').trim();
    const idempotencyKey = String(req.body?.idempotency_key || '').trim();
    const statusToken = String(req.body?.status_token || '').trim();
    const amount = asMoney(req.body?.amount);

    if (idempotencyKey.length < 16 || idempotencyKey.length > 100) {
      throw new AppError('Refresh the page and try again.', 400);
    }
    if (statusToken.length < 32 || statusToken.length > 200) {
      throw new AppError('Refresh the page and try again.', 400);
    }

    const paymentTokenHash = tokenHash(statusToken);
    const preview = await getPublicGroupPreviewByJoinCode(joinCode, { requirePublicGiving: true });
    const previewGroupId = preview?.group?.id;
    const group = previewGroupId ? await ContributionGroup.findById(previewGroupId) : null;
    if (!group?._id) throw new AppError('Cause not found.', 404);
    if (group.status !== 'active') {
      throw new AppError('This cause is no longer accepting donations.', 409);
    }
    if (group.verification?.status !== 'verified' || group.verification?.level !== 'public' || group.verification?.public_giving_enabled !== true || (group.verification?.expires_at && new Date(group.verification.expires_at) <= new Date())) {
      throw new AppError('This fundraiser is not currently approved for public donations.', 409);
    }
    if (group.contribution_end_date && new Date(group.contribution_end_date) < new Date()) {
      throw new AppError('The donation period for this cause has ended.', 409);
    }

    const existingIntent = await PaymentIntent.findOne({ idempotency_key: idempotencyKey });
    if (existingIntent) {
      if (!idempotentIntentMatches(existingIntent, { tokenHash: paymentTokenHash, groupId: group._id })) {
        throw new AppError('This donation request has already been used. Refresh and try again.', 409);
      }
      return res.status(200).json({
        success: true,
        data: {
          status: existingIntent.status,
          status_token: statusToken,
          reference: existingIntent.reference,
          amount: String(existingIntent.amount),
          phone_number: existingIntent.phone_number,
        },
      });
    }

    if (displayName.length < 2 || displayName.length > 100) {
      throw new AppError('Enter your name (2 to 100 characters).', 400);
    }
    if (!Number.isFinite(amount) || amount < 1 || Math.round(amount * 100) !== amount * 100) {
      throw new AppError('Enter a valid donation amount of at least KES 1.', 400);
    }
    const phoneNumber = mpesaService.normalizePhoneNumber(req.body?.phone_number);
    if (!phoneNumber) throw new AppError('Enter a valid M-Pesa phone number.', 400);
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new AppError('Enter a valid email address for your receipt.', 400);

    let donor = await ContributionDonor.findOne({ contribution_group_id: group._id, phone_number: phoneNumber });
    if (!donor) {
      try {
        donor = await ContributionDonor.create({
        contribution_group_id: group._id,
        display_name: displayName,
        phone_number: phoneNumber,
        email: email || null,
        });
      } catch (error) {
        if (error?.code !== 11000) throw error;
        donor = await ContributionDonor.findOne({ contribution_group_id: group._id, phone_number: phoneNumber });
      }
    }
    if (!donor) throw new AppError('Could not prepare your donation. Please try again.', 503);
    if (!donor.pledge_id && displayName) donor.display_name = displayName;
    if (email) donor.email = email;
    if (donor.obligation_id) {
      const pendingIntent = await PaymentIntent.findOne({
        owner_type: 'ContributionGroup',
        owner_id: group._id,
        participant_type: 'ContributionDonor',
        participant_id: donor._id,
        obligation_id: donor.obligation_id,
        status: { $in: ['pending', 'processing'] },
      });
      if (isAttemptInFlight(pendingIntent?.status)) throw new AppError('A payment for this number is already waiting for confirmation.', 409);
    }
    await donor.save();
    const callbackUrl = process.env.MPESA_GIVING_CALLBACK_URL?.trim();
    if (process.env.NODE_ENV === 'production' && !callbackUrl) throw new AppError('Giving payment callback is not configured.', 503);
    const { pledge, obligation } = await createDonationRecords({ group, donor, amount });
    const reference = `GIVE-${String(group._id).slice(-6)}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    let payment;
    try {
      payment = await paymentService.initiate({
      type: 'contribution',
      amount,
      currency: 'KES',
      provider: { name: PAYMENT_PROVIDER.MPESA },
      ownerType: 'ContributionGroup',
      ownerId: group._id,
      participantType: 'ContributionDonor',
      participantId: donor._id,
      obligationId: obligation._id,
      planId: pledge.plan_id,
      actorId: null,
      phoneNumber,
      participant: { id: donor._id, phoneNumber },
      reference,
      displayReference: `Donation to ${group.name}`,
      idempotencyKey,
      metadata: {
        publicDonation: true,
        ...(callbackUrl && { callbackUrl }),
        publicPaymentTokenHash: paymentTokenHash,
        contributionGroupId: String(group._id),
        donorId: String(donor._id),
        donorName: displayName,
      },
      });
    } catch (error) {
      const unstartedIntent = await PaymentIntent.findOne({ idempotency_key: idempotencyKey });
      if (unstartedIntent && !unstartedIntent.provider_request_id && unstartedIntent.status !== 'completed') {
        unstartedIntent.status = 'failed';
        unstartedIntent.failure_reason = 'The M-Pesa prompt could not be started.';
        unstartedIntent.failed_at = new Date();
        await unstartedIntent.save();
      }
      await rollbackUnsettledDonation(obligation._id).catch(() => {});
      throw error;
    }

    res.status(201).json({
      success: true,
      data: {
        status: 'processing',
        status_token: statusToken,
        reference: payment.reference,
        amount: String(amount),
        phone_number: phoneNumber,
        pledge_id: pledge._id,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function rollbackUnsettledDonation(obligationId) {
  const obligation = await ContributionObligation.findById(obligationId);
  if (!obligation) return;
  const paid = Number(obligation.paid_amount?.toString?.() ?? obligation.paid_amount ?? 0);
  const pledge = await ContributionPledge.findOne({ obligation_id: obligation._id });
  obligation.expected_amount = paid;
  obligation.status = paid > 0 ? 'paid' : 'pending';
  await obligation.save();
  if (pledge) {
    pledge.pledged_amount = paid;
    pledge.status = paid > 0 ? 'paid' : 'pledged';
    await pledge.save();
  }
}

async function restoreSettledDonationCommitment(obligationId) {
  if (!obligationId) return;
  const obligation = await ContributionObligation.findById(obligationId);
  if (!obligation) return;
  const paid = Number(obligation.paid_amount?.toString?.() ?? obligation.paid_amount ?? 0);
  const expected = Number(obligation.expected_amount?.toString?.() ?? obligation.expected_amount ?? 0);
  if (paid > expected) obligation.expected_amount = paid;
  obligation.status = 'paid';
  await obligation.save();
  const pledge = await ContributionPledge.findOne({ obligation_id: obligation._id });
  if (pledge) {
    const pledged = Number(pledge.pledged_amount?.toString?.() ?? pledge.pledged_amount ?? 0);
    if (paid > pledged) pledge.pledged_amount = paid;
    pledge.status = 'paid';
    await pledge.save();
  }
}

export async function handleGivingMpesaCallback(req, res) {
  const checkoutRequestId = req.body?.Body?.stkCallback?.CheckoutRequestID;
  try {
    if (!checkoutRequestId) return res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback received' });
    const intent = await PaymentIntent.findOne({ provider: 'mpesa', provider_request_id: checkoutRequestId });
    if (!isPublicGivingIntent(intent)) return res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback ignored' });
    const result = await paymentService.handleCallback(req.body);
    const settled = await PaymentIntent.findById(intent._id).select('status obligation_id').lean();
    if (settled && ['failed', 'cancelled'].includes(settled.status) && !result?.amountMismatch) await rollbackUnsettledDonation(settled.obligation_id);
    if (settled?.status === 'completed') {
      await restoreSettledDonationCommitment(settled.obligation_id);
      await sendPublicGivingReceipt(intent._id);
    }
    return res.status(200).json({ ResultCode: 0, ResultDesc: result?.success ? 'Callback processed' : 'Callback received' });
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'giving_mpesa_callback_failed', checkoutRequestId, message: error.message }));
    // Daraja retries callbacks when non-200 is returned. The reconciliation worker is the durable backstop.
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback received' });
  }
}

export async function getPublicDonationStatus(req, res, next) {
  try {
    const token = String(req.params.statusToken || '');
    if (token.length < 32 || token.length > 200) throw new AppError('Donation status not found.', 404);
    const intent = await PaymentIntent.findOne({
      'metadata.publicDonation': true,
      'metadata.publicPaymentTokenHash': tokenHash(token),
    }).select('status reference amount failure_reason completed_at phone_number');
    if (!intent) throw new AppError('Donation status not found.', 404);
    res.json({
      success: true,
      data: {
        status: intent.status,
        reference: intent.reference,
        amount: String(intent.amount),
        phone_number: intent.phone_number,
        failure_reason: ['failed', 'cancelled'].includes(intent.status) ? 'The M-Pesa payment was not completed.' : null,
        completed_at: intent.completed_at,
      },
    });
  } catch (error) {
    next(error);
  }
}
