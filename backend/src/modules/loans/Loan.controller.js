import AppError from '../../utils/AppError.js';
import loanApplication from './Loanapplication.service.js';
import loanGuarantor from './Loanguarantor.service.js';
import loanApproval from './Loanapproval.service.js';
import loanDisbursement from './Loandisbursement.service.js';
import loanRepayment from './Loanrepayment.service.js';
import loanRecovery from './loanRecovery.service.js';
import loanDashboard from './Loandashboard.service.js';
import loanPolicy from './Loanpolicy.service.js';
import { LOAN_OFFICIAL_ROLES } from './Loan.constants.js';

// Committee members are included because the recusal quorum (spec section
// 5/9 — "other authorized committee members" stand in when an officer is
// recused as an applicant) needs them to be able to review and decide.
const OFFICIAL_ROLES = LOAN_OFFICIAL_ROLES;

const send = (handler) => async (req, res, next) => {
  try {
    const data = await handler(req);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

function requireOfficial(req) {
  if (!OFFICIAL_ROLES.includes(req.membership.role)) {
    throw new AppError('This action is restricted to Chama officials', 403);
  }
}

// Disbursement is normally treasurer-only, but the treasurer can never
// disburse their own loan — the chairperson is the authorized fallback
// when the treasurer is the applicant. That per-loan nuance needs the
// loan itself, so only a coarse role gate happens here; the specific
// check is enforced by Loandisbursement.service.js#assertAuthorizedDisburser.
function requireDisburserRole(req) {
  if (!['treasurer', 'chairperson'].includes(req.membership.role)) {
    throw new AppError('This action is restricted to the treasurer (or the chairperson when the treasurer is the applicant)', 403);
  }
}

// ==========================================================
// MEMBER — DASHBOARD & APPLICATION (spec sections 2, 3, 20)
// ==========================================================

export const getMySummary = send((req) => loanDashboard.getMemberLoanSummary({ chama: req.chama, membership: req.membership }));

export const listMyLoans = send((req) => loanDashboard.listMemberLoans({ chama: req.chama, membership: req.membership }));

export const checkEligibility = send(async (req) => {
  const policy = await loanPolicy.getOrCreatePolicy(req.chama._id);
  const { amount, purpose, repaymentPeriodMonths, repaymentFrequency, loanType } = req.query;
  const loanEligibilityService = (await import('./Loaneligibility.service.js')).default;
  return loanEligibilityService.checkEligibility({
    chama: req.chama,
    membership: req.membership,
    policy,
    amount: Number(amount || 0),
    purpose: purpose || 'General',
    repaymentPeriodMonths: Number(repaymentPeriodMonths || 1),
    repaymentFrequency: repaymentFrequency || 'monthly',
    loanType: loanType || 'standard',
  });
});

export const listMyGuarantees = send(async (req) => {
  const ChamaLoan = (await import('../../models/ChamaLoan.js')).default;
  const loans = await ChamaLoan.find({
    chama_id: req.chama._id,
    'guarantors.membership_id': req.membership._id,
  })
    .populate({ path: 'membership_id', populate: { path: 'user_id', select: 'name phone email' } })
    .sort({ createdAt: -1 });

  return loans.map((loanItem) => {
    const myGuarantee = (loanItem.guarantors || []).find((g) => String(g.membership_id) === String(req.membership._id));
    return {
      loan_id: loanItem._id,
      reference: loanItem.reference,
      borrower_name: loanItem.membership_id?.user_id?.name || 'Member',
      amount: loanItem.amount,
      purpose: loanItem.purpose,
      guaranteed_amount: myGuarantee?.guaranteed_amount || 0,
      status: myGuarantee?.status || 'pending',
      requested_at: myGuarantee?.requested_at,
    };
  });
});

export const applyForLoan = send((req) =>
  loanApplication.applyForLoan({ chama: req.chama, membership: req.membership, userId: req.user._id, data: req.body })
);

export const getLoan = send(async (req) => {
  const loan = await loanApplication.getLoanOrThrow(req.chama._id, req.params.loanId);
  const isOwner = String(loan.membership_id) === String(req.membership._id);
  const isGuarantor = loan.guarantors.some((g) => String(g.membership_id) === String(req.membership._id));
  if (!isOwner && !isGuarantor && !OFFICIAL_ROLES.includes(req.membership.role)) {
    throw new AppError('You do not have access to this loan', 403);
  }
  return loan;
});

export const replaceGuarantor = send(async (req) => {
  const loan = await loanApplication.getLoanOrThrow(req.chama._id, req.params.loanId);
  return loanApplication.replaceGuarantor({
    chama: req.chama,
    loan,
    membership: req.membership,
    oldGuarantorMembershipId: req.params.membershipId,
    newGuarantor: req.body,
  });
});

// ==========================================================
// GUARANTORS (spec section 5)
// ==========================================================

export const respondToGuarantee = send((req) =>
  loanGuarantor.respondToGuarantee({
    chamaId: req.chama._id,
    loanId: req.params.loanId,
    guarantorMembershipId: req.membership._id,
    decision: req.body.decision,
    userId: req.user._id,
  })
);

// ==========================================================
// OFFICIALS — REVIEW & APPROVAL (spec sections 7, 8, 9)
// ==========================================================

export const listPortfolio = send((req) => {
  requireOfficial(req);
  return loanDashboard.getPortfolio({ chama: req.chama });
});

export const getLoanHealth = send((req) => {
  requireOfficial(req);
  return loanDashboard.getLoanHealth({ chama: req.chama });
});

export const getReviewPacket = send((req) => {
  requireOfficial(req);
  return loanApproval.getReviewPacket(req.chama._id, req.params.loanId);
});

export const assessLoanApprovalRisk = send((req) => {
  requireOfficial(req);
  return loanApproval.assessLoanApprovalRisk({
    chamaId: req.chama._id,
    loanId: req.params.loanId,
    membershipId: req.membership._id
  });
});

export const decideLoan = send((req) => {
  requireOfficial(req);
  return loanApproval.decide({
    chama: req.chama,
    loanId: req.params.loanId,
    membership: req.membership,
    userId: req.user._id,
    decision: req.body.decision,
    comment: req.body.comment,
    ipAddress: req.ip,
    versionToken: req.body.versionToken
  });
});

// ==========================================================
// DISBURSEMENT (spec section 11)
// ==========================================================

export const initiateDisbursement = send((req) => {
  requireDisburserRole(req);
  return loanDisbursement.initiateDisbursement({ chama: req.chama, loanId: req.params.loanId, userId: req.user._id, membership: req.membership });
});

export const confirmManualDisbursement = send((req) => {
  requireDisburserRole(req);
  return loanDisbursement.confirmManualDisbursement({
    chama: req.chama,
    loanId: req.params.loanId,
    userId: req.user._id,
    membership: req.membership,
    disbursementMethod: req.body.disbursement_method,
    externalReference: req.body.external_reference,
  });
});

// ==========================================================
// REPAYMENT (spec sections 14, 15, 16)
// ==========================================================

export const recordManualRepayment = send((req) => {
  requireOfficial(req);
  return loanRepayment.recordRepayment({
    chama: req.chama,
    loanId: req.params.loanId,
    amount: req.body.amount,
    source: 'manual',
    externalReference: req.body.external_reference || null,
    recordedBy: req.user._id,
  });
});

export const getRepaymentHistory = send((req) => loanRepayment.getRepaymentHistory(req.chama._id, req.params.loanId));

export const refreshLoanStatus = send((req) => {
  requireOfficial(req);
  return loanRepayment.refreshLoanStatus({ chama: req.chama, loanId: req.params.loanId });
});

export const refreshAllLoans = send((req) => {
  requireOfficial(req);
  return loanRepayment.refreshAllLoans(req.chama._id);
});

// ==========================================================
// DEFAULT & RECOVERY (spec sections 17, 18)
// ==========================================================

export const initiateRecovery = send((req) => {
  requireOfficial(req);
  return loanRecovery.initiateRecovery({ chama: req.chama, loanId: req.params.loanId, userId: req.user._id });
});

export const recoverFromGuarantors = send((req) => {
  requireOfficial(req);
  return loanRecovery.recoverFromGuarantors({ chama: req.chama, loanId: req.params.loanId, userId: req.user._id });
});

// ==========================================================
// POLICY (spec section 7, configurable approval matrix / multiplier / etc.)
// ==========================================================

export const getPolicy = send((req) => loanPolicy.getOrCreatePolicy(req.chama._id));

export const updatePolicy = send((req) => {
  requireOfficial(req);
  return loanPolicy.updatePolicy(req.chama._id, req.body, req.user._id);
});

export const initiateStkRepayment = send((req) => loanRepayment.initiateStkRepayment({ chama: req.chama, loanId: req.params.loanId, membership: req.membership, amount: req.body.amount, phoneNumber: req.body.phone_number, userId: req.user._id }));
