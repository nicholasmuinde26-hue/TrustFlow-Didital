import api from '@/app/services/api';

const base = (chamaId) => `/chamas/${chamaId}/assets`;
const leaseBase = (chamaId) => `/chamas/${chamaId}/leases`;
const complianceBase = (chamaId) => `/chamas/${chamaId}/compliance-obligations`;

export default {
  list: (chamaId, { includePending = false } = {}) =>
    api.get(base(chamaId), { params: { includePending } }),

  request: (chamaId, payload) => api.post(`${base(chamaId)}/request`, payload),

  requestBusinessWorkspace: (chamaId, payload) =>
    api.post(`${base(chamaId)}/business-workspace-requests`, payload),

  businessWorkspaceRequests: (chamaId) =>
    api.get(`${base(chamaId)}/business-workspace-requests`),

  // Leadership Desk: chama-owned business workspaces + their managers.
  businessWorkspaces: (chamaId) =>
    api.get(`${base(chamaId)}/business-workspaces`),

  // Change who manages a business. managerType: member | external | unassigned.
  assignManager: (chamaId, assetId, payload) =>
    api.post(`${base(chamaId)}/${assetId}/manager`, payload),

  approve: (chamaId, assetId) => api.post(`${base(chamaId)}/${assetId}/approve`),

  reject: (chamaId, assetId, reason) =>
    api.post(`${base(chamaId)}/${assetId}/reject`, { reason }),

  recordIncome: (chamaId, assetId, payload) =>
    api.post(`${base(chamaId)}/${assetId}/income`, payload),

  recordExpense: (chamaId, assetId, payload) =>
    api.post(`${base(chamaId)}/${assetId}/expense`, payload),

  expenseBreakdown: (chamaId, assetId) =>
    api.get(`${base(chamaId)}/${assetId}/expenses/breakdown`),

  // ---- Progress dashboard (open to every member) -----------------------
  progress: (chamaId, assetId) =>
    api.get(`${base(chamaId)}/${assetId}/progress`),

  recordValuation: (chamaId, assetId, payload) =>
    api.post(`${base(chamaId)}/${assetId}/valuation`, payload),

  fundBusiness: (chamaId, assetId, payload) =>
    api.post(`${base(chamaId)}/${assetId}/funding`, payload),

  listDistributions: (chamaId) =>
    api.get(`${base(chamaId)}/distributions`),

  createDistribution: (chamaId, assetId, payload) =>
    api.post(`${base(chamaId)}/${assetId}/distributions`, payload),

  respondDistribution: (chamaId, distributionId, response) =>
    api.post(`${base(chamaId)}/distributions/${distributionId}/respond`, { response }),

  transactions: (chamaId, assetId) =>
    api.get(`${base(chamaId)}/${assetId}/transactions`),

  createProposal: (chamaId, payload) =>
    api.post(`${base(chamaId)}/proposals`, payload),

  proposals: (chamaId) => api.get(`${base(chamaId)}/proposals`),

  decideProposal: (chamaId, proposalId, decision, comment = '') =>
    api.post(`${base(chamaId)}/proposals/${proposalId}/decision`, { decision, comment }),

  completeAcquisition: (chamaId, proposalId, payload) =>
    api.post(`${base(chamaId)}/proposals/${proposalId}/acquire`, payload),

  // ---- M-Pesa reconciliation queue -------------------------------------
  unverifiedIncome: (chamaId) =>
    api.get(`${base(chamaId)}/reconciliation/unverified`),

  verifyIncome: (chamaId, transactionId, mpesaReceiptNumber) =>
    api.post(`${base(chamaId)}/reconciliation/${transactionId}/verify`, { mpesaReceiptNumber }),

  // ---- Manager accountability loop -------------------------------------
  // Structured periodic reports (open to every member to read).
  reports: (chamaId, assetId) => api.get(`${base(chamaId)}/${assetId}/reports`),

  submitReport: (chamaId, assetId, reportId, payload) =>
    api.post(`${base(chamaId)}/${assetId}/reports/${reportId}/submit`, payload),

  acknowledgeReport: (chamaId, assetId, reportId, comment = '') =>
    api.post(`${base(chamaId)}/${assetId}/reports/${reportId}/acknowledge`, { comment }),

  setReporting: (chamaId, assetId, payload) =>
    api.patch(`${base(chamaId)}/${assetId}/reporting`, payload),

  managerPerformance: (chamaId, userId) =>
    api.get(`${base(chamaId)}/managers/${userId}/performance`),

  // Member-raised discrepancy flags on an income/expense entry. Routed to
  // leadership through the multi-signatory approval engine.
  flagTransaction: (chamaId, assetId, transactionId, reason) =>
    api.post(`${base(chamaId)}/${assetId}/transactions/${transactionId}/flag`, { reason }),

  decideFlag: (chamaId, assetId, transactionId, decision, comment = '') =>
    api.post(`${base(chamaId)}/${assetId}/transactions/${transactionId}/flag/decision`, { decision, comment }),

  discrepancies: (chamaId) => api.get(`${base(chamaId)}/discrepancies`),

  // ---- Leases (cash and/or in-kind, per-season expected vs received) --
  listLeases: (chamaId, assetId, params = {}) =>
    api.get(`${base(chamaId)}/${assetId}/leases`, { params }),

  createLease: (chamaId, assetId, payload) =>
    api.post(`${base(chamaId)}/${assetId}/leases`, payload),

  getLease: (chamaId, leaseId) => api.get(`${leaseBase(chamaId)}/${leaseId}`),

  getLeaseTracker: (chamaId, leaseId) => api.get(`${leaseBase(chamaId)}/${leaseId}/tracker`),

  endLease: (chamaId, leaseId, payload) =>
    api.post(`${leaseBase(chamaId)}/${leaseId}/end`, payload),

  addLeasePeriod: (chamaId, leaseId, payload) =>
    api.post(`${leaseBase(chamaId)}/${leaseId}/periods`, payload),

  waiveLeasePeriod: (chamaId, leaseId, periodId, reason) =>
    api.post(`${leaseBase(chamaId)}/${leaseId}/periods/${periodId}/waive`, { reason }),

  recordLeaseCashReceipt: (chamaId, leaseId, periodId, payload) =>
    api.post(`${leaseBase(chamaId)}/${leaseId}/periods/${periodId}/cash-receipt`, payload),

  recordLeaseInKindReceipt: (chamaId, leaseId, periodId, payload) =>
    api.post(`${leaseBase(chamaId)}/${leaseId}/periods/${periodId}/in-kind-receipt`, payload),

  // ---- Compliance obligations (land rates / permits, jurisdiction-driven) --
  listComplianceObligations: (chamaId, assetId, params = {}) =>
    api.get(`${base(chamaId)}/${assetId}/compliance`, { params }),

  createComplianceObligation: (chamaId, assetId, payload) =>
    api.post(`${base(chamaId)}/${assetId}/compliance`, payload),

  getComplianceObligation: (chamaId, obligationId) =>
    api.get(`${complianceBase(chamaId)}/${obligationId}`),

  setComplianceObligationActive: (chamaId, obligationId, active) =>
    api.patch(`${complianceBase(chamaId)}/${obligationId}`, { active }),

  addComplianceCycle: (chamaId, obligationId, payload) =>
    api.post(`${complianceBase(chamaId)}/${obligationId}/cycles`, payload),

  payComplianceCycle: (chamaId, obligationId, cycleId, payload) =>
    api.post(`${complianceBase(chamaId)}/${obligationId}/cycles/${cycleId}/pay`, payload),

  waiveComplianceCycle: (chamaId, obligationId, cycleId, reason) =>
    api.post(`${complianceBase(chamaId)}/${obligationId}/cycles/${cycleId}/waive`, { reason }),
};