import api from "@/app/services/api";

const aiApi = {
  insights(workspaceId) {
    return api.get(`/workspaces/${workspaceId}/ai/insights`);
  },

  suggestions(workspaceId) {
    return api.get(`/workspaces/${workspaceId}/ai/suggestions`);
  },

  overview(workspaceId) {
    return api.get(`/workspaces/${workspaceId}/ai/overview`);
  },

  chat(workspaceId, message) {
    return api.post(`/workspaces/${workspaceId}/ai/chat`, { message });
  },
};

export default aiApi;
