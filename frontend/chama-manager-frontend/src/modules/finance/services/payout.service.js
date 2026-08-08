import payoutApi from "../api/payout.api";

const payoutService = {
  async getAll(workspaceId) {
    const { data } = await payoutApi.list(workspaceId);
    return data.data;
  },

  async start(workspaceId) {
    const { data } = await payoutApi.start(workspaceId);

    return data.data;
  },

  async pay(workspaceId, payoutId, payload) {
    const { data } = await payoutApi.pay(
      workspaceId,
      payoutId,
      payload
    );

    return data.data;
  },
};

export default payoutService;
