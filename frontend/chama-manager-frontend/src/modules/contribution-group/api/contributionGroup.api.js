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

  // Time-bound fund / pledge workflow
  getFundDashboard(groupId) {
    return api.get(`/contribution-groups/${groupId}/dashboard`);
  },

  updateFundDetails(groupId, payload) {
    return api.patch(`/contribution-groups/${groupId}/details`, payload);
  },

  extendFund(groupId, contribution_end_date) {
    return api.post(`/contribution-groups/${groupId}/extend`, { contribution_end_date });
  },

  listPledges(groupId) {
    return api.get(`/contribution-groups/${groupId}/pledges`);
  },

  pledge(groupId, payload) {
    return api.post(`/contribution-groups/${groupId}/pledges`, payload);
  },

  initiatePledgeStk(groupId, pledgeId, payload) {
    return api.post(`/contribution-groups/${groupId}/pledges/${pledgeId}/payments/stk`, payload);
  },

  recordCashPledgePayment(groupId, pledgeId, payload) {
    return api.post(`/contribution-groups/${groupId}/pledges/${pledgeId}/payments/cash`, payload);
  },

  sendPledgeReminders(groupId) {
    return api.post(`/contribution-groups/${groupId}/reminders`);
  },
};

export default contributionGroupApi;
