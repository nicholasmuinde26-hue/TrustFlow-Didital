import api from "@/app/services/api";

// One workspace's announcement board. Same endpoints regardless of
// whether the workspace is a chama or a contribution group — the
// backend can key this off the existing workspace id.
const announcementsApi = {
  list(workspaceId) {
    return api.get(`/workspaces/${workspaceId}/announcements`);
  },

  create(workspaceId, payload) {
    return api.post(`/workspaces/${workspaceId}/announcements`, payload);
  },

  setPinned(workspaceId, announcementId, pinned) {
    return api.patch(
      `/workspaces/${workspaceId}/announcements/${announcementId}`,
      { pinned }
    );
  },

  remove(workspaceId, announcementId) {
    return api.delete(
      `/workspaces/${workspaceId}/announcements/${announcementId}`
    );
  },
};

export default announcementsApi;