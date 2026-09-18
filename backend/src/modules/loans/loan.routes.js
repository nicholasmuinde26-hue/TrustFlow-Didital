import express from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import { requireChamaMember, requireChamaChairperson } from '../../middleware/chama.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import {
  requireLeadershipStepUp,
  STEP_UP_ACTIONS
} from '../../middleware/leadershipSession.middleware.js';
import * as loan from './Loan.controller.js';

const router = express.Router();
router.use(protect);
router.use('/:chamaId/loans', requireChamaMember);

// Loan viewing - basic permissions
router.get('/:chamaId/loans/me/summary', requirePermission('loans.view'), loan.getMySummary);
router.get('/:chamaId/loans/me', requirePermission('loans.view'), loan.listMyLoans);
router.get('/:chamaId/loans/eligibility-check', requirePermission('loans.view'), loan.checkEligibility);
router.get('/:chamaId/loans/my-guarantees', requirePermission('loans.view'), loan.listMyGuarantees);
router.get('/:chamaId/loans/policy', requirePermission('loans.view'), loan.getPolicy);
// FIX: these two must come BEFORE the /:loanId route below - Express matches
// routes in registration order, so /loans/portfolio and /loans/health were
// being swallowed by /:chamaId/loans/:loanId (with "portfolio"/"health"
// cast as a loanId ObjectId, causing a CastError).
router.get('/:chamaId/loans/portfolio', requirePermission('loans.view'), loan.listPortfolio);
router.get('/:chamaId/loans/health', requirePermission('loans.view'), loan.getLoanHealth);
router.get('/:chamaId/loans/:loanId', requirePermission('loans.view'), loan.getLoan);
router.get('/:chamaId/loans/:loanId/repayments', requirePermission('loans.view'), loan.getRepaymentHistory);

// Loan application - members can apply for themselves
router.post('/:chamaId/loans', requirePermission('loans.apply'), loan.applyForLoan);

// Loan management - requires higher permissions
// Loan policy sets the interest rate, multiplier and penalties every
// member borrows under. Changing it quietly is one of the highest-value
// moves an attacker could make, so it takes a fresh PIN confirmation.
router.patch('/:chamaId/loans/policy', requireChamaChairperson, requireLeadershipStepUp(STEP_UP_ACTIONS.UPDATE_LOAN_POLICY), requirePermission('settings.manage'), loan.updatePolicy);

// Loan approval workflow - critical security endpoints
router.get('/:chamaId/loans/:loanId/review', requirePermission('loans.review'), loan.getReviewPacket);
router.get('/:chamaId/loans/:loanId/assess-risk', requirePermission('loans.review'), loan.assessLoanApprovalRisk);
router.post('/:chamaId/loans/:loanId/decision', requirePermission('loans.approve'), loan.decideLoan);

// Loan disbursement - critical financial operation.
//
// Money leaving the group account is the single most damaging thing a
// compromised leader session could do, so it requires a fresh PIN
// confirmation regardless of which screen it was launched from (the
// Leadership Desk's Loans tab or the standalone Loans page). The client
// surfaces the prompt automatically off the LEADERSHIP_STEP_UP_REQUIRED
// response code.
router.post('/:chamaId/loans/:loanId/disburse', requireLeadershipStepUp(STEP_UP_ACTIONS.DISBURSE_FUNDS), requirePermission('loans.disburse'), loan.initiateDisbursement);
router.post('/:chamaId/loans/:loanId/confirm-disbursement', requireLeadershipStepUp(STEP_UP_ACTIONS.DISBURSE_FUNDS), requirePermission('loans.disburse'), loan.confirmManualDisbursement);

// Loan guarantor management
router.patch('/:chamaId/loans/:loanId/guarantors/:membershipId', requirePermission('loans.approve'), loan.replaceGuarantor);
router.post('/:chamaId/loans/:loanId/guarantee-response', requirePermission('loans.view'), loan.respondToGuarantee);

// Loan repayments
router.post('/:chamaId/loans/:loanId/repayments', requirePermission('contributions.record'), loan.recordManualRepayment);
router.post('/:chamaId/loans/:loanId/repayments/stk', requirePermission('contributions.record'), loan.initiateStkRepayment);

// Loan status and recovery - admin functions
router.post('/:chamaId/loans/:loanId/refresh-status', requirePermission('loans.review'), loan.refreshLoanStatus);
router.post('/:chamaId/loans/refresh-statuses', requirePermission('loans.review'), loan.refreshAllLoans);
router.post('/:chamaId/loans/:loanId/recovery', requirePermission('loans.approve'), loan.initiateRecovery);
router.post('/:chamaId/loans/:loanId/recovery/guarantors', requirePermission('loans.approve'), loan.recoverFromGuarantors);

export default router;