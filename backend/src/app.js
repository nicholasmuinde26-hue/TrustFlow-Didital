import express from "express";
import cors from "cors";
import helmet from "helmet";

// ============================================================================
// ROUTES
// ============================================================================

// Authentication
import authRoutes from "./modules/auth/auth.routes.js";

// Workspace
import workspaceRoutes from "./modules/workspaces/workspace.routes.js";

// Chamas
import chamaRoutes from "./modules/chama/chama.routes.js";
import chamaOperationsRoutes from "./modules/chama/chamaOperations.routes.js";
import chamaInvitationRoutes from "./modules/chama/chamaInvitation.routes.js";
import memberRoutes from "./modules/member/member.routes.js";

// Contribution Groups
import contributionGroupRoutes from "./modules/contributionGroups/contributionGroup.routes.js";
import contributionGroupPlanRoutes from "./modules/contributionPlan/contributionGroupPlan.routes.js";
import contributionPlanRoutes from "./modules/contributionPlan/contributionPlan.routes.js";
import contributionPaymentRoutes from "./modules/contributionPlan/contributionPayment.routes.js";
import mpesaRoutes from "./payment/providers/mpesa/mpesa.routes.js";

// Finance
import financeRoutes from "./modules/finance/finance.routes.js";

// Payouts
import payoutRoutes from "./modules/payout/payout.routes.js";

// Chat
import chatRoutes from "./modules/chat/chat.routes.js";

// Meetings
import meetingRoutes from "./modules/meetings/meetings.routes.js";

// Announcements
import announcementRoutes from "./modules/announcements/announcement.routes.js";

// Audit
import auditRoutes from "./modules/audit/audit.routes.js";
import businessRoutes from "./modules/business/business.routes.js";
import loanRoutes from "./modules/loans/loan.routes.js";

import "./modules/finance/financeEngine.service.js";

// ============================================================================
// ERROR MIDDLEWARE
// ============================================================================

import { notFound } from "./middleware/notFound.middleware.js";
import { errorHandler } from "./middleware/error.middleware.js";

// ============================================================================
// CREATE EXPRESS APP
// ============================================================================

const app = express();

// ============================================================================
// GLOBAL MIDDLEWARE
// ============================================================================

app.use(helmet());

app.use(
    cors({
        origin: true,
        credentials: true,
    })
);

// Body size limit raised from Express's 100kb default to accommodate
// base64-encoded profile photo uploads (see src/utils/userProfile.js —
// avatar_url is capped at ~2.8MB as a data URI string).
app.use(express.json({ limit: "5mb" }));

app.use(
    express.urlencoded({
        extended: true,
        limit: "5mb",
    })
);

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get("/api/v1/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "ChamaManager API is healthy",
        timestamp: new Date(),
    });
});

// ============================================================================
// AUTHENTICATION
// ============================================================================

app.use(
    "/api/v1/auth",
    authRoutes
);

// ============================================================================
// WORKSPACES
// ============================================================================

app.use(
    "/api/v1/workspaces",
    workspaceRoutes
);

// ============================================================================
// CHAMAS
// ============================================================================

app.use(
    "/api/v1/chamas",
    chamaRoutes
);

app.use("/api/v1/chamas/:chamaId", chamaOperationsRoutes);
app.use("/api/v1/chama-invitations", chamaInvitationRoutes);

// ============================================================================
// MEMBERS
// ============================================================================

app.use(
    "/api/v1/chamas",
    memberRoutes
);

// ============================================================================
// PAYOUTS
// ============================================================================

app.use(
    "/api/v1/chamas",
    payoutRoutes
);
app.use("/api/v1/chamas", loanRoutes);

// ============================================================================
// CONTRIBUTION GROUPS
// ============================================================================

app.use(
    "/api/v1/contribution-groups",
    contributionGroupRoutes
);

// ============================================================================
// CONTRIBUTION GROUP PLANS
// ============================================================================

app.use(
    "/api/v1/contribution-groups",
    contributionGroupPlanRoutes
);

// ============================================================================
// CONTRIBUTION PLANS
// ============================================================================

app.use(
    "/api/v1/contribution-plans",
    contributionPlanRoutes
);

// ============================================================================
// CONTRIBUTION PAYMENTS
// ============================================================================

app.use(
    "/api/v1/contributions",
    contributionPaymentRoutes
);

app.use(
    "/api/v1/mpesa",
    mpesaRoutes
);

app.use(
    "/api/v1/businesses",
    businessRoutes
);

// ============================================================================
// FINANCE ENGINE
// ============================================================================
//
// Mounted under:
//
// /api/v1/workspaces/:workspaceId/finance/*
//
// Examples
//
// GET    /finance/summary
// GET    /finance/accounts
// GET    /finance/transactions
// GET    /finance/ledger
// GET    /finance/trial-balance
// GET    /finance/balance-sheet
// GET    /finance/income-statement
// GET    /finance/cash-flow
//
// ============================================================================

app.use(
    "/api/v1/workspaces",
    financeRoutes
);

app.use(
    "/api/v1/workspaces",
    meetingRoutes
);

app.use(
    "/api/v1/workspaces",
    announcementRoutes
);

// ============================================================================
// CHAT
// ============================================================================
//
// REST API
//
// GET    /api/v1/chat/workspace/:workspaceId
// GET    /api/v1/chat/workspace/:workspaceId/search
//
// Realtime communication is handled separately
// by Socket.IO in socketServer.js.
//
// ============================================================================

app.use(
    "/api/v1/chat",
    chatRoutes
);

// ============================================================================
// AUDIT LOGS
// ============================================================================

app.use(
    "/api/v1/chamas",
    auditRoutes
);

// ============================================================================
// 404 HANDLER
// ============================================================================

app.use(notFound);

// ============================================================================
// GLOBAL ERROR HANDLER
// ============================================================================

app.use(errorHandler);

// ============================================================================
// EXPORT
// ============================================================================

export default app;