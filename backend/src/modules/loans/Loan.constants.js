export const LOAN_STATUS = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  ELIGIBILITY_FAILED: 'eligibility_failed',
  // Eligible, but governance rules can't be satisfied: the applicant holds
  // one of the required approval roles (e.g. chairperson/treasurer) and
  // there aren't enough other independent officials to form the recusal
  // quorum in their place. See Loanconflict.service.js.
  BLOCKED_CONFLICT: 'blocked_conflict',
  PENDING_APPROVAL: 'pending_approval',
  REJECTED: 'rejected',
  APPROVED: 'approved',
  DISBURSEMENT_PENDING: 'disbursement_pending',
  DISBURSED: 'disbursed',
  ACTIVE: 'active',
  PARTIALLY_REPAID: 'partially_repaid',
  OVERDUE: 'overdue',
  DEFAULTED: 'defaulted',
  RECOVERED: 'recovered',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
});

// Every role that is treated as a Chama "official" for loan governance
// purposes — able to review applications, sit on the approval chain, and
// (for committee_member) fill in for a recused chairperson/treasurer seat.
// Kept in one place so approval, disbursement, and controller-level access
// checks can't drift apart.
export const LOAN_OFFICIAL_ROLES = ['treasurer', 'chairperson', 'secretary', 'auditor', 'committee_member'];

// Statuses in which the loan still carries an outstanding balance and
// therefore counts against "one active loan at a time" / portfolio totals.
export const OPEN_LOAN_STATUSES = [
  LOAN_STATUS.APPROVED,
  LOAN_STATUS.DISBURSEMENT_PENDING,
  LOAN_STATUS.DISBURSED,
  LOAN_STATUS.ACTIVE,
  LOAN_STATUS.PARTIALLY_REPAID,
  LOAN_STATUS.OVERDUE,
  LOAN_STATUS.DEFAULTED,
];

export const AWAITING_DECISION_STATUSES = [
  LOAN_STATUS.SUBMITTED,
  LOAN_STATUS.PENDING_APPROVAL,
];

export const GUARANTOR_STATUS = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
});

export const LOAN_TYPE = Object.freeze({
  STANDARD: 'standard',
  EMERGENCY: 'emergency',
  TOPUP: 'topup',
  GROUP: 'group',
});

export const PAYMENT_SOURCE = Object.freeze({
  MPESA: 'mpesa',
  CONTRIBUTION_DEDUCTION: 'contribution_deduction',
  MANUAL: 'manual',
  GUARANTOR_RECOVERY: 'guarantor_recovery',
});

export const loanReference = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `LN-${year}-${random}`;
};

export const paymentReference = () => {
  const random = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `LNPAY-${random}`;
};