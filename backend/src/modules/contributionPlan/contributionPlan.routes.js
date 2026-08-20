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

    getPlanFinancialSummary

}
from "./contributionPlan.controller.js";



// AUTHENTICATION MIDDLEWARE
import {
    protect
}
from "../../middleware/auth.middleware.js";





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






// GET SINGLE PLAN


router.get(

    "/:planId",

    protect,

    getPlanById

);









export default router;