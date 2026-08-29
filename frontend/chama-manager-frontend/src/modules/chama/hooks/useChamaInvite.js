import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import chamaService from "../services/chama.service";

function joinRequestsKey(chamaId) {
  return ["chama-join-requests", chamaId];
}

// Treasurer/Chairperson-only: generates a shareable join link. Anyone
// with the link can request to join; it does NOT grant membership by
// itself (see JoinChamaPage + useJoinChama).
export function useCreateChamaInvite(chamaId) {
  return useMutation({
    mutationFn: (payload) => chamaService.createInvite(chamaId, payload),
  });
}

// Treasurer/Chairperson-only: lists pending "request to join" entries
// created when someone accepts the join link. Approve/decline reuse
// useUpdateMemberStatus({ status: "active" | "removed" }) from
// members/hooks/useMembers.js — no separate mutation needed here.
export function useChamaJoinRequests(chamaId, enabled = true) {
  return useQuery({
    queryKey: joinRequestsKey(chamaId),
    queryFn: () => chamaService.listJoinRequests(chamaId),
    enabled: Boolean(chamaId) && enabled,
  });
}

export function useInvalidateChamaJoinRequests(chamaId) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: joinRequestsKey(chamaId) });
}
