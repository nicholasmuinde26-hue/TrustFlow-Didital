import api from '@/app/services/api';

const adminService = {
  async getMyProfile() {
    const { data } = await api.get('/admin/me');
    return data.data || null;
  },

  // Stats overview
  async getOverview() {
    const { data } = await api.get('/admin/overview');
    return data.data || {};
  },

  // Cross-workspace executive snapshot: groups, members, transactions,
  // money processed, verified %, risk alerts, pending approvals
  async getExecutiveOverview() {
    const { data } = await api.get('/admin/overview/executive');
    return data.data || {};
  },

  // Users
  async getUsers(params = {}) {
    const { data } = await api.get('/admin/users', { params });
    return data.data || { users: [], total: 0 };
  },

  // Sub-admins
  async getSubAdmins() {
    const { data } = await api.get('/admin/sub-admins');
    return data.data || [];
  },
  async getAdminActivity(params = {}) {
    const { data } = await api.get('/admin/activity', { params });
    return data.data || { logs: [] };
  },
  async requestStepUp(password) {
    const { data } = await api.post('/admin/step-up', { password });
    const token = data.data?.token;
    if (token) sessionStorage.setItem('adminStepUpToken', token);
    return token;
  },
  async getSessions() { const { data } = await api.get('/admin/sessions'); return data.data || []; },
  async revokeSession(sessionId) { const { data } = await api.delete(`/admin/sessions/${sessionId}`); return data.data; },

  stepUpConfig() { return { headers: { 'X-Admin-Step-Up': sessionStorage.getItem('adminStepUpToken') || '' } }; },

  async promoteSubAdmin(userId, permissions = {}, category = 'operations', notes = '') {
    const { data } = await api.post('/admin/sub-admins', { userId, permissions, category, notes }, this.stepUpConfig());
    return data;
  },

  async updateSubAdminPermissions(userId, permissions) {
    const { data } = await api.patch(`/admin/sub-admins/${userId}`, { permissions }, this.stepUpConfig());
    return data;
  },

  async demoteSubAdmin(userId) {
    const { data } = await api.delete(`/admin/sub-admins/${userId}`, this.stepUpConfig());
    return data;
  },

  // Workspace requests
  async getWorkspaceRequests(status = '') {
    const params = status ? { status } : {};
    const { data } = await api.get('/admin/workspace-requests', { params });
    return data.data || [];
  },

  async getWorkspaceRequest(requestId) {
    const { data } = await api.get(`/admin/workspace-requests/${requestId}`);
    return data.data || null;
  },

  async updateWorkspaceRequest(requestId, edits) {
    const { data } = await api.patch(`/admin/workspace-requests/${requestId}`, edits);
    return data;
  },

  async approveWorkspaceRequest(requestId, edits = {}) {
    const { data } = await api.post(`/admin/workspace-requests/${requestId}/approve`, edits);
    return data;
  },

  async rejectWorkspaceRequest(requestId, adminNotes) {
    const { data } = await api.post(`/admin/workspace-requests/${requestId}/reject`, { adminNotes });
    return data;
  },

  // Entity directory drill-down (chama / business / contribution_group detail)
  async getEntityDetail(type, id) {
    const { data } = await api.get(`/admin/entities/${type}/${id}`);
    return data.data || null;
  },

  // Admin override of a chama membership — role change (incl. chairperson
  // handover) and/or status change (suspend/reactivate)
  async updateChamaMember(chamaId, membershipId, payload) {
    const { data } = await api.patch(`/admin/chamas/${chamaId}/members/${membershipId}`, payload);
    return data;
  },

  // Global "who is who where" people search
  async searchPeople(params = {}) {
    const { data } = await api.get('/admin/people', { params });
    return data.data || { people: [], total: 0 };
  },
};

export default adminService;
