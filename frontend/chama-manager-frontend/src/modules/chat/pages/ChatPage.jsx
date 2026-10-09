import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Search, SquarePen, ArrowLeft, MessageCircle, Users } from "lucide-react";

import useAuth from "@/app/hooks/useAuth";
import useWorkspace from "@/app/hooks/useWorkspace";
import { useSocket } from "@/app/providers/SocketProvider";
import { usePresence } from "@/modules/presence/hooks/usePresence";
import { useMembers } from "@/modules/members/hooks/useMembers";
import { useNotificationPreferences } from "@/modules/notifications/hooks/useNotifications";
import {
  useMessages,
  useSendMessage,
  useDirectConversations,
  useChatUnreadCounts,
  useMarkConversationRead,
  useDirectMessages,
  useSendDirectMessage,
} from "../hooks/useChat";

import ChatMessage from "../components/ChatMessage";
import ChatComposer from "../components/ChatComposer";
import MemberPickerModal from "../components/MemberPickerModal";
import Spinner from "@/shared/components/ui/Spinner";

const PANEL_BG = "#0b1512";
const SIDEBAR_BG = "#0d1a16";
const CARD_BG = "#16211e";
const BORDER = "rgba(255,255,255,0.06)";

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatDayLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ChatIncomingToast({ t, title, message, onOpen }) {
  return (
    <div className="pointer-events-auto flex w-[calc(100vw-2rem)] max-w-sm items-center gap-3 rounded-2xl border border-emerald-900/40 bg-[#102019] p-4 text-white shadow-xl">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-lg text-emerald-300" aria-hidden="true">
        💬
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="mt-0.5 truncate text-xs text-slate-300">{message}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          toast.dismiss(t.id);
          onOpen?.();
        }}
        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-white/5"
      >
        Open
      </button>
    </div>
  );
}

export default function ChatPage() {
  const { workspaceId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { data: notificationPreferences } = useNotificationPreferences();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const { workspaces } = useWorkspace();
  const messagePaneRef = useRef(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isGroupOpen, setIsGroupOpen] = useState(false);
  // A direct thread is selected only after the member chooses it.
  const [activeDirect, setActiveDirect] = useState(null);

  const userId = user?.id ?? user?._id;
  const workspace = workspaces.find((item) => String(item.id ?? item._id) === String(workspaceId));

  const { data: groupMessages = [], isLoading: groupLoading, isError: groupError } = useMessages(
    workspaceId,
    workspace?.type
  );
  const sendGroupMessage = useSendMessage(workspaceId, user);

  const {
    data: directMessages = [],
    isLoading: directLoading,
    isError: directError,
  } = useDirectMessages(activeDirect?.userId);
  const sendDirectMessage = useSendDirectMessage(activeDirect?.userId, user);

  const { data: presence = [] } = usePresence(workspaceId);
  const onlineCount = presence.filter((p) => p.status === "online").length;

  const { data: membersList = [] } = useMembers(workspace?.type, workspaceId);
  const { data: directConversations = [] } = useDirectConversations(workspaceId, workspace?.type);
  const { data: unreadCounts = { workspace: 0, direct: [] } } = useChatUnreadCounts(workspaceId, workspace?.type);
  const { mutate: markConversationRead } = useMarkConversationRead(workspaceId);
  const chatToastEnabled = notificationPreferences?.default_channels?.toast !== false &&
    notificationPreferences?.category_preferences?.system?.toast !== false;
  const memberCount = membersList.length;
  const directUserId = searchParams.get("direct");

  const directUnreadByUser = useMemo(
    () => new Map((unreadCounts.direct || []).map((item) => [String(item.userId), item.count])),
    [unreadCounts.direct]
  );

  useEffect(() => {
    if (!directUserId) {
      setActiveDirect(null);
      return;
    }
    const member = membersList.find((item) => {
      const memberUser = item.user_id || {};
      return String(memberUser._id || memberUser.id || member.user_id) === directUserId;
    });
    if (member) {
      const memberUser = member.user_id || {};
      const nextDirect = { userId: directUserId, name: memberUser.name || memberUser.first_name || "Member" };
      setIsGroupOpen(false);
      setActiveDirect((current) =>
        current?.userId === nextDirect.userId && current?.name === nextDirect.name ? current : nextDirect
      );
    }
  }, [directUserId, membersList]);

  useEffect(() => {
    if (!socket) return undefined;
    const onChatMessage = (event) => {
      if (event?.conversation_type === "direct") {
        queryClient.invalidateQueries({ queryKey: ["direct-conversations", workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["chat-unread", workspaceId] });
        if (activeDirect?.userId && String(event.sender?.id) === String(activeDirect.userId)) {
          queryClient.setQueryData(["direct-messages", activeDirect.userId], (messages = []) => {
            const exists = messages.some((message) => String(message.id || message._id) === String(event.id));
            return exists ? messages : [...messages, {
              id: event.id,
              conversation_type: "direct",
              sender: event.sender,
              recipient: event.recipient,
              message: event.message,
              attachments: event.attachments || [],
              created_at: event.created_at,
            }];
          });
          queryClient.invalidateQueries({ queryKey: ["direct-messages", activeDirect.userId] });
          markConversationRead({ workspaceType: workspace?.type, conversationType: "direct", recipientUserId: activeDirect.userId });
        } else if (chatToastEnabled) {
          const senderId = String(event.sender?.id || "");
          const member = membersList.find((item) => {
            const memberUser = item.user_id || {};
            return String(memberUser._id || memberUser.id || item.user_id) === senderId;
          });
          if (member && event.id) {
            const senderName = member.user_id?.name || event.sender?.name || "A member";
            toast.custom((t) => (
              <ChatIncomingToast
                t={t}
                title={`New message from ${senderName}`}
                message={event.message || "Sent an attachment"}
                onOpen={() => {
                  const direct = { userId: senderId, name: senderName };
                  setActiveDirect(direct);
                  setIsGroupOpen(false);
                  setSearchParams({ direct: senderId });
                }}
              />
            ), { id: `chat-incoming-${event.id}`, duration: 6500 });
          }
        }
        return;
      }
      if (String(event?.workspace_id) === String(workspaceId)) {
        queryClient.setQueryData(["messages", workspaceId], (messages = []) => {
          const exists = messages.some((message) => String(message.id || message._id) === String(event.id));
          return exists ? messages : [...messages, {
            id: event.id,
            conversation_type: "workspace",
            workspace_id: event.workspace_id,
            workspace_type: event.workspace_type,
            sender: event.sender,
            message: event.message,
            attachments: event.attachments || [],
            created_at: event.created_at,
          }];
        });
        queryClient.invalidateQueries({ queryKey: ["messages", workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["chat-unread", workspaceId] });
        if (isGroupOpen) markConversationRead({ workspaceType: workspace?.type, conversationType: "workspace" });
        else if (chatToastEnabled && event.id) {
          toast.custom((t) => (
            <ChatIncomingToast
              t={t}
              title={`New message in ${workspace?.name || "group chat"}`}
              message={`${event.sender?.name || "A member"}: ${event.message || "Sent an attachment"}`}
              onOpen={() => {
                setActiveDirect(null);
                setIsGroupOpen(true);
                if (directUserId) setSearchParams({}, { replace: true });
              }}
            />
          ), { id: `chat-incoming-${event.id}`, duration: 6500 });
        }
      }
    };
    socket.on("chat:new", onChatMessage);
    return () => socket.off("chat:new", onChatMessage);
  }, [socket, queryClient, workspaceId, activeDirect?.userId, isGroupOpen, workspace?.type, workspace?.name, membersList, chatToastEnabled, directUserId, markConversationRead, setSearchParams]);

  const isDirectView = Boolean(activeDirect);
  const hasActiveConversation = isGroupOpen || isDirectView;
  const messages = isDirectView ? directMessages : groupMessages;
  const isLoading = isDirectView ? directLoading : groupLoading;
  const isError = isDirectView ? directError : groupError;

  const orderedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    [messages]
  );
  const lastGroupMessage = useMemo(
    () => [...groupMessages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).slice(-1)[0],
    [groupMessages]
  );

  const conversationKey = isDirectView
    ? `direct:${activeDirect.userId}`
    : isGroupOpen
      ? `group:${workspaceId}`
      : "closed";

  useEffect(() => {
    if (!hasActiveConversation || !workspace?.type) return;
    if (isDirectView) {
      markConversationRead({
        workspaceType: workspace.type,
        conversationType: "direct",
        recipientUserId: activeDirect.userId,
      });
    } else {
      markConversationRead({ workspaceType: workspace.type, conversationType: "workspace" });
    }
  }, [conversationKey, hasActiveConversation, workspace?.type, markConversationRead]);

  useLayoutEffect(() => {
    const pane = messagePaneRef.current;
    if (!pane || !hasActiveConversation || isLoading) return;
    pane.scrollTop = pane.scrollHeight;
  }, [conversationKey, hasActiveConversation, isLoading, messages.length]);

  const workspaceName = workspace?.name || "Group chat";
  const matchesSearch = (name) => name.toLowerCase().includes(query.trim().toLowerCase());

  const showGroupInList = activeFilter !== "direct" && matchesSearch(workspaceName);
  const directConversationRows = useMemo(() => {
    const rows = [...directConversations];
    if (activeDirect && !rows.some((row) => String(row.user?.id) === String(activeDirect.userId))) {
      rows.unshift({ user: { id: activeDirect.userId, name: activeDirect.name }, lastMessage: null });
    }
    return rows;
  }, [directConversations, activeDirect]);
  const visibleDirectConversations = activeFilter === "groups"
    ? []
    : directConversationRows.filter((row) => matchesSearch(row.user?.name || "Member"));

  const dayGroups = useMemo(() => {
    const groups = [];
    for (const message of orderedMessages) {
      const label = formatDayLabel(message.created_at);
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.label === label) {
        lastGroup.items.push(message);
      } else {
        groups.push({ label, items: [message] });
      }
    }
    return groups;
  }, [orderedMessages]);

  const headerName = isDirectView ? activeDirect.name : workspaceName;
  const memberPresence = isDirectView
    ? presence.find((p) => String(p.id) === String(activeDirect.userId))
    : null;

  function closeConversation() {
    setActiveDirect(null);
    setIsGroupOpen(false);
    if (directUserId) setSearchParams({}, { replace: true });
  }

  useEffect(() => {
    if (!hasActiveConversation) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") {
        setActiveDirect(null);
        setIsGroupOpen(false);
        if (directUserId) setSearchParams({}, { replace: true });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasActiveConversation, directUserId, setSearchParams]);

  return (
    <div
      className="flex h-[calc(100dvh-14.5rem)] min-h-[300px] overflow-hidden rounded-2xl border sm:min-h-[340px] lg:h-[calc(100dvh-11rem)] lg:min-h-[520px] lg:rounded-3xl"
      style={{ borderColor: BORDER, backgroundColor: PANEL_BG }}
    >
      {/* Sidebar — conversation list */}
      <div
        className={`${hasActiveConversation ? "hidden md:flex" : "flex"} w-full min-w-0 shrink-0 flex-col border-r md:w-[280px] lg:w-[320px] xl:w-[350px]`}
        style={{ borderColor: BORDER, backgroundColor: SIDEBAR_BG }}
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <div>
            <h1 className="text-lg font-bold text-white">Messages</h1>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Choose a conversation to get started.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsPickerOpen(true)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-300 transition hover:text-white"
            style={{ backgroundColor: CARD_BG }}
            aria-label="New message"
          >
            <SquarePen size={15} />
          </button>
        </div>

        <div className="px-4 pt-4 sm:px-5">
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ backgroundColor: CARD_BG }}
          >
            <Search size={14} className="text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search conversations"
              className="w-full bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 px-4 text-xs font-semibold sm:px-5">
          {[
            { key: "all", label: "All" },
            { key: "groups", label: "Groups" },
            { key: "direct", label: "Direct" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key)}
              className="pb-2 transition"
              style={{
                color: activeFilter === tab.key ? "#ffffff" : "#7d8b86",
                borderBottom: activeFilter === tab.key ? "2px solid #0f9d70" : "2px solid transparent",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="border-b" style={{ borderColor: BORDER }} />

        <div className="flex-1 space-y-1 overflow-y-auto px-2.5 py-2">
          {showGroupInList && (
            <button
              type="button"
              onClick={() => {
                setActiveDirect(null);
                setIsGroupOpen(true);
                if (directUserId) setSearchParams({}, { replace: true });
              }}
              className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition"
              style={{ backgroundColor: isGroupOpen ? CARD_BG : "transparent" }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: "#0f9d70" }}
              >
                {initials(workspaceName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{workspaceName}</p>
                <p className="truncate text-xs text-slate-400">
                  {lastGroupMessage
                    ? `${lastGroupMessage.sender?.name || "Member"}: ${lastGroupMessage.message}`
                    : "No messages yet"}
                </p>
              </div>
              {unreadCounts.workspace > 0 && !isGroupOpen && (
                <span className="grid min-h-6 min-w-6 place-items-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-emerald-950">
                  {unreadCounts.workspace > 99 ? "99+" : unreadCounts.workspace}
                </span>
              )}
            </button>
          )}

          {visibleDirectConversations.map((conversation) => {
            const direct = {
              userId: conversation.user.id,
              name: conversation.user.name || "Member",
              avatar: conversation.user.avatar_url,
            };
            const previewText = conversation.lastMessage?.message ||
              (conversation.lastMessage?.hasAttachments ? "Attachment" : "Start a conversation");
            const preview = conversation.lastMessage
              ? `${String(conversation.lastMessage.senderId) === String(userId) ? "You: " : ""}${previewText}`
              : previewText;
            const selected = String(activeDirect?.userId) === String(direct.userId);
            const unread = directUnreadByUser.get(String(direct.userId)) || 0;
            return (
            <button
              key={direct.userId}
              type="button"
              onClick={() => {
                setActiveDirect(direct);
                setIsGroupOpen(false);
                setSearchParams({ direct: String(direct.userId) });
              }}
              className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition"
              style={{ backgroundColor: selected ? CARD_BG : "transparent" }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: "#6366f1" }}
              >
                {direct.avatar ? (
                  <img src={direct.avatar} alt="" className="h-full w-full rounded-full object-cover" />
                ) : initials(direct.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{direct.name}</p>
                <p className="truncate text-xs text-slate-400">{preview}</p>
              </div>
              {unread > 0 && !selected && (
                <span className="grid min-h-6 min-w-6 place-items-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-emerald-950">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </button>
            );
          })}

          {!showGroupInList && visibleDirectConversations.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-slate-500">
              {activeFilter === "direct"
                ? "No direct messages yet — tap the compose icon to start one"
                : "No conversations match your search"}
            </p>
          )}
        </div>
      </div>

      {/* Main panel — the active conversation */}
      <div className={`${hasActiveConversation ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`} style={{ backgroundColor: PANEL_BG }}>
        {!hasActiveConversation ? (
          <div className="m-auto hidden max-w-md px-8 text-center md:block">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl text-emerald-300" style={{ backgroundColor: CARD_BG }}>
              <MessageCircle size={28} />
            </div>
            <h2 className="mt-5 text-xl font-bold text-white">Your conversations</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Select the group conversation or start a private chat with a member. Nothing opens until you choose it.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => setIsGroupOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400">
                <Users size={16} /> Open group chat
              </button>
              <button type="button" onClick={() => setIsPickerOpen(true)} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/5" style={{ borderColor: BORDER }}>
                <SquarePen size={16} /> New message
              </button>
            </div>
          </div>
        ) : (
        <>
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: BORDER }}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={closeConversation}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/5 hover:text-white"
              aria-label="Close conversation"
            >
              <ArrowLeft size={16} />
            </button>
            {isDirectView && (
              <>
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: "#6366f1" }}
              >
                {initials(headerName)}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold text-white">{headerName}</h2>
                <p className="text-[11px] text-slate-400">
                  {memberPresence?.status === "online" ? "Online" : "Direct message"}
                </p>
              </div>
              </>
            )}
            {!isDirectView && (
              <>
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: "#0f9d70" }}
              >
                {initials(workspaceName)}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold text-white">{workspaceName}</h2>
                <p className="text-[11px] text-slate-400">
                  {`${memberCount > 0 ? `${memberCount} members` : "Group chat"}${presence.length > 0 ? ` · ${onlineCount} online` : ""}`}
                </p>
              </div>
              </>
            )}
          </div>
        </div>

        <div ref={messagePaneRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5" aria-live="polite">
          {isLoading && (
            <div className="py-10">
              <Spinner />
            </div>
          )}

          {isError && (
            <p className="text-center text-sm text-red-400">
              {isDirectView
                ? "Couldn't load this direct conversation. Try again in a moment."
                : "Couldn't load messages. Retrying shortly."}
            </p>
          )}

          {!isLoading && !isError && messages.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">
              {isDirectView ? `Say hello to ${activeDirect.name} 👋` : "No messages yet. Say hello 👋"}
            </p>
          )}

          <div className="space-y-5">
            {dayGroups.map((group) => (
              <div key={group.label} className="space-y-3">
                <div className="flex items-center justify-center">
                  <span
                    className="rounded-full px-3 py-1 text-[11px] font-semibold text-slate-400"
                    style={{ backgroundColor: CARD_BG }}
                  >
                    {group.label}
                  </span>
                </div>
                {group.items.map((message) => {
                  const authorId = message.sender?.id ?? message.sender?._id;
                  return (
                    <ChatMessage
                      key={message.id ?? message._id}
                      message={message}
                      isOwn={Boolean(authorId) && String(authorId) === String(userId)}
                    />
                  );
                })}
              </div>
            ))}
          </div>

        </div>

        <ChatComposer
          sending={isDirectView ? sendDirectMessage.isPending : sendGroupMessage.isPending}
          onSend={(payload) =>
            isDirectView
              ? sendDirectMessage.mutateAsync(payload)
              : sendGroupMessage.mutateAsync({ ...payload, workspaceType: workspace?.type })
          }
        />
        </>
        )}
      </div>

      {isPickerOpen && (
        <MemberPickerModal
          members={membersList}
          currentUserId={userId}
          onClose={() => setIsPickerOpen(false)}
          onSelect={(member) => {
            const direct = { userId: member.userId, name: member.name };
            setActiveDirect(direct);
            setRecentDirect(direct);
            setIsGroupOpen(false);
            setSearchParams({ direct: String(member.userId) });
            setActiveFilter("all");
            setIsPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}
