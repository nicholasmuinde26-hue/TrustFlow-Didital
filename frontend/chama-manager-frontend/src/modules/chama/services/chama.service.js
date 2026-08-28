import chamaApi from "../api/chama.api";

const chamaService = {
  async create(payload) {
    const { data } = await chamaApi.create(payload);
    return data.data.chama;
  },

  async verifyTreasurer(query) {
    const { data } = await chamaApi.verifyTreasurer(query);
    return data.data.user;
  },

  async get(chamaId) {
    const { data } = await chamaApi.get(chamaId);
    return data.data.chama;
  },

  // Backend expects monthly_savings (snake_case) on update, unlike the
  // camelCase monthlySavings accepted on create — that inconsistency is
  // in the backend itself (chama.service.js updateChama), not a typo here.
  async update(chamaId, { name, monthly_savings }) {
    const { data } = await chamaApi.update(chamaId, { name, monthly_savings });
    return data.data.chama;
  },

  async remove(chamaId) {
    await chamaApi.remove(chamaId);
  },

  async getProfile(chamaId) {
    const { data } = await chamaApi.getProfile(chamaId);
    return data.data || data;
  },

  async saveProfile(chamaId, payload) {
    const { data } = await chamaApi.saveProfile(chamaId, payload);
    return data.data || data;
  },
};

export default chamaService;