import { useQuery } from "@tanstack/react-query";

import trustTimelineService from "../services/trustTimeline.service";

export function useTrustTimeline(chamaId, { page = 1, limit = 20 } = {}) {
  return useQuery({
    queryKey: ["trust-timeline", chamaId, page, limit],
    queryFn: () => trustTimelineService.list(chamaId, { page, limit }),
    enabled: Boolean(chamaId),
    keepPreviousData: true,
  });
}
