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

  recentPayments(workspaceId) {
    return api.get(
      `/workspaces/${workspaceId}/finance/payments/recent`
    );
  },

  createOperation(workspaceId, payload) {
    return api.post(`/workspaces/${workspaceId}/finance/operations`, payload);
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