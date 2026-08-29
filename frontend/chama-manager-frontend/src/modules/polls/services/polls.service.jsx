import pollsApi from "../api/polls.api";

const pollsService = {
  async list(workspaceId, status) {
    const { data } = await pollsApi.list(workspaceId, status);
    return data.data?.polls || [];
  },

  async get(workspaceId, pollId) {
    const { data } = await pollsApi.get(workspaceId, pollId);
    return data.data?.poll;
  },

  async create(workspaceId, payload) {
    const { data } = await pollsApi.create(workspaceId, payload);
    return data.data?.poll;
  },

  async publish(workspaceId, pollId) {
    const { data } = await pollsApi.publish(workspaceId, pollId);
    return data.data?.poll;
  },

  async vote(workspaceId, pollId, optionIds) {
    const { data } = await pollsApi.vote(workspaceId, pollId, optionIds);
    return data.data?.poll;
  },

  async close(workspaceId, pollId) {
    const { data } = await pollsApi.close(workspaceId, pollId);
    return data.data?.poll;
  },

  async cancel(workspaceId, pollId) {
    await pollsApi.cancel(workspaceId, pollId);
  },
};

export default pollsService;
