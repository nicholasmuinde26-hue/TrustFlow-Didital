import api from '@/app/services/api';

const base = (chamaId) => `/chamas/${chamaId}/loans`;
export default {
  summary: (chamaId) => api.get(`${base(chamaId)}/me/summary`),
  mine: (chamaId) => api.get(`${base(chamaId)}/me`),
  apply: (chamaId, payload) => api.post(base(chamaId), payload),
  loan: (chamaId, loanId) => api.get(`${base(chamaId)}/${loanId}`),
  respondGuarantee: (chamaId, loanId, decision) => api.post(`${base(chamaId)}/${loanId}/guarantee-response`, { decision }),
  repayments: (chamaId, loanId) => api.get(`${base(chamaId)}/${loanId}/repayments`),
  payByMpesa: (chamaId, loanId, payload) => api.post(`${base(chamaId)}/${loanId}/repayments/stk`, payload),
  portfolio: (chamaId) => api.get(`${base(chamaId)}/portfolio`),
  review: (chamaId, loanId) => api.get(`${base(chamaId)}/${loanId}/review`),
  decide: (chamaId, loanId, decision, comment) => api.post(`${base(chamaId)}/${loanId}/decision`, { decision, comment }),
  disburse: (chamaId, loanId) => api.post(`${base(chamaId)}/${loanId}/disburse`),
  confirmDisbursement: (chamaId, loanId, payload) => api.post(`${base(chamaId)}/${loanId}/confirm-disbursement`, payload),
};
