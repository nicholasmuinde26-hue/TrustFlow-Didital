import ChamaLoan from '../../models/ChamaLoan.js';
import Chama from '../../models/Chama.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import { getOrCreatePolicy } from './Loanpolicy.service.js';
import { getMemberSavings, getExistingOutstanding } from './loanSavings.service.js';
import { OPEN_LOAN_STATUSES, LOAN_IN_PROGRESS_STATUSES, AWAITING_DECISION_STATUSES } from './Loan.constants.js';

const round2 = (n) => Math.round((n || 0) * 100) / 100;

/** Member "My Loans" summary — spec section 2 & 20. */
export async function getMemberLoanSummary({ chama, membership }) {
  const policy = await getOrCreatePolicy(chama._id);
  const savings = await getMemberSavings(chama._id, membership._id);
  const loanLimit = round2(savings * Number(policy.loan_multiplier || 0));

  // LOAN_IN_PROGRESS_STATUSES (not just OPEN_LOAN_STATUSES) so the
  // member's dashboard already shows this loan while it's still
  // submitted/pending_approval — not only once an official has fully
  // approved it. The status field on the returned object is what lets
  // the UI distinguish "awaiting approval" from "disbursed" etc.
  const activeLoan = await ChamaLoan.findOne({
    chama_id: chama._id,
    membership_id: membership._id,
    status: { $in: LOAN_IN_PROGRESS_STATUSES },
  }).sort({ createdAt: -1 });

  const outstanding = activeLoan
    ? round2(
        activeLoan.balances.principal_outstanding +
          activeLoan.balances.interest_outstanding +
          activeLoan.balances.penalty_outstanding
      )
    : 0;

  const nextInstallment = activeLoan?.repayment_schedule.find((i) => i.status !== 'paid') || null;

  const totalOutstandingAcrossLoans = await getExistingOutstanding(chama._id, membership._id);
  const availableCapacity = round2(Math.max(0, loanLimit - totalOutstandingAcrossLoans));

  const pendingGuaranteeRequests = await ChamaLoan.find({
    chama_id: chama._id,
    'guarantors.membership_id': membership._id,
    'guarantors.status': 'pending',
  }).select('reference amount purpose guarantors membership_id');

  // Approval-chain progress — only meaningful while the loan is still
  // awaiting a decision, but harmless to include either way. Lets the
  // dashboard show "1 of 2 approvals in" instead of just a status word.
  const isAwaitingDecision = activeLoan && AWAITING_DECISION_STATUSES.includes(activeLoan.status);
  const requiredApprovalRoles = activeLoan?.required_approval_roles?.length
    ? activeLoan.required_approval_roles
    : ['chairperson', 'treasurer'];
  const approvals = (activeLoan?.approvals || []).map((a) => ({
    role: a.role,
    decision: a.decision,
    decided_at: a.decided_at,
  }));

  return {
    savings_balance: savings,
    loan_limit: loanLimit,
    loan_multiplier: policy.loan_multiplier,
    active_loan: activeLoan
      ? {
          id: activeLoan._id,
          reference: activeLoan.reference,
          amount: activeLoan.amount,
          purpose: activeLoan.purpose,
          status: activeLoan.status,
          outstanding,
          next_payment: nextInstallment
            ? { amount: round2(nextInstallment.total_due - nextInstallment.principal_paid - nextInstallment.interest_paid), due_date: nextInstallment.due_date }
            : null,
          // Only populated while awaiting a decision — a disbursed/active
          // loan has already cleared its approval chain, so there's
          // nothing left to track here.
          required_approval_roles: isAwaitingDecision ? requiredApprovalRoles : [],
          approvals: isAwaitingDecision ? approvals : [],
        }
      : null,
    outstanding_total: totalOutstandingAcrossLoans,
    available_borrowing_capacity: availableCapacity,
    can_apply: !activeLoan || Number(policy.max_active_loans_per_member || 1) > 1,
    pending_guarantee_requests: pendingGuaranteeRequests.map((l) => ({
      loan_id: l._id,
      reference: l.reference,
      amount: l.amount,
      purpose: l.purpose,
      guaranteed_amount: l.guarantors.find((g) => String(g.membership_id) === String(membership._id))?.guaranteed_amount,
    })),
  };
}

export async function listMemberLoans({ chama, membership }) {
  return ChamaLoan.find({ chama_id: chama._id, membership_id: membership._id }).sort({ createdAt: -1 });
}

/** Official "loan book" — spec section 21. */
export async function getPortfolio({ chama }) {
  const loans = await ChamaLoan.find({ chama_id: chama._id })
    .populate({ path: 'membership_id', populate: { path: 'user_id', select: 'name phone' } })
    .sort({ createdAt: -1 });

  let totalOutstanding = 0;
  let totalDisbursed = 0;
  let overdue = 0;
  let defaulted = 0;
  let interestEarned = 0;

  // Repayment rate: of everything that has fallen due across the
  // portfolio's repayment schedules so far, what fraction has actually
  // been collected. Installments that aren't due yet don't count either
  // way — a loan that's still mid-term with no missed payments should
  // read as "on track", not drag the rate down for money not yet owed.
  let amountDueToDate = 0;
  let amountCollectedOfDue = 0;

  const now = new Date();
  const openStatuses = new Set(OPEN_LOAN_STATUSES);

  for (const loan of loans) {
    const outstanding = round2(
      loan.balances.principal_outstanding + loan.balances.interest_outstanding + loan.balances.penalty_outstanding
    );
    if (openStatuses.has(loan.status)) totalOutstanding = round2(totalOutstanding + outstanding);
    if (['disbursed', 'active', 'partially_repaid', 'overdue', 'defaulted', 'recovered', 'closed'].includes(loan.status)) {
      totalDisbursed = round2(totalDisbursed + loan.amount);
    }
    if (loan.status === 'overdue') overdue = round2(overdue + outstanding);
    if (loan.status === 'defaulted') defaulted = round2(defaulted + outstanding);

    const interestPaid = loan.repayment_schedule.reduce((s, i) => s + (i.interest_paid || 0), 0);
    interestEarned = round2(interestEarned + interestPaid);

    for (const installment of loan.repayment_schedule) {
      const isDue = installment.status !== 'pending' || new Date(installment.due_date) <= now;
      if (!isDue) continue;
      amountDueToDate += installment.total_due || 0;
      amountCollectedOfDue += (installment.principal_paid || 0) + (installment.interest_paid || 0);
    }
  }

  // No installments due yet anywhere in the portfolio (e.g. a brand-new
  // book) reads as 100% rather than 0/0 — nothing has been missed.
  const repaymentRatePercent = amountDueToDate > 0
    ? round2(Math.min(100, (amountCollectedOfDue / amountDueToDate) * 100))
    : 100;

  const awaitingDecision = loans.filter((l) => ['submitted', 'pending_approval', 'eligible', 'draft'].includes(l.status));


  return {
    summary: {
      total_outstanding: totalOutstanding,
      total_disbursed: totalDisbursed,
      overdue,
      defaulted,
      interest_earned: interestEarned,
      loan_count: loans.length,
      awaiting_decision_count: awaitingDecision.length,
      repayment_rate_percent: repaymentRatePercent,
      all_loans_current: overdue === 0 && defaulted === 0,
    },
    loans: loans.map((loan) => ({
      id: loan._id,
      _id: loan._id,
      reference: loan.reference,
      // Applicant's own membership id — required by the frontend to
      // determine "is the current viewer the applicant?" (conflict-of-
      // interest recusal). Without this the check silently falls back to
      // comparing undefined to undefined and misfires for every viewer.
      membership_id: loan.membership_id?._id || loan.membership_id,
      member_name: loan.membership_id?.user_id?.name || 'Unknown',
      member_phone: loan.membership_id?.user_id?.phone || loan.phone_number || '',
      principal: loan.amount,
      amount: loan.amount,
      purpose: loan.purpose,
      repayment_period_months: loan.repayment_period_months,
      repayment_frequency: loan.repayment_frequency,
      disbursement_method: loan.disbursement_method,
      required_approval_roles: loan.required_approval_roles,
      approvals: loan.approvals || [],
      // Conflict-of-interest routing data (spec section 5) — needed so the
      // approvals queue can show the real recusal state instead of it
      // being derived incorrectly on the frontend.
      conflict_of_interest: loan.conflict_of_interest || false,
      recused_roles: loan.recused_roles || [],
      recusal_quorum_required: loan.recusal_quorum_required || 0,
      outstanding: round2(
        loan.balances.principal_outstanding + loan.balances.interest_outstanding + loan.balances.penalty_outstanding
      ),
      days_late: loan.default_info?.days_late || 0,
      status: loan.status,
      createdAt: loan.createdAt,
      // Decision + disbursement audit trail — needed so the dashboard can
      // show approved/rejected/disbursed loans as a clear, read-only
      // history instead of those loans just disappearing from view once
      // they leave the active approvals queue.
      rejected_at: loan.rejected_at || null,
      rejection_reason: loan.rejection_reason || null,
      approved_at: loan.approved_at || null,
      disbursement: {
        status: loan.disbursement?.status || null,
        provider: loan.disbursement?.provider || null,
        provider_reference: loan.disbursement?.provider_reference || null,
        disbursed_at: loan.disbursement?.disbursed_at || null,
        failure_reason: loan.disbursement?.failure_reason || null,
      },
      // Needed as the optimistic-concurrency "versionToken" the approve/
      // reject confirmation flow sends back with the decision — without it
      // the frontend had nothing to send, so decide()'s stale-record check
      // was silently never triggered.
      updatedAt: loan.updatedAt,
    })),
  };
}

/** Chama-level portfolio health ratios — spec section 24. */
export async function getLoanHealth({ chama }) {
  const { summary } = await getPortfolio({ chama });

  const chamaDoc = await Chama.findById(chama._id).select('monthly_savings');
  const memberCount = await ChamaMembership.countDocuments({ chama_id: chama._id, status: 'active' });
  const memberDeposits = round2((chamaDoc?.monthly_savings || 0) * memberCount) || 1;

  const loanToDepositRatio = round2((summary.total_outstanding / memberDeposits) * 100);
  const portfolioAtRisk = summary.total_outstanding > 0 ? round2((summary.overdue / summary.total_outstanding) * 100) : 0;

  const totalLoans = await ChamaLoan.countDocuments({ chama_id: chama._id });
  const defaultedLoans = await ChamaLoan.countDocuments({ chama_id: chama._id, status: { $in: ['defaulted', 'recovered'] } });
  const defaultRate = totalLoans > 0 ? round2((defaultedLoans / totalLoans) * 100) : 0;

  return {
    ...summary,
    loan_to_deposit_ratio_percent: loanToDepositRatio,
    portfolio_at_risk_percent: portfolioAtRisk,
    default_rate_percent: defaultRate,
  };
}

export default { getMemberLoanSummary, listMemberLoans, getPortfolio, getLoanHealth };