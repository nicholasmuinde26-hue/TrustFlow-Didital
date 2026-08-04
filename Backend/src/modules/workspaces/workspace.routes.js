import express from "express";

import { protect } from "../../middleware/auth.middleware.js";
import { getWorkspaces } from "./workspace.controller.js";

const router = express.Router();

router.get(
    "/",
    protect,
    getWorkspaces
);

export default router;