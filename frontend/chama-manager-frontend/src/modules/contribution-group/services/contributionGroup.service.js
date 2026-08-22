import contributionGroupApi from "../api/contributionGroup.api";

const contributionGroupService = {
  // Backend accepts { name, description, type, event_date, location,
  // visibility }. "type" here is the group's category (wedding, funeral,
  // fundraiser, ...) — see GROUP_TYPES — not the chama/contribution-group
  // workspace discriminator.
  async create(payload) {
    const { data } = await contributionGroupApi.create(payload);
    return data.data.group;
  },

  async get(groupId) {
    const { data } = await contributionGroupApi.get(groupId);
    return data.data;
  },

  async update(groupId, payload) {
    const { data } = await contributionGroupApi.update(groupId, payload);
    return data.data.group;
  },

  async updateStatus(groupId, status) {
    const { data } = await contributionGroupApi.updateStatus(groupId, status);
    return data.data.group;
  },

  async getMembers(groupId) {
    const { data } = await contributionGroupApi.getMembers(groupId);
    return data.data.members || data.data || [];
  },

  async getPlans(groupId) {
    const { data } = await contributionGroupApi.getPlans(groupId);
    return data.data.plans || data.data || [];
  },

  async getAuditLogs(groupId) {
    const { data } = await contributionGroupApi.getAuditLogs(groupId);
    return data.data.logs || data.data || [];
  },

  async getFinanceSummary(groupId) {
    const { data } = await contributionGroupApi.getFinanceSummary(groupId);
    return data.data || {};
  },

  async getTransactions(groupId) {
    const { data } = await contributionGroupApi.getTransactions(groupId);
    return data.data.transactions || data.data || [];
  },

  async getExpenses(groupId) {
    const { data } = await contributionGroupApi.getExpenses(groupId);
    return data.data.expenses || data.data || [];
  },

  async createExpense(groupId, payload) {
    const { data } = await contributionGroupApi.createExpense(groupId, payload);
    return data.data;
  },
};

export default contributionGroupService;