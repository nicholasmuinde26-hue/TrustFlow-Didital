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

  approve(workspaceId, payoutId) {
    return api.patch(
      `/chamas/${workspaceId}/payouts/${payoutId}/approve`
    );
  },

  pay(workspaceId, payoutId, payload) {
    return api.patch(
      `/chamas/${workspaceId}/payouts/${payoutId}/pay`,
      payload
    );
  },

  cancel(workspaceId, payoutId, payload) {
    return api.patch(
      `/chamas/${workspaceId}/payouts/${payoutId}/cancel`,
      payload
    );
  },
};

export default payoutApi;
