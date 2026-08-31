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

  // Public Join Link & Preview
  getPublicPreview(joinCode) {
    return api.get(`/contribution-groups/join/${joinCode}`);
  },

  joinViaCode(joinCode, payload) {
    return api.post(`/contribution-groups/join/${joinCode}`, payload);
  },

  // Time-bound fund / pledge workflow (mounted under /contribution-groups/:groupId/fund)
  getFundDashboard(groupId) {
    return api.get(`/contribution-groups/${groupId}/fund/dashboard`);
  },

  updateFundDetails(groupId, payload) {
    return api.patch(`/contribution-groups/${groupId}/fund/details`, payload);
  },

  extendFund(groupId, contribution_end_date) {
    return api.post(`/contribution-groups/${groupId}/fund/extend`, { contribution_end_date });
  },

  listPledges(groupId) {
    return api.get(`/contribution-groups/${groupId}/fund/pledges`);
  },

  pledge(groupId, payload) {
    return api.post(`/contribution-groups/${groupId}/fund/pledges`, payload);
  },

  initiatePledgeStk(groupId, pledgeId, payload) {
    return api.post(`/contribution-groups/${groupId}/fund/pledges/${pledgeId}/payments/stk`, payload);
  },

  recordCashPledgePayment(groupId, pledgeId, payload) {
    return api.post(`/contribution-groups/${groupId}/fund/pledges/${pledgeId}/payments/cash`, payload);
  },

  sendPledgeReminders(groupId) {
    return api.post(`/contribution-groups/${groupId}/fund/reminders`);
  },

  // RSVP (persisted on the caller's own membership record)
  updateRsvp(groupId, rsvp_status) {
    return api.patch(`/contribution-groups/${groupId}/rsvp`, { rsvp_status });
  },

  // Generic M-Pesa payment-intent polling — not group-scoped, but the
  // STK push initiated via /fund/pledges/:pledgeId/payments/stk returns
  // a paymentIntentId that's polled through this shared endpoint.
  getPaymentIntentStatus(paymentIntentId) {
    return api.get(`/mpesa/payment-intents/${paymentIntentId}`);
  },
};

export default contributionGroupApi;
