import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { MessageCircle, Sparkles, Users } from "lucide-react";

import useAuth from "@/app/hooks/useAuth";
import useWorkspace from "@/app/hooks/useWorkspace";
import { usePresence } from "@/modules/presence/hooks/usePresence";
import { useMessages, useSendMessage } from "../hooks/useChat";

import ChatMessage from "../components/ChatMessage";
import ChatComposer from "../components/ChatComposer";
import Spinner from "@/shared/components/ui/Spinner";

export default function ChatPage() {
  const { workspaceId } = useParams();
  const { user } = useAuth();
  const { workspaces } = useWorkspace();
  const scrollRef = useRef(null);

  const workspace = workspaces.find((item) => String(item.id ?? item._id) === String(workspaceId));
  const { data: messages = [], isLoading, isError } = useMessages(workspaceId, workspace?.type);
  const sendMessage = useSendMessage(workspaceId);

  const { data: presence = [] } = usePresence(workspaceId);
  const onlineCount = presence.filter((p) => p.status === "online").length;
  const isContributionGroup = workspace?.type === "contribution-group";
  const orderedMessages = [...messages].sort(
    (first, second) => new Date(first.created_at) - new Date(second.created_at)
  );

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className={`flex h-[calc(100vh-11rem)] min-h-[500px] flex-col overflow-hidden border ${isContributionGroup ? "rounded-3xl border-violet-100 bg-white shadow-xl shadow-violet-100/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none" : "rounded-2xl border-slate-200 dark:border-slate-800"}`}>
      <div className={`flex items-center justify-between border-b px-5 py-4 ${isContributionGroup ? "border-violet-100 bg-gradient-to-r from-violet-50 to-fuchsia-50 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}`}>
        <div className="flex items-center gap-3">
          {isContributionGroup && <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-700 text-white shadow-lg shadow-violet-200"><MessageCircle size={19} /></div>}
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{isContributionGroup ? "Group circle" : "Chat"}</h1>
            {isContributionGroup && <p className="text-xs text-violet-700 dark:text-violet-300">A calm space for your group to stay in sync</p>}
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-violet-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
          <Users size={14} /> {onlineCount} online
        </span>
      </div>

      <div className={`flex flex-1 flex-col overflow-y-auto p-5 ${isContributionGroup ? "bg-[radial-gradient(circle_at_top_right,_#f5f3ff,_transparent_35%),linear-gradient(#fdfcff,#f8f7ff)] dark:bg-slate-950" : "bg-slate-50 dark:bg-slate-950"}`}>
        {isContributionGroup && <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full bg-violet-100/80 px-3 py-1.5 text-xs font-medium text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"><Sparkles size={13} /> Keep messages kind, useful, and on-topic.</div>}
        <div className="mt-auto space-y-3">
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

        {orderedMessages.map((message) => {
          const authorId = message.sender?.id ?? message.sender?._id;
          const userId = user?.id ?? user?._id;

          return (
            <ChatMessage
              key={message.id ?? message._id}
              message={message}
              isOwn={Boolean(authorId) && String(authorId) === String(userId)}
            />
          );
        })}

        <div ref={scrollRef} />
        </div>
      </div>

      <ChatComposer
        sending={sendMessage.isPending}
        onSend={(payload) => sendMessage.mutateAsync({ ...payload, workspaceType: workspace?.type })}
      />
    </div>
  );
}
