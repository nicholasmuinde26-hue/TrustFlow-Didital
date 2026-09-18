import api from "@/app/services/api";

// Chama-only — see backend/src/modules/disputes/Dispute.routes.js.
const disputeApi = {
  list(chamaId, { status, page = 1, limit = 20 } = {}) {
    return api.get(`/chamas/${chamaId}/disputes`, {
      params: { status, page, limit },
    });
  },

  raise(chamaId, payload) {
    return api.post(`/chamas/${chamaId}/disputes`, payload);
  },

  updateStatus(chamaId, disputeId, payload) {
    return api.patch(`/chamas/${chamaId}/disputes/${disputeId}`, payload);
  },
};

export default disputeApi;
