import api from '@/app/services/api';

const securityService = {
  async getCommandCenter() { const { data } = await api.get('/security/command-center'); return data.data; },
  async getRiskSignals() { const { data } = await api.get('/security/risk-signals'); return data.data; },
  async getAlerts(params = {}) { const { data } = await api.get('/security/alerts', { params }); return data.data || []; },
  async respond(alertId, action) { const { data } = await api.post(`/security/alerts/${alertId}/respond`, { action }); return data.data; },
};
export default securityService;
