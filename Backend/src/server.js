import http from "http";

import app from "./app.js";

import env from "./config/env.js";
import { connectDatabase } from "./config/database.js";

import { initSocket } from "./modules/realtime/socketServer.js";
import { startPaymentIntentReconciliationJob } from "./jobs/paymentIntentReconciliation.job.js";

// NEW: Payment Provider Registry
import providerRegistry from "./payment/providers/provider.registry.js";
import MpesaProvider from "./payment/providers/mpesa/mpesa.provider.js";

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

        // ============================================================
        // REGISTER PAYMENT PROVIDERS - ADD THIS
        // ============================================================
        providerRegistry.register(MpesaProvider);
        console.log(` Registered Payment Providers: [${providerRegistry.list().join(', ')}]`);
        

        // ============================================================
        // START BACKGROUND JOBS
        // ============================================================

        startPaymentIntentReconciliationJob();

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
                    "              CHAMAMANAGER PLATFORM"
                );

                console.log(
                    "======================================================="
                );

                console.log("");

                console.log(
                    ` Environment      : ${env.nodeEnv}`
                );

                console.log(
                    ` HTTP Server      : http://localhost:${env.port}`
                );

                console.log(
                    ` REST API         : http://localhost:${env.port}/api/v1`
                );

                console.log(
                    ` Health Check     : http://localhost:${env.port}/api/v1/health`
                );

                console.log(
                    ` Socket.IO        : ws://localhost:${env.port}`
                );

                console.log("");

                console.log(" Enabled Modules");

                console.log("   ✓ Authentication");
                console.log("   ✓ User Management");
                console.log("   ✓ Workspaces");
                console.log("   ✓ Chama Management");
                console.log("   ✓ Contribution Groups");
                console.log("   ✓ Contribution Plans");
                console.log("   ✓ Finance Engine");
                console.log("   ✓ Double Entry Accounting");
                console.log("   ✓ Ledger System");
                console.log("   ✓ Payment Engine");
                console.log("   ✓ Payout Engine");
                console.log("   ✓ Audit Logs");
                console.log("   ✓ Chat API");

                console.log("");

                console.log(" Realtime");

                console.log("   ✓ Socket.IO Server");
                console.log("   ✓ Workspace Rooms");
                console.log("   ✓ Chat Events");
                console.log("   ✓ Presence Tracking");
                console.log("   ✓ Notifications Ready");
                console.log("   ✓ Live Contributions Ready");

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