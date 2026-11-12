import express from "express";
import cors from "cors";
import helmet from "helmet";

import env from "./config/env.js";
import { globalLimiter } from "./middleware/rateLimit.middleware.js";
import { notFound } from "./middleware/notFound.middleware.js";
import { errorHandler } from "./middleware/error.middleware.js";

import { marketplaceRoutes } from "./modules/marketplace/index.js";

// ============================================================================
// STANDALONE MARKETPLACE API
// ============================================================================
//
// The public shopper-facing half of the marketplace as its own Express app, so
// it can be deployed (and scaled, and rate-limited) separately from the
// ChamaManager API. It exposes ONLY the public routes: browse, search, store
// pages, guest checkout and order tracking. There is no login, no chama data,
// no admin and no merchant management here. Those stay in ChamaManager, which
// is where a merchant switches workspace to manage their business.
//
// Both apps share the same MongoDB (MONGO_URI), so a listing a merchant
// publishes in ChamaManager is visible here immediately. Entry point:
// marketplace.server.js

const app = express();

app.use(helmet());

if (process.env.TRUST_PROXY) {
  const v = process.env.TRUST_PROXY;
  app.set("trust proxy", Number.isNaN(Number(v)) ? v : Number(v));
}

// Only the marketplace site(s) may call this API from a browser. No cookies or
// credentials are used, so `credentials` stays off.
const allowedOrigins = env.marketplaceAllowedOrigins;

if (!allowedOrigins.length && env.isProduction) {
  throw new Error(
    "MARKETPLACE_ALLOWED_ORIGINS must be set in production (comma-separated list of exact origins)."
  );
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (!env.isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      console.warn(`[marketplace cors] blocked origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(globalLimiter);

app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Marketplace API is healthy",
    timestamp: new Date(),
  });
});

app.use("/api/v1/marketplace", marketplaceRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
