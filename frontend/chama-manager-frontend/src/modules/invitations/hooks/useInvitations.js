import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import invitationsService from "../services/invitations.service";
import useWorkspace from "@/app/hooks/useWorkspace";

function invitationsKey(status) {
  return ["my-invitations", status];
}

export function useMyInvitations(status = "pending") {
  return useQuery({
    queryKey: invitationsKey(status),
    queryFn: () => invitationsService.list(status),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  const { refresh } = useWorkspace();

  return useMutation({
    mutationFn: (invitationId) => invitationsService.accept(invitationId),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-invitations"] });
      // Accepting creates a new active membership, so the workspace list
      // (Home page, WorkspaceSwitcher) needs to pick up the new group.
      refresh();
    },
  });
}

export function useSendInvitation(groupId) {
  return useMutation({
    mutationFn: (payload) => invitationsService.send(groupId, payload),
  });
}
