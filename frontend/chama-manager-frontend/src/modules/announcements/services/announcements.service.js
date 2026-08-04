import announcementsApi from "../api/announcements.api";

const announcementsService = {
  async list(workspaceId) {
    const { data } = await announcementsApi.list(workspaceId);
    return data.announcements || [];
  },

  async create(workspaceId, payload) {
    const { data } = await announcementsApi.create(workspaceId, payload);
    return data.announcement || data;
  },

  async setPinned(workspaceId, announcementId, pinned) {
    const { data } = await announcementsApi.setPinned(
      workspaceId,
      announcementId,
      pinned
    );
    return data.announcement || data;
  },

  async remove(workspaceId, announcementId) {
    await announcementsApi.remove(workspaceId, announcementId);
  },
};

export default announcementsService;