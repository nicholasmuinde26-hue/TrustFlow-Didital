import presenceApi from "../api/presence.api";

const presenceService = {
  async list(workspaceId) {
    const { data } = await presenceApi.list(workspaceId);
    return data.presence || [];
  },

  async ping(workspaceId) {
    await presenceApi.ping(workspaceId);
  },
};

export default presenceService;