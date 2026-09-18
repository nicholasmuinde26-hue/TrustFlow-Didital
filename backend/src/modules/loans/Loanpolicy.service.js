import ChamaLoanPolicy from '../../models/ChamaLoanPolicy.js';
import AppError from '../../utils/AppError.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import notificationService from '../../services/notification.service.js';

/**
 * Every Chama gets a loan policy lazily, the first time it's needed,
 * seeded with sane defaults. Officials can then tune it.
 */
export async function getOrCreatePolicy(chamaId) {
  let policy = await ChamaLoanPolicy.findOne({ chama_id: chamaId });
  if (!policy) {
    policy = await ChamaLoanPolicy.create({ chama_id: chamaId });
  }
  return policy;
}

export async function updatePolicy(chamaId, updates, userId) {
  const allowed = [
    'loan_multiplier',
    'interest_rate_percent',
    'interest_type',
    'min_membership_months',
    'max_active_loans_per_member',
    'allowed_purposes',
    'allowed_repayment_periods_months',
    'allowed_repayment_frequencies',
    'grace_period_days',
    'default_after_days',
    'penalty_type',
    'penalty_amount',
    'repayment_waterfall',
    'guarantor_capacity_ratio',
    'allow_guarantor_recovery',
    'min_guarantors_required',
    'approval_matrix',
    'recusal_quorum_size',
    'emergency_loan_enabled',
    'emergency_loan_limit',
    'emergency_loan_approval_roles',
    'topup_enabled',
    'group_loans_enabled',
  ];

  const $set = { updated_by: userId };
  for (const key of allowed) {
    if (updates[key] !== undefined) $set[key] = updates[key];
  }

  const previousPolicy = await ChamaLoanPolicy.findOne({ chama_id: chamaId });

  const policy = await ChamaLoanPolicy.findOneAndUpdate(
    { chama_id: chamaId },
    { $set, $setOnInsert: { chama_id: chamaId } },
    { new: true, upsert: true, runValidators: true }
  );

  if (!policy) throw new AppError('Unable to update loan policy', 500);

  // Interest-rate changes are sensitive governance events. Notify management
  // first, then broadcast the confirmed change to the wider membership.
  const sensitiveChanges = getSensitiveChanges(previousPolicy, policy, updates);
  if (sensitiveChanges.length > 0) {
    await notifyLoanPolicyChange({
      chamaId,
      userId,
      previousPolicy,
      policy,
      sensitiveChanges
    });
  }

  return policy;
}


function getSensitiveChanges(previousPolicy, policy, updates) {
  const fields = [
    ['interest_rate_percent', 'loan interest rate'],
    ['interest_type', 'interest calculation method'],
    ['loan_multiplier', 'loan multiplier'],
    ['penalty_amount', 'loan penalty'],
    ['penalty_type', 'penalty calculation method'],
    ['approval_matrix', 'loan approval rules'],
    ['recusal_quorum_size', 'conflict-of-interest approval quorum'],
    ['emergency_loan_limit', 'emergency loan limit'],
  ];

  return fields
    .filter(([field]) => updates[field] !== undefined && String(previousPolicy?.[field]) !== String(policy?.[field]))
    .map(([field, label]) => ({ field, label, previousValue: previousPolicy?.[field] ?? null, newValue: policy?.[field] ?? null }));
}

async function notifyLoanPolicyChange({ chamaId, userId, previousPolicy, policy, sensitiveChanges }) {
  try {
    const memberships = await ChamaMembership.find({
      chama_id: chamaId,
      status: 'active'
    }).select('_id user_id role');

    const managementRoles = new Set(['chairperson', 'treasurer', 'secretary', 'auditor', 'committee_member', 'patron']);
    const management = memberships.filter((m) => managementRoles.has(m.role));
    const memberRecipients = memberships;

    const rateChange = sensitiveChanges.find((c) => c.field === 'interest_rate_percent');
    const changedSummary = sensitiveChanges.map((c) => `${c.label}: ${formatPolicyValue(c.previousValue)} → ${formatPolicyValue(c.newValue)}`).join('; ');

    // Phase 1: management notification. This is deliberately awaited before
    // the member broadcast so the governance alert is persisted/delivered first.
    await notificationService.sendBulkNotification({
      chamaId,
      recipientMembershipIds: management.map((m) => m._id),
      notificationType: 'LOAN_POLICY_SENSITIVE_UPDATE',
      title: 'Sensitive loan policy change',
      message: rateChange
        ? `A sensitive loan policy update changed the interest rate from ${formatPolicyValue(rateChange.previousValue)} to ${formatPolicyValue(rateChange.newValue)}. Management has been notified before the member announcement.`
        : `A sensitive loan policy update was made: ${changedSummary}. Management has been notified before the member announcement.`,
      description: 'Please review the updated loan rules and governance impact.',
      metadata: { sensitiveChanges, previousPolicyVersion: previousPolicy?.updatedAt || null, newPolicyVersion: policy.updatedAt, changedByUserId: userId },
      relatedEntityType: 'ChamaLoanPolicy',
      relatedEntityId: policy._id,
      priority: 'high',
      requiresAction: true,
      sentBy: null
    });

    // Phase 2: all active members, including management, receive the general
    // announcement after management has been notified.
    await notificationService.sendBulkNotification({
      chamaId,
      recipientMembershipIds: memberRecipients.map((m) => m._id),
      notificationType: 'LOAN_POLICY_UPDATED',
      title: 'Loan policy updated',
      message: rateChange
        ? `The Chama loan interest rate has been updated from ${formatPolicyValue(rateChange.previousValue)} to ${formatPolicyValue(rateChange.newValue)}. Please review the current loan terms in the Loans section.`
        : `The Chama loan policy has been updated. Changed rules: ${changedSummary}. Please review the current loan terms in the Loans section.`,
      description: 'The Loans page now uses the latest Chama loan policy.',
      metadata: { sensitiveChanges, policyVersion: policy.updatedAt, changedByUserId: userId },
      relatedEntityType: 'ChamaLoanPolicy',
      relatedEntityId: policy._id,
      priority: 'normal',
      requiresAction: false,
      sentBy: null
    });
  } catch (notificationError) {
    // Policy changes must not be rolled back because a notification provider
    // is unavailable. The audit/policy write remains authoritative.
    console.error('Loan policy notification error:', notificationError);
  }
}

function formatPolicyValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (value === null || value === undefined) return 'not set';
  return String(value);
}

/** Resolve the approval matrix tier (list of required roles) for an amount. */
export function resolveApprovalRoles(policy, amount) {
  const tiers = [...(policy?.approval_matrix || [])].sort((a, b) => {
    const aMax = a.max_amount ?? Infinity;
    const bMax = b.max_amount ?? Infinity;
    return aMax - bMax;
  });

  const tier = tiers.find((t) => amount <= (t.max_amount ?? Infinity));
  return (tier?.required_roles && tier.required_roles.length > 0)
    ? tier.required_roles
    : ['chairperson', 'treasurer'];
}

export default { getOrCreatePolicy, updatePolicy, resolveApprovalRoles };