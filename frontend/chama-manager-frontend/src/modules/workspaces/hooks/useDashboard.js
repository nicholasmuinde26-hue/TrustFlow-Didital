import { useQuery } from "@tanstack/react-query";

import { getDashboard } from '../services/dashboard.service.js';

export default function useDashboard(workspaceId) {
  return useQuery({
    queryKey: ["dashboard", workspaceId],

    queryFn: () => getDashboard(workspaceId),

    enabled: !!workspaceId,

    staleTime: 1000 * 60,

    refetchOnWindowFocus: true,
  });
}
