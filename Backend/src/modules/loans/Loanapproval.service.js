import ChamaLoan from '../../models/ChamaLoan.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import AppError from '../../utils/AppError.js';
import { getOrCreatePolicy, resolveApprovalRoles } from './Loanpolicy.service.js';
import { LOAN_STATUS } from './Loan.constants.js';
import { assessRisk } from './Loanrisk.service.js';
import { createAuditLog, AUDIT_SCOPE_TYPES } from '../../services/audit.service.js';
import { AUDIT_ACTIONS } from '../../constants/audit.constants.js';

/**
 * Everything an official needs to review a loan before deciding —
 * applicant history, the loan itself, guarantors, and an advisory
 * risk assessment. See spec section 8 & 22.
 */
export async function getReviewPacket(chamaId, loanId) {
  const loan = await ChamaLoan.findOne({ _id: loanId, chama_id: chamaId })
    .populate({ path: 'membership_id', populate: { path: 'user_id', select: 'name phone' } })
    .populate({ path: 'guarantors.membership_id', populate: { path: 'user_id', select: 'name phone' } });

  if (!loan) throw new AppError('Loan not found', 404);

  const policy = await getOrCreatePolicy(chamaId);
  const membership = await ChamaMembership.findById(loan.membership_id).populate('user_id', 'name phone');

  const priorLoans = await ChamaLoan.find({
    chama_id: chamaId,
    membership_id: loan.membership_id,
    _id: { $ne: loan._id },
  }).select('status amount closure').sort({ createdAt: -1 }).limit(10);

  let risk = loan.risk?.score ? loan.risk : null;
  if (!risk) {
    risk = await assessRisk({
      chama: { _id: chamaId },
      membership,
      loan,
      membershipMonths: loan.eligibility?.membership_months || 0,
    });
    loan.risk = risk;
    await loan.save();
  }

  return { loan, priorLoans, risk };
}

export async function decide({ chama, loanId, membership, userId, decision, comment, ipAddress }) {
  if (!['approved', 'rejected'].includes(decision)) {
    throw new AppError('Decision must be approved or rejected', 400);
  }

  const loan = await ChamaLoan.findOne({ _id: loanId, chama_id: chama._id });
  if (!loan) throw new AppError('Loan not found', 404);

  const awaitingStatuses = [
    LOAN_STATUS.PENDING_APPROVAL,
    LOAN_STATUS.SUBMITTED,
    LOAN_STATUS.DRAFT,
    'eligible',
    'pending_approval',
    'submitted',
    'draft',
  ];

  if (!awaitingStatuses.includes(loan.status)) {
    throw new AppError('Loan is not currently awaiting approval', 400);
  }

  const requiredRoles = loan.required_approval_roles?.length
    ? loan.required_approval_roles
    : resolveApprovalRoles(await getOrCreatePolicy(chama._id), loan.amount);

  const isOfficial = ['treasurer', 'chairperson', 'secretary', 'admin'].includes(membership.role);
  if (!isOfficial && !requiredRoles.includes(membership.role)) {
    throw new AppError(`Your role (${membership.role}) is not part of the approval chain for this loan`, 403);
  }


  const alreadyDecided = loan.approvals.some((a) => String(a.membership_id) === String(membership._id));
  if (alreadyDecided) {
    throw new AppError('You have already recorded a decision for this loan', 400);
  }

  loan.approvals.push({
    membership_id: membership._id,
    role: membership.role,
    decision,
    comment: comment || null,
    decided_at: new Date(),
    ip_address: ipAddress || null,
  });

  if (decision === 'rejected') {
    loan.status = LOAN_STATUS.REJECTED;
    loan.rejected_at = new Date();
    loan.rejection_reason = comment || `Rejected by ${membership.role}`;
  } else {
    const approvedRoles = new Set(
      loan.approvals.filter((a) => a.decision === 'approved').map((a) => a.role)
    );
    const allRequiredRolesApproved = requiredRoles.every((role) => approvedRoles.has(role));

    if (allRequiredRolesApproved) {
      loan.status = LOAN_STATUS.APPROVED;
      loan.approved_at = new Date();
      await buildLoanAgreement(loan);
    }
  }

  await loan.save();

  await createAuditLog({
    actorUserId: userId,
    scopeType: AUDIT_SCOPE_TYPES.CHAMA,
    chamaId: chama._id,
    action: decision === 'approved' ? AUDIT_ACTIONS.LOAN_APPROVED : AUDIT_ACTIONS.LOAN_REJECTED,
    resourceType: 'ChamaLoan',
    resourceId: loan._id,
    after: { status: loan.status, decided_by: membership._id, role: membership.role },
  }).catch(() => null);

  return loan;
}

/**
 * Builds the loan agreement (interest + total payable) and repayment
 * schedule once every required approval is in. See spec section 10.
 */
export async function buildLoanAgreement(loan) {
  const principal = loan.amount;
  const rate = Number(loan.interest_rate_percent || 0) / 100;

  let interestAmount;
  if (loan.interest_type === 'reducing_balance') {
    // Approximate reducing-balance interest across the term using the
    // average outstanding principal (n+1)/(2n) of the flat amount —
    // a standard simplification for short Chama loan terms.
    const n = loan.repayment_period_months;
    interestAmount = Math.round(principal * rate * ((n + 1) / (2 * n)) * 100) / 100;
  } else {
    interestAmount = Math.round(principal * rate * 100) / 100;
  }

  const totalPayable = principal + interestAmount;
  const installments = loan.repayment_period_months;
  const principalPerInstallment = Math.round((principal / installments) * 100) / 100;
  const interestPerInstallment = Math.round((interestAmount / installments) * 100) / 100;

  const schedule = [];
  let remainingPrincipal = principal;
  let remainingInterest = interestAmount;
  const now = new Date();

  for (let i = 1; i <= installments; i++) {
    const isLast = i === installments;
    const dueDate = new Date(now);
    if (loan.repayment_frequency === 'weekly') {
      dueDate.setDate(dueDate.getDate() + 7 * i);
    } else {
      dueDate.setMonth(dueDate.getMonth() + i);
    }

    const principalDue = isLast ? Math.round(remainingPrincipal * 100) / 100 : principalPerInstallment;
    const interestDue = isLast ? Math.round(remainingInterest * 100) / 100 : interestPerInstallment;
    remainingPrincipal = Math.round((remainingPrincipal - principalDue) * 100) / 100;
    remainingInterest = Math.round((remainingInterest - interestDue) * 100) / 100;

    schedule.push({
      installment_number: i,
      due_date: dueDate,
      principal_due: principalDue,
      interest_due: interestDue,
      total_due: Math.round((principalDue + interestDue) * 100) / 100,
      principal_paid: 0,
      interest_paid: 0,
      penalty_accrued: 0,
      penalty_paid: 0,
      status: 'pending',
      paid_at: null,
    });
  }

  loan.interest_amount = interestAmount;
  loan.total_payable = Math.round(totalPayable * 100) / 100;
  loan.repayment_schedule = schedule;
  loan.balances.principal_outstanding = principal;
  loan.balances.interest_outstanding = interestAmount;

  return loan;
}

export default { getReviewPacket, decide, buildLoanAgreement };