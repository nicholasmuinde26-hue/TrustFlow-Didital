import api from '@/app/services/api';

const adminService = {
  // Stats overview
  async getOverview() {
    const { data } = await api.get('/admin/overview');
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

  async promoteSubAdmin(userId, permissions = {}) {
    const { data } = await api.post('/admin/sub-admins', { userId, permissions });
    return data;
  },

  async updateSubAdminPermissions(userId, permissions) {
    const { data } = await api.patch(`/admin/sub-admins/${userId}`, { permissions });
    return data;
  },

  async demoteSubAdmin(userId) {
    const { data } = await api.delete(`/admin/sub-admins/${userId}`);
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
};

export default adminService;
