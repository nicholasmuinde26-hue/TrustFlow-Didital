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