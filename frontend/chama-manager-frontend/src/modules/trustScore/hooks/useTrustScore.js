import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import trustScoreService from "../services/trustScore.service";

function trustScoreKey(chamaId) {
  return ["trust-score", chamaId];
}

function trustScoreHistoryKey(chamaId, page, limit) {
  return ["trust-score-history", chamaId, page, limit];
}

export function useTrustScore(chamaId) {
  return useQuery({
    queryKey: trustScoreKey(chamaId),
    queryFn: () => trustScoreService.getLatest(chamaId),
    enabled: Boolean(chamaId),
  });
}

export function useTrustScoreHistory(chamaId, { page = 1, limit = 12 } = {}) {
  return useQuery({
    queryKey: trustScoreHistoryKey(chamaId, page, limit),
    queryFn: () => trustScoreService.getHistory(chamaId, { page, limit }),
    enabled: Boolean(chamaId),
    keepPreviousData: true,
  });
}

export function useGenerateTrustScore(chamaId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => trustScoreService.generate(chamaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trustScoreKey(chamaId) });
      queryClient.invalidateQueries({ queryKey: ["trust-score-history", chamaId] });
    },
  });
}

export function useShareTrustScore(chamaId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (trustScoreId) => trustScoreService.share(chamaId, trustScoreId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trustScoreKey(chamaId) });
    },
  });
}

// Public — used on the unauthenticated share page (no chama scoping,
// no auth headers needed).
export function usePublicTrustScore(token) {
  return useQuery({
    queryKey: ["public-trust-score", token],
    queryFn: () => trustScoreService.getPublicReport(token),
    enabled: Boolean(token),
    retry: false,
  });
}

export function useRevokeTrustScoreShare(chamaId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (trustScoreId) => trustScoreService.revoke(chamaId, trustScoreId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trustScoreKey(chamaId) });
    },
  });
}
