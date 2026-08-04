import api from "@/app/services/api";

const contributionGroupApi = {
  create(payload) {
    return api.post("/contribution-groups", payload);
  },

  join(payload) {
    return api.post("/contribution-groups/join", payload);
  },

  get(id) {
    return api.get(`/contribution-groups/${id}`);
  },

  getMembers(id) {
    return api.get(`/contribution-groups/${id}/members`);
  },
};

export default contributionGroupApi;