import ledgerApi from "../api/ledger.api";

const ledgerService = {
  async getEntries(workspaceId, filters = {}) {
    const { data } =
      await ledgerApi.getEntries(
        workspaceId,
        filters
      );

    return data.data ?? data.entries ?? [];
  },

  async getEntry(workspaceId, id) {
    const { data } =
      await ledgerApi.getEntry(
        workspaceId,
        id
      );

    return data.data ?? data.entry;
  },
};

export default ledgerService;