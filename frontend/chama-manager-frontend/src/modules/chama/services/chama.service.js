import chamaApi from "../api/chama.api";

const chamaService = {
  // Backend only accepts { name, monthlySavings } — no description field
  // exists on the Chama model.
  async create({ name, monthlySavings }) {
    const { data } = await chamaApi.create({ name, monthlySavings });
    return data.data.chama;
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