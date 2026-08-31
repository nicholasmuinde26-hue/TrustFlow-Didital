import express from "express";

const router = express.Router();

// Routes are mounted in app.js as app.use("/api/v1/workspaces", aiRoutes)
// so these paths are relative to /api/v1/workspaces

// GET  /:workspaceId/ai/insights
router.get("/:workspaceId/ai/insights", async (req, res) => {
  res.json({ success: true, data: { insights: [] } });
});

// GET  /:workspaceId/ai/suggestions
router.get("/:workspaceId/ai/suggestions", async (req, res) => {
  res.json({ success: true, data: { suggestions: [] } });
});

// GET  /:workspaceId/ai/overview
router.get("/:workspaceId/ai/overview", async (req, res) => {
  res.json({ success: true, data: { overview: {} } });
});

// POST /:workspaceId/ai/chat
router.post("/:workspaceId/ai/chat", async (req, res) => {
  // echo body as placeholder
  res.json({ success: true, message: "AI chat endpoint placeholder", payload: req.body });
});

export default router;
