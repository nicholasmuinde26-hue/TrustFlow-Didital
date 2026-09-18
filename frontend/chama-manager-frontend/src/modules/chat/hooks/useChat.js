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

export function useMessages(workspaceId, workspaceType) {
  return useQuery({
    queryKey: messagesKey(workspaceId),
    queryFn: () => chatService.list(workspaceId, { workspaceType }),
    enabled: Boolean(workspaceId && workspaceType),
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

function directMessagesKey(recipientUserId) {
  return ["direct-messages", recipientUserId];
}

// Direct (1:1) thread with another workspace member. Requires the
// backend's /chat/direct/:recipientUserId routes — see chat.api.js.
export function useDirectMessages(recipientUserId) {
  return useQuery({
    queryKey: directMessagesKey(recipientUserId),
    queryFn: () => chatService.listDirect(recipientUserId),
    enabled: Boolean(recipientUserId),
    refetchInterval: POLL_INTERVAL,
    retry: false,
  });
}

export function useSendDirectMessage(recipientUserId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => chatService.sendDirect(recipientUserId, payload),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: directMessagesKey(recipientUserId),
      });
    },
  });
}