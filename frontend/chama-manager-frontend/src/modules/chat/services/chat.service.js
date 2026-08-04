import chatApi from "../api/chat.api";

const chatService = {
  async list(workspaceId, params) {
    const { data } = await chatApi.list(workspaceId, params);
    return data.messages || [];
  },

  async send(workspaceId, payload) {
    const { data } = await chatApi.send(workspaceId, payload);
    return data.message || data;
  },
};

export default chatService;