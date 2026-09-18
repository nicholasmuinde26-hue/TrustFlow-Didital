import { useQuery } from "@tanstack/react-query";

import auditLogService from "../services/auditLog.service";

export function useAuditLog(chamaId, { page = 1, limit = 20, action, resourceType, startDate, endDate } = {}, enabled = true) {
  return useQuery({
    queryKey: ["audit-log", chamaId, page, limit, action, resourceType, startDate, endDate],
    queryFn: () => auditLogService.list(chamaId, { page, limit, action, resourceType, startDate, endDate }),
    enabled: Boolean(chamaId) && enabled,
    keepPreviousData: true,
  });
}