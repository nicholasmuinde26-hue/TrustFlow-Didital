import auditLogApi from "../api/auditLog.api";

const auditLogService = {
  async list(chamaId, params) {
    const { data } = await auditLogApi.list(chamaId, params);
    return {
      logs: data.data?.logs || [],
      pagination: data.data?.pagination || { page: 1, totalPages: 1, total: 0 },
    };
  },

  async getById(chamaId, auditLogId) {
    const { data } = await auditLogApi.getById(chamaId, auditLogId);
    return data.data?.auditLog || null;
  },
};

export default auditLogService;