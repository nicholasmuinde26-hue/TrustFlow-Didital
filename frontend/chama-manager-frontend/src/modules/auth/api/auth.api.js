import api from "@/app/services/api";

const authApi = {
  login(credentials) {
    return api.post("/auth/login", credentials);
  },

  me() {
    return api.get("/auth/me");
  },

  logout() {
    return api.post("/auth/logout");
  },
};

export default authApi;