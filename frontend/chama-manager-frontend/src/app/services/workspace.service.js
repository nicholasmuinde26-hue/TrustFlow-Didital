import api from "@/app/services/api";

// Matches backend/src/modules/workspaces exactly. This is a read-only
// aggregator — it does NOT expose create/join endpoints of its own.
// Creating a workspace means POSTing to /chamas, /contribution-groups,
// or /business directly (see modules/chama, modules/contribution-group,
// and modules/business), which is why there's no createWorkspace/joinWorkspace
// here anymore.
//
// IMPORTANT — backend setup required for this to work at all:
// 1. backend/src/app.js never mounts workspace.routes.js. Add:
//      import workspaceRoutes from './modules/workspaces/workspace.routes.js';
//      app.use('/api/v1/workspaces', workspaceRoutes);
// 2. backend/src/modules/workspaces/workspace.service.js imports a model
//    that doesn't exist:
//      import ContributionGroupMembership from "../../models/ContributionGroupMembership.js";
//    The actual model file is ContributionGroupMember.js (no "ship").
//    This import will crash Node at startup until it's fixed to:
//      import ContributionGroupMember from "../../models/ContributionGroupMember.js";
//    (and the two later references to ContributionGroupMembership in that
//    file renamed to match).
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