import http from "http";

import app from "./app.js";

import env from "./config/env.js";
import { connectDatabase } from "./config/database.js";

import { initSocket } from "./modules/realtime/socketServer.js";

import { startPaymentIntentReconciliationJob } from "./jobs/paymentIntentReconciliation.job.js"; // FIX: was paymentIntentReconciliation.job
import { startPollAutoCloseJob } from "./jobs/pollAutoClose.job.js";
import { startSavingsShareoutSchedulerJob } from "./jobs/savingsShareoutScheduler.job.js";
import { startUssdSessionCleanupJob } from "./jobs/ussdSessionCleanup.job.js";

// NEW: Payment Provider Bootstrap
import { initializePaymentProviders } from "./payment/providers/provider.bootstrap.js";
import { bootstrapSuperAdmin } from "./config/bootstrapAdmin.js";

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
        // REGISTER PAYMENT PROVIDERS
        // ============================================================
        const paymentRegistry = initializePaymentProviders();
        console.log(` Registered Payment Providers: [${paymentRegistry.list().join(', ')}]`);

        // ============================================================
        // START BACKGROUND JOBS
        // ============================================================

        startPaymentIntentReconciliationJob();
        console.log(` Payment Intent Reconciliation Job: Started [30s interval]`);

        startPollAutoCloseJob();
        console.log(` Poll Auto-Close Job: Started [60s interval]`);

        startSavingsShareoutSchedulerJob();
        console.log(` Savings Share-Out Scheduler Job: Started [6h interval]`);

        startUssdSessionCleanupJob();
        console.log(` USSD Session Cleanup Job: Started [2m interval]`);

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