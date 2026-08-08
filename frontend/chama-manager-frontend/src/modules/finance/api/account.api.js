import api from "@/app/services/api";

const accountApi = {
  getAll(workspaceId) {
    return api.get(
      `/workspaces/${workspaceId}/finance/accounts`
    );
  },

  getOne(workspaceId, accountId) {
    return api.get(
      `/workspaces/${workspaceId}/finance/accounts/${accountId}`
    );
  },
};

export default accountApi;