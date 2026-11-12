import axios from 'axios';

// The organizer console talks to the main ChamaManager API (auth, workspaces,
// contribution groups) directly. It does NOT open the ChamaManager web app,
// so people sign up, sign in and work entirely inside the giving web.
//
// Set VITE_ORGANIZER_API_URL when the API is not on localhost:5000, e.g.
//   VITE_ORGANIZER_API_URL=https://api.example.com/api/v1
const baseURL = String(import.meta.env.VITE_ORGANIZER_API_URL || 'http://localhost:5000/api/v1').replace(/\/+$/, '');

// Separate keys from ChamaManager so the two apps never read each other's session.
const ACCESS_KEY = 'giving.accessToken';
const REFRESH_KEY = 'giving.refreshToken';

export const tokens = {
  get access() { try { return localStorage.getItem(ACCESS_KEY); } catch { return null; } },
  get refresh() { try { return localStorage.getItem(REFRESH_KEY); } catch { return null; } },
  set(access, refresh) {
    try {
      if (access) localStorage.setItem(ACCESS_KEY, access);
      if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    } catch { /* storage unavailable */ }
  },
  clear() {
    try { localStorage.removeItem(ACCESS_KEY); localStorage.removeItem(REFRESH_KEY); } catch { /* ignore */ }
  },
};

const getDeviceId = () => {
  const key = 'giving.deviceId';
  try {
    let id = localStorage.getItem(key);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
    return id;
  } catch { return 'giving-web'; }
};

const api = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' }, timeout: 25_000 });

api.interceptors.request.use((config) => {
  config.headers['X-Device-Id'] = getDeviceId();
  if (tokens.access) config.headers.Authorization = `Bearer ${tokens.access}`;
  return config;
});

let refreshing = null;
const isAuthRoute = (url = '') => /\/auth\/(login|register|send-otp|verify-otp|refresh|otp-channels)/.test(url);

api.interceptors.response.use((response) => response, async (error) => {
  const original = error.config;
  if (error.response?.status !== 401 || !original || original._retry || isAuthRoute(original.url)) return Promise.reject(error);
  if (!tokens.refresh) { tokens.clear(); window.dispatchEvent(new Event('giving:signed-out')); return Promise.reject(error); }
  original._retry = true;
  try {
    refreshing = refreshing || axios.post(`${baseURL}/auth/refresh`, { refreshToken: tokens.refresh }).finally(() => { refreshing = null; });
    const { data } = await refreshing;
    const payload = data?.data || data;
    if (!payload?.accessToken) throw new Error('No access token returned');
    tokens.set(payload.accessToken, payload.refreshToken);
    original.headers.Authorization = `Bearer ${payload.accessToken}`;
    return api(original);
  } catch (refreshError) {
    tokens.clear();
    window.dispatchEvent(new Event('giving:signed-out'));
    return Promise.reject(refreshError);
  }
});

const unwrap = (response) => response.data?.data ?? response.data;

// ---- Auth (OTP flow, same endpoints ChamaManager uses) ----
export const authApi = {
  login: (payload) => api.post('/auth/login', payload).then(unwrap),
  register: (payload) => api.post('/auth/register', payload).then(unwrap),
  sendOtp: (payload) => api.post('/auth/send-otp', payload).then(unwrap),
  async verifyOtp(payload) {
    const result = await api.post('/auth/verify-otp', payload).then(unwrap);
    if (result?.accessToken) tokens.set(result.accessToken, result.refreshToken);
    return result;
  },
  me: () => api.get('/auth/me').then(unwrap),
};

// ---- Organizer workspace ----
export const organizerApi = {
  workspaces: () => api.get('/workspaces').then((r) => r.data?.data || []),
  createAuthHandoff: () => api.post('/auth/handoff').then(unwrap),
  myRequests: () => api.get('/workspace-requests/my').then((r) => r.data?.data || []),
  submitRequest: (payload) => api.post('/workspace-requests', payload).then(unwrap),
  updateRequest: (id, payload) => api.patch(`/workspace-requests/my/${id}`, payload).then(unwrap),
  fundDashboard: (groupId) => api.get(`/contribution-groups/${groupId}/fund/dashboard`).then(unwrap),
  pledges: (groupId) => api.get(`/contribution-groups/${groupId}/fund/pledges`).then(unwrap),
  members: (groupId) => api.get(`/contribution-groups/${groupId}/members`).then(unwrap),
  extendFund: (groupId, date) => api.post(`/contribution-groups/${groupId}/fund/extend`, { contribution_end_date: date }).then(unwrap),
  sendReminders: (groupId) => api.post(`/contribution-groups/${groupId}/fund/reminders`).then(unwrap),
};


export async function handoffToChamaManager(preferredGroupId = "") {
  let groupId = '';
  try {
    const workspaces = await organizerApi.workspaces();
    const contributionGroups = workspaces.filter((workspace) =>
      ['contribution', 'contribution_group', 'contribution-group'].includes(String(workspace?.type || '').toLowerCase())
    );
    const contributionGroup = contributionGroups.find((workspace) =>
      String(workspace?.id || workspace?._id || '') === String(preferredGroupId)
    ) || contributionGroups[0];
    groupId = contributionGroup?.id || contributionGroup?._id || '';
  } catch {
    // Continue to the main app home if workspace discovery is temporarily unavailable.
  }

  const { code } = await organizerApi.createAuthHandoff();
  if (!code) throw new Error('Could not create a secure sign-in handoff. Please try again.');
  const appUrl = String(import.meta.env.VITE_CHAMAMANAGER_APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const params = new URLSearchParams({ code });
  if (groupId) params.set('workspaceId', String(groupId));
  window.location.replace(`${appUrl}/auth/giving-handoff?${params.toString()}`);
}

export const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;
