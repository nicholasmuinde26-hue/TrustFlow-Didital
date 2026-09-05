import api from './api';

const inquiryService = {
  // Workspace-facing
  async submitInquiry({ workspaceId, workspaceType, subject, category, message, priority }) {
    const res = await api.post('/inquiries', {
      workspaceId,
      workspaceType,
      subject,
      category,
      message,
      priority,
    });
    return res.data?.data;
  },

  async getWorkspaceInquiries(workspaceId) {
    const res = await api.get(`/inquiries/workspace/${workspaceId}`);
    return res.data?.data || [];
  },

  async replyToInquiry(inquiryId, message) {
    const res = await api.post(`/inquiries/${inquiryId}/reply`, { message });
    return res.data?.data;
  },

  // Admin-facing
  async listAdminInquiries({ status = '', workspaceType = '', search = '', page = 1, limit = 50 } = {}) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (workspaceType) params.append('workspaceType', workspaceType);
    if (search) params.append('search', search);
    params.append('page', page);
    params.append('limit', limit);

    const res = await api.get(`/admin/inquiries?${params.toString()}`);
    return res.data?.data || { inquiries: [], total: 0 };
  },

  async getAdminInquiryStats() {
    const res = await api.get('/admin/inquiries/stats');
    return res.data?.data || { openCount: 0, inProgressCount: 0, resolvedCount: 0, pendingTotal: 0 };
  },

  async getAdminInquiryById(inquiryId) {
    const res = await api.get(`/admin/inquiries/${inquiryId}`);
    return res.data?.data;
  },

  async updateAdminInquiryStatus(inquiryId, status, adminNotes = '') {
    const res = await api.patch(`/admin/inquiries/${inquiryId}/status`, { status, adminNotes });
    return res.data?.data;
  },

  async replyAdminInquiry(inquiryId, message) {
    const res = await api.post(`/admin/inquiries/${inquiryId}/reply`, { message });
    return res.data?.data;
  },
};

export default inquiryService;
