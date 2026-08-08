import AppError from '../../utils/AppError.js';
import loanApplication from './loanApplication.service.js';
import loanGuarantor from './loanGuarantor.service.js';
import loanApproval from './loanApproval.service.js';
import loanDisbursement from './loanDisbursement.service.js';
import loanRepayment from './loanRepayment.service.js';
import loanRecovery from './loanRecovery.service.js';
import loanDashboard from './loanDashboard.service.js';
import loanPolicy from './loanPolicy.service.js';

const OFFICIAL_ROLES = ['treasurer', 'chairperson', 'secretary', 'auditor'];

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

function requireTreasurer(req) {
  if (req.membership.role !== 'treasurer') {
    throw new AppError('This action is restricted to the treasurer', 403);
  }
}

// ==========================================================
// MEMBER — DASHBOARD & APPLICATION (spec sections 2, 3, 20)
// ==========================================================

export const getMySummary = send((req) => loanDashboard.getMemberLoanSummary({ chama: req.chama, membership: req.membership }));

export const listMyLoans = send((req) => loanDashboard.listMemberLoans({ chama: req.chama, membership: req.membership }));

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
  });
});

// ==========================================================
// DISBURSEMENT (spec section 11)
// ==========================================================

export const initiateDisbursement = send((req) => {
  requireTreasurer(req);
  return loanDisbursement.initiateDisbursement({ chama: req.chama, loanId: req.params.loanId, userId: req.user._id });
});

export const confirmManualDisbursement = send((req) => {
  requireTreasurer(req);
  return loanDisbursement.confirmManualDisbursement({
    chama: req.chama,
    loanId: req.params.loanId,
    userId: req.user._id,
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
