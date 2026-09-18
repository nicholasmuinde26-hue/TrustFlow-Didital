import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Activity,
  CalendarClock,
  Coins,
  LayoutDashboard,
  MessageCircle,
  MoreHorizontal,
  PlusCircle,
  Receipt,
  Settings,
  Users,
  Video,
  Vote,
  X,
} from "lucide-react";

import Logo from "@/shared/components/layout/Logo";
import ThemeToggle from "@/shared/components/layout/ThemeToggle/ThemeToggle";
import NotificationButton from "@/shared/components/layout/NotificationButton/NotificationButton";
import UserMenu from "@/shared/components/layout/UserMenu/UserMenu";
import { AiAssistantWidget } from "@/modules/ai";
import WorkspaceQuickLaunchers from "@/modules/workspaces/components/WorkspaceQuickLaunchers";

/*
 * NOTE ON THIS FILE: it was previously a byte-for-byte duplicate of
 * modules/workspaces/components/AdminInquiryBottomPanel.jsx (a zip/copy
 * artifact, same bug family as the Savingsshareout filename-casing
 * issue already flagged on the backend) — meaning every
 * contribution-group workspace was silently rendering the admin
 * inquiry panel instead of its own shell. Rebuilt from scratch here.
 *
 * Per the product direction: a Contribution Group workspace should
 * feel like a collaborative event space rather than accounting
 * software — top nav on desktop, bottom nav on mobile, no fixed
 * sidebar. The Doc1 mockups only cover the Chama workspace, so this
 * follows that same obsidian/mint visual language rather than a
 * specific mockup.
 */

// Primary destinations get a persistent tab (desktop top pills AND
// mobile bottom bar); everything else lives behind "More" so neither
// surface gets overcrowded.
function usePrimaryNav(base) {
  return [
    { title: "Home", icon: LayoutDashboard, to: base, end: true },
    { title: "Contributions", icon: Coins, to: `${base}/contributions` },
    { title: "Members", icon: Users, to: `${base}/members` },
    { title: "Meetings", icon: Video, to: `${base}/meetings` },
    { title: "Chat", icon: MessageCircle, to: `${base}/chat` },
  ];
}

function useMoreNav(base) {
  return [
    { title: "Record contribution", icon: PlusCircle, to: `${base}/finance/record-contribution` },
    { title: "Polls", icon: Vote, to: `${base}/polls` },
    { title: "Schedule", icon: CalendarClock, to: `${base}/schedule` },
    { title: "Activity", icon: Activity, to: `${base}/activity` },
    { title: "Expenses", icon: Receipt, to: `${base}/updates` },
    { title: "Settings", icon: Settings, to: `${base}/settings` },
  ];
}

export default function ContributionGroupLayout({ workspace, workspaceId }) {
  const base = `/workspace/${workspaceId}`;
  const primary = usePrimaryNav(base);
  const more = useMoreNav(base);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f8f6] dark:bg-obsidian">
      {/* Desktop top nav */}
      <header className="sticky top-0 z-30 hidden border-b border-obsidian-border bg-white/80 backdrop-blur-xl dark:bg-obsidian/90 lg:block">
        <div className="flex h-20 items-center justify-between gap-4 px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Logo />
            <div className="h-8 w-px bg-slate-200 dark:bg-obsidian-border" />
            <p className="truncate text-sm font-bold text-slate-900 dark:text-mist">{workspace?.name || "Contribution group"}</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <NotificationButton />
            <UserMenu />
          </div>
        </div>

        <nav
          aria-label="Contribution group navigation"
          className="flex items-center gap-2 overflow-x-auto px-8 pb-4"
        >
          {primary.map(({ title, icon: Icon, to, end }) => (
            <NavLink
              key={title}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "border-transparent bg-mint-deep text-mint"
                    : "border-obsidian-border/40 text-slate-500 hover:bg-slate-100 dark:text-mist-muted dark:hover:bg-obsidian-card"
                }`
              }
            >
              <Icon size={16} aria-hidden="true" />
              {title}
            </NavLink>
          ))}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex shrink-0 items-center gap-2 rounded-full border border-obsidian-border/40 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 dark:text-mist-muted dark:hover:bg-obsidian-card"
          >
            <MoreHorizontal size={16} aria-hidden="true" />
            More
          </button>
        </nav>
      </header>

      {/* Mobile top bar — identity + utilities only, nav lives at the bottom */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-obsidian-border bg-white/80 px-4 backdrop-blur-xl dark:bg-obsidian/90 lg:hidden">
        <p className="truncate text-sm font-bold text-slate-900 dark:text-mist">{workspace?.name || "Contribution group"}</p>
        <div className="flex items-center gap-2">
          <NotificationButton />
          <UserMenu />
        </div>
      </header>

      <main className="flex-1 p-4 pb-24 lg:p-8 lg:pb-8">
        <Outlet />
      </main>

      {/* Mobile bottom nav — same five primary destinations plus More */}
      <nav
        aria-label="Contribution group mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-between border-t border-obsidian-border bg-obsidian/95 px-1 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 backdrop-blur-xl lg:hidden"
      >
        {primary.map(({ title, icon: Icon, to, end }) => (
          <NavLink
            key={title}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-medium transition ${
                isActive ? "text-mint" : "text-mist-muted"
              }`
            }
          >
            <Icon size={20} aria-hidden="true" />
            {title}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-medium text-mist-muted"
        >
          <MoreHorizontal size={20} aria-hidden="true" />
          More
        </button>
      </nav>

      {/* Shared "More" drawer for both desktop and mobile */}
      {moreOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-obsidian/60 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-label="More contribution group tools"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-3xl border-t border-obsidian-border bg-white p-5 shadow-2xl dark:bg-obsidian-card lg:inset-auto lg:right-8 lg:top-24 lg:w-80 lg:rounded-2xl lg:border"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900 dark:text-mist">More tools</p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-mist-muted dark:hover:bg-obsidian-raised"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-1">
              {more.map(({ title, icon: Icon, to }) => (
                <NavLink
                  key={title}
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                      isActive
                        ? "bg-mint-deep text-mint"
                        : "text-slate-600 hover:bg-slate-100 dark:text-mist-muted dark:hover:bg-obsidian-raised"
                    }`
                  }
                >
                  <Icon size={17} aria-hidden="true" />
                  {title}
                </NavLink>
              ))}
            </div>
          </div>
        </>
      )}

      <WorkspaceQuickLaunchers workspaceId={workspaceId} workspaceType={workspace?.type} />
      <AiAssistantWidget workspaceId={workspaceId} workspaceType={workspace?.type} workspaceName={workspace?.name} />
    </div>
  );
}