import { useNavigate } from "react-router-dom";
import { Megaphone, MessageCircle } from "lucide-react";

import { useAnnouncements } from "@/modules/announcements/hooks/useAnnouncements";
import { useMessages } from "@/modules/chat/hooks/useChat";

/* ============================================================
   WORKSPACE QUICK LAUNCHERS

   Two small floating buttons stacked above the AI assistant's
   launcher (which sits at bottom-6) so the corner reads, bottom
   to top, as: AI assistant -> Chat -> Announcements. Each badge
   is the real count fetched for this specific workspace (via
   the same hooks the Chat and Announcements pages themselves
   use), and only appears once that count is actually above
   zero ("in case there is any").

   Unlike the AI assistant, these don't expand into an inline
   panel that can be toggled shut again — tapping one opens the
   real Chat/Announcements page for this workspace. There's
   nothing to collapse back down; leaving the page is the only
   way to "close" it, same as any other page in the app.

   Only shown where the app already offers Chat/Announcements in
   the sidebar today: Chama and Contribution Group workspaces.
   Business workspaces don't have a member chat/announcements
   feed, so no launcher appears there.
============================================================ */

const APPLICABLE_TYPES = new Set(["chama", "contribution-group"]);

export default function WorkspaceQuickLaunchers({ workspaceId, workspaceType }) {
  const applicable = Boolean(workspaceId) && APPLICABLE_TYPES.has(workspaceType);

  const { data: announcements = [] } = useAnnouncements(applicable ? workspaceId : undefined);

  const { data: messages = [] } = useMessages(
    applicable ? workspaceId : undefined,
    applicable ? workspaceType : undefined
  );

  const navigate = useNavigate();

  if (!applicable) {
    return null;
  }

  const announcementCount = announcements.length;
  const chatCount = messages.length;

  return (
    <>
      <QuickLauncher
        label="Announcements"
        Icon={Megaphone}
        count={announcementCount}
        onClick={() => navigate(`/workspace/${workspaceId}/announcements`)}
        className="bottom-40 bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/30"
      />

      <QuickLauncher
        label="Chat"
        Icon={MessageCircle}
        count={chatCount}
        onClick={() => navigate(`/workspace/${workspaceId}/chat`)}
        className="bottom-24 bg-gradient-to-br from-emerald-500 to-teal-500 shadow-emerald-500/30"
      />
    </>
  );
}

/* ============================================================
   QUICK LAUNCHER — a single floating pill, positioned via the
   caller-supplied bottom-* class so both share the same
   right-edge alignment as the AI assistant launcher below them.
============================================================ */

function QuickLauncher({ label, Icon, count, onClick, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={count > 0 ? `${label}, ${count} unread` : label}
      className={`fixed right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 sm:right-6 ${className}`}
    >
      <Icon size={19} />

      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-white px-1 text-[10px] font-black text-white bg-slate-950 dark:border-slate-950 dark:bg-white dark:text-slate-950">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}