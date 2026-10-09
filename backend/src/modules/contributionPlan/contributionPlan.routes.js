import express from "express";


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

    getPlanFinancialSummary,

    configurePlanSchedule
}
from "./contributionPlan.controller.js";



// AUTHENTICATION MIDDLEWARE
import {
    protect
}
from "../../middleware/auth.middleware.js";

// Resetting a contribution's timings (due day, grace period, start/end
// month) affects every member on that plan, so - like the calendar
// routes in contributionCalendar.routes.js - it is restricted to the
// Treasurer/Chairperson (or a ContributionGroup organizer, which the
// membership resolver treats as equivalent). Previously this endpoint
// only checked `protect`, so any authenticated user who knew a plan's
// ID could reschedule any chama's contributions.
import {
    requireChamaMember,
    requireChamaTreasurerOrChairperson
}
from "../../middleware/chama.middleware.js";





// ============================================================
// ROUTER
// ============================================================

const router =
    express.Router();








// ============================================================
// CONTRIBUTION PLAN COLLECTION
// ============================================================



// CREATE PLAN
//
// POST
// /api/v1/contribution-plans


router.post(

    "/",

    protect,

    createPlan

);





// GET ALL PLANS
//
// GET
// /api/v1/contribution-plans


router.get(

    "/",

    protect,

    getPlans

);









// ============================================================
// PLAN REPORTING
// ============================================================



// GET PLAN OBLIGATIONS
//
// GET
// /api/v1/contribution-plans/:planId/obligations


router.get(

    "/:planId/obligations",

    protect,

    getPlanObligations

);






// GET PLAN PAYMENTS
//
// GET
// /api/v1/contribution-plans/:planId/payments


router.get(

    "/:planId/payments",

    protect,

    getPlanPayments

);







// GET FINANCIAL SUMMARY
//
// GET
// /api/v1/contribution-plans/:planId/financial-summary


router.get(

    "/:planId/financial-summary",

    protect,

    getPlanFinancialSummary

);










// ============================================================
// PLAN LIFECYCLE
// ============================================================


// ACTIVATE PLAN
//
// draft -> active


router.patch(

    "/:planId/activate",

    protect,

    activatePlan

);






// PAUSE PLAN
//
// active -> paused


router.patch(

    "/:planId/pause",

    protect,

    pausePlan

);







// RESUME PLAN
//
// paused -> active


router.patch(

    "/:planId/resume",

    protect,

    resumePlan

);







// COMPLETE PLAN
//
// active/paused -> completed


router.patch(

    "/:planId/complete",

    protect,

    completePlan

);







// CANCEL PLAN


router.patch(

    "/:planId/cancel",

    protect,

    cancelPlan

);









// ============================================================
// SINGLE PLAN OPERATIONS
// ============================================================



// UPDATE PLAN


router.patch(

    "/:planId",

    protect,

    updatePlan

);

// CONFIGURE SCHEDULE

router.patch(

    "/:planId/configure-schedule",

    protect,

    requireChamaMember,

    requireChamaTreasurerOrChairperson,

    configurePlanSchedule

);






// GET SINGLE PLAN


router.get(

    "/:planId",

    protect,

    getPlanById

);









export default router;