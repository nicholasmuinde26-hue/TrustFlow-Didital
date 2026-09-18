import api from "@/app/services/api";

// Ad-hoc, cause-based contributions that live inside a chama (emergency,
// wedding, purchase, etc) - separate from Savings, MGR, and the scheduled
// Contribution plan. See backend modules/chama/chamaContribution.service.js.
const chamaContributionApi = {
  // ── Create / list / get ──────────────────────────────────

  list(workspaceId, status) {
    return api.get(`/chamas/${workspaceId}/chama-contributions`, {
      params: status ? { status } : undefined,
    });
  },

  get(workspaceId, contributionId) {
    return api.get(`/chamas/${workspaceId}/chama-contributions/${contributionId}`);
  },

  create(workspaceId, payload) {
    return api.post(`/chamas/${workspaceId}/chama-contributions`, payload);
  },

  // ── Officials: approve / reject ──────────────────────────

  approve(workspaceId, contributionId) {
    return api.patch(`/chamas/${workspaceId}/chama-contributions/${contributionId}/approve`);
  },

  reject(workspaceId, contributionId, reason) {
    return api.patch(`/chamas/${workspaceId}/chama-contributions/${contributionId}/reject`, { reason });
  },

  // ── Chip in ───────────────────────────────────────────────

  contribute(workspaceId, contributionId, { amount, phone_number }) {
    return api.post(`/chamas/${workspaceId}/chama-contributions/${contributionId}/contribute`, {
      amount,
      phone_number,
    });
  },

  recordCash(workspaceId, contributionId, { member_id, amount }) {
    return api.post(`/chamas/${workspaceId}/chama-contributions/${contributionId}/record-cash`, {
      member_id,
      amount,
    });
  },

  // ── Close / payout / cancel (officials) ──────────────────

  closeCollection(workspaceId, contributionId) {
    return api.patch(`/chamas/${workspaceId}/chama-contributions/${contributionId}/close`);
  },

  proposePayout(workspaceId, contributionId, { disbursement_method, phone_number, notes }) {
    return api.post(`/chamas/${workspaceId}/chama-contributions/${contributionId}/propose-payout`, {
      disbursement_method,
      phone_number,
      notes,
    });
  },

  disburse(workspaceId, contributionId) {
    return api.post(`/chamas/${workspaceId}/chama-contributions/${contributionId}/disburse`);
  },

  cancel(workspaceId, contributionId, reason) {
    return api.patch(`/chamas/${workspaceId}/chama-contributions/${contributionId}/cancel`, { reason });
  },
};

export default chamaContributionApi;
