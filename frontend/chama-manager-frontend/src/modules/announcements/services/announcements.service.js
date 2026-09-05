import announcementsApi from "../api/announcements.api";

// The backend DTO uses isPinned/createdBy; normalize to the
// pinned/author shape the UI components read, and carry the
// approval-workflow fields through untouched.
function normalize(announcement) {
  if (!announcement) return announcement;

  const { isPinned, createdBy, ...rest } = announcement;

  return {
    ...rest,
    pinned: isPinned,
    author: createdBy,
  };
}

const announcementsService = {
  async list(workspaceId) {
    const { data } = await announcementsApi.list(workspaceId);
    return (data.announcements || []).map(normalize);
  },

  async create(workspaceId, payload) {
    const { data } = await announcementsApi.create(workspaceId, payload);
    return normalize(data.announcement || data);
  },

  async setPinned(workspaceId, announcementId, pinned) {
    const { data } = await announcementsApi.setPinned(
      workspaceId,
      announcementId,
      pinned
    );
    return normalize(data.announcement || data);
  },

  async approve(workspaceId, announcementId) {
    const { data } = await announcementsApi.approve(workspaceId, announcementId);
    return normalize(data.announcement || data);
  },

  async reject(workspaceId, announcementId, reason) {
    const { data } = await announcementsApi.reject(
      workspaceId,
      announcementId,
      reason
    );
    return normalize(data.announcement || data);
  },

  async remove(workspaceId, announcementId) {
    await announcementsApi.remove(workspaceId, announcementId);
  },
};

export default announcementsService;