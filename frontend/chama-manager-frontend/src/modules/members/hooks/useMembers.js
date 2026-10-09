import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import membersService from "../services/members.service";

function membersKey(workspaceId) {
  return ["members", workspaceId];
}

export function useMembers(type, workspaceId) {
  return useQuery({
    queryKey: membersKey(workspaceId),
    queryFn: () => membersService.list(type, workspaceId),
    enabled: Boolean(type && workspaceId),
  });
}

export function useMembersOverview(type, workspaceId) {
  return useQuery({
    queryKey: ["members-overview", workspaceId],
    queryFn: () => membersService.overview(type, workspaceId),
    enabled: Boolean(workspaceId && type && (type === "chama" || type === "burial-chama")),
    refetchInterval: 60000,
  });
}

export function useMemberContributionMatrix(workspaceId, month, enabled) {
  return useQuery({
    queryKey: ["member-contribution-matrix", workspaceId, month],
    queryFn: () => membersService.contributionMatrix(workspaceId, month),
    enabled: Boolean(enabled && workspaceId && month),
    staleTime: 60_000,
  });
}

export function useAddMember(type, workspaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId) => membersService.add(type, workspaceId, userId),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKey(workspaceId) });
    },
  });
}

export function useUpdateMemberRole(type, workspaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, role }) =>
      membersService.updateRole(type, workspaceId, memberId, role),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKey(workspaceId) });
    },
  });
}

export function useRemoveMember(type, workspaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId) => membersService.remove(type, workspaceId, memberId),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKey(workspaceId) });
    },
  });
}

export function useUpdateMemberProfile(type, workspaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, payload }) =>
      membersService.updateProfile(type, workspaceId, memberId, payload),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKey(workspaceId) });
    },
  });
}

export function useUpdateMemberStatus(type, workspaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, status }) =>
      membersService.updateStatus(type, workspaceId, memberId, status),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKey(workspaceId) });
    },
  });
}

export function useTransferTreasurer(type, workspaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newTreasurerMemberId) =>
      membersService.transferTreasurer(type, workspaceId, newTreasurerMemberId),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKey(workspaceId) });
    },
  });
}

// Arranges the Merry-Go-Round payout rotation. `order` is the full list of
// active member IDs, first payout to last — position 1 goes to order[0].
export function useReorderPayoutPositions(type, workspaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (order) =>
      membersService.reorderPayoutPositions(type, workspaceId, order),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKey(workspaceId) });
    },
  });
}
