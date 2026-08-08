import ChamaLoan from '../../models/ChamaLoan.js';
import { getMemberSavings, getExistingOutstanding } from './loanSavings.service.js';
import { OPEN_LOAN_STATUSES } from './loan.constants.js';

const monthsSince = (date) => {
  if (!date) return 0;
  const now = new Date();
  const then = new Date(date);
  return (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
};

/**
 * The automatic eligibility engine — spec section 4. Runs every check
 * BEFORE a loan reaches an official, and returns the specific reason
 * for a failure rather than a bare "not eligible".
 */
export async function checkEligibility({ chama, membership, policy, amount, purpose, repaymentPeriodMonths, repaymentFrequency, loanType }) {
  const membershipMonths = monthsSince(membership.joined_at);
  const savings = await getMemberSavings(chama._id, membership._id);
  const existingOutstanding = await getExistingOutstanding(chama._id, membership._id);

  const isEmergency = loanType === 'emergency';
  const loanLimit = isEmergency
    ? Number(policy.emergency_loan_limit || 0)
    : savings * Number(policy.loan_multiplier || 0);

  const fail = (reason) => ({
    eligible: false,
    reason,
    savings,
    loanLimit,
    existingOutstanding,
    membershipMonths,
  });

  // 1. Membership active
  if (membership.status !== 'active') {
    return fail('Your membership is not currently active, so you cannot apply for a loan.');
  }

  // 2. Minimum membership period (waived for emergency welfare loans)
  if (!isEmergency && membershipMonths < Number(policy.min_membership_months || 0)) {
    return fail(
      `You must be a member for at least ${policy.min_membership_months} month(s) before applying. ` +
      `You have been a member for ${membershipMonths} month(s).`
    );
  }

  // 3. No unresolved previous loan (one active loan at a time, unless it's a top-up)
  if (loanType !== 'topup') {
    const openLoansCount = await ChamaLoan.countDocuments({
      chama_id: chama._id,
      membership_id: membership._id,
      status: { $in: OPEN_LOAN_STATUSES },
    });
    if (openLoansCount >= Number(policy.max_active_loans_per_member || 1)) {
      return fail(
        openLoansCount === 1
          ? 'You already have an active loan. Repay it in full, or apply for a top-up instead.'
          : `You already have ${openLoansCount} active loan(s), which is the maximum this Chama allows.`
      );
    }
  }

  // 4. No active default
  const hasDefault = await ChamaLoan.exists({
    chama_id: chama._id,
    membership_id: membership._id,
    status: 'defaulted',
  });
  if (hasDefault) {
    return fail('You have a defaulted loan on record. Resolve it with the treasurer before applying again.');
  }

  // 5. No overdue balance
  const overdueLoan = await ChamaLoan.findOne({
    chama_id: chama._id,
    membership_id: membership._id,
    status: 'overdue',
  });
  if (overdueLoan) {
    const overdueBalance =
      (overdueLoan.balances?.principal_outstanding || 0) +
      (overdueLoan.balances?.interest_outstanding || 0) +
      (overdueLoan.balances?.penalty_outstanding || 0);
    return fail(`You have an overdue loan balance of KES ${overdueBalance.toLocaleString()}. Please clear it before applying.`);
  }

  // 6. Savings sufficient / within loan limit
  if (!isEmergency && savings <= 0) {
    return fail('You have no recorded savings with this Chama yet, so no loan limit is available.');
  }
  const projectedExposure = loanType === 'topup' ? existingOutstanding + amount : amount;
  if (projectedExposure > loanLimit) {
    const capacity = Math.max(0, loanLimit - (loanType === 'topup' ? existingOutstanding : 0));
    return fail(
      loanType === 'topup'
        ? `Your outstanding balance of KES ${existingOutstanding.toLocaleString()} plus this top-up of KES ${amount.toLocaleString()} ` +
          `would exceed your loan limit of KES ${loanLimit.toLocaleString()}. Available top-up capacity: KES ${capacity.toLocaleString()}.`
        : `Requested amount of KES ${amount.toLocaleString()} exceeds your loan limit of KES ${loanLimit.toLocaleString()} ` +
          (isEmergency ? '(the emergency loan cap).' : `(savings of KES ${savings.toLocaleString()} x ${policy.loan_multiplier}x multiplier).`)
    );
  }

  // 7. Repayment period allowed
  if (!isEmergency && Array.isArray(policy.allowed_repayment_periods_months) && policy.allowed_repayment_periods_months.length) {
    if (!policy.allowed_repayment_periods_months.includes(Number(repaymentPeriodMonths))) {
      return fail(
        `A repayment period of ${repaymentPeriodMonths} month(s) is not allowed. ` +
        `Choose from: ${policy.allowed_repayment_periods_months.join(', ')} month(s).`
      );
    }
  }

  // 8. Repayment frequency allowed
  if (Array.isArray(policy.allowed_repayment_frequencies) && policy.allowed_repayment_frequencies.length) {
    if (!policy.allowed_repayment_frequencies.includes(repaymentFrequency)) {
      return fail(`Repayment frequency "${repaymentFrequency}" is not allowed by this Chama's loan policy.`);
    }
  }

  // 9. Loan purpose allowed (empty allow-list = any purpose)
  if (Array.isArray(policy.allowed_purposes) && policy.allowed_purposes.length) {
    if (!policy.allowed_purposes.includes(purpose)) {
      return fail(`Loan purpose "${purpose}" is not on this Chama's list of approved purposes.`);
    }
  }

  // 10. Emergency loans must be enabled
  if (isEmergency && !policy.emergency_loan_enabled) {
    return fail('Emergency loans are not currently enabled for this Chama.');
  }

  return {
    eligible: true,
    reason: 'Eligible',
    savings,
    loanLimit,
    existingOutstanding,
    membershipMonths,
  };
}

export default { checkEligibility };