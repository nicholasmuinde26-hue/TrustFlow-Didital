
import ChatService from "./chat.service.js";
import { toChatDTO } from "./chat.mapper.js";
import {
  validateMessage,
  validateDirectMessage,
} from "./chat.validation.js";
import {
  canAccessWorkspace,
  canDirectMessage,
} from "./chat.permissions.js";
import AppError from "../../utils/AppError.js";
import {
  notifyNewChatMessage,
} from "../notifications/notifications.service.js";

import Chama from "../../models/Chama.js";
import ContributionGroup from "../../models/ContributionGroup.js";
import User from "../../models/User.js";
import ChatMessage from "../../models/ChatMessage.js";

// ============================================================================
// HELPERS
// ============================================================================

async function getWorkspaceName(workspaceId, workspaceType) {
  try {
    if (workspaceType === "chama") {
      const chama = await Chama.findById(workspaceId)
        .select("name")
        .lean();

      return chama?.name || null;
    }

    if (workspaceType === "contribution-group") {
      const group = await ContributionGroup.findById(workspaceId)
        .select("name")
        .lean();

      return group?.name || null;
    }

    return null;
  } catch (error) {
    console.error(
      "Failed to get workspace name:",
      error.message
    );

    return null;
  }
}

// ============================================================================
// WORKSPACE CHAT
// ============================================================================

/**
 * Send a message to a workspace.
 *
 * POST /api/v1/chat/workspace/:workspaceId
 *
 * Body:
 * {
 *   "workspaceType": "chama",
 *   "message": "Hello everyone"
 * }
 */
export async function sendMessage(req, res, next) {
  try {
    const { workspaceId } = req.params;
    const { message, workspaceType } = req.body;

    // ------------------------------------------------------------------------
    // Validate workspace type
    // ------------------------------------------------------------------------

    if (
      !["chama", "contribution-group"].includes(
        workspaceType
      )
    ) {
      throw new AppError(
        "A valid workspace type is required",
        400
      );
    }

    // ------------------------------------------------------------------------
    // Verify workspace membership
    // ------------------------------------------------------------------------

    const allowed = await canAccessWorkspace(
      req.user._id,
      workspaceId,
      workspaceType
    );

    if (!allowed) {
      throw new AppError(
        "You are not an active member of this workspace",
        403
      );
    }

    // ------------------------------------------------------------------------
    // Build and validate payload
    // ------------------------------------------------------------------------

    const payload = {
      workspace_id: workspaceId,
      workspace_type: workspaceType,
      sender_id: req.user._id,
      message,
    };

    validateMessage(payload);

    // ------------------------------------------------------------------------
    // Create message
    // ------------------------------------------------------------------------

    const created =
      await ChatService.sendMessage(payload);

    // ------------------------------------------------------------------------
    // Respond immediately
    // ------------------------------------------------------------------------

    res.status(201).json({
      success: true,
      data: toChatDTO(created),
    });

    // ------------------------------------------------------------------------
    // Notification
    // ------------------------------------------------------------------------

    getWorkspaceName(
      workspaceId,
      workspaceType
    )
      .then((workspaceName) =>
        notifyNewChatMessage(
          created,
          workspaceName
        )
      )
      .catch((error) =>
        console.error(
          "Failed to create chat notification:",
          error.message
        )
      );
  } catch (error) {
    next(error);
  }
}

/**
 * Get workspace messages.
 *
 * GET /api/v1/chat/workspace/:workspaceId
 *
 * Query:
 * ?workspaceType=chama
 * ?limit=50
 * ?before=2026-09-18T01:00:00.000Z
 */
export async function getMessages(req, res, next) {
  try {
    const { workspaceId } = req.params;

    const {
      limit = 50,
      before,
      workspaceType,
    } = req.query;

    // ------------------------------------------------------------------------
    // Validate workspace type
    // ------------------------------------------------------------------------

    if (
      !["chama", "contribution-group"].includes(
        workspaceType
      )
    ) {
      throw new AppError(
        "A valid workspace type is required",
        400
      );
    }

    // ------------------------------------------------------------------------
    // Verify membership
    // ------------------------------------------------------------------------

    const allowed = await canAccessWorkspace(
      req.user._id,
      workspaceId,
      workspaceType
    );

    if (!allowed) {
      throw new AppError(
        "You are not an active member of this workspace",
        403
      );
    }

    // ------------------------------------------------------------------------
    // Sanitize pagination
    // ------------------------------------------------------------------------

    const parsedLimit = Math.min(
      Math.max(Number(limit) || 50, 1),
      100
    );

    // ------------------------------------------------------------------------
    // Get messages
    // ------------------------------------------------------------------------

    const messages =
      await ChatService.getMessages(
        workspaceId,
        {
          limit: parsedLimit,
          before,
        }
      );

    // ------------------------------------------------------------------------
    // Response
    // ------------------------------------------------------------------------

    res.json({
      success: true,
      data: messages.map(toChatDTO),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Search workspace messages.
 *
 * GET /api/v1/chat/workspace/:workspaceId/search?q=hello&workspaceType=chama
 */
export async function searchMessages(req, res, next) {
  try {
    const { workspaceId } = req.params;

    const {
      q,
      workspaceType,
    } = req.query;

    // ------------------------------------------------------------------------
    // Validate workspace type
    // ------------------------------------------------------------------------

    if (
      !["chama", "contribution-group"].includes(
        workspaceType
      )
    ) {
      throw new AppError(
        "A valid workspace type is required",
        400
      );
    }

    // ------------------------------------------------------------------------
    // Validate search text
    // ------------------------------------------------------------------------

    if (!q || !String(q).trim()) {
      throw new AppError(
        "Search query is required",
        400
      );
    }

    // ------------------------------------------------------------------------
    // Verify membership
    // ------------------------------------------------------------------------

    const allowed = await canAccessWorkspace(
      req.user._id,
      workspaceId,
      workspaceType
    );

    if (!allowed) {
      throw new AppError(
        "You are not an active member of this workspace",
        403
      );
    }

    // ------------------------------------------------------------------------
    // Search
    // ------------------------------------------------------------------------

    const messages =
      await ChatService.searchMessages(
        workspaceId,
        String(q).trim()
      );

    // ------------------------------------------------------------------------
    // Response
    // ------------------------------------------------------------------------

    res.json({
      success: true,
      data: messages.map(toChatDTO),
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// DIRECT MESSAGES
// ============================================================================

/**
 * Send a direct message.
 *
 * POST /api/v1/chat/direct/:recipientUserId
 *
 * Body:
 * {
 *   "message": "Hello"
 * }
 */
export async function sendDirectMessage(
  req,
  res,
  next
) {
  try {
    const { recipientUserId } = req.params;
    const { message } = req.body;

    // ------------------------------------------------------------------------
    // Prevent messaging yourself
    // ------------------------------------------------------------------------

    if (
      String(recipientUserId) ===
      String(req.user._id)
    ) {
      throw new AppError(
        "You can't message yourself",
        400
      );
    }

    // ------------------------------------------------------------------------
    // Find recipient
    // ------------------------------------------------------------------------

    const recipient =
      await User.findById(recipientUserId)
        .select("_id name phone avatar")
        .lean();

    if (!recipient) {
      throw new AppError(
        "Recipient not found",
        404
      );
    }

    // ------------------------------------------------------------------------
    // Verify relationship
    // ------------------------------------------------------------------------

    const allowed = await canDirectMessage(
      req.user._id,
      recipientUserId
    );

    if (!allowed) {
      throw new AppError(
        "You can only message members you share a chama or group with",
        403
      );
    }

    // ------------------------------------------------------------------------
    // Build payload
    // ------------------------------------------------------------------------

    const payload = {
      sender_id: req.user._id,
      recipient_id: recipientUserId,
      message,
    };

    validateDirectMessage(payload);

    // ------------------------------------------------------------------------
    // Create message
    // ------------------------------------------------------------------------

    const created =
      await ChatService.sendDirectMessage(
        payload
      );

    // ------------------------------------------------------------------------
    // Response
    // ------------------------------------------------------------------------

    res.status(201).json({
      success: true,
      data: toChatDTO(created),
    });

    // ------------------------------------------------------------------------
    // IMPORTANT
    //
    // notifyNewDirectMessage is currently NOT exported by
    // notifications.service.js.
    //
    // Therefore we intentionally do not call it here.
    //
    // Once the notification service exposes that function,
    // direct-message notifications can be enabled here.
    // ------------------------------------------------------------------------

  } catch (error) {
    next(error);
  }
}

/**
 * Get direct message conversation.
 *
 * GET /api/v1/chat/direct/:recipientUserId
 */
export async function getDirectMessages(
  req,
  res,
  next
) {
  try {
    const { recipientUserId } = req.params;

    const {
      limit = 50,
      before,
    } = req.query;

    // ------------------------------------------------------------------------
    // Prevent opening your own DM thread
    // ------------------------------------------------------------------------

    if (
      String(recipientUserId) ===
      String(req.user._id)
    ) {
      throw new AppError(
        "You can't open a conversation with yourself",
        400
      );
    }

    // ------------------------------------------------------------------------
    // Find recipient
    // ------------------------------------------------------------------------

    const recipient =
      await User.findById(recipientUserId)
        .select("_id")
        .lean();

    if (!recipient) {
      throw new AppError(
        "Recipient not found",
        404
      );
    }

    // ------------------------------------------------------------------------
    // Verify relationship
    // ------------------------------------------------------------------------

    const allowed = await canDirectMessage(
      req.user._id,
      recipientUserId
    );

    if (!allowed) {
      throw new AppError(
        "You can only message members you share a chama or group with",
        403
      );
    }

    // ------------------------------------------------------------------------
    // Pagination
    // ------------------------------------------------------------------------

    const parsedLimit = Math.min(
      Math.max(Number(limit) || 50, 1),
      100
    );

    // ------------------------------------------------------------------------
    // Get conversation
    // ------------------------------------------------------------------------

    const messages =
      await ChatService.getDirectMessages(
        req.user._id,
        recipientUserId,
        {
          limit: parsedLimit,
          before,
        }
      );

    // ------------------------------------------------------------------------
    // Response
    // ------------------------------------------------------------------------

    res.json({
      success: true,
      data: messages.map(toChatDTO),
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// MESSAGE EDITING
// ============================================================================

/**
 * Edit a message.
 *
 * PATCH /api/v1/chat/message/:messageId
 *
 * Body:
 * {
 *   "message": "Updated message"
 * }
 */
export async function editMessage(
  req,
  res,
  next
) {
  try {
    const { messageId } = req.params;
    const { message } = req.body;

    // ------------------------------------------------------------------------
    // Validate message ID
    // ------------------------------------------------------------------------

    if (!messageId) {
      throw new AppError(
        "Message ID is required",
        400
      );
    }

    // ------------------------------------------------------------------------
    // Validate message body
    // ------------------------------------------------------------------------

    if (
      !message ||
      !String(message).trim()
    ) {
      throw new AppError(
        "Message cannot be empty",
        400
      );
    }

    // ------------------------------------------------------------------------
    // Find message
    // ------------------------------------------------------------------------

    const existing =
      await ChatMessage.findById(messageId);

    if (!existing) {
      throw new AppError(
        "Message not found",
        404
      );
    }

    // ------------------------------------------------------------------------
    // Prevent editing deleted messages
    // ------------------------------------------------------------------------

    if (existing.deleted_at) {
      throw new AppError(
        "Deleted messages cannot be edited",
        400
      );
    }

    // ------------------------------------------------------------------------
    // Ownership check
    //
    // A normal user can edit their own message.
    // ------------------------------------------------------------------------

    if (
      String(existing.sender_id) !==
      String(req.user._id)
    ) {
      throw new AppError(
        "You can only edit your own messages",
        403
      );
    }

    // ------------------------------------------------------------------------
    // Update
    // ------------------------------------------------------------------------

    const updated =
      await ChatService.editMessage(
        messageId,
        String(message).trim()
      );

    if (!updated) {
      throw new AppError(
        "Message could not be updated",
        404
      );
    }

    // ------------------------------------------------------------------------
    // Response
    // ------------------------------------------------------------------------

    res.json({
      success: true,
      data: toChatDTO(updated),
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// MESSAGE DELETION
// ============================================================================

/**
 * Delete a message.
 *
 * DELETE /api/v1/chat/message/:messageId
 */
export async function deleteMessage(
  req,
  res,
  next
) {
  try {
    const { messageId } = req.params;

    // ------------------------------------------------------------------------
    // Validate ID
    // ------------------------------------------------------------------------

    if (!messageId) {
      throw new AppError(
        "Message ID is required",
        400
      );
    }

    // ------------------------------------------------------------------------
    // Find message
    // ------------------------------------------------------------------------

    const existing =
      await ChatMessage.findById(messageId);

    if (!existing) {
      throw new AppError(
        "Message not found",
        404
      );
    }

    // ------------------------------------------------------------------------
    // Ownership check
    // ------------------------------------------------------------------------

    if (
      String(existing.sender_id) !==
      String(req.user._id)
    ) {
      throw new AppError(
        "You can only delete your own messages",
        403
      );
    }

    // ------------------------------------------------------------------------
    // Already deleted
    // ------------------------------------------------------------------------

    if (existing.deleted_at) {
      throw new AppError(
        "Message has already been deleted",
        400
      );
    }

    // ------------------------------------------------------------------------
    // Soft delete
    // ------------------------------------------------------------------------

    const deleted =
      await ChatService.deleteMessage(
        messageId
      );

    if (!deleted) {
      throw new AppError(
        "Message could not be deleted",
        404
      );
    }

    // ------------------------------------------------------------------------
    // Response
    // ------------------------------------------------------------------------

    res.json({
      success: true,
      message: "Message deleted successfully",
      data: {
        id: deleted._id,
        deleted_at: deleted.deleted_at,
      },
    });
  } catch (error) {
    next(error);
  }
}
