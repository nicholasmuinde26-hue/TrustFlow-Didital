import api from "@/app/services/api";

// Matches backend/src/modules/contributionGroups/contributionGroup.routes.js
// exactly.
const contributionGroupApi = {
  create(payload) {
    return api.post("/contribution-groups", payload);
  },

  get(groupId) {
    return api.get(`/contribution-groups/${groupId}`);
  },

  update(groupId, payload) {
    return api.patch(`/contribution-groups/${groupId}`, payload);
  },

  updateStatus(groupId, status) {
    return api.patch(`/contribution-groups/${groupId}/status`, { status });
  },
};

export default contributionGroupApi;