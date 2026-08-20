import ChatService from "./chat.service.js";
import { toChatDTO } from "./chat.mapper.js";
import { validateMessage } from "./chat.validation.js";
import { canAccessWorkspace } from "./chat.permissions.js";
import AppError from "../../utils/AppError.js";

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
