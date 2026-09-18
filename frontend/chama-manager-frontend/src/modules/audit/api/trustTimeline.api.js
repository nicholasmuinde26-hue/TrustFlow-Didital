import api from "@/app/services/api";

// Chama-only for now — Contribution Groups don't carry the same
// governance/loan surface area that makes a trust timeline meaningful.
const trustTimelineApi = {
  list(chamaId, { page = 1, limit = 20 } = {}) {
    return api.get(`/chamas/${chamaId}/trust-timeline`, {
      params: { page, limit },
    });
  },

  // Re-walks the chama's audit hash chain server-side and reports
  // whether it is still intact. Read-only, and safe to call repeatedly.
  verify(chamaId) {
    return api.get(`/chamas/${chamaId}/trust-timeline/verify`);
  },
};

export default trustTimelineApi;