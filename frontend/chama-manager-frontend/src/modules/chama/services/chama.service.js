import chamaApi from "../api/chama.api";

const chamaService = {
  async create(payload) {
    const { data } = await chamaApi.create(payload);
    return data.data.chama;
  },

  async verifyTreasurer(query) {
    const { data } = await chamaApi.verifyTreasurer(query);
    return data.data.user;
  },

  async get(chamaId) {
    const { data } = await chamaApi.get(chamaId);
    return data.data.chama;
  },

  async getPublicChamas() {
    const { data } = await chamaApi.getPublicChamas();
    return data.data.chamas || [];
  },

  async joinWithCode(joinCode) {
    const { data } = await chamaApi.joinWithCode(joinCode);
    return data.data.membership;
  },

  // Backend expects monthly_savings (snake_case) on update, unlike the
  // camelCase monthlySavings accepted on create — that inconsistency is
  // in the backend itself (chama.service.js updateChama), not a typo here.
  async update(chamaId, { name, monthly_savings }) {
    const { data } = await chamaApi.update(chamaId, { name, monthly_savings });
    return data.data.chama;
  },

  async remove(chamaId) {
    await chamaApi.remove(chamaId);
  },

  async getProfile(chamaId) {
    const { data } = await chamaApi.getProfile(chamaId);
    return data.data || data;
  },

  async saveProfile(chamaId, payload) {
    const { data } = await chamaApi.saveProfile(chamaId, payload);
    return data.data || data;
  },

  // ------------------------------------------------------------------
  // JOIN-LINK FLOW
  // ------------------------------------------------------------------
  // A Treasurer/Chairperson generates a shareable link (createInvite);
  // anyone with the link can preview it before logging in (previewInvite),
  // then "accept" it once authenticated — which creates a PENDING
  // membership, not an active one. The Treasurer/Chairperson approves
  // or declines it from the Members page (see useMembers.js).
  // ------------------------------------------------------------------

  async createInvite(chamaId, payload = {}) {
    const { data } = await chamaApi.createInvitation(chamaId, payload);
    return data.data; // { invitation, token, join_path }
  },

  // Public — safe to call before the user is authenticated.
  async previewInvite(token) {
    const { data } = await chamaApi.previewInvitation(token);
    return data.data; // { valid, expired, chama, role, invited_by, expires_at }
  },

  // Requires auth. Returns the (pending) membership created.
  async acceptInvite(token) {
    const { data } = await chamaApi.acceptInvitation(token);
    return data.data.membership;
  },

  async myPendingRequests() {
    const { data } = await chamaApi.myPendingRequests();
    return data.data.requests || [];
  },

  // Pending join requests shown on the Members page. Backed by a
  // dedicated endpoint (GET /chamas/:id/members/join-requests) that
  // already returns only status: "pending" records — no client-side
  // filtering needed.
  async listJoinRequests(chamaId) {
    const { data } = await chamaApi.listJoinRequests(chamaId);
    return data.data.requests || [];
  },
};

export default chamaService;