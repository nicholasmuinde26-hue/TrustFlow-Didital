import api from "@/app/services/api";

// Mirrors be/src/modules/workspaces/workspaceModules.routes.js and
// workspace.routes.js (GET /workspaces/modules/catalog).
const unwrap = (response) => response?.data?.data ?? response?.data;

const workspaceModulesApi = {
  // Static catalog: { groups, modules[], presets[] }. Same for everyone.
  catalog() {
    return api.get("/workspaces/modules/catalog").then(unwrap);
  },

  // { preset, modules[], blocked{key:{count,reason,hint}}, pending, recent[] }
  settings(chamaId) {
    return api.get(`/chamas/${chamaId}/workspace-modules`).then(unwrap);
  },

  // Chama chairperson or treasurer. Platform administration reviews the full target list.
  request(chamaId, { modules, note }) {
    return api
      .post(`/chamas/${chamaId}/workspace-modules/requests`, { modules, note })
      .then(unwrap);
  },

  cancel(chamaId, requestId, reason) {
    return api
      .post(`/chamas/${chamaId}/workspace-modules/requests/${requestId}/cancel`, { reason })
      .then(unwrap);
  },

};

export default workspaceModulesApi;
