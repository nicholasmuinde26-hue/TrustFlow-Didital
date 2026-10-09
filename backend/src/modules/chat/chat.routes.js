import express from "express";

import { protect } from "../../middleware/auth.middleware.js";

import {
  getMessages,
  searchMessages,
  sendMessage,
  getDirectMessages,
  getDirectConversations,
  getUnreadCounts,
  markMessagesRead,
  sendDirectMessage,
  editMessage,
  deleteMessage,
} from "./chat.controller.js";

import { requireModule } from '../../middleware/module.middleware.js';
// ============================================================================
// ROUTER
// ============================================================================

const router = express.Router();

// ============================================================================
// AUTHENTICATION
// ============================================================================

router.use(protect);
router.use("/workspace/:workspaceId", requireModule("chat"));

// ============================================================================
// WORKSPACE CHAT
// ============================================================================

// -----------------------------------------------------------------------------
// Get workspace messages
// GET /api/v1/chat/workspace/:workspaceId?workspaceType=chama
// GET /api/v1/chat/workspace/:workspaceId?workspaceType=contribution-group
// -----------------------------------------------------------------------------

router.get(
  "/workspace/:workspaceId",
  getMessages
);

router.get("/workspace/:workspaceId/unread", getUnreadCounts);
router.post("/workspace/:workspaceId/read", markMessagesRead);

// -----------------------------------------------------------------------------
// Send workspace message
// POST /api/v1/chat/workspace/:workspaceId
//
// Body:
// {
//   "workspaceType": "chama",
//   "message": "Hello everyone"
// }
// -----------------------------------------------------------------------------

router.post(
  "/workspace/:workspaceId",
  sendMessage
);

// -----------------------------------------------------------------------------
// Search workspace messages
// GET /api/v1/chat/workspace/:workspaceId/search?q=hello
// -----------------------------------------------------------------------------

router.get(
  "/workspace/:workspaceId/search",
  searchMessages
);

// ============================================================================
// DIRECT MESSAGES
// ============================================================================

// List direct conversations for a workspace's active members. Keep this static
// route above /:recipientUserId so Express does not treat "conversations" as an id.
router.get("/direct", getDirectConversations);

// -----------------------------------------------------------------------------
// Get direct message conversation
// GET /api/v1/chat/direct/:recipientUserId
// -----------------------------------------------------------------------------

router.get(
  "/direct/:recipientUserId",
  getDirectMessages
);

// -----------------------------------------------------------------------------
// Send direct message
// POST /api/v1/chat/direct/:recipientUserId
//
// Body:
// {
//   "message": "Hello"
// }
// -----------------------------------------------------------------------------

router.post(
  "/direct/:recipientUserId",
  sendDirectMessage
);

// ============================================================================
// MESSAGE MANAGEMENT
// ============================================================================

// -----------------------------------------------------------------------------
// Edit message
// PATCH /api/v1/chat/message/:messageId
//
// Body:
// {
//   "message": "Updated message"
// }
// -----------------------------------------------------------------------------

router.patch(
  "/message/:messageId",
  editMessage
);

// -----------------------------------------------------------------------------
// Delete message
// DELETE /api/v1/chat/message/:messageId
// -----------------------------------------------------------------------------

router.delete(
  "/message/:messageId",
  deleteMessage
);

// ============================================================================
// EXPORT
// ============================================================================

export default router;
