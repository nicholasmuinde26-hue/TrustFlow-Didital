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