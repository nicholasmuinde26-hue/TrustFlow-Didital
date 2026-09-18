import api from "@/app/services/api";

// Raw, filterable audit log for a chama — distinct from the member-facing
// trust timeline (trustTimeline.api.js). This is the officials-only view
// (treasurer/auditor) backed by GET /:chamaId/audit-logs, and shows every
// logged action with actor, before/after state and resource references,
// not just the curated subset the trust timeline surfaces to all members.
const auditLogApi = {
  list(chamaId, { page = 1, limit = 20, action, actorUserId, resourceType, resourceId, startDate, endDate } = {}) {
    return api.get(`/chamas/${chamaId}/audit-logs`, {
      params: { page, limit, action, actorUserId, resourceType, resourceId, startDate, endDate },
    });
  },

  getById(chamaId, auditLogId) {
    return api.get(`/chamas/${chamaId}/audit-logs/${auditLogId}`);
  },
};

export default auditLogApi;