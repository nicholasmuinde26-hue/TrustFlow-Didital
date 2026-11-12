import api from './api';

const workspaceRequestService = {
  async submitRequest(requestData) {
    const { data } = await api.post('/workspace-requests', requestData);
    return data;
  },

  async getMyRequests() {
    const { data } = await api.get('/workspace-requests/my');
    return data.data || [];
  },
  async updateMyContributionGroupRequest(requestId, requestData) {
    const { data } = await api.patch(`/workspace-requests/my/${requestId}`, requestData);
    return data;
  },
};

export default workspaceRequestService;
