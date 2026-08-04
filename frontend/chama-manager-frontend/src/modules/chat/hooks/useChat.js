import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import chatService from "../services/chat.service";

const POLL_INTERVAL = 4_000; // v1 is polling-based, not a websocket yet

function messagesKey(workspaceId) {
  return ["messages", workspaceId];
}

export function useMessages(workspaceId) {
  return useQuery({
    queryKey: messagesKey(workspaceId),
    queryFn: () => chatService.list(workspaceId),
    enabled: Boolean(workspaceId),
    refetchInterval: POLL_INTERVAL,
  });
}

export function useSendMessage(workspaceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => chatService.send(workspaceId, payload),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: messagesKey(workspaceId),
      });
    },
  });
}