import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import disputeService from "../services/dispute.service";

function disputesKey(chamaId, status, page, limit) {
  return ["disputes", chamaId, status || "all", page, limit];
}

export function useDisputes(chamaId, { status, page = 1, limit = 20 } = {}) {
  return useQuery({
    queryKey: disputesKey(chamaId, status, page, limit),
    queryFn: () => disputeService.list(chamaId, { status, page, limit }),
    enabled: Boolean(chamaId),
    keepPreviousData: true,
  });
}

export function useRaiseDispute(chamaId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => disputeService.raise(chamaId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disputes", chamaId] });
    },
  });
}

export function useUpdateDisputeStatus(chamaId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ disputeId, status, resolutionNotes }) =>
      disputeService.updateStatus(chamaId, disputeId, { status, resolutionNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disputes", chamaId] });
    },
  });
}
