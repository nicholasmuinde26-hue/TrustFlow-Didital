import chatApi from "../api/chat.api";

const chatService = {
  async list(workspaceId, params) {
    const { data } = await chatApi.list(workspaceId, params);
    return data.data || [];
  },

  async send(workspaceId, payload) {
    const { data } = await chatApi.send(workspaceId, payload);
    return data.data;
  },

  async unread(workspaceId, params) {
    const { data } = await chatApi.unread(workspaceId, params);
    return data.data || { workspace: 0, direct: [] };
  },

  async markRead(workspaceId, payload) {
    const { data } = await chatApi.markRead(workspaceId, payload);
    return data;
  },

  async listDirectConversations(params) {
    const { data } = await chatApi.listDirectConversations(params);
    return data.data || [];
  },

  async listDirect(recipientUserId, params) {
    const { data } = await chatApi.listDirect(recipientUserId, params);
    return data.data || [];
  },

  async sendDirect(recipientUserId, payload) {
    const { data } = await chatApi.sendDirect(recipientUserId, payload);
    return data.data;
  },
};

export default chatService;
