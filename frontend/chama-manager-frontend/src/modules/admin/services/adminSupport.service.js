import api from '@/app/services/api';
import adminService from './admin.service';

// Platform support console API (/admin/support). The server enforces every
// permission; the UI only hides what a person could not use anyway.

const STEP_UP_KEY = 'adminStepUpAt';
const STEP_UP_TTL_MS = 4.5 * 60 * 1000; // server token lasts 5 minutes

export const isStepUpFresh = () =>
  Boolean(sessionStorage.getItem('adminStepUpToken')) &&
  Date.now() - Number(sessionStorage.getItem(STEP_UP_KEY) || 0) < STEP_UP_TTL_MS;

export const markStepUpStale = () => sessionStorage.removeItem(STEP_UP_KEY);

export async function confirmWithPassword(password) {
  await adminService.requestStepUp(password);
  sessionStorage.setItem(STEP_UP_KEY, String(Date.now()));
}

const get = async (url, params) => (await api.get(`/admin/support${url}`, { params })).data.data;
const post = async (url, body = {}, config) => (await api.post(`/admin/support${url}`, body, config)).data.data;
const patch = async (url, body = {}) => (await api.patch(`/admin/support${url}`, body)).data.data;
const stepUp = () => adminService.stepUpConfig();

const adminSupportService = {
  getOverview: () => get('/overview'),
  listAssignees: () => get('/assignees'),

  // Billing support per chama
  searchChamas: (query) => get('/chamas', { query }),
  getChamaBilling: (chamaId) => get(`/chamas/${chamaId}/billing`),
  extendAccess: (chamaId, body) => post(`/chamas/${chamaId}/billing/extend`, body, stepUp()),
  compPlan: (chamaId, body) => post(`/chamas/${chamaId}/billing/comp`, body, stepUp()),
  changePlan: (chamaId, body) => post(`/chamas/${chamaId}/billing/change-plan`, body, stepUp()),

  // Payments needing review
  listReviewQueue: (params) => get('/payments/review', params),
  markPaid: (invoiceId, body) => post(`/payments/${invoiceId}/mark-paid`, body, stepUp()),
  resolveReview: (invoiceId, body) => post(`/payments/${invoiceId}/resolve`, body, stepUp()),

  // User tools
  searchUsers: (query, page = 1) => get('/users', { query, page }),
  getUser: (userId) => get(`/users/${userId}`),
  unlockUser: (userId, body) => post(`/users/${userId}/unlock`, body),
  forceLogout: (userId, body) => post(`/users/${userId}/force-logout`, body),
  resendVerification: (userId, body) => post(`/users/${userId}/resend-verification`, body),

  // Notes and cases
  listNotes: (params) => get('/notes', params),
  addNote: (body) => post('/notes', body),
  setNotePinned: (noteId, pinned) => patch(`/notes/${noteId}/pin`, { pinned }),
  listCases: (params) => get('/cases', params),
  getCase: (caseId) => get(`/cases/${caseId}`),
  createCase: (body) => post('/cases', body),
  updateCase: (caseId, body) => patch(`/cases/${caseId}`, body),
};

export default adminSupportService;
