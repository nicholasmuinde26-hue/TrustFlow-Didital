import api from "@/app/services/api";

const workspaceService = {
  async getWorkspaces() {
    const { data } = await api.get("/workspaces");
    return data;
  },

  async createWorkspace(payload) {
    const { data } = await api.post(
      "/workspaces",
      payload
    );

    return data;
  },

  async getWorkspace(id) {
    const { data } = await api.get(
      `/workspaces/${id}`
    );

    return data;
  },
};

export default workspaceService;