import ChamaLoan from '../../models/ChamaLoan.js';
import Chama from '../../models/Chama.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import { getOrCreatePolicy } from './loanPolicy.service.js';
import { getMemberSavings, getExistingOutstanding } from './loanSavings.service.js';
import { OPEN_LOAN_STATUSES } from './loan.constants.js';

const round2 = (n) => Math.round((n || 0) * 100) / 100;

/** Member "My Loans" summary — spec section 2 & 20. */
export async function getMemberLoanSummary({ chama, membership }) {
  const policy = await getOrCreatePolicy(chama._id);
  const savings = await getMemberSavings(chama._id, membership._id);
  const loanLimit = round2(savings * Number(policy.loan_multiplier || 0));

  const activeLoan = await ChamaLoan.findOne({
    chama_id: chama._id,
    membership_id: membership._id,
    status: { $in: OPEN_LOAN_STATUSES },
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

  return {
    savings_balance: savings,
    loan_limit: loanLimit,
    loan_multiplier: policy.loan_multiplier,
    active_loan: activeLoan
      ? {
          id: activeLoan._id,
          reference: activeLoan.reference,
          amount: activeLoan.amount,
          status: activeLoan.status,
          outstanding,
          next_payment: nextInstallment
            ? { amount: round2(nextInstallment.total_due - nextInstallment.principal_paid - nextInstallment.interest_paid), due_date: nextInstallment.due_date }
            : null,
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
  }

  const awaitingDecision = loans.filter((l) => ['submitted', 'pending_approval'].includes(l.status));

  return {
    summary: {
      total_outstanding: totalOutstanding,
      total_disbursed: totalDisbursed,
      overdue,
      defaulted,
      interest_earned: interestEarned,
      loan_count: loans.length,
      awaiting_decision_count: awaitingDecision.length,
    },
    loans: loans.map((loan) => ({
      id: loan._id,
      reference: loan.reference,
      member_name: loan.membership_id?.user_id?.name || 'Unknown',
      principal: loan.amount,
      outstanding: round2(
        loan.balances.principal_outstanding + loan.balances.interest_outstanding + loan.balances.penalty_outstanding
      ),
      days_late: loan.default_info?.days_late || 0,
      status: loan.status,
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