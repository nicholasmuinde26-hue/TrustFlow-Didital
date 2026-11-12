import Announcement from './Announcement.model.js';

/** Recent approved announcements for cross-module notification and USSD views. */
export async function listLatestApprovedForWorkspaces(workspaceIds, limit = 5) {
  if (!Array.isArray(workspaceIds) || workspaceIds.length === 0) return [];
  return Announcement.find({ workspace_id: { $in: workspaceIds }, status: 'approved' })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Number(limit) || 5))
    .lean();
}

/** Recent approved announcements for a single typed workspace. */
export async function listLatestApprovedForWorkspace(workspaceId, workspaceType, limit = 2) {
  return Announcement.find({ workspace_id: workspaceId, workspace_type: workspaceType, status: 'approved' })
    .sort({ is_pinned: -1, createdAt: -1 })
    .limit(Math.max(1, Number(limit) || 2))
    .lean();
}
