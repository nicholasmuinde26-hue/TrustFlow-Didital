import express from "express";
import cors from "cors";
import helmet from "helmet";

import env from "./config/env.js";
import { globalLimiter } from "./middleware/Ratelimit.middleware.js";

// ============================================================================
// ROUTES
// ============================================================================

// Authentication
import authRoutes from "./modules/auth/auth.routes.js";

// Admin & Workspace Requests
import adminRoutes from "./modules/admin/admin.routes.js";
import securityRoutes from "./modules/security/security.routes.js";
import workspaceRequestRoutes from "./modules/workspaces/workspaceRequest.routes.js";

// Workspace
import workspaceRoutes from "./modules/workspaces/workspace.routes.js";

// Chamas
import chamaRoutes from "./modules/chama/chama.routes.js";
import chamaOperationsRoutes from "./modules/chama/chamaOperations.routes.js";
import chamaAssetRoutes from "./modules/chamaAssets/chamaAsset.routes.js";
import assetLeaseRoutes from "./modules/chamaAssets/assetLease.routes.js";
import assetComplianceRoutes from "./modules/chamaAssets/assetCompliance.routes.js";
import leadershipPinRoutes from "./modules/leadership/leadershipPin.routes.js";
import chamaInvitationRoutes from "./modules/chama/chamaInvitation.routes.js";
import memberRoutes from "./modules/member/member.routes.js";
import chamaContributionRoutes from "./modules/chama/chamaContribution.routes.js";

// Contribution Groups
import contributionGroupRoutes from "./modules/contributionGroups/contributionGroup.routes.js";
import contributionFundRoutes from "./modules/contributionGroups/contributionFund.routes.js";
import contributionGroupPlanRoutes from "./modules/contributionPlan/contributionGroupPlan.routes.js";
import contributionPlanRoutes from "./modules/contributionPlan/contributionPlan.routes.js";
import financialYearRoutes from "./modules/contributionPlan/financialYear.routes.js";
import yearEndRoutes from "./modules/yearEnd/yearEnd.routes.js";
import contributionCalendarRoutes from "./modules/contributionPlan/contributionCalendar.routes.js";
import billingRoutes from "./modules/billing/billing.routes.js";
import billingAdminRoutes from "./modules/billing/billingAdmin.routes.js";
import adminSupportRoutes from "./modules/support/adminSupport.routes.js";
import contributionPaymentRoutes from "./modules/contributionPlan/contributionPayment.routes.js";
import mpesaRoutes from "./payment/providers/mpesa/mpesa.routes.js";
import mpesaC2bRoutes from "./modules/mpesaC2b/c2b.routes.js";

// Finance
import financeRoutes from "./modules/finance/finance.routes.js";

// Payouts
import payoutRoutes from "./modules/payout/payout.routes.js";
import withdrawalRoutes from "./modules/withdrawal/withdrawal.routes.js";
import savingsShareoutRoutes from "./modules/savingsShareout/savingsShareout.routes.js";

// Chat
import chatRoutes from "./modules/chat/chat.routes.js";

// Meetings
import meetingRoutes from "./modules/meetings/meetings.routes.js";

// Announcements
import announcementRoutes from "./modules/announcements/announcement.routes.js";

// Polls & Voting
import pollRoutes from "./modules/polls/poll.routes.js";

// Audit
import auditRoutes from "./modules/audit/audit.routes.js";

// Chama Trust Score (shareable score/report + public share-link view)
import trustScoreRoutes from "./modules/trustScore/Trustscore.routes.js";
import publicTrustScoreRoutes from "./modules/trustScore/Publictrustscore.routes.js";

// Official peer ratings (accountability)
import officialRatingRoutes from "./modules/officials/Officialrating.routes.js";

// Disputes (accountability)
import disputeRoutes from "./modules/disputes/Dispute.routes.js";
import businessRoutes from "./modules/business/business.routes.js";
import productRoutes from "./modules/business/product.routes.js";
import cartRoutes from "./modules/business/cart.routes.js";
import loanRoutes from "./modules/loans/loan.routes.js";
import marketplaceRoutes from "./modules/marketplace/marketplace.routes.js";
import marketplaceAdminRoutes from "./modules/marketplace/marketplaceAdmin.routes.js";
import marketplaceMerchantRoutes from "./modules/marketplace/marketplaceMerchant.routes.js";

// Notifications
import notificationRoutes from "./modules/notifications/notifications.routes.js";
import notificationEventHandler from "./services/notificationEventHandler.service.js";

// Action Safety Engine
import actionSafetyRoutes from "./routes/actionSafety.routes.js";

// AI Assistant
import aiRoutes from "./modules/ai/ai.routes.js";

// MGR & Approvals Engine
import mgrRoutes from "./modules/mgr/mgr.routes.js";
import approvalRoutes from "./modules/approval/approval.routes.js";

// Committee System
import committeeRoutes from "./modules/committee/committee.routes.js";

// Burial Chama
import burialChamaRoutes from "./modules/burialChama/burialChama.routes.js";

// USSD (general — standard chamas)
import ussdRoutes from "./modules/ussd/ussd.routes.js";

// Chairperson Loan Settings
import chairpersonLoanSettingsRoutes from "./modules/chairperson/chairpersonLoanSettings.routes.js";
import workspaceModuleRoutes from "./modules/workspaces/workspaceModules.routes.js";

// Platform Inquiries & Support
import inquiryRoutes, { adminInquiryRouter } from "./modules/inquiries/inquiry.routes.js";

import "./modules/finance/financeEngine.service.js";

// Bridges payment.completed/failed/cancelled events (contributions, MGR,
// savings) onto Socket.IO so the paying member's STK modal resolves the
// instant M-Pesa's callback lands, instead of only via HTTP polling.
import { registerPaymentSocketBridge } from "./payment/paymentSocketBridge.js";
registerPaymentSocketBridge();


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

// ============================================================================
// TRUST PROXY
// ============================================================================
// req.ip is used for the M-Pesa C2B IP allowlist and for rate limiting, and
// both are worthless if Express reports the load balancer's address for every
// request. Set TRUST_PROXY to the number of proxies in front of this app
// (1 for a single LB on Render/Railway/Heroku).
//
// Do NOT set this to `true` blindly: that trusts the entire X-Forwarded-For
// chain, letting a caller spoof their own source address and walk straight
// past both the allowlist and the limiter.
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy) {
    app.set('trust proxy', Number.isNaN(Number(trustProxy)) ? trustProxy : Number(trustProxy));
}

// ============================================================================
// CORS
// ============================================================================
//
// This was `origin: true` with `credentials: true`, which reflects whatever
// Origin header the caller sends and tells the browser to allow credentialed
// requests to it. That is functionally "allow every website on the internet
// to make authenticated cross-origin calls on behalf of anyone logged in" —
// the exact thing the same-origin policy exists to prevent.
//
// Now an explicit allowlist from CORS_ALLOWED_ORIGINS.
const allowedOrigins = env.corsAllowedOrigins;

if (!allowedOrigins.length && env.isProduction) {
    throw new Error(
        'CORS_ALLOWED_ORIGINS must be set in production (comma-separated list of exact origins).'
    );
}

app.use(
    cors({
        origin(origin, callback) {
            // Same-origin requests, curl, mobile apps and server-to-server
            // calls send no Origin header at all. CORS is a browser
            // protection, so there is nothing to enforce for these.
            if (!origin) return callback(null, true);

            if (allowedOrigins.includes(origin)) return callback(null, true);

            // In development, allow localhost on any port so the Vite dev
            // server doesn't need re-configuring every time its port moves.
            if (!env.isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
                return callback(null, true);
            }

            console.warn(`[cors] blocked origin: ${origin}`);
            return callback(new Error('Not allowed by CORS'));
        },
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
// RATE LIMITING
// ============================================================================
// Broad backstop across the whole API. Auth-specific, much tighter limits are
// applied per-route in auth.routes.js. See the note in the middleware about
// moving to a shared Redis store before running more than one instance.
app.use(globalLimiter);

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
// ADMIN PANEL & INQUIRIES
// ============================================================================

app.use(
    "/api/v1/admin/inquiries",
    adminInquiryRouter
);

app.use(
    "/api/v1/admin/marketplace",
    marketplaceAdminRoutes
);

// Platform revenue (Super Admin only) - mounted before the general admin router.
app.use("/api/v1/admin/billing", billingAdminRoutes);

// Platform support console: billing help, payment review, user tools, notes and cases.
app.use("/api/v1/admin/support", adminSupportRoutes);

app.use(
    "/api/v1/admin",
    adminRoutes
);

// TrustOS security intelligence: telemetry is evaluated continuously;
// the Security Admin consumes the explanations and controlled responses.
app.use("/api/v1/security", securityRoutes);

app.use(
    "/api/v1/inquiries",
    inquiryRoutes
);

// ============================================================================
// WORKSPACE REQUESTS
// ============================================================================


app.use(
    "/api/v1/workspace-requests",
    workspaceRequestRoutes
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
app.use("/api/v1/chamas/:chamaId/assets", chamaAssetRoutes);
app.use("/api/v1/chamas/:chamaId/leases", assetLeaseRoutes);
app.use("/api/v1/chamas/:chamaId/compliance-obligations", assetComplianceRoutes);
app.use("/api/v1/chamas/:chamaId/financial-years", financialYearRoutes);
app.use("/api/v1/chamas/:chamaId/year-end", yearEndRoutes);
app.use("/api/v1/chamas/:chamaId/contribution-calendar", contributionCalendarRoutes);
app.use("/api/v1/chamas/:chamaId/billing", billingRoutes);

// ============================================================================
// LEADERSHIP DESK (PIN)
// ============================================================================
//
// Mounted on /api/v1/chamas (not /:chamaId) so the router owns its own
// "/:chamaId/leadership/..." paths, same pattern as memberRoutes below.
// These endpoints are how a leader OBTAINS a leadership session token —
// they are gated by role only, never by the session token itself.
// ============================================================================

app.use("/api/v1/chamas", leadershipPinRoutes);
app.use("/api/v1/chama-invitations", chamaInvitationRoutes);

// ============================================================================
// MEMBERS
// ============================================================================

app.use(
    "/api/v1/chamas",
    memberRoutes
);

// ============================================================================
// CHAMA-INTERNAL CONTRIBUTIONS (emergency / wedding / purchase, etc)
// ============================================================================
//
// Ad-hoc, cause-based contributions that live inside a Chama - separate
// from Savings, MGR, and the fixed/scheduled ContributionPlan. See
// modules/chama/chamaContribution.service.js.
// ============================================================================

app.use(
    "/api/v1/chamas",
    chamaContributionRoutes
);

// ============================================================================
// PAYOUTS
// ============================================================================

app.use(
    "/api/v1/chamas",
    payoutRoutes
);

// ============================================================================
// WITHDRAWALS (member-initiated, mirrors PAYOUTS above)
// ============================================================================

app.use(
    "/api/v1/chamas",
    withdrawalRoutes
);
app.use(
    "/api/v1/chamas",
    savingsShareoutRoutes
);
app.use("/api/v1/chamas", loanRoutes);
app.use("/api/v1/chamas", chairpersonLoanSettingsRoutes);
app.use("/api/v1/chamas", workspaceModuleRoutes);

// ============================================================================
// CONTRIBUTION GROUPS
// ============================================================================

app.use(
    "/api/v1/contribution-groups",
    contributionGroupRoutes
);

app.use(
    "/api/v1/contribution-groups/:groupId/fund",
    contributionFundRoutes
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
    "/api/v1/mpesa/c2b",
    mpesaC2bRoutes
);

app.use(
    "/api/v1/businesses",
    businessRoutes
);

app.use(
    "/api/v1/businesses",
    productRoutes
);

app.use(
    "/api/v1",
    cartRoutes
);

app.use(
    "/api/v1/marketplace",
    marketplaceRoutes
);

app.use(
    "/api/v1/businesses/:businessId/marketplace",
    marketplaceMerchantRoutes
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
// POLLS & VOTING
// ============================================================================
//
// GET    /workspaces/:workspaceId/polls                  list polls
// POST   /workspaces/:workspaceId/polls                  create poll (draft, or open if an official publishes immediately)
// GET    /workspaces/:workspaceId/polls/:pollId          poll detail + results
// PUT    /workspaces/:workspaceId/polls/:pollId/publish  open a draft poll for voting
// POST   /workspaces/:workspaceId/polls/:pollId/votes    cast a vote
// PUT    /workspaces/:workspaceId/polls/:pollId/close    close a poll early and tally it
// DELETE /workspaces/:workspaceId/polls/:pollId          cancel a draft/open poll
//
// ============================================================================

app.use(
    "/api/v1/workspaces",
    pollRoutes
);

// ============================================================================
// AI ASSISTANT
// ============================================================================
//
// GET  /workspaces/:workspaceId/ai/insights
// GET  /workspaces/:workspaceId/ai/suggestions
// GET  /workspaces/:workspaceId/ai/overview
// POST /workspaces/:workspaceId/ai/chat
//
// In-house, rule-based (no third-party AI API) — see modules/ai for details.
// ============================================================================

app.use(
    "/api/v1/workspaces",
    aiRoutes
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
app.use(
    "/api/v1/contribution-groups",
    auditRoutes
);

// ============================================================================
// CHAMA TRUST SCORE — shareable score/report, peer ratings, disputes
// ============================================================================
//
// A single exportable artifact a chama can hand to a bank, a SACCO
// federation, or a prospective member — see chamaTrustScore.service.js.
// Peer ratings (officialRatingRoutes) and disputes (disputeRoutes) are
// the "official accountability" inputs that, alongside repayment/KYC/
// audit-integrity data, feed that score.
//
// GET  /api/v1/chamas/:chamaId/trust-score
// POST /api/v1/chamas/:chamaId/trust-score/generate
// POST /api/v1/chamas/:chamaId/trust-score/:trustScoreId/share
// GET  /api/v1/chamas/:chamaId/officials
// POST /api/v1/chamas/:chamaId/officials/:membershipId/ratings
// POST /api/v1/chamas/:chamaId/disputes
//
// GET  /api/v1/public/trust-score/:token   <- no auth, for banks/SACCOs
//
// ============================================================================

app.use(
    "/api/v1/chamas",
    trustScoreRoutes
);
app.use(
    "/api/v1/chamas",
    officialRatingRoutes
);
app.use(
    "/api/v1/chamas",
    disputeRoutes
);
app.use(
    "/api/v1/public/trust-score",
    publicTrustScoreRoutes
);

// ============================================================================
// NOTIFICATIONS
// ============================================================================

app.use(
    "/api/v1/notifications",
    notificationRoutes
);

// ============================================================================
// ACTION SAFETY ENGINE
// ============================================================================

app.use(
    "/api/v1/actions",
    actionSafetyRoutes
);

// MGR Workflow & Approvals Engine
app.use("/api/v1/mgr", mgrRoutes);
app.use("/api/v1/approvals", approvalRoutes);

// Committee System
app.use("/api/v1/committees", committeeRoutes);

// Burial Chama
app.use("/api/v1/burial-chama", burialChamaRoutes);

// USSD (general — standard chamas)
app.use("/api/v1/ussd", ussdRoutes);

// Initialize notification event listeners
notificationEventHandler.initializeEventListeners();

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