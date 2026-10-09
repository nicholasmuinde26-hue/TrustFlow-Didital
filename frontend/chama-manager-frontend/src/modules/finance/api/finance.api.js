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

  // My Wallet — the caller's own contributions + savings + loan +
  // pending payout + pending withdrawal, rolled into one response.
  wallet(workspaceId) {
    return api.get(
      `/workspaces/${workspaceId}/finance/wallet`
    );
  },
  depositMemberWallet(workspaceId, payload) { return api.post(`/workspaces/${workspaceId}/finance/wallet/deposit`, payload); },
  withdrawMemberWallet(workspaceId, payload) { return api.post(`/workspaces/${workspaceId}/finance/wallet/withdraw`, payload); },
  setMemberWalletPin(workspaceId, pin) { return api.post(`/workspaces/${workspaceId}/finance/wallet/pin`, { pin }); },
  changeMemberWalletPin(workspaceId, payload) { return api.patch(`/workspaces/${workspaceId}/finance/wallet/pin`, payload); },

  accounts(workspaceId, params = {}) {
    return api.get(
      `/workspaces/${workspaceId}/finance/accounts`,
      { params }
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

  // The contributions register - the single source of truth behind the
  // Contributions page (per-member/per-plan expected vs collected vs
  // outstanding, plus the payment rows themselves).
  contributions(workspaceId, params = {}) {
    return api.get(
      `/workspaces/${workspaceId}/finance/contributions`,
      { params }
    );
  },

  // The caller's own effective permissions for this workspace, so the UI
  // gates on the same decision the API will make.
  permissions(workspaceId) {
    return api.get(
      `/workspaces/${workspaceId}/finance/permissions`
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

  businessFundSeparation(workspaceId) {
    return api.get(`/workspaces/${workspaceId}/finance/business-funds/separation`);
  },

  applyBusinessFundSeparation(workspaceId) {
    return api.post(`/workspaces/${workspaceId}/finance/business-funds/separation`);
  },

  businessFunds(workspaceId, params = {}) {
    return api.get(`/workspaces/${workspaceId}/finance/business-funds`, { params });
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

  contributionObligations(planId, workspaceId, ownerType, participantId, status = "pending,partially_paid,overdue") {
    return api.get(`/contribution-plans/${planId}/obligations`, {
      params: { owner_id: workspaceId, owner_type: ownerType, status: status || undefined, participant_id: participantId || undefined },
    });
  },

  initiateMpesaStkPush(payload) {
    return api.post("/mpesa/contributions/stk-push", payload);
  },

  // ========================================
  // LEDGER ADJUSTMENTS
  // ========================================

  adjustments(workspaceId, params = {}) {
    return api.get(`/workspaces/${workspaceId}/finance/adjustments`, { params });
  },

  adjustment(workspaceId, adjustmentId) {
    return api.get(`/workspaces/${workspaceId}/finance/adjustments/${adjustmentId}`);
  },

  requestAdjustment(workspaceId, payload) {
    return api.post(`/workspaces/${workspaceId}/finance/adjustments`, payload);
  },

  decideAdjustment(workspaceId, adjustmentId, payload) {
    return api.post(`/workspaces/${workspaceId}/finance/adjustments/${adjustmentId}/decide`, payload);
  },

  cancelAdjustment(workspaceId, adjustmentId, payload = {}) {
    return api.post(`/workspaces/${workspaceId}/finance/adjustments/${adjustmentId}/cancel`, payload);
  },

  // ========================================
  // BANK RECONCILIATION
  // ========================================

  reconciliationSessions(workspaceId, params = {}) {
    return api.get(`/workspaces/${workspaceId}/finance/reconciliation/sessions`, { params });
  },

  reconciliationSession(workspaceId, sessionId) {
    return api.get(`/workspaces/${workspaceId}/finance/reconciliation/sessions/${sessionId}`);
  },

  createReconciliationSession(workspaceId, payload) {
    return api.post(`/workspaces/${workspaceId}/finance/reconciliation/sessions`, payload);
  },

  addReconciliationLines(workspaceId, sessionId, lines) {
    return api.post(`/workspaces/${workspaceId}/finance/reconciliation/sessions/${sessionId}/lines`, { lines });
  },

  autoMatchReconciliation(workspaceId, sessionId) {
    return api.post(`/workspaces/${workspaceId}/finance/reconciliation/sessions/${sessionId}/auto-match`);
  },

  matchReconciliationLine(workspaceId, sessionId, lineId, ledgerEntryId) {
    return api.post(
      `/workspaces/${workspaceId}/finance/reconciliation/sessions/${sessionId}/lines/${lineId}/match`,
      { ledgerEntryId }
    );
  },

  unmatchReconciliationLine(workspaceId, sessionId, lineId) {
    return api.post(`/workspaces/${workspaceId}/finance/reconciliation/sessions/${sessionId}/lines/${lineId}/unmatch`);
  },

  ignoreReconciliationLine(workspaceId, sessionId, lineId, reason) {
    return api.post(
      `/workspaces/${workspaceId}/finance/reconciliation/sessions/${sessionId}/lines/${lineId}/ignore`,
      { reason }
    );
  },

  raiseAdjustmentForLine(workspaceId, sessionId, lineId, payload) {
    return api.post(
      `/workspaces/${workspaceId}/finance/reconciliation/sessions/${sessionId}/lines/${lineId}/raise-adjustment`,
      payload
    );
  },

  completeReconciliationSession(workspaceId, sessionId, force = false) {
    return api.post(`/workspaces/${workspaceId}/finance/reconciliation/sessions/${sessionId}/complete`, { force });
  },
};

export default financeApi;
