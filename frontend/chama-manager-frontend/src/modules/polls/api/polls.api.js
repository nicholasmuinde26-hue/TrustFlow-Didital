import api from "@/app/services/api";

const pollsApi = {
  list(workspaceId, status) {
    return api.get(`/workspaces/${workspaceId}/polls`, {
      params: status && status !== "all" ? { status } : undefined,
    });
  },

  get(workspaceId, pollId) {
    return api.get(`/workspaces/${workspaceId}/polls/${pollId}`);
  },

  create(workspaceId, payload) {
    return api.post(`/workspaces/${workspaceId}/polls`, payload);
  },

  publish(workspaceId, pollId) {
    return api.put(`/workspaces/${workspaceId}/polls/${pollId}/publish`);
  },

  vote(workspaceId, pollId, optionIds) {
    return api.post(`/workspaces/${workspaceId}/polls/${pollId}/votes`, { optionIds });
  },

  close(workspaceId, pollId) {
    return api.put(`/workspaces/${workspaceId}/polls/${pollId}/close`);
  },

  cancel(workspaceId, pollId) {
    return api.delete(`/workspaces/${workspaceId}/polls/${pollId}`);
  },
};

export default pollsApi;
