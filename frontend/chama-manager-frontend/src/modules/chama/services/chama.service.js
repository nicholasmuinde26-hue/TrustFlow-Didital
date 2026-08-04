import chamaApi from "../api/chama.api";

const chamaService = {
  async create(payload) {
    const { data } = await chamaApi.create(payload);
    return data;
  },

  async join(payload) {
    const { data } = await chamaApi.join(payload);
    return data;
  },
};

export default chamaService;