import api from "@/app/services/api";

const financeApi = {
  // ========================================
  // DASHBOARD
  // ========================================

  summary(workspaceId) {
    return api.get(
      `/workspaces/${workspaceId}/finance/summary`
    );
  },

  summaryMe(workspaceId) {
    return api.get(
      `/workspaces/${workspaceId}/finance/summary/me`
    );
  },

  summaryTrend(workspaceId) {
    return api.get(
      `/workspaces/${workspaceId}/finance/summary/trend`
    );
  },

  accounts(workspaceId) {
    return api.get(
      `/workspaces/${workspaceId}/finance/accounts`
    );
  },

  transactions(workspaceId, params = {}) {
    return api.get(
      `/workspaces/${workspaceId}/finance/transactions`,
      { params }
    );
  },

  ledger(workspaceId, params = {}) {
    return api.get(
      `/workspaces/${workspaceId}/finance/ledger`,
      { params }
    );
  },

  // GL balance check — cheap enough to poll from the workspace layout
  glBalance(workspaceId) {
    return api.get(
      `/workspaces/${workspaceId}/finance/gl-balance`
    );
  },

  recentPayments(workspaceId) {
    return api.get(
      `/workspaces/${workspaceId}/finance/payments/recent`
    );
  },

  reports(workspaceId, params = {}) {
    return api.get(
      `/workspaces/${workspaceId}/finance/reports`,
      { params }
    );
  },

  createOperation(workspaceId, payload) {
    return api.post(`/workspaces/${workspaceId}/finance/operations`, payload);
  },

  // ========================================
  // CASH DEPOSIT ENFORCEMENT
  // ========================================
  // "No money stays as cash" - see backend cashDeposit.service.js.

  cashDepositStatus(workspaceId) {
    return api.get(`/workspaces/${workspaceId}/finance/cash/status`);
  },

  depositCash(workspaceId, payload) {
    return api.post(`/workspaces/${workspaceId}/finance/cash/deposit`, payload);
  },

  // ========================================
  // BANK ACCOUNTS
  // ========================================

  bankAccounts(workspaceId, params = {}) {
    return api.get(`/workspaces/${workspaceId}/finance/bank-accounts`, { params });
  },

  createBankAccount(workspaceId, payload) {
    return api.post(`/workspaces/${workspaceId}/finance/bank-accounts`, payload);
  },

  updateBankAccount(workspaceId, bankAccountId, payload) {
    return api.patch(`/workspaces/${workspaceId}/finance/bank-accounts/${bankAccountId}`, payload);
  },

  deactivateBankAccount(workspaceId, bankAccountId) {
    return api.delete(`/workspaces/${workspaceId}/finance/bank-accounts/${bankAccountId}`);
  },


  // ========================================
  // FINANCE OPERATIONS
  // ========================================

  recordContribution(payload) {
    return api.post(
      "/contributions",
      payload
    );
  },

  contributionPlans(workspaceId, ownerType) {
    return api.get("/contribution-plans", {
      params: { owner_id: workspaceId, owner_type: ownerType, status: "active" },
    });
  },

  contributionObligations(planId, workspaceId, ownerType) {
    return api.get(`/contribution-plans/${planId}/obligations`, {
      params: { owner_id: workspaceId, owner_type: ownerType, status: "pending,partially_paid,overdue" },
    });
  },

  initiateMpesaStkPush(payload) {
    return api.post("/mpesa/contributions/stk-push", payload);
  },
};

export default financeApi;