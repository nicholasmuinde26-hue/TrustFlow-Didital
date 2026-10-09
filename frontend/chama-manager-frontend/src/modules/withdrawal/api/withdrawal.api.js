import api from '@/app/services/api';

const base = (chamaId) => `/chamas/${chamaId}/withdrawals`;

export default {
  // Officials see everyone's; the backend narrows a plain member to their
  // own automatically, but getMine() below is the more direct call for
  // "my requests" views.
  list: (chamaId, params) => api.get(base(chamaId), { params }),
  mine: (chamaId, params) => api.get(`${base(chamaId)}/mine`, { params }),
  get: (chamaId, withdrawalId) => api.get(`${base(chamaId)}/${withdrawalId}`),
  request: (chamaId, payload) => api.post(base(chamaId), payload),
  decide: (chamaId, withdrawalId, decision, comment) =>
    api.patch(`${base(chamaId)}/${withdrawalId}/decide`, { decision, comment }),
  settle: (chamaId, withdrawalId, disbursement_method, external_reference) =>
    api.patch(`${base(chamaId)}/${withdrawalId}/pay`, { disbursement_method, external_reference }),
  cancel: (chamaId, withdrawalId, reason) =>
    api.patch(`${base(chamaId)}/${withdrawalId}/cancel`, { reason }),

  // Withdrawal policy configuration (chairperson/treasurer)
  policies: (chamaId) => api.get(`/chamas/${chamaId}/withdrawal-policies`),
  policy: (chamaId, policyId) => api.get(`/chamas/${chamaId}/withdrawal-policies/${policyId}`),
  createPolicy: (chamaId, payload) => api.post(`/chamas/${chamaId}/withdrawal-policies`, payload),
  updatePolicy: (chamaId, policyId, payload) => api.patch(`/chamas/${chamaId}/withdrawal-policies/${policyId}`, payload),
  activatePolicy: (chamaId, policyId) => api.patch(`/chamas/${chamaId}/withdrawal-policies/${policyId}/activate`),
  archivePolicy: (chamaId, policyId) => api.patch(`/chamas/${chamaId}/withdrawal-policies/${policyId}/archive`),
};