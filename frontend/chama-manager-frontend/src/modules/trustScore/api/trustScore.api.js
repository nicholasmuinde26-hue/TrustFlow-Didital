import api from "@/app/services/api";

// Chama-only — see backend/src/modules/trustScore/Trustscore.routes.js.
const trustScoreApi = {
  getLatest(chamaId) {
    return api.get(`/chamas/${chamaId}/trust-score`);
  },

  getHistory(chamaId, { page = 1, limit = 12 } = {}) {
    return api.get(`/chamas/${chamaId}/trust-score/history`, {
      params: { page, limit },
    });
  },

  generate(chamaId) {
    return api.post(`/chamas/${chamaId}/trust-score/generate`);
  },

  share(chamaId, trustScoreId) {
    return api.post(`/chamas/${chamaId}/trust-score/${trustScoreId}/share`);
  },

  revoke(chamaId, trustScoreId) {
    return api.post(`/chamas/${chamaId}/trust-score/${trustScoreId}/revoke`);
  },
};

export default trustScoreApi;

// Public — no auth, no chama scoping. Served from a separate mount
// (/api/v1/public/trust-score) so it never touches auth headers even
// if the viewer happens to have a stale token in storage.
export const publicTrustScoreApi = {
  getByToken(token) {
    return api.get(`/public/trust-score/${token}`);
  },
};
