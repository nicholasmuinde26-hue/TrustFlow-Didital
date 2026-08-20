import mongoose from "mongoose";

import Chama from "../../models/Chama.js";
import ChamaMembership from "../../models/ChamaMembership.js";
import ContributionGroup from "../../models/ContributionGroup.js";
import ContributionGroupMember from "../../models/ContributionGroupMember.js";
import Meeting from "../../models/Meeting.js";
import AppError from "../../utils/AppError.js";

function toMeetingDTO(meeting) {
  return {
    id: meeting._id,
    title: meeting.title,
    startsAt: meeting.starts_at,
    link: meeting.link,
    createdAt: meeting.createdAt,
    createdBy: meeting.created_by?._id || meeting.created_by,
  };
}

async function getWorkspaceContext(workspaceId, userId) {
  if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
    throw new AppError("Invalid workspace ID", 400);
  }

  if (await Chama.exists({ _id: workspaceId })) {
    const membership = await ChamaMembership.findOne({
      chama_id: workspaceId,
      user_id: userId,
      status: "active",
    }).select("role");
    if (!membership) throw new AppError("You are not an active member of this workspace", 403);
    return { workspaceType: "Chama", canManage: membership.role === "treasurer" };
  }

  if (await ContributionGroup.exists({ _id: workspaceId })) {
    const membership = await ContributionGroupMember.findOne({
      contribution_group_id: workspaceId,
      user_id: userId,
      status: "active",
    }).select("role");
    if (!membership) throw new AppError("You are not an active member of this workspace", 403);
    return {
      workspaceType: "ContributionGroup",
      canManage: ["organizer", "co_organizer"].includes(membership.role),
    };
  }

  throw new AppError("Workspace not found", 404);
}

export async function listMeetings(req, res, next) {
  try {
    const { workspaceId } = req.params;
    await getWorkspaceContext(workspaceId, req.user._id);
    const meetings = await Meeting.find({ workspace_id: workspaceId, cancelled_at: null })
      .sort({ starts_at: 1 })
      .populate("created_by", "name");
    res.json({ success: true, data: { meetings: meetings.map(toMeetingDTO) } });
  } catch (error) {
    next(error);
  }
}

export async function createMeeting(req, res, next) {
  try {
    const { workspaceId } = req.params;
    const context = await getWorkspaceContext(workspaceId, req.user._id);
    if (!context.canManage) throw new AppError("Only workspace managers can schedule meetings", 403);

    const { title, startsAt, link } = req.body || {};
    if (typeof title !== "string" || title.trim().length < 2) {
      throw new AppError("A meeting title of at least 2 characters is required", 400);
    }
    const startsAtDate = new Date(startsAt);
    if (!startsAt || Number.isNaN(startsAtDate.getTime())) {
      throw new AppError("A valid meeting date and time is required", 400);
    }
    if (link && !/^https?:\/\//i.test(link)) {
      throw new AppError("Meeting link must begin with http:// or https://", 400);
    }

    const meeting = await Meeting.create({
      workspace_id: workspaceId,
      workspace_type: context.workspaceType,
      title: title.trim(),
      starts_at: startsAtDate,
      link: link?.trim() || null,
      created_by: req.user._id,
    });
    res.status(201).json({ success: true, data: { meeting: toMeetingDTO(meeting) } });
  } catch (error) {
    next(error);
  }
}

export async function cancelMeeting(req, res, next) {
  try {
    const { workspaceId, meetingId } = req.params;
    const context = await getWorkspaceContext(workspaceId, req.user._id);
    if (!context.canManage) throw new AppError("Only workspace managers can cancel meetings", 403);
    if (!mongoose.Types.ObjectId.isValid(meetingId)) throw new AppError("Invalid meeting ID", 400);

    const meeting = await Meeting.findOneAndUpdate(
      { _id: meetingId, workspace_id: workspaceId, cancelled_at: null },
      { cancelled_at: new Date() },
      { new: true }
    );
    if (!meeting) throw new AppError("Meeting not found", 404);
    res.json({ success: true, data: { meeting: toMeetingDTO(meeting) } });
  } catch (error) {
    next(error);
  }
}
