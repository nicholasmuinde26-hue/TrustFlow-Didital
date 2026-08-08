import accountApi from "../api/account.api";

const accountService = {
  async getAll(workspaceId) {
    const { data } =
      await accountApi.getAll(workspaceId);

    return data.data ?? data.accounts ?? [];
  },

  async getOne(workspaceId, id) {
    const { data } =
      await accountApi.getOne(workspaceId, id);

    return data.data ?? data.account;
  },
};

export default accountService;