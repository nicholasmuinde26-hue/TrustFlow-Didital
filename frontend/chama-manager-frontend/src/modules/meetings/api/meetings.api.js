import api from "@/app/services/api";

// v1 meetings: scheduling data only (title, time, optional link) — no
// in-app voice/video, recordings, or attendance tracking yet. Those are
// a separate, much larger milestone once this shell is in place.
const meetingsApi = {
  list(workspaceId) {
    return api.get(`/workspaces/${workspaceId}/meetings`);
  },

  create(workspaceId, payload) {
    return api.post(`/workspaces/${workspaceId}/meetings`, payload);
  },

  remove(workspaceId, meetingId) {
    return api.delete(`/workspaces/${workspaceId}/meetings/${meetingId}`);
  },
};

export default meetingsApi;