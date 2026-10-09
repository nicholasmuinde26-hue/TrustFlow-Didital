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

function unwrap(responseData) {
  const body = responseData?.data ?? responseData;
  return body?.data ?? body;
}

const announcementsService = {
  async list(workspaceId) {
    const response = await announcementsApi.list(workspaceId);
    const payload = unwrap(response?.data);
    return (payload?.announcements || []).map(normalize);
  },

  async create(workspaceId, payload) {
    const response = await announcementsApi.create(workspaceId, payload);
    const body = unwrap(response?.data);
    return normalize(body?.announcement || body);
  },

  async setPinned(workspaceId, announcementId, pinned) {
    const response = await announcementsApi.setPinned(
      workspaceId,
      announcementId,
      pinned
    );
    const body = unwrap(response?.data);
    return normalize(body?.announcement || body);
  },

  async approve(workspaceId, announcementId) {
    const response = await announcementsApi.approve(workspaceId, announcementId);
    const body = unwrap(response?.data);
    return normalize(body?.announcement || body);
  },

  async reject(workspaceId, announcementId, reason) {
    const response = await announcementsApi.reject(
      workspaceId,
      announcementId,
      reason
    );
    const body = unwrap(response?.data);
    return normalize(body?.announcement || body);
  },

  async remove(workspaceId, announcementId) {
    await announcementsApi.remove(workspaceId, announcementId);
  },
};

export default announcementsService;
