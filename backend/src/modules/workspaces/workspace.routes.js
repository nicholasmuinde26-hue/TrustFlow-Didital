import express from "express";

import { protect } from "../../middleware/auth.middleware.js";
import { getWorkspaces, getWorkspaceDashboard } from "./workspace.controller.js";

const router = express.Router();

router.get(
    "/",
    protect,
    getWorkspaces
);

router.get('/:workspaceId/dashboard', protect, getWorkspaceDashboard);

export default router;
