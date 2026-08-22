import api from "@/app/services/api";

// Matches backend/src/modules/contributionGroups/contributionGroup.routes.js
// exactly.
const contributionGroupApi = {
  create(payload) {
    return api.post("/contribution-groups", payload);
  },

  get(groupId) {
    return api.get(`/contribution-groups/${groupId}`);
  },

  update(groupId, payload) {
    return api.patch(`/contribution-groups/${groupId}`, payload);
  },

  updateStatus(groupId, status) {
    return api.patch(`/contribution-groups/${groupId}/status`, { status });
  },

  getMembers(groupId) {
    return api.get(`/contribution-groups/${groupId}/members`);
  },

  getPlans(groupId) {
    return api.get(`/contribution-groups/${groupId}/plans`);
  },

  getAuditLogs(groupId) {
    return api.get(`/contribution-groups/${groupId}/group-audit-logs`);
  },

  getFinanceSummary(groupId) {
    return api.get(`/workspaces/${groupId}/finance/summary`);
  },

  getTransactions(groupId) {
    return api.get(`/workspaces/${groupId}/finance/transactions`);
  },

  getExpenses(groupId) {
    return api.get(`/workspaces/${groupId}/finance/expenses`);
  },

  createExpense(groupId, payload) {
    return api.post(`/workspaces/${groupId}/finance/expenses`, payload);
  },
};

export default contributionGroupApi;