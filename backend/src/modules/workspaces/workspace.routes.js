import express from "express";

import { protect } from "../../middleware/auth.middleware.js";
import { getWorkspaces, getWorkspaceDashboard, getWorkspaceDirectory, getModuleCatalog } from "./workspace.controller.js";

const router = express.Router();

router.get(
    "/",
    protect,
    getWorkspaces
);

router.get('/directory', protect, getWorkspaceDirectory);

// Catalog of switchable modules + presets, for the workspace setup picker.
router.get('/modules/catalog', protect, getModuleCatalog);

router.get('/:workspaceId/dashboard', protect, getWorkspaceDashboard);

export default router;
