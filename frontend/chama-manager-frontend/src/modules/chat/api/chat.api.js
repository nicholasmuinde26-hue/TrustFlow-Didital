import api from "@/app/services/api";

const chatApi = {
  list(workspaceId, params) {
    return api.get(`/chat/workspace/${workspaceId}`, { params });
  },

  unread(workspaceId, params) {
    return api.get(`/chat/workspace/${workspaceId}/unread`, { params });
  },

  markRead(workspaceId, payload) {
    return api.post(`/chat/workspace/${workspaceId}/read`, payload);
  },

  send(workspaceId, payload) {
    return api.post(`/chat/workspace/${workspaceId}`, payload);
  },

  listDirectConversations(params) {
    return api.get("/chat/direct", { params });
  },

  listDirect(recipientUserId, params) {
    return api.get(`/chat/direct/${recipientUserId}`, { params });
  },

  sendDirect(recipientUserId, payload) {
    return api.post(`/chat/direct/${recipientUserId}`, payload);
  },
};

export default chatApi;
