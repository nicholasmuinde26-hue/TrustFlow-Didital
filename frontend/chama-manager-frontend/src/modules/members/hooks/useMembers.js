import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import membersService from "../services/members.service";

function membersKey(workspaceId) {
  return ["members", workspaceId];
}

export function useMembers(workspaceId) {
  return useQuery({
    queryKey: membersKey(workspaceId),
    queryFn: () => membersService.list(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export function useInviteMember(workspaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => membersService.invite(workspaceId, payload),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKey(workspaceId) });
    },
  });
}

export function useUpdateMemberRole(workspaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, role }) =>
      membersService.updateRole(workspaceId, memberId, role),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKey(workspaceId) });
    },
  });
}

export function useRemoveMember(workspaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId) => membersService.remove(workspaceId, memberId),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKey(workspaceId) });
    },
  });
}