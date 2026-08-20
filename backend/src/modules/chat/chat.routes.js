import express from "express";

import { protect } from "../../middleware/auth.middleware.js";

import {
    getMessages,
    searchMessages,
    sendMessage,
} from "./chat.controller.js";


// ============================================================================
// ROUTER
// ============================================================================

const router = express.Router();


// ============================================================================
// AUTHENTICATION
// ============================================================================

router.use(protect);


// ============================================================================
// CHAT ROUTES
// ============================================================================

// Get workspace messages
router.get(
    "/workspace/:workspaceId",
    getMessages
);

router.post(
    "/workspace/:workspaceId",
    sendMessage
);


// Search workspace messages
router.get(
    "/workspace/:workspaceId/search",
    searchMessages
);


export default router;
