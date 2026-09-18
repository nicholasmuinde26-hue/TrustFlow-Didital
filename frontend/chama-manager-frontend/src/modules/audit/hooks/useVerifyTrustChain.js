import { useMutation } from "@tanstack/react-query";

import trustTimelineService from "../services/trustTimeline.service";

// Deliberately a mutation rather than a query, even though the endpoint
// is read-only: verification is an action someone takes and watches the
// result of, not ambient data. Running it automatically on mount would
// make "verified" wallpaper — something the eye stops registering —
// when the whole point is that a member chose to check and got an
// answer they can point at.
export function useVerifyTrustChain(chamaId) {
  return useMutation({
    mutationKey: ["trust-timeline", "verify", chamaId],
    mutationFn: () => trustTimelineService.verify(chamaId),
  });
}