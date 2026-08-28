import ChamaLoanPolicy from '../../models/ChamaLoanPolicy.js';
import AppError from '../../utils/AppError.js';

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

  const policy = await ChamaLoanPolicy.findOneAndUpdate(
    { chama_id: chamaId },
    { $set, $setOnInsert: { chama_id: chamaId } },
    { new: true, upsert: true, runValidators: true }
  );

  if (!policy) throw new AppError('Unable to update loan policy', 500);
  return policy;
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