import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Search, Phone, MoreVertical, SquarePen, ArrowLeft } from "lucide-react";

import useAuth from "@/app/hooks/useAuth";
import useWorkspace from "@/app/hooks/useWorkspace";
import { usePresence } from "@/modules/presence/hooks/usePresence";
import { useMembers } from "@/modules/members/hooks/useMembers";
import {
  useMessages,
  useSendMessage,
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

export default function ChatPage() {
  const { workspaceId } = useParams();
  const { user } = useAuth();
  const { workspaces } = useWorkspace();
  const scrollRef = useRef(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  // null = the group chat. Otherwise { userId, name } of the member
  // whose direct thread is open.
  const [activeDirect, setActiveDirect] = useState(null);

  const userId = user?.id ?? user?._id;
  const workspace = workspaces.find((item) => String(item.id ?? item._id) === String(workspaceId));

  const { data: groupMessages = [], isLoading: groupLoading, isError: groupError } = useMessages(
    workspaceId,
    workspace?.type
  );
  const sendGroupMessage = useSendMessage(workspaceId);

  const {
    data: directMessages = [],
    isLoading: directLoading,
    isError: directError,
  } = useDirectMessages(activeDirect?.userId);
  const sendDirectMessage = useSendDirectMessage(activeDirect?.userId);

  const { data: presence = [] } = usePresence(workspaceId);
  const onlineCount = presence.filter((p) => p.status === "online").length;

  const { data: membersList = [] } = useMembers(workspace?.type, workspaceId);
  const memberCount = membersList.length;

  const isDirectView = Boolean(activeDirect);
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

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const workspaceName = workspace?.name || "Group chat";
  const matchesSearch = (name) => name.toLowerCase().includes(query.trim().toLowerCase());

  const showGroupInList = activeFilter !== "direct" && matchesSearch(workspaceName);
  const showDirectInList = activeFilter !== "groups" && activeDirect && matchesSearch(activeDirect.name);

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

  return (
    <div
      className="flex h-[calc(100vh-11rem)] min-h-[520px] overflow-hidden rounded-3xl border"
      style={{ borderColor: BORDER, backgroundColor: PANEL_BG }}
    >
      {/* Sidebar — conversation list */}
      <div
        className="flex w-[300px] shrink-0 flex-col border-r"
        style={{ borderColor: BORDER, backgroundColor: SIDEBAR_BG }}
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <div>
            <h1 className="text-lg font-bold text-white">Messages</h1>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Conversations stay alongside the work they refer to.
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

        <div className="px-5 pt-4">
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

        <div className="mt-4 flex items-center gap-4 px-5 text-xs font-semibold">
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
              onClick={() => setActiveDirect(null)}
              className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition"
              style={{ backgroundColor: !isDirectView ? CARD_BG : "transparent" }}
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
            </button>
          )}

          {showDirectInList && (
            <button
              type="button"
              onClick={() => setActiveDirect(activeDirect)}
              className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition"
              style={{ backgroundColor: isDirectView ? CARD_BG : "transparent" }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: "#6366f1" }}
              >
                {initials(activeDirect.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{activeDirect.name}</p>
                <p className="truncate text-xs text-slate-400">Direct message</p>
              </div>
            </button>
          )}

          {!showGroupInList && !showDirectInList && (
            <p className="px-3 py-6 text-center text-xs text-slate-500">
              {activeFilter === "direct"
                ? "No direct messages yet — tap the compose icon to start one"
                : "No conversations match your search"}
            </p>
          )}
        </div>
      </div>

      {/* Main panel — the active conversation */}
      <div className="flex flex-1 flex-col" style={{ backgroundColor: PANEL_BG }}>
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: BORDER }}
        >
          <div className="flex items-center gap-3">
            {isDirectView && (
              <button
                type="button"
                onClick={() => setActiveDirect(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:text-white"
                aria-label="Back to group chat"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: isDirectView ? "#6366f1" : "#0f9d70" }}
            >
              {initials(headerName)}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">{headerName}</h2>
              <p className="text-[11px] text-slate-400">
                {isDirectView
                  ? memberPresence?.status === "online"
                    ? "Online"
                    : "Direct message"
                  : `${memberCount > 0 ? `${memberCount} members` : "Group chat"}${
                      presence.length > 0 ? ` · ${onlineCount} online` : ""
                    }`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full transition hover:text-white"
              aria-label="Call"
            >
              <Phone size={16} />
            </button>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full transition hover:text-white"
              aria-label="More options"
            >
              <MoreVertical size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5" aria-live="polite">
          {isLoading && (
            <div className="py-10">
              <Spinner />
            </div>
          )}

          {isError && (
            <p className="text-center text-sm text-red-400">
              {isDirectView
                ? "Couldn't load this conversation. Direct messaging needs backend support that isn't live yet."
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

          <div ref={scrollRef} />
        </div>

        <ChatComposer
          sending={isDirectView ? sendDirectMessage.isPending : sendGroupMessage.isPending}
          onSend={(payload) =>
            isDirectView
              ? sendDirectMessage.mutateAsync(payload)
              : sendGroupMessage.mutateAsync({ ...payload, workspaceType: workspace?.type })
          }
        />
      </div>

      {isPickerOpen && (
        <MemberPickerModal
          members={membersList}
          currentUserId={userId}
          onClose={() => setIsPickerOpen(false)}
          onSelect={(member) => {
            setActiveDirect({ userId: member.userId, name: member.name });
            setActiveFilter("all");
            setIsPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}