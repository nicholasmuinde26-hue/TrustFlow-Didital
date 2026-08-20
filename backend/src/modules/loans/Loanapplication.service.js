import ChamaLoan from '../../models/ChamaLoan.js';
import AppError from '../../utils/AppError.js';
import { getOrCreatePolicy, resolveApprovalRoles } from './Loanpolicy.service.js';
import { checkEligibility } from './Loaneligibility.service.js';
import { requestGuarantors, allGuaranteesAccepted, anyGuaranteeDeclined, validateGuarantor } from './Loanguarantor.service.js';
import { loanReference, LOAN_STATUS, LOAN_TYPE } from './Loan.constants.js';
import { createAuditLog, AUDIT_SCOPE_TYPES } from '../../services/audit.service.js';
import { AUDIT_ACTIONS } from '../../constants/audit.constants.js';

const REQUIRED_FIELDS_MESSAGE = 'Amount, purpose, repayment period, and repayment frequency are required';

export async function applyForLoan({ chama, membership, userId, data }) {
  const amount = Number(data.amount);
  const repaymentPeriodMonths = Number(data.repayment_period_months);
  const loanType = data.loan_type && Object.values(LOAN_TYPE).includes(data.loan_type) ? data.loan_type : LOAN_TYPE.STANDARD;

  if (!Number.isFinite(amount) || amount <= 0 || !data.purpose) {
    throw new AppError(REQUIRED_FIELDS_MESSAGE, 400);
  }
  if (loanType !== LOAN_TYPE.EMERGENCY && (!Number.isFinite(repaymentPeriodMonths) || repaymentPeriodMonths <= 0)) {
    throw new AppError(REQUIRED_FIELDS_MESSAGE, 400);
  }

  const policy = await getOrCreatePolicy(chama._id);

  let parentLoan = null;
  if (loanType === LOAN_TYPE.TOPUP) {
    if (!policy.topup_enabled) throw new AppError('Loan top-ups are not enabled for this Chama', 400);
    if (!data.parent_loan_id) throw new AppError('A top-up must reference the original loan (parent_loan_id)', 400);

    parentLoan = await ChamaLoan.findOne({
      _id: data.parent_loan_id,
      chama_id: chama._id,
      membership_id: membership._id,
      status: { $in: ['active', 'partially_repaid'] },
    });
    if (!parentLoan) {
      throw new AppError('The referenced loan is not an active loan of yours eligible for a top-up', 400);
    }
  }

  const loan = new ChamaLoan({
    chama_id: chama._id,
    membership_id: membership._id,
    loan_type: loanType,
    parent_loan_id: parentLoan ? parentLoan._id : null,
    amount,
    purpose: data.purpose,
    repayment_period_months: loanType === LOAN_TYPE.EMERGENCY ? 1 : repaymentPeriodMonths,
    repayment_frequency: data.repayment_frequency || 'monthly',
    disbursement_method: data.disbursement_method || 'mpesa',
    phone_number: data.phone_number || null,
    disbursement_account: data.disbursement_account || null,
    status: LOAN_STATUS.DRAFT,
    interest_rate_percent: policy.interest_rate_percent,
    interest_type: policy.interest_type,
    created_by: userId,
  });

  const eligibility = await checkEligibility({
    chama,
    membership,
    policy,
    amount,
    purpose: data.purpose,
    repaymentPeriodMonths: loan.repayment_period_months,
    repaymentFrequency: loan.repayment_frequency,
    loanType,
  });

  loan.eligibility = {
    eligible: eligibility.eligible,
    reason: eligibility.reason,
    savings_balance: eligibility.savings ?? null,
    loan_limit: eligibility.loanLimit ?? null,
    existing_outstanding: eligibility.existingOutstanding ?? null,
    membership_months: eligibility.membershipMonths ?? null,
    checked_at: new Date(),
  };

  if (!eligibility.eligible) {
    loan.status = LOAN_STATUS.ELIGIBILITY_FAILED;
    await loan.save();
    return loan;
  }

  loan.status = LOAN_STATUS.PENDING_APPROVAL;
  loan.submitted_at = new Date();
  if (!loan.reference) loan.reference = loanReference();
  loan.required_approval_roles = resolveApprovalRoles(policy, loan.amount);

  if (Array.isArray(data.guarantors) && data.guarantors.length) {
    await requestGuarantors({ chama, policy, loan, guarantors: data.guarantors }).catch(() => null);
  }

  await loan.save();


  await createAuditLog({
    actorUserId: userId,
    scopeType: AUDIT_SCOPE_TYPES.CHAMA,
    chamaId: chama._id,
    action: AUDIT_ACTIONS.LOAN_CREATED,
    resourceType: 'ChamaLoan',
    resourceId: loan._id,
    after: { amount: loan.amount, status: loan.status, reference: loan.reference },
  }).catch(() => null);

  return loan;
}

/** Moves a loan from "guarantors pending" into the approval queue once every
 *  required guarantee has been accepted (or none were required). */
export async function maybeAutoSubmit(loan, policy) {
  if (loan.status !== LOAN_STATUS.SUBMITTED) return loan;
  if (anyGuaranteeDeclined(loan)) return loan; // stays submitted; applicant must replace the guarantor
  if (!allGuaranteesAccepted(loan)) return loan;

  loan.required_approval_roles = resolveApprovalRoles(policy, loan.amount);
  loan.status = LOAN_STATUS.PENDING_APPROVAL;
  loan.submitted_at = new Date();
  if (!loan.reference) loan.reference = loanReference();

  return loan;
}

export async function getLoanOrThrow(chamaId, loanId) {
  const loan = await ChamaLoan.findOne({ _id: loanId, chama_id: chamaId });
  if (!loan) throw new AppError('Loan not found', 404);
  return loan;
}

export async function replaceGuarantor({ chama, loan, membership, oldGuarantorMembershipId, newGuarantor }) {
  if (String(loan.membership_id) !== String(membership._id)) {
    throw new AppError('Only the applicant can update guarantors on this loan', 403);
  }
  if (loan.status !== LOAN_STATUS.SUBMITTED) {
    throw new AppError('Guarantors can only be changed while the loan is awaiting guarantor acceptance', 400);
  }

  const policy = await getOrCreatePolicy(chama._id);
  await validateGuarantor({
    chama,
    policy,
    guarantorMembershipId: newGuarantor.membership_id,
    proposedAmount: newGuarantor.guaranteed_amount,
    borrowerMembershipId: loan.membership_id,
  });

  loan.guarantors = loan.guarantors.filter((g) => String(g.membership_id) !== String(oldGuarantorMembershipId));
  loan.guarantors.push({
    membership_id: newGuarantor.membership_id,
    guaranteed_amount: newGuarantor.guaranteed_amount,
    status: 'pending',
    requested_at: new Date(),
    responded_at: null,
  });

  await maybeAutoSubmit(loan, policy);
  await loan.save();
  return loan;
}

export default { applyForLoan, maybeAutoSubmit, getLoanOrThrow, replaceGuarantor };