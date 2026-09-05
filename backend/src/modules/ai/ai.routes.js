import express from "express";

import { protect } from "../../middleware/auth.middleware.js";
import {
  getInsights,
  getSuggestions,
  getOverview,
  postChat,
} from "./ai.controller.js";

const router = express.Router();

// Routes are mounted in app.js as app.use("/api/v1/workspaces", aiRoutes)
// so these paths are relative to /api/v1/workspaces

// GET  /:workspaceId/ai/insights
router.get("/:workspaceId/ai/insights", protect, getInsights);

// GET  /:workspaceId/ai/suggestions
router.get("/:workspaceId/ai/suggestions", protect, getSuggestions);

// GET  /:workspaceId/ai/overview
router.get("/:workspaceId/ai/overview", protect, getOverview);

// POST /:workspaceId/ai/chat
router.post("/:workspaceId/ai/chat", protect, postChat);

export default router;