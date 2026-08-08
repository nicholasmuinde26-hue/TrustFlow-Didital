import express from 'express';

import {
  createPlan,
  getPlanById,
  getPlans,
  updatePlan,
  activatePlan,
  pausePlan,
  resumePlan,
  completePlan,
  cancelPlan,
  getPlanObligations,
  getPlanPayments,
  getPlanFinancialSummary
} from './contributionPlan.controller.js';


// ========================================
// CONTRIBUTION GROUP PLAN ROUTER
// ========================================
//
// Base route:
//
// /api/contribution-groups/:groupId/plans
//
// This router provides a ContributionGroup-
// scoped API for ContributionPlan.
//
// IMPORTANT:
//
// ContributionGroup is the OWNER.
//
// Therefore every request through this
// router is automatically scoped to:
//
// owner_type = ContributionGroup
//
// owner_id = :groupId
//
// This prevents clients from manually
// changing the owner type or owner ID.
//
// ========================================


const router = express.Router({

  mergeParams:

    true

});


// ========================================
// FORCE CONTRIBUTION GROUP OWNERSHIP
// ========================================
//
// This middleware guarantees that all
// controller calls operate on:
//
// owner_type:
//   ContributionGroup
//
// owner_id:
//   req.params.groupId
//
// ========================================
const scopeToContributionGroup = (req, res, next) => {

  if (!req.body) {
    req.body = {};
  }

  if (!req.query) {
    req.query = {};
  }

  req.body.owner_type = "ContributionGroup";
  req.body.owner_id = req.params.groupId;

  req.query.owner_type = "ContributionGroup";
  req.query.owner_id = req.params.groupId;

  next();
};

// ========================================
// APPLY GROUP SCOPE
// ========================================

router.use(

  scopeToContributionGroup

);


// ========================================
// CREATE GROUP CONTRIBUTION PLAN
// ========================================
//
// POST
// /api/contribution-groups/:groupId/plans
//
// Creates a plan owned by the specified
// ContributionGroup.
//
// The client does NOT need to send:
//
// owner_type
// owner_id
//
// They are derived from the route.
//
// ========================================

router.post(

  '/',

  createPlan

);


// ========================================
// GET GROUP CONTRIBUTION PLANS
// ========================================
//
// GET
// /api/contribution-groups/:groupId/plans
//
// Returns all contribution plans belonging
// to this ContributionGroup.
//
// Optional:
//
// ?status=active
//
// ?contribution_type=fixed
//
// ?frequency=monthly
//
// ========================================

router.get(

  '/',

  getPlans

);


// ========================================
// ACTIVATE GROUP PLAN
// ========================================
//
// PATCH
// /api/contribution-groups/:groupId/plans/:planId/activate
//
// ========================================

router.patch(

  '/:planId/activate',

  activatePlan

);


// ========================================
// PAUSE GROUP PLAN
// ========================================
//
// PATCH
// /api/contribution-groups/:groupId/plans/:planId/pause
//
// ========================================

router.patch(

  '/:planId/pause',

  pausePlan

);


// ========================================
// RESUME GROUP PLAN
// ========================================
//
// PATCH
// /api/contribution-groups/:groupId/plans/:planId/resume
//
// ========================================

router.patch(

  '/:planId/resume',

  resumePlan

);


// ========================================
// COMPLETE GROUP PLAN
// ========================================
//
// PATCH
// /api/contribution-groups/:groupId/plans/:planId/complete
//
// ========================================

router.patch(

  '/:planId/complete',

  completePlan

);


// ========================================
// CANCEL GROUP PLAN
// ========================================
//
// PATCH
// /api/contribution-groups/:groupId/plans/:planId/cancel
//
// ========================================

router.patch(

  '/:planId/cancel',

  cancelPlan

);


// ========================================
// GET GROUP PLAN OBLIGATIONS
// ========================================
//
// GET
// /api/contribution-groups/:groupId/plans/:planId/obligations
//
// Returns all obligations belonging to the
// specified group plan.
//
// ========================================

router.get(

  '/:planId/obligations',

  getPlanObligations

);


// ========================================
// GET GROUP PLAN PAYMENTS
// ========================================
//
// GET
// /api/contribution-groups/:groupId/plans/:planId/payments
//
// Returns all payments associated with
// the specified group plan.
//
// ========================================

router.get(

  '/:planId/payments',

  getPlanPayments

);


// ========================================
// GET GROUP PLAN FINANCIAL SUMMARY
// ========================================
//
// GET
// /api/contribution-groups/:groupId/plans/:planId/financial-summary
//
// Returns aggregated financial information
// for the group contribution plan.
//
// ========================================

router.get(

  '/:planId/financial-summary',

  getPlanFinancialSummary

);


// ========================================
// GET SINGLE GROUP PLAN
// ========================================
//
// GET
// /api/contribution-groups/:groupId/plans/:planId
//
// ========================================
//
// IMPORTANT:
//
// This route is intentionally placed after
// all specific /:planId/... routes.
//
// ========================================

router.get(

  '/:planId',

  getPlanById

);


// ========================================
// UPDATE GROUP PLAN
// ========================================
//
// PATCH
// /api/contribution-groups/:groupId/plans/:planId
//
// ========================================

router.patch(

  '/:planId',

  updatePlan

);


// ========================================
// EXPORT ROUTER
// ========================================

export default router;