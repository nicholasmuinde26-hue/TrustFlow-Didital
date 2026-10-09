import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import chatService from "../services/chat.service";

const POLL_INTERVAL = 4_000; // polling fallback alongside live socket updates

function messagesKey(workspaceId) {
  return ["messages", workspaceId];
}

function upsertMessage(messages = [], message) {
  if (!message?.id && !message?._id) return messages;
  const id = String(message.id || message._id);
  const index = messages.findIndex((item) => String(item.id || item._id) === id);
  if (index === -1) return [...messages, message];
  const next = [...messages];
  next[index] = { ...next[index], ...message };
  return next;
}

export function useMessages(workspaceId, workspaceType) {
  return useQuery({
    queryKey: messagesKey(workspaceId),
    queryFn: () => chatService.list(workspaceId, { workspaceType }),
    enabled: Boolean(workspaceId && workspaceType),
    refetchInterval: POLL_INTERVAL,
  });
}

export function useSendMessage(workspaceId, currentUser) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => chatService.send(workspaceId, payload),
    onMutate: async (payload) => {
      const key = messagesKey(workspaceId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      const optimisticId = `pending:${Date.now()}:${Math.random().toString(36).slice(2)}`;
      queryClient.setQueryData(key, (messages = []) => upsertMessage(messages, {
        id: optimisticId,
        conversation_type: "workspace",
        workspace_id: workspaceId,
        workspace_type: payload.workspaceType,
        sender: { id: currentUser?.id || currentUser?._id, name: currentUser?.name || "You" },
        message: payload.message,
        attachments: payload.attachments || [],
        created_at: new Date().toISOString(),
        pending: true,
      }));
      return { key, previous, optimisticId };
    },
    onSuccess: (created, _payload, context) => {
      queryClient.setQueryData(context?.key || messagesKey(workspaceId), (messages = []) => {
        const withoutOptimistic = messages.filter((message) => message.id !== context?.optimisticId);
        return upsertMessage(withoutOptimistic, created);
      });
      queryClient.invalidateQueries({
        queryKey: messagesKey(workspaceId),
      });
    },
    onError: (_error, _payload, context) => {
      if (!context) return;
      if (context.previous === undefined) {
        queryClient.setQueryData(context.key, (messages = []) => messages.filter((message) => message.id !== context.optimisticId));
      } else {
        queryClient.setQueryData(context.key, context.previous);
      }
    },
  });
}

export function useDirectConversations(workspaceId, workspaceType) {
  return useQuery({
    queryKey: ["direct-conversations", workspaceId],
    queryFn: () => chatService.listDirectConversations({ workspaceId, workspaceType }),
    enabled: Boolean(workspaceId && workspaceType),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useChatUnreadCounts(workspaceId, workspaceType) {
  return useQuery({
    queryKey: ["chat-unread", workspaceId],
    queryFn: () => chatService.unread(workspaceId, { workspaceType }),
    enabled: Boolean(workspaceId && workspaceType),
    refetchInterval: 30_000,
  });
}

export function useMarkConversationRead(workspaceId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => chatService.markRead(workspaceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-unread", workspaceId] });
    },
  });
}

function directMessagesKey(recipientUserId) {
  return ["direct-messages", recipientUserId];
}

// Direct (1:1) thread with another active workspace member.
export function useDirectMessages(recipientUserId) {
  return useQuery({
    queryKey: directMessagesKey(recipientUserId),
    queryFn: () => chatService.listDirect(recipientUserId),
    enabled: Boolean(recipientUserId),
    refetchInterval: POLL_INTERVAL,
    retry: false,
  });
}

export function useSendDirectMessage(recipientUserId, currentUser) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => chatService.sendDirect(recipientUserId, payload),
    onMutate: async (payload) => {
      const key = directMessagesKey(recipientUserId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      const optimisticId = `pending:${Date.now()}:${Math.random().toString(36).slice(2)}`;
      queryClient.setQueryData(key, (messages = []) => upsertMessage(messages, {
        id: optimisticId,
        conversation_type: "direct",
        sender: { id: currentUser?.id || currentUser?._id, name: currentUser?.name || "You" },
        recipient: { id: recipientUserId },
        message: payload.message,
        attachments: payload.attachments || [],
        created_at: new Date().toISOString(),
        pending: true,
      }));
      return { key, previous, optimisticId };
    },
    onSuccess: (created, _payload, context) => {
      queryClient.setQueryData(context?.key || directMessagesKey(recipientUserId), (messages = []) => {
        const withoutOptimistic = messages.filter((message) => message.id !== context?.optimisticId);
        return upsertMessage(withoutOptimistic, created);
      });
      queryClient.invalidateQueries({
        queryKey: directMessagesKey(recipientUserId),
      });
      queryClient.invalidateQueries({ queryKey: ["direct-conversations"] });
    },
    onError: (_error, _payload, context) => {
      if (!context) return;
      if (context.previous === undefined) {
        queryClient.setQueryData(context.key, (messages = []) => messages.filter((message) => message.id !== context.optimisticId));
      } else {
        queryClient.setQueryData(context.key, context.previous);
      }
    },
  });
}
