import ChatService from "./chat.service.js";
import { toChatDTO } from "./chat.mapper.js";
import { validateMessage } from "./chat.validation.js";
import { canAccessWorkspace } from "./chat.permissions.js";
import AppError from "../../utils/AppError.js";
import { notifyNewChatMessage } from "../notifications/notifications.service.js";
import Chama from "../../models/Chama.js";
import ContributionGroup from "../../models/ContributionGroup.js";

async function getWorkspaceName(workspaceId, workspaceType) {
  try {
    if (workspaceType === "chama") {
      const chama = await Chama.findById(workspaceId).select("name");
      return chama?.name || null;
    }
    const group = await ContributionGroup.findById(workspaceId).select("name");
    return group?.name || null;
  } catch {
    return null;
  }
}

export async function sendMessage(req, res, next) {
  try {
    const { workspaceId } = req.params;
    const { message, workspaceType } = req.body;

    if (!['chama', 'contribution-group'].includes(workspaceType)) {
      throw new AppError('A valid workspace type is required', 400);
    }

    const allowed = await canAccessWorkspace(req.user._id, workspaceId, workspaceType);
    if (!allowed) {
      throw new AppError('You are not an active member of this workspace', 403);
    }

    const payload = { workspace_id: workspaceId, workspace_type: workspaceType, sender_id: req.user._id, message };
    validateMessage(payload);
    const created = await ChatService.sendMessage(payload);
    res.status(201).json({ success: true, data: toChatDTO(created) });

    // Fire-and-forget: notify other active workspace members of the new message.
    getWorkspaceName(workspaceId, workspaceType)
      .then((workspaceName) => notifyNewChatMessage(created, workspaceName))
      .catch((err) => console.error("Failed to create chat notifications:", err.message));
  } catch (error) {
    next(error);
  }
}

export async function getMessages(req, res, next) {
  try {

    const {
      workspaceId,
    } = req.params;

    const {
      limit = 50,
      before,
    } = req.query;

    const workspaceType = req.query.workspaceType;
    if (!['chama', 'contribution-group'].includes(workspaceType)) {
      throw new AppError('A valid workspace type is required', 400);
    }
    const allowed = await canAccessWorkspace(req.user._id, workspaceId, workspaceType);
    if (!allowed) {
      throw new AppError('You are not an active member of this workspace', 403);
    }

    const messages =
      await ChatService.getMessages(
        workspaceId,
        {
          limit: Number(limit),
          before,
        }
      );

    res.json({

      success: true,

      data: messages.map(toChatDTO),

    });

  } catch (error) {

    next(error);

  }
}

export async function searchMessages(
  req,
  res,
  next
) {

  try {

    const {
      workspaceId,
    } = req.params;

    const {
      q,
    } = req.query;

    const messages =
      await ChatService.searchMessages(
        workspaceId,
        q
      );

    res.json({

      success: true,

      data: messages.map(toChatDTO),

    });

  }

  catch (error) {

    next(error);

  }

}