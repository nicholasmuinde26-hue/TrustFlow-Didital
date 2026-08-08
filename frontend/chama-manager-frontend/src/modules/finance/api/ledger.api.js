import api from "@/app/services/api";

const ledgerApi = {
  getEntries(workspaceId, params = {}) {
    return api.get(
      `/workspaces/${workspaceId}/finance/ledger`,
      {
        params,
      }
    );
  },

  getEntry(workspaceId, entryId) {
    return api.get(
      `/workspaces/${workspaceId}/finance/ledger/${entryId}`
    );
  },
};

export default ledgerApi;