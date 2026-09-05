import savingsShareoutApi from "../api/savingsShareout.api";

const savingsShareoutService = {
  // ── Policies ──────────────────────────────────────────────

  async getPolicies(workspaceId) {
    const { data } = await savingsShareoutApi.listPolicies(workspaceId);
    return data.data;
  },

  async createPolicy(workspaceId, payload) {
    const { data } = await savingsShareoutApi.createPolicy(workspaceId, payload);
    return data.data;
  },

  async updatePolicy(workspaceId, policyId, payload) {
    const { data } = await savingsShareoutApi.updatePolicy(
      workspaceId,
      policyId,
      payload
    );
    return data.data;
  },

  async activatePolicy(workspaceId, policyId) {
    const { data } = await savingsShareoutApi.activatePolicy(workspaceId, policyId);
    return data.data;
  },

  async archivePolicy(workspaceId, policyId) {
    const { data } = await savingsShareoutApi.archivePolicy(workspaceId, policyId);
    return data.data;
  },

  // ── Share-outs ────────────────────────────────────────────

  async preview(workspaceId, policyId) {
    const { data } = await savingsShareoutApi.preview(workspaceId, policyId);
    return data.data;
  },

  async trigger(workspaceId, payload) {
    const { data } = await savingsShareoutApi.trigger(workspaceId, payload);
    return data.data;
  },

  async getAll(workspaceId) {
    const { data } = await savingsShareoutApi.list(workspaceId);
    return data.data;
  },

  async getOne(workspaceId, shareoutId) {
    const { data } = await savingsShareoutApi.get(workspaceId, shareoutId);
    return data.data;
  },

  async approve(workspaceId, shareoutId, payload = {}) {
    const { data } = await savingsShareoutApi.approve(
      workspaceId,
      shareoutId,
      payload
    );
    return data.data;
  },

  async payItem(workspaceId, shareoutId, itemId, payload = {}) {
    const { data } = await savingsShareoutApi.payItem(
      workspaceId,
      shareoutId,
      itemId,
      payload
    );
    return data.data;
  },

  async cancel(workspaceId, shareoutId, payload = {}) {
    const { data } = await savingsShareoutApi.cancel(
      workspaceId,
      shareoutId,
      payload
    );
    return data.data;
  },
};

export default savingsShareoutService;