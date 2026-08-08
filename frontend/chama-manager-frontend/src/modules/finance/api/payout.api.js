import api from "@/app/services/api";

const payoutApi = {
  list(workspaceId) {
    return api.get(
      `/chamas/${workspaceId}/payouts`
    );
  },

  start(workspaceId) {
    return api.post(`/chamas/${workspaceId}/payouts/start`);
  },

  pay(workspaceId, payoutId, payload) {
    return api.patch(
      `/chamas/${workspaceId}/payouts/${payoutId}/pay`,
      payload
    );
  },
};

export default payoutApi;
