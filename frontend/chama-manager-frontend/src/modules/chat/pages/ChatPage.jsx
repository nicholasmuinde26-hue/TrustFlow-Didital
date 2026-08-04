import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Users } from "lucide-react";

import useAuth from "@/app/hooks/useAuth";
import { usePresence } from "@/modules/presence/hooks/usePresence";
import { useMessages, useSendMessage } from "../hooks/useChat";

import ChatMessage from "../components/ChatMessage";
import ChatComposer from "../components/ChatComposer";
import Spinner from "@/shared/components/ui/Spinner";

export default function ChatPage() {
  const { workspaceId } = useParams();
  const { user } = useAuth();
  const scrollRef = useRef(null);

  const { data: messages = [], isLoading, isError } = useMessages(workspaceId);
  const sendMessage = useSendMessage(workspaceId);

  const { data: presence = [] } = usePresence(workspaceId);
  const onlineCount = presence.filter((p) => p.status === "online").length;

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
          Chat
        </h1>

        <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Users size={14} />
          {onlineCount} online
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-5 dark:bg-slate-950">
        {isLoading && (
          <div className="py-10">
            <Spinner />
          </div>
        )}

        {isError && (
          <p className="text-center text-sm text-red-500">
            Couldn't load messages. Retrying shortly.
          </p>
        )}

        {!isLoading && !isError && messages.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No messages yet. Say hello 👋
          </p>
        )}

        {messages.map((message) => {
          const authorId = message.author?.id ?? message.author?._id;
          const userId = user?.id ?? user?._id;

          return (
            <ChatMessage
              key={message.id ?? message._id}
              message={message}
              isOwn={Boolean(authorId) && authorId === userId}
            />
          );
        })}

        <div ref={scrollRef} />
      </div>

      <ChatComposer
        sending={sendMessage.isPending}
        onSend={(payload) => sendMessage.mutateAsync(payload)}
      />
    </div>
  );
}