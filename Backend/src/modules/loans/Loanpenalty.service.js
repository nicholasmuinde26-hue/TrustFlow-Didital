const DAY_MS = 24 * 60 * 60 * 1000;
const daysBetween = (a, b) => Math.floor((a.getTime() - b.getTime()) / DAY_MS);

/**
 * Recomputes each schedule item's penalty/status against "now", and
 * rolls the results up into loan.balances + loan.default_info.
 * Mutates and returns `loan` — caller is responsible for `loan.save()`.
 *
 * Grace period: 1-7 days late       -> still "pending" (no penalty)
 * Overdue:      grace+ days late    -> "overdue"/"partial", penalty accrues weekly
 * Default:      default_after_days  -> loan-level default trigger
 */
export function recalculateSchedule(loan, policy, now = new Date()) {
  let maxDaysLate = 0;
  let penaltyOutstanding = 0;
  let principalOutstanding = 0;
  let interestOutstanding = 0;
  let anyOverdue = false;
  let anyPending = false;

  for (const item of loan.repayment_schedule) {
    const remainingPrincipal = Math.max(0, Math.round((item.principal_due - item.principal_paid) * 100) / 100);
    const remainingInterest = Math.max(0, Math.round((item.interest_due - item.interest_paid) * 100) / 100);
    const remainingTotal = remainingPrincipal + remainingInterest;

    principalOutstanding += remainingPrincipal;
    interestOutstanding += remainingInterest;

    if (remainingTotal <= 0) {
      item.status = 'paid';
      penaltyOutstanding += Math.max(0, item.penalty_accrued - item.penalty_paid);
      continue;
    }

    const daysLate = daysBetween(now, item.due_date);

    if (daysLate <= 0) {
      item.status = item.principal_paid > 0 || item.interest_paid > 0 ? 'partial' : 'pending';
      anyPending = true;
    } else if (daysLate <= Number(policy.grace_period_days || 0)) {
      item.status = item.principal_paid > 0 || item.interest_paid > 0 ? 'partial' : 'pending';
      anyPending = true;
    } else {
      const weeksLate = Math.ceil((daysLate - Number(policy.grace_period_days || 0)) / 7);
      const penalty =
        policy.penalty_type === 'percentage_of_due'
          ? remainingTotal * (Number(policy.penalty_amount || 0) / 100) * weeksLate
          : Number(policy.penalty_amount || 0) * weeksLate;

      item.penalty_accrued = Math.max(item.penalty_accrued, Math.round(penalty * 100) / 100);
      item.status = item.principal_paid > 0 || item.interest_paid > 0 ? 'partial' : 'overdue';
      anyOverdue = true;
      maxDaysLate = Math.max(maxDaysLate, daysLate);
    }

    penaltyOutstanding += Math.max(0, item.penalty_accrued - item.penalty_paid);
  }

  loan.balances.principal_outstanding = Math.round(principalOutstanding * 100) / 100;
  loan.balances.interest_outstanding = Math.round(interestOutstanding * 100) / 100;
  loan.balances.penalty_outstanding = Math.round(penaltyOutstanding * 100) / 100;

  loan.default_info.days_late = maxDaysLate;

  const isDefault = maxDaysLate >= Number(policy.default_after_days || Infinity);
  if (isDefault && !loan.default_info.is_default) {
    loan.default_info.is_default = true;
    loan.default_info.defaulted_at = new Date();
  } else if (!isDefault) {
    loan.default_info.is_default = false;
  }

  const totalOutstanding = principalOutstanding + interestOutstanding + penaltyOutstanding;

  return { totalOutstanding, anyOverdue, anyPending, isDefault };
}

export default { recalculateSchedule };