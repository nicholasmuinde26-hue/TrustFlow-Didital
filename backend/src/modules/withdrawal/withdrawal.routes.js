import express from 'express';

import {
  listWithdrawalsController,
  getMyWithdrawalsController,
  getWithdrawalController,
  requestWithdrawalController,
  decideWithdrawalController,
  settleWithdrawalController,
  cancelWithdrawalController,
  listWithdrawalPoliciesController,
  getWithdrawalPolicyController,
  createWithdrawalPolicyController,
  updateWithdrawalPolicyController,
  activateWithdrawalPolicyController,
  archiveWithdrawalPolicyController
} from './withdrawal.controller.js';

import {
  protect
} from '../../middleware/auth.middleware.js';

import {
  requireChamaMember,
  requireChamaTreasurer,
  requireChamaTreasurerOrChairperson
} from '../../middleware/chama.middleware.js';

import {
  requireLeadershipStepUp,
  STEP_UP_ACTIONS
} from '../../middleware/leadershipSession.middleware.js';


import { requireModule } from '../../middleware/module.middleware.js';
const router = express.Router();


// ========================================
// AUTHENTICATION
// ========================================

router.use(
  protect
);


// ========================================
// WITHDRAWAL POLICY CONFIGURATION
// ========================================
//
// Mounted before /:id/withdrawals/:withdrawalId below so
// '/withdrawal-policies/...' never gets swallowed by a withdrawalId
// param match (different path segment, but kept together here for
// readability alongside the rest of the policy routes).
// ========================================

router.get(
  '/:id/withdrawal-policies',
  requireChamaMember, requireModule('withdrawals'),
  requireChamaTreasurerOrChairperson,
  listWithdrawalPoliciesController
);

router.get(
  '/:id/withdrawal-policies/:policyId',
  requireChamaMember, requireModule('withdrawals'),
  requireChamaTreasurerOrChairperson,
  getWithdrawalPolicyController
);

router.post(
  '/:id/withdrawal-policies',
  requireChamaMember, requireModule('withdrawals'),
  requireChamaTreasurerOrChairperson,
  createWithdrawalPolicyController
);

router.patch(
  '/:id/withdrawal-policies/:policyId',
  requireChamaMember, requireModule('withdrawals'),
  requireChamaTreasurerOrChairperson,
  updateWithdrawalPolicyController
);

router.patch(
  '/:id/withdrawal-policies/:policyId/activate',
  requireChamaMember, requireModule('withdrawals'),
  requireChamaTreasurerOrChairperson,
  activateWithdrawalPolicyController
);

router.patch(
  '/:id/withdrawal-policies/:policyId/archive',
  requireChamaMember, requireModule('withdrawals'),
  requireChamaTreasurerOrChairperson,
  archiveWithdrawalPolicyController
);


// ========================================
// LIST WITHDRAWALS
// Officials see everyone's; a plain member is narrowed to their own by
// the controller itself.
// ========================================

router.get(
  '/:id/withdrawals',
  requireChamaMember, requireModule('withdrawals'),
  listWithdrawalsController
);


// ========================================
// MY WITHDRAWALS
// Must be registered before /:withdrawalId below, or 'mine' would be
// parsed as a withdrawal id.
// ========================================

router.get(
  '/:id/withdrawals/mine',
  requireChamaMember, requireModule('withdrawals'),
  getMyWithdrawalsController
);


// ========================================
// GET SINGLE WITHDRAWAL
// ========================================

router.get(
  '/:id/withdrawals/:withdrawalId',
  requireChamaMember, requireModule('withdrawals'),
  getWithdrawalController
);


// ========================================
// REQUEST A WITHDRAWAL
// ANY ACTIVE MEMBER (own) — chairperson may request on a member's
// behalf; withdrawal.service.js enforces that distinction itself.
// ========================================

router.post(
  '/:id/withdrawals',
  requireChamaMember, requireModule('withdrawals'),
  requestWithdrawalController
);


// ========================================
// APPROVE / REJECT A WITHDRAWAL
// TREASURER OR CHAIRPERSON
// ========================================
//
// Getting past this gate only proves the caller holds ONE of the two
// roles a withdrawal policy's eligible_roles could name — submitSignoff
// (approval.service.js) still checks the caller's role against THIS
// request's actual eligible_roles and blocks the requester approving
// their own request, same separation-of-duties guarantee Payout gets
// from requireChamaChairperson being distinct from requireChamaTreasurer.
//
// ========================================

router.patch(
  '/:id/withdrawals/:withdrawalId/decide',
  requireChamaMember, requireModule('withdrawals'),
  requireChamaTreasurerOrChairperson,
  decideWithdrawalController
);


// ========================================
// SETTLE (MARK PAID)
// TREASURER ONLY
// ========================================
//
// Money actually leaving the group account — same class of action as
// loan disbursement (loan.routes.js), so it takes the same fresh PIN
// re-confirmation via requireLeadershipStepUp, regardless of whether
// the call came from the Leadership Desk's Treasury tab or the
// standalone Withdrawals page. The api.js interceptor surfaces the
// prompt automatically off the LEADERSHIP_STEP_UP_REQUIRED response.
// ========================================

router.patch(
  '/:id/withdrawals/:withdrawalId/pay',
  requireChamaMember, requireModule('withdrawals'),
  requireChamaTreasurer,
  requireLeadershipStepUp(STEP_UP_ACTIONS.DISBURSE_FUNDS),
  settleWithdrawalController
);


// ========================================
// CANCEL A WITHDRAWAL
// REQUESTER (own, while pending) OR TREASURER/CHAIRPERSON — enforced
// inside withdrawal.service.js since it depends on WHOSE request this
// is, not just the caller's role.
// ========================================

router.patch(
  '/:id/withdrawals/:withdrawalId/cancel',
  requireChamaMember, requireModule('withdrawals'),
  cancelWithdrawalController
);


export default router;
