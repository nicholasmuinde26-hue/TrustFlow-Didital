import http from "http";

import app from "./marketplace.app.js";
import env from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import { initializePaymentProviders } from "./payment/providers/provider.bootstrap.js";

// Entry point for the standalone marketplace API:  npm run start:marketplace
//
// Deliberately boots far less than server.js: no sockets, no schedulers, no
// backfills, no admin bootstrap. Those belong to the ChamaManager API and must
// keep running there exactly once. This process only serves shoppers.
//
// Guest checkout can trigger an M-Pesa STK push, so payment providers are
// registered. The M-Pesa *callback* still lands on the ChamaManager API (its
// URL is whatever MPESA callback env vars point to), which is what settles the
// order, so keep that API running.

async function start() {
  await connectDatabase();

  const registry = initializePaymentProviders();
  console.log(`Registered Payment Providers: [${registry.list().join(", ")}]`);

  const port = Number(process.env.MARKETPLACE_PORT) || 5001;
  const server = http.createServer(app);
  server.listen(port, () => {
    console.log(`Marketplace API listening on :${port} (${env.nodeEnv})`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down marketplace API`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((err) => {
  console.error("Marketplace API failed to start:", err);
  process.exit(1);
});
