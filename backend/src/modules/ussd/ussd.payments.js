import crypto from 'crypto';
import ContributionPlan from '../../models/ContributionPlan.js';
import ContributionObligation from '../../models/ContributionObligation.js';
import paymentService from '../../payment/payment.service.js';
import mpesaService from '../../payment/providers/mpesa/mpesa.service.js';
import { PAYMENT_PROVIDER } from '../../payment/payment.constants.js';
import { previewContributionPayment } from '../contributionPlan/contributionAllocation.service.js';
import { getOrCreateSavingsPlan } from '../chama/chamaFinance.service.js';
import { toDecimal } from '../../shared/decimal.js';

// ======================================================================
// USSD <-> CONTRIBUTION PLAN PAYMENTS
// ======================================================================
// Uses the same "contribution product" as the app (contributionPayment
// controller): previewContributionPayment() validates the plan, member
// and amount without writing anything, then paymentService.initiate()
// opens the M-Pesa STK push and settlement allocates the money oldest
// obligation first. That makes savings, dues, fees, fines AND burial
// welfare levies all payable the same way - the plan's `behavior`
// decides how the money is treated, USSD does not.

const MAX_PLANS_SHOWN = 5;
const OPEN = ['pending', 'partially_paid', 'overdue'];

const appliesTo = (plan, membershipId) =>
  !plan.applies_to || plan.applies_to.mode !== 'selected'
    ? true
    : (plan.applies_to.participant_ids || []).some((id) => String(id) === String(membershipId));

/**
 * Plans this member can pay right now, each with what they currently owe on it.
 * Plans with something owing come first; for burial chamas welfare plans lead.
 */
export const listPayablePlans = async ({ chama, membership, userId }) => {
  const isBurial = chama.chama_type === 'burial';

  // Standard chamas have a built-in savings plan that is created lazily on
  // first deposit; make sure it exists so "Contribute" is never empty.
  if (!isBurial) {
    const hasSavings = await ContributionPlan.exists({ owner_type: 'Chama', owner_id: chama._id, system_key: 'savings' });
    if (!hasSavings) await getOrCreateSavingsPlan({ chama, userId });
  }

  const plans = await ContributionPlan.find({
    owner_type: 'Chama',
    owner_id: chama._id,
    status: 'active',
    contribution_type: { $ne: 'merry_go_round' },
  })
    .select('name behavior system_key applies_to display contribution_type')
    .sort({ 'display.sort_order': 1, createdAt: 1 })
    .lean();

  const mine = plans.filter((p) => appliesTo(p, membership._id));
  if (mine.length === 0) return [];

  const open = await ContributionObligation.find({
    owner_type: 'Chama',
    owner_id: chama._id,
    participant_type: 'ChamaMembership',
    participant_id: membership._id,
    plan_id: { $in: mine.map((p) => p._id) },
    status: { $in: OPEN },
  })
    .select('plan_id expected_amount paid_amount')
    .lean();

  const owing = new Map();
  for (const o of open) {
    const left = toDecimal(o.expected_amount).minus(toDecimal(o.paid_amount));
    if (left.gt(0)) owing.set(String(o.plan_id), (owing.get(String(o.plan_id)) || toDecimal(0)).plus(left));
  }

  const rank = (p) => {
    const hasOwing = owing.has(String(p._id)) ? 0 : 10;
    const welfareLead = isBurial && p.behavior === 'welfare' ? 0 : 1;
    return hasOwing + welfareLead;
  };

  return mine
    // The late-penalties plan is system-made: only offer it when a fine is owing.
    .filter((p) => p.system_key !== 'late_penalties' || owing.has(String(p._id)))
    .map((p, i) => ({ ...p, owing: owing.get(String(p._id)) || toDecimal(0), _i: i }))
    .sort((a, b) => rank(a) - rank(b) || a._i - b._i)
    .slice(0, MAX_PLANS_SHOWN);
};

const reference = (display) =>
  `${display}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`.slice(0, 100);

/** Starts the STK push for `amount` against `plan`. Throws AppError on a refusal. */
export const initiatePlanPayment = async ({ chama, membership, plan, amount, userId, phoneNumber, idempotencyKey }) => {
  // Validates plan status, member status and amount; writes nothing.
  const preview = await previewContributionPayment({
    chamaId: chama._id,
    planId: plan._id,
    membershipId: membership._id,
    amount,
  });

  const displayRef = `CONTRIB-${plan.name || 'PLAN'}`.slice(0, 20);
  const normalizedPhone = mpesaService.normalizePhoneNumber(phoneNumber);

  return paymentService.initiate({
    type: 'CONTRIBUTION',
    amount: Number(amount),
    currency: 'KES',
    provider: { name: PAYMENT_PROVIDER.MPESA },
    actorId: userId,
    chamaId: chama._id,
    participantId: membership._id,
    obligationId: preview.anchor_obligation_id || undefined,
    planId: preview.plan.id,
    phoneNumber: normalizedPhone,
    reference: reference(displayRef),
    displayReference: displayRef,
    participant: { id: membership._id, phoneNumber: normalizedPhone },
    metadata: {
      description: `Contribution to ${preview.plan.name} (USSD)`,
      ownerType: 'Chama',
      period_key: null,
      channel: 'ussd',
      allocation: { mode: 'oldest_first', period_key: null },
    },
    idempotencyKey,
  });
};

export default { listPayablePlans, initiatePlanPayment };
