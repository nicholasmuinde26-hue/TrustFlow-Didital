import mongoose from "mongoose";

import aiService from "./ai.service.js";
import { resolveWorkspaceLabel } from "./ai.context.service.js";
import { canAccessWorkspace } from "../chat/chat.permissions.js";
import Business from "../../models/Business.js";
import AppError from "../../utils/AppError.js";

/**
 * Confirms the requesting user actually belongs to this workspace
 * before we hand back any AI-generated read of its data.
 */
async function assertAccess(req) {
  const { workspaceId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
    throw new AppError("Invalid workspace ID", 400);
  }

  const label = await resolveWorkspaceLabel(workspaceId);
  if (!label) {
    throw new AppError("Workspace not found", 404);
  }

  if (label === "business") {
    const owns = await Business.exists({ _id: workspaceId, created_by: req.user._id });
    if (!owns) {
      throw new AppError("You are not authorized to view this workspace", 403);
    }
    return;
  }

  const allowed = await canAccessWorkspace(req.user._id, workspaceId, label);
  if (!allowed) {
    throw new AppError("You are not an active member of this workspace", 403);
  }
}

export async function getInsights(req, res, next) {
  try {
    await assertAccess(req);
    const data = await aiService.getInsights({
      workspaceId: req.params.workspaceId,
      userId: req.user._id,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getSuggestions(req, res, next) {
  try {
    await assertAccess(req);
    const data = await aiService.getSuggestions({
      workspaceId: req.params.workspaceId,
      userId: req.user._id,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getOverview(req, res, next) {
  try {
    await assertAccess(req);
    const data = await aiService.getOverview({
      workspaceId: req.params.workspaceId,
      userId: req.user._id,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function postChat(req, res, next) {
  try {
    await assertAccess(req);
    const { message } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      throw new AppError("message is required", 400);
    }

    if (message.length > 1000) {
      throw new AppError("message is too long", 400);
    }

    const data = await aiService.chat({
      workspaceId: req.params.workspaceId,
      userId: req.user._id,
      message,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
