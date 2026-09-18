import React from "react";
import { useParams, useLocation, NavLink } from "react-router-dom";
import { MessageCircle, CalendarDays, Vote, Megaphone } from "lucide-react";

// The tabs across the top of the "Collaboration & Communication" group,
// kept in one place so a single layout (CollaborationLayout) can render
// them once and keep the bar mounted while the pages underneath swap
// out — same pattern as MoneyCollectionsQuickNav / GovernanceQuickNav.
function collaborationTabs(base) {
  return [
    { label: "Messages", icon: MessageCircle, to: `${base}/chat` },
    { label: "Meetings", icon: CalendarDays, to: `${base}/meetings` },
    { label: "Polls", icon: Vote, to: `${base}/polls` },
    { label: "Announcements", icon: Megaphone, to: `${base}/announcements` },
  ];
}

export default function CollaborationQuickNav() {
  const { workspaceId } = useParams();
  const location = useLocation();
  const base = `/workspace/${workspaceId}`;

  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 pb-2 dark:border-obsidian-border text-xs font-bold">
      {collaborationTabs(base).map(({ label, icon: Icon, to }) => {
        const isActive = location.pathname === to;
        return (
          <NavLink
            key={to}
            to={to}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 transition whitespace-nowrap ${
              isActive
                ? ""
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-mist-muted dark:hover:bg-obsidian-card dark:hover:text-mist"
            }`}
            style={isActive ? { backgroundColor: "#059669", color: "#ffffff" } : undefined}
          >
            <Icon size={14} />
            {label}
          </NavLink>
        );
      })}
    </div>
  );
}