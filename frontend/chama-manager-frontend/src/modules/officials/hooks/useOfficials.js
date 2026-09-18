import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import officialRatingService from "../services/officialRating.service";

function officialsKey(chamaId) {
  return ["officials", chamaId];
}

export function useOfficials(chamaId) {
  return useQuery({
    queryKey: officialsKey(chamaId),
    queryFn: () => officialRatingService.list(chamaId),
    enabled: Boolean(chamaId),
  });
}

export function useSubmitOfficialRating(chamaId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ membershipId, ...payload }) =>
      officialRatingService.submitRating(chamaId, membershipId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: officialsKey(chamaId) });
    },
  });
}

export function useOfficialRatingDetail(chamaId, membershipId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ["official-rating-detail", chamaId, membershipId],
    queryFn: () => officialRatingService.getDetail(chamaId, membershipId),
    enabled: Boolean(chamaId) && Boolean(membershipId) && enabled,
  });
}
