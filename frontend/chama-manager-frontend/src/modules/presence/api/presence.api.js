import api from "@/app/services/api";

// Presence is intentionally simple for v1: "who has been seen recently
// in this workspace" rather than a real websocket connection. The
// backend can compute this however it likes (e.g. lastSeenAt on the
// membership record) — the frontend just polls it.
const presenceApi = {
  list(workspaceId) {
    return api.get(`/workspaces/${workspaceId}/presence`);
  },

  // Lets the backend know "I'm here" — call this on an interval while
  // a workspace is open so other members' polls pick you up.
  ping(workspaceId) {
    return api.post(`/workspaces/${workspaceId}/presence/ping`);
  },
};

export default presenceApi;