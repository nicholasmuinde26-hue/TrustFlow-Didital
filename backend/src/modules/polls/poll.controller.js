import * as pollService from "./poll.service.js";
import { toPollDTO } from "./poll.service.js";
import AppError from "../../utils/AppError.js";

function emitPollEvent(workspaceId, event, payload) {
  // Realtime is best-effort — a poll action must never fail just because
  // no socket server is attached (e.g. in tests or scripts).
  import("../realtime/socketServer.js")
    .then(({ getIO }) => {
      try {
        getIO().to(`workspace:${workspaceId}`).emit(event, payload);
      } catch {
        // Socket.IO not initialized — ignore.
      }
    })
    .catch(() => {});
}

export async function listPolls(req, res, next) {
  try {
    const { workspaceId } = req.params;
    const context = await pollService.getWorkspaceContext(workspaceId, req.user._id);
    const polls = await pollService.listPolls(workspaceId, { status: req.query.status });
    res.json({
      success: true,
      data: { polls: polls.map((p) => toPollDTO(p, { context })) },
    });
  } catch (error) {
    next(error);
  }
}

export async function getPoll(req, res, next) {
  try {
    const { workspaceId, pollId } = req.params;
    const context = await pollService.getWorkspaceContext(workspaceId, req.user._id);
    const poll = await pollService.getPoll(workspaceId, pollId);
    res.json({ success: true, data: { poll: toPollDTO(poll, { context }) } });
  } catch (error) {
    next(error);
  }
}

export async function createPoll(req, res, next) {
  try {
    const { workspaceId } = req.params;
    const context = await pollService.getWorkspaceContext(workspaceId, req.user._id);
    const poll = await pollService.createPoll(
      workspaceId,
      context.workspaceType,
      req.user._id,
      context,
      req.body || {}
    );
    if (poll.status === "open") {
      emitPollEvent(workspaceId, "poll:opened", { pollId: poll._id });
    }
    res.status(201).json({ success: true, data: { poll: toPollDTO(poll, { context }) } });
  } catch (error) {
    next(error);
  }
}

export async function publishPoll(req, res, next) {
  try {
    const { workspaceId, pollId } = req.params;
    const context = await pollService.getWorkspaceContext(workspaceId, req.user._id);
    const poll = await pollService.publishPoll(workspaceId, pollId, req.user._id, context);
    emitPollEvent(workspaceId, "poll:opened", { pollId: poll._id });
    res.json({ success: true, data: { poll: toPollDTO(poll, { context }) } });
  } catch (error) {
    next(error);
  }
}

export async function castVote(req, res, next) {
  try {
    const { workspaceId, pollId } = req.params;
    const context = await pollService.getWorkspaceContext(workspaceId, req.user._id);
    const optionIds = req.body?.optionIds ?? req.body?.optionId;
    if (!optionIds) throw new AppError("Select an option to vote", 400);

    const poll = await pollService.castVote(workspaceId, pollId, context, optionIds);
    emitPollEvent(workspaceId, "poll:vote_cast", {
      pollId: poll._id,
      status: poll.status,
      totalVotes: poll.ballots.length,
    });
    if (poll.status === "closed") {
      emitPollEvent(workspaceId, "poll:closed", { pollId: poll._id, outcome: poll.result?.outcome });
    }
    res.json({ success: true, data: { poll: toPollDTO(poll, { context }) } });
  } catch (error) {
    next(error);
  }
}

export async function closePoll(req, res, next) {
  try {
    const { workspaceId, pollId } = req.params;
    const context = await pollService.getWorkspaceContext(workspaceId, req.user._id);
    const poll = await pollService.closePoll(workspaceId, pollId, req.user._id, context);
    emitPollEvent(workspaceId, "poll:closed", { pollId: poll._id, outcome: poll.result?.outcome });
    res.json({ success: true, data: { poll: toPollDTO(poll, { context }) } });
  } catch (error) {
    next(error);
  }
}

export async function cancelPoll(req, res, next) {
  try {
    const { workspaceId, pollId } = req.params;
    const context = await pollService.getWorkspaceContext(workspaceId, req.user._id);
    const poll = await pollService.cancelPoll(workspaceId, pollId, req.user._id, context);
    emitPollEvent(workspaceId, "poll:cancelled", { pollId: poll._id });
    res.json({ success: true, data: { poll: toPollDTO(poll, { context }) } });
  } catch (error) {
    next(error);
  }
}
