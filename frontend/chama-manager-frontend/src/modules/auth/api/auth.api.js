import api from "@/app/services/api";

const authApi = {
  async login(credentials) {
    const { data } = await api.post("/auth/login", credentials);
    return data;
  },

  async register(payload) {
    const { data } = await api.post("/auth/register", payload);
    return data;
  },

  async me() {
    const { data } = await api.get("/auth/me");
    return data;
  },

  async logout() {
    const { data } = await api.post("/auth/logout");
    return data;
  },
};

export default authApi;