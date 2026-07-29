import express from 'express';
import cors from 'cors';
import helmet from 'helmet';


// ========================================
// ROUTES
// ========================================

import authRoutes
  from './modules/auth/auth.routes.js';

import chamaRoutes
  from './modules/chama/chama.routes.js';

import memberRoutes
  from './modules/member/member.routes.js';

import payoutRoutes
  from './modules/payout/payout.routes.js';

import contributionGroupRoutes
  from './modules/contributionGroups/contributionGroup.routes.js';

import contributionPlanRoutes
  from './modules/contributionPlan/contributionPlan.routes.js';

import contributionGroupPlanRoutes
  from './modules/contributionPlan/contributionGroupPlan.routes.js';

import contributionPaymentRoutes
  from './modules/contributionPlan/contributionPayment.routes.js';


  import auditRoutes
  from './modules/audit/audit.routes.js';


// ========================================
// ERROR MIDDLEWARE
// ========================================

import {
  notFound
} from './middleware/notFound.middleware.js';

import {
  errorHandler
} from './middleware/error.middleware.js';


// ========================================
// CREATE EXPRESS APP
// ========================================

const app = express();


// ========================================
// GLOBAL MIDDLEWARE
// ========================================

// Security headers
app.use(
  helmet()
);


// Cross-Origin Resource Sharing
app.use(
  cors()
);


// Parse JSON request bodies
app.use(
  express.json()
);


// Parse URL-encoded request bodies
app.use(
  express.urlencoded({
    extended: true
  })
);


// ========================================
// HEALTH CHECK
// ========================================
//
// GET /api/v1/health
//
// Used to verify that the API is running.
//
// ========================================

app.get(
  '/api/v1/health',
  (req, res) => {

    res.status(200).json({

      success: true,

      message:
        'ChamaManager API is healthy'

    });

  }
);


// ========================================
// AUTH ROUTES
// ========================================
//
// Base URL:
//
// /api/v1/auth
//
// Examples:
//
// POST /api/v1/auth/register
// POST /api/v1/auth/login
//
// ========================================

app.use(
  '/api/v1/auth',
  authRoutes
);


// ========================================
// CHAMA ROUTES
// ========================================
//
// Base URL:
//
// /api/v1/chamas
//
// Examples:
//
// POST   /api/v1/chamas
// GET    /api/v1/chamas/:id
// GET    /api/v1/chamas/:id/members
// PATCH  /api/v1/chamas/:id
// DELETE /api/v1/chamas/:id
//
// ========================================

app.use(
  '/api/v1/chamas',
  chamaRoutes
);


// ========================================
// MEMBER ROUTES
// ========================================
//
// Base URL:
//
// /api/v1/chamas
//
// Member routes are mounted under the
// Chama resource.
//
// Examples:
//
// GET
// /api/v1/chamas/:chamaId/members
//
// POST
// /api/v1/chamas/:chamaId/members
//
// DELETE
// /api/v1/chamas/:chamaId/members/:memberId
//
// ========================================

app.use(
  '/api/v1/chamas',
  memberRoutes
);


// ========================================
// PAYOUT ROUTES
// ========================================
//
// Base URL:
//
// /api/v1/chamas
//
// ========================================

app.use(
  '/api/v1/chamas',
  payoutRoutes
);


// ========================================
// CONTRIBUTION GROUP ROUTES
// ========================================
//
// Base URL:
//
// /api/v1/contribution-groups
//
// Examples:
//
// POST
// /api/v1/contribution-groups
//
// GET
// /api/v1/contribution-groups/:groupId
//
// GET
// /api/v1/contribution-groups/:groupId/members
//
// POST
// /api/v1/contribution-groups/:groupId/members
//
// ========================================

app.use(
  '/api/v1/contribution-groups',
  contributionGroupRoutes
);


// ========================================
// CONTRIBUTION GROUP PLAN ROUTES
// ========================================
//
// Group-scoped contribution plans.
//
// Base URL:
//
// /api/v1/contribution-groups
//
// Examples:
//
// GET
// /api/v1/contribution-groups/:groupId/plans
//
// POST
// /api/v1/contribution-groups/:groupId/plans
//
// ========================================

app.use(
  '/api/v1/contribution-groups',
  contributionGroupPlanRoutes
);


// ========================================
// CONTRIBUTION PLAN ROUTES
// ========================================
//
// Individual contribution plan operations.
//
// Base URL:
//
// /api/v1/contribution-plans
//
// Examples:
//
// GET
// /api/v1/contribution-plans/:planId
//
// PATCH
// /api/v1/contribution-plans/:planId/pause
//
// PATCH
// /api/v1/contribution-plans/:planId/resume
//
// ========================================

app.use(
  '/api/v1/contribution-plans',
  contributionPlanRoutes
);


// ========================================
// CONTRIBUTION ROUTES
// ========================================
//
// Actual member contribution transactions.
//
// Base URL:
//
// /api/v1/contributions
//
// Examples:
//
// POST
// /api/v1/contributions
//
// POST
// /api/v1/contributions/callback
//
// ========================================

app.use(
  '/api/v1/contributions',
  contributionPaymentRoutes
);


// ========================================
// AUDIT ROUTES
// ========================================

app.use(
  '/api/v1/chamas',
  auditRoutes
);


// ========================================
// 404 NOT FOUND
// ========================================
//
// IMPORTANT:
//
// This must come AFTER all routes.
//
// Any request that reaches this point
// did not match an existing route.
//
// ========================================

app.use(
  notFound
);


// ========================================
// GLOBAL ERROR HANDLER
// ========================================
//
// IMPORTANT:
//
// This must be the LAST middleware.
//
// It handles errors passed using:
//
// next(error)
//
// ========================================

app.use(
  errorHandler
);




// ========================================
// EXPORT APP
// ========================================

export default app;