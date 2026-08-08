import financeApi from "../api/finance.api";

const financeService = {
  async getSummary(workspaceId) {
    const { data } =
      await financeApi.summary(workspaceId);

    return data.data;
  },

  async getAccounts(workspaceId) {
    const { data } =
      await financeApi.accounts(workspaceId);

    return data.data;
  },

  async getTransactions(workspaceId, params) {
    const { data } =
      await financeApi.transactions(
        workspaceId,
        params
      );

    return data.data;
  },

  async getLedger(workspaceId, params) {
    const { data } =
      await financeApi.ledger(
        workspaceId,
        params
      );

    return data.data;
  },

  async createOperation(workspaceId, payload) {
    const { data } = await financeApi.createOperation(workspaceId, payload);
    return data.data;
  },

  // ========================================

  async recordContribution(payload) {
    const { data } =
      await financeApi.recordContribution(
        payload
      );

    return data.data;
  },

  async getContributionPlans(workspaceId, ownerType) {
    const { data } = await financeApi.contributionPlans(workspaceId, ownerType);
    return data.data?.plans || [];
  },

  async getContributionObligations(planId, workspaceId, ownerType) {
    const { data } = await financeApi.contributionObligations(planId, workspaceId, ownerType);
    return data.data?.obligations || [];
  },

  async initiateMpesaStkPush(payload) {
    const { data } = await financeApi.initiateMpesaStkPush(payload);
    return data.data;
  },
};

export default financeService;
