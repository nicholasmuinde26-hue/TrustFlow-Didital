import api from '@/app/services/api';

const finesApi = {
  list(workspaceId) { return api.get(`/workspaces/${workspaceId}/fines`); },
  create(workspaceId, payload) { return api.post(`/workspaces/${workspaceId}/fines`, payload); },
  remind(workspaceId, fineId) { return api.post(`/workspaces/${workspaceId}/fines/${fineId}/remind`); },
  listShareouts(chamaId) { return api.get(`/chamas/${chamaId}/fine-shareouts`); },
  createShareout(chamaId, payload) { return api.post(`/chamas/${chamaId}/fine-shareouts`, payload); },
  approveShareout(chamaId, shareoutId) { return api.patch(`/chamas/${chamaId}/fine-shareouts/${shareoutId}/approve`); },
  payShareoutItem(chamaId, shareoutId, itemId, payload) { return api.patch(`/chamas/${chamaId}/fine-shareouts/${shareoutId}/items/${itemId}/pay`, payload); },
  payShareoutItems(chamaId, shareoutId, payload) { return api.patch(`/chamas/${chamaId}/fine-shareouts/${shareoutId}/items/pay-bulk`, payload); },
  cancelShareout(chamaId, shareoutId) { return api.patch(`/chamas/${chamaId}/fine-shareouts/${shareoutId}/cancel`); },
};

export default finesApi;
