import api from "@/app/services/api";

// v1 chat: plain text messages per workspace, polled rather than pushed
// over a socket. Same discriminator pattern as Announcements/Presence —
// the backend doesn't need to know or care whether this is a chama or
// a contribution group.
const chatApi = {
  list(workspaceId, params) {
    return api.get(`/chat/workspace/${workspaceId}`, { params });
  },

  send(workspaceId, payload) {
    return api.post(`/chat/workspace/${workspaceId}`, payload);
  },

  // Direct (1:1) messages between the current user and another member
  // of the same workspace, keyed by the other member's user id. Mirrors
  // the workspace chat routes above. NOTE: these routes don't exist on
  // the backend yet — this is the shape the frontend expects once
  // they're added (GET returns the thread history, POST appends a
  // message with { message }).
  listDirect(recipientUserId, params) {
    return api.get(`/chat/direct/${recipientUserId}`, { params });
  },

  sendDirect(recipientUserId, payload) {
    return api.post(`/chat/direct/${recipientUserId}`, payload);
  },
};

export default chatApi;