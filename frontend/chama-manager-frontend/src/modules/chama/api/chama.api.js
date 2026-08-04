import api from "@/app/services/api";

const chamaApi = {
  create(payload) {
    return api.post("/chamas", payload);
  },

  join(payload) {
    return api.post("/chamas/join", payload);
  },
};

export default chamaApi;