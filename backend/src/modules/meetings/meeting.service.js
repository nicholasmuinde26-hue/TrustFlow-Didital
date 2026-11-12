import Meeting from './Meeting.model.js';

export function listUpcomingMeetings({ workspaceId, workspaceType, limit = 3, now = new Date() }) {
  const query = { workspace_id: workspaceId, cancelled_at: null, starts_at: { $gte: now } };
  if (workspaceType) query.workspace_type = workspaceType;
  return Meeting.find(query).sort({ starts_at: 1 }).limit(limit).lean();
}

export function findNextMeeting({ workspaceId, workspaceType, from = new Date(), until }) {
  const query = {
    workspace_id: workspaceId,
    workspace_type: workspaceType,
    cancelled_at: null,
    starts_at: { $gte: from, ...(until ? { $lte: until } : {}) },
  };
  return Meeting.findOne(query).sort({ starts_at: 1 }).select('title starts_at').lean();
}
