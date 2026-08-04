import api from "@/app/services/api";

// v1 chat: plain text messages per workspace, polled rather than pushed
// over a socket. Same discriminator pattern as Announcements/Presence —
// the backend doesn't need to know or care whether this is a chama or
// a contribution group.
const chatApi = {
  list(workspaceId, params) {
    return api.get(`/workspaces/${workspaceId}/messages`, { params });
  },

  send(workspaceId, payload) {
    return api.post(`/workspaces/${workspaceId}/messages`, payload);
  },
};

export default chatApi;