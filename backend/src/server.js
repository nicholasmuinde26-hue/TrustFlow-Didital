import http from "http";

import app from "./app.js";

import env from "./config/env.js";
import { connectDatabase } from "./config/database.js";

import { initSocket } from "./modules/realtime/socketServer.js";

import { startPaymentIntentReconciliationJob } from "./jobs/paymentIntentReconciliation.job.js"; // FIX: was paymentIntentReconciliation.job
import { startLoanDisbursementReconciliationJob } from "./jobs/loanDisbursementReconciliation.job.js";
import { startPollAutoCloseJob } from "./jobs/pollAutoClose.job.js";
import { startSavingsShareoutSchedulerJob } from "./jobs/savingsShareoutScheduler.job.js";
import { startUssdSessionCleanupJob } from "./jobs/ussdSessionCleanup.job.js";
import { startCashDepositEnforcementJob } from "./jobs/cashDepositEnforcement.job.js";
import { startAssetManagerReportSchedulerJob } from "./jobs/Assetmanagerreportscheduler.job.js";
import { startAssetNudgesJob } from "./jobs/assetNudges.job.js";
import { startContributionCalendarJob } from "./jobs/contributionCalendar.job.js";
import { startMgrRoundLifecycleJob } from "./jobs/mgrRoundLifecycle.job.js";
import { ensureDefaultPlans } from "./modules/billing/billingEntitlement.service.js";

// NEW: Payment Provider Bootstrap
import { initializePaymentProviders } from "./payment/providers/provider.bootstrap.js";
import { bootstrapSuperAdmin } from "./config/bootstrapAdmin.js";
import { runBackfillChairpersonWalletView } from "./scripts/backfillChairpersonWalletView.js";
import { runBackfillContributionBehavior } from "./scripts/backfillContributionBehavior.js";

// ============================================================================
// CREATE HTTP SERVER
// ============================================================================

const server = http.createServer(app);

// ============================================================================
// INITIALIZE SOCKET.IO
// ============================================================================

initSocket(server);

// ============================================================================
// START APPLICATION
// ============================================================================

async function startServer() {

    try {

        // ============================================================
        // DATABASE CONNECTION
        // ============================================================

        await connectDatabase();
        await bootstrapSuperAdmin();

        // ============================================================
        // PERMISSION BACKFILLS
        // ============================================================
        // Self-healing: grants chairpersons `finance.accounts.view` (Chama
        // Wallet, view-only) on chamas whose RolePermission rows were
        // seeded before this key existed. Idempotent - safe on every boot.
        try {
            const backfillResult = await runBackfillChairpersonWalletView({ silent: true });
            console.log(
                ` Chairperson Wallet View Backfill: granted ${backfillResult.granted}, ` +
                `already covered/no chairperson ${backfillResult.skippedNoChairperson}, ` +
                `failed ${backfillResult.failed} (of ${backfillResult.total} chamas)`
            );
        } catch (error) {
            console.error(" Chairperson Wallet View Backfill failed (non-fatal):", error.message);
        }

        // ============================================================
        // CONTRIBUTION BEHAVIOR BACKFILL
        // ============================================================
        // Stores an explicit `behavior` on plans created before it existed
        // (the old name-guessing runs once, here, then never again) and tags
        // each chama's built-in Savings plan. Idempotent: plans that already
        // have a behavior are skipped. Per-plan ledger accounts are NOT
        // created on boot - that stays the opt-in --create-ledgers CLI flag.
        try {
            const behaviorResult = await runBackfillContributionBehavior({ silent: true });
            console.log(
                ` Contribution Behavior Backfill: updated ${behaviorResult.updated} of ` +
                `${behaviorResult.found} plan(s) without a behavior ` +
                `(savings tagged ${behaviorResult.savingsTagged})`
            );
        } catch (error) {
            console.error(" Contribution Behavior Backfill failed (non-fatal):", error.message);
        }

        // ============================================================
        // BILLING PLANS
        // ============================================================
        // Seeds Free / Standard / Pro once. Never overwrites an edited price.
        try {
            await ensureDefaultPlans();
            console.log(` Billing Plans: ready (enforcement ${process.env.BILLING_ENFORCEMENT === "on" ? "ON" : "off"})`);
        } catch (error) {
            console.error(" Billing Plans seed failed (non-fatal):", error.message);
        }

        // ============================================================
        // REGISTER PAYMENT PROVIDERS
        // ============================================================
        const paymentRegistry = initializePaymentProviders();
        console.log(` Registered Payment Providers: [${paymentRegistry.list().join(', ')}]`);

        // ============================================================
        // START BACKGROUND JOBS
        // ============================================================

        startPaymentIntentReconciliationJob();
        console.log(` Payment Intent Reconciliation Job: Started [30s interval]`);

        startLoanDisbursementReconciliationJob();
        console.log(` Loan Disbursement Reconciliation Job: Started [60s interval]`);

        startPollAutoCloseJob();
        console.log(` Poll Auto-Close Job: Started [60s interval]`);

        startSavingsShareoutSchedulerJob();
        console.log(` Savings Share-Out Scheduler Job: Started [6h interval]`);

        startUssdSessionCleanupJob();
        console.log(` USSD Session Cleanup Job: Started [2m interval]`);

        startCashDepositEnforcementJob();
        console.log(` Cash Deposit Enforcement Job: Started [5m interval]`);

        startAssetManagerReportSchedulerJob();
        console.log(` Asset Manager Report Scheduler Job: Started [6h interval]`);

        startAssetNudgesJob();
        console.log(` Asset Nudges Job: Started [1h interval]`);

        startContributionCalendarJob();
        startMgrRoundLifecycleJob();
        console.log(` Contribution Calendar Rollover Job: Started [1h interval]`);

        // ============================================================
        // START HTTP SERVER
        // ============================================================

        server.listen(
            env.port,
            () => {

                console.log("");

                console.log(
                    "======================================================="
                );

                console.log(
                    " CHAMAMANAGER PLATFORM"
                );

                console.log(
                    "======================================================="
                );

                console.log("");

                console.log(
                    ` Environment : ${env.nodeEnv}`
                );

                if (env.demoOtpAutofill) {
                    console.log("");
                    console.log(" ⚠️  DEMO_OTP_AUTOFILL IS ON — real OTPs are being echoed back in the");
                    console.log("    send-otp API response for autofill. Unset DEMO_OTP_AUTOFILL (or set");
                    console.log("    it to anything other than 'true') as soon as this demo is done.");
                }

                console.log(
                    ` HTTP Server : http://localhost:${env.port}`
                );

                console.log(
                    ` REST API : http://localhost:${env.port}/api/v1`
                );

                console.log(
                    ` Health Check : http://localhost:${env.port}/api/v1/health`
                );

                console.log(
                    ` Socket.IO : ws://localhost:${env.port}`
                );

                console.log("");

                console.log(" Enabled Modules");

                console.log(" ✓ Authentication");
                console.log(" ✓ User Management");
                console.log(" ✓ Workspaces");
                console.log(" ✓ Chama Management");
                console.log(" ✓ Contribution Groups");
                console.log(" ✓ Contribution Plans");
                console.log(" ✓ Finance Engine");
                console.log(" ✓ Double Entry Accounting");
                console.log(" ✓ Ledger System");
                console.log(" ✓ Payment Engine");
                console.log(" ✓ Payout Engine");
                console.log(" ✓ Audit Logs");
                console.log(" ✓ Chat API");
                console.log(" ✓ Polls & Voting");

                console.log("");

                console.log(" Payment Engine");

                console.log(` ✓ Provider: ${paymentRegistry.list().join(', ')}`);
                console.log(" ✓ Event Driven GL Posting");
                console.log(" ✓ Reconciliation Job: Active");

                console.log("");

                console.log(" Realtime");

                console.log(" ✓ Socket.IO Server");
                console.log(" ✓ Workspace Rooms");
                console.log(" ✓ Chat Events");
                console.log(" ✓ Presence Tracking");
                console.log(" ✓ Real-time Notifications");
                console.log(" ✓ Toast Notifications");
                console.log(" ✓ Live Contributions Ready");

                console.log("");

                console.log(
                    "======================================================="
                );

                console.log("");

            }
        );

    } catch (error) {

        console.error("");

        console.error(
            "======================================================="
        );

        console.error(
            "Failed to start ChamaManager"
        );

        console.error(error);

        console.error(
            "======================================================="
        );

        process.exit(1);

    }

}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

function shutdown(signal) {

    console.log(
        `\n${signal} received. Shutting down gracefully...`
    );

    server.close(
        () => {

            console.log(
                "HTTP Server stopped"
            );

            process.exit(0);

        }
    );

}

process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);

process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);

// ============================================================================
// BOOTSTRAP
// ============================================================================

startServer();
