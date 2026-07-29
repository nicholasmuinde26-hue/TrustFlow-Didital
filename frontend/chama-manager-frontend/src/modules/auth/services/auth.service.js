import authApi from "../api/auth.api";

const authService = {
  async login(credentials) {
    const { data } = await authApi.login(credentials);
    return data;
  },

  async me() {
    const { data } = await authApi.me();
    return data;
  },

  async logout() {
    await authApi.logout();
  },
};

export default authService;