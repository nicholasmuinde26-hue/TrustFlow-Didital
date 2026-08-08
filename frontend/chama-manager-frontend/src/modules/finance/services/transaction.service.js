import transactionApi from "../api/transaction.api";

const transactionService = {
  async getAll(workspaceId, filters) {
    const { data } =
      await transactionApi.getAll(
        workspaceId,
        filters
      );

    return data.data ?? data.transactions ?? [];
  },

  async getOne(workspaceId, id) {
    const { data } =
      await transactionApi.getOne(
        workspaceId,
        id
      );

    return data.data ?? data.transaction;
  },
};

export default transactionService;