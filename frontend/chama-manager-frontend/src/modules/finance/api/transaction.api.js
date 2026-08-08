import api from "@/app/services/api";

const transactionApi = {
  getAll(workspaceId, params = {}) {
    return api.get(
      `/workspaces/${workspaceId}/finance/transactions`,
      {
        params,
      }
    );
  },

  getOne(workspaceId, transactionId) {
    return api.get(
      `/workspaces/${workspaceId}/finance/transactions/${transactionId}`
    );
  },
};

export default transactionApi;