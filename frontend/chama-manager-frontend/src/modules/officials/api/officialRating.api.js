import api from "@/app/services/api";

// Chama-only — see backend/src/modules/officials/Officialrating.routes.js.
const officialRatingApi = {
  list(chamaId) {
    return api.get(`/chamas/${chamaId}/officials`);
  },

  submitRating(chamaId, membershipId, payload) {
    return api.post(`/chamas/${chamaId}/officials/${membershipId}/ratings`, payload);
  },

  // Raw per-rater detail — treasurer/auditor only (enforced server-side).
  getDetail(chamaId, membershipId) {
    return api.get(`/chamas/${chamaId}/officials/${membershipId}/ratings`);
  },
};

export default officialRatingApi;
