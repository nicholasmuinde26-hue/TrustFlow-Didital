import api from "@/app/services/api";

const savingsShareoutApi = {
  // ── Policies (Treasurer or Chairperson) ──────────────────

  listPolicies(workspaceId) {
    return api.get(`/chamas/${workspaceId}/savings-share-policies`);
  },

  createPolicy(workspaceId, payload) {
    return api.post(`/chamas/${workspaceId}/savings-share-policies`, payload);
  },

  updatePolicy(workspaceId, policyId, payload) {
    return api.patch(
      `/chamas/${workspaceId}/savings-share-policies/${policyId}`,
      payload
    );
  },

  activatePolicy(workspaceId, policyId) {
    return api.patch(
      `/chamas/${workspaceId}/savings-share-policies/${policyId}/activate`
    );
  },

  archivePolicy(workspaceId, policyId) {
    return api.patch(
      `/chamas/${workspaceId}/savings-share-policies/${policyId}/archive`
    );
  },

  // ── Share-outs ────────────────────────────────────────────

  preview(workspaceId, policyId) {
    return api.get(`/chamas/${workspaceId}/savings-shareouts/preview`, {
      params: { policyId },
    });
  },

  trigger(workspaceId, payload) {
    return api.post(`/chamas/${workspaceId}/savings-shareouts`, payload);
  },

  list(workspaceId) {
    return api.get(`/chamas/${workspaceId}/savings-shareouts`);
  },

  get(workspaceId, shareoutId) {
    return api.get(`/chamas/${workspaceId}/savings-shareouts/${shareoutId}`);
  },

  // Chairperson-only
  approve(workspaceId, shareoutId, payload) {
    return api.patch(
      `/chamas/${workspaceId}/savings-shareouts/${shareoutId}/approve`,
      payload
    );
  },

  // Treasurer-only, per line item
  payItem(workspaceId, shareoutId, itemId, payload) {
    return api.patch(
      `/chamas/${workspaceId}/savings-shareouts/${shareoutId}/items/${itemId}/pay`,
      payload
    );
  },

  cancel(workspaceId, shareoutId, payload) {
    return api.patch(
      `/chamas/${workspaceId}/savings-shareouts/${shareoutId}/cancel`,
      payload
    );
  },
};

export default savingsShareoutApi;