import api from "@/app/services/api";

// Matches backend/src/modules/workspaces exactly. This is a read-only
// aggregator — it does NOT expose create/join endpoints of its own.
// Creating a workspace means POSTing to /chamas, /contribution-groups,
// or /business directly (see modules/chama, modules/contribution-group,
// and modules/business), which is why there's no createWorkspace/joinWorkspace
// here anymore.
const workspaceService = {
  async getWorkspaces() {
    const { data } = await api.get("/workspaces");
    // workspace.controller.js returns { success, data: [...] } — the
    // array directly, not wrapped in a further { workspaces: [] } key.
    return data.data || [];
  },

  async getWorkspaceById(workspaceId) {
    const { data } = await api.get(`/workspaces/${workspaceId}`);
    return data.data || data;
  },
};

export default workspaceService;