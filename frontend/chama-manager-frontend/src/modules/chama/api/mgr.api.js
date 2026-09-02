import api from "@/app/services/api";

const mgrApi = {
  // ── Dashboard & read ──────────────────────────────────────
  getOverview(chamaId) {
    return api.get(`/mgr/overview/${chamaId}`);
  },

  /**
   * Fetch all active Chama members for the MGR wizard participant picker.
   * Available to any authenticated Chama member.
   */
  getMembers(chamaId) {
    return api.get(`/mgr/members/${chamaId}`);
  },

  /**
   * Fetch Chama-scoped contribution plans + per-member obligation overview.
   * Works without creating a separate ContributionGroup.
   */
  getContributions(chamaId) {
    return api.get(`/mgr/contributions/${chamaId}`);
  },

  // ── Policy lifecycle (Treasurer only) ────────────────────

  /**
   * Create a new draft MGR Policy.
   * @enforced requireChamaTreasurer on the backend
   */
  createPolicy(chamaId, payload) {
    return api.post(`/mgr/policy/${chamaId}`, payload);
  },

  /**
   * Edit a DRAFT policy (fields like name, participants, rules).
   * The backend rejects edits on active/archived policies.
   * @enforced requireChamaTreasurer on the backend
   */
  updatePolicy(chamaId, policyId, payload) {
    return api.patch(`/mgr/policy/${chamaId}/${policyId}`, payload);
  },

  /**
   * Activate a draft policy → generates all MgrRound objects.
   * @enforced requireChamaTreasurer on the backend
   */
  activatePolicy(chamaId, policyId) {
    return api.post(`/mgr/policy/${chamaId}/${policyId}/activate`);
  },

  /**
   * Reorder payout rotation positions (audit-logged change).
   * @enforced requireChamaTreasurer on the backend
   */
  reorderRotation(chamaId, policyId, newOrderArray) {
    return api.patch(`/mgr/policy/${chamaId}/${policyId}/reorder`, { newOrderArray });
  },

  // ── Round workflow (Treasurer only) ──────────────────────

  /**
   * Submit a payout proposal for the current round.
   * Creates an ApprovalRequest and blocks disbursement until approved.
   * @enforced requireChamaTreasurer on the backend
   */
  proposePayout(roundId, payload) {
    return api.post(`/mgr/rounds/${roundId}/propose-payout`, payload);
  },

  /**
   * Disburse a payout that has been fully approved.
   * Backend validates ApprovalRequest.status === 'approved' before acting.
   * @enforced requireChamaTreasurer on the backend
   */
  disbursePayout(roundId) {
    return api.post(`/mgr/rounds/${roundId}/disburse`);
  },

  /**
   * Send payment reminders to unpaid members for the current round
   */
  sendReminders(roundId) {
    return api.post(`/mgr/rounds/${roundId}/send-reminders`);
  },

  /**
   * Manually record a member contribution payment (cash / bank).
   * @enforced requireChamaTreasurer on the backend
   */
  recordPayment(chamaId, payload) {
    return api.post(`/mgr/payment/${chamaId}`, payload);
  },

  /**
   * Check M-Pesa / payment intent status for STK push listener polling
   */
  getPaymentStatus(paymentIntentId) {
    return api.get(`/contributions/payments/${paymentIntentId}/status`);
  },

  /**
   * Initiate contribution payment (supports M-Pesa STK push or cash/bank)
   */
  initiateContributionPayment(payload) {
    return api.post(`/contributions`, payload);
  },

  // ── Approvals (role-checked in approval.service.js) ──────

  getApprovals(chamaId, status = null) {
    return api.get(`/approvals/chama/${chamaId}`, { params: status ? { status } : {} });
  },

  submitApprovalSignoff(requestId, payload) {
    return api.post(`/approvals/${requestId}/signoff`, payload);
  },
};

export default mgrApi;
