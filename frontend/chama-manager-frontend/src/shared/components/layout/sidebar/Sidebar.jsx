import { Command, LayoutGrid, SlidersHorizontal, X, User, BookOpen } from "lucide-react";
import { NavLink, Link } from "react-router-dom";

import Logo from "../Logo";
import SidebarSection from "./SidebarSection";
import AdminInquiryBottomPanel from "@/modules/workspaces/components/AdminInquiryBottomPanel";
import useAuth from "@/app/hooks/useAuth";

// Order mirrors the VeriCircle workspace rail: Command Center (Overview),
// Money & Collections (Dashboard / Finance), Loans, People & Governance (Members),
// Messages (Chat), and All Tools drawer.
//
// "Contributions" was dropped from this list on purpose: it and
// "Dashboard" both landed in the rail as separate money icons even
// though they're the same finance area, so they're merged into a
// single "Dashboard" -> /finance icon here (Contributions still has
// its own entry in the full "All tools" list).
const RAIL_PRIORITIES = [
  "Overview",
  "Dashboard",
  "Finance",
  "Loans",
  "Members",
  "Messages",
  "Chat",
  "Meeting Records",
  "Trust Score",
  "Command Center"
];

// Rail tooltips/aria-labels are relabeled here (route/icon untouched) so
// they read the same as their grouping in the full "All tools" list —
// the rail's merged money icon is "Dashboard" by item title, but it
// stands in for the whole "Money & Contributions" section there.
const RAIL_LABEL_OVERRIDES = {
  Dashboard: "Money & Contributions",
};

function pickRailItems(sections) {
  const items = sections.flatMap((section) => section.items || []);
  const seen = new Set();
  return RAIL_PRIORITIES.map((title) => items.find((item) => item.title === title))
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item.to)) return false;
      seen.add(item.to);
      return true;
    })
    .slice(0, 5);
}

// Leadership Desk is pinned in the bottom action group (above "All tools")
// instead of competing with the other links for one of the 5 rail slots.
// It's already role-filtered upstream in workspaceNavigation.js, so it
// simply won't be found (and won't render) for members without access.
function pickLeadershipItem(sections) {
  const items = sections.flatMap((section) => section.items || []);
  return items.find((item) => item.title === "Leadership Desk") || null;
}

// "Books" is a whole section (Transactions, Balance Sheet, Income
// Statement, Cash Flow, Reports, Trust Timeline, Trust Score, Disputes,
// Official Accountability) rather than a single nav item, so there's no
// item literally titled "Books" to look up. This finds that section and
// builds a synthetic rail entry that opens it at its first item.
function pickBooksItem(sections) {
  const booksSection = sections.find((section) => section.title === "Books");
  const firstItem = booksSection?.items?.[0];
  if (!firstItem) return null;
  return { title: "Books", icon: BookOpen, to: firstItem.to };
}

export default function Sidebar({ sections = [], isOpen, onClose, onOpen, workspace, workspaceId }) {
  const railItems = pickRailItems(sections);
  const leadershipItem = pickLeadershipItem(sections);
  const booksItem = pickBooksItem(sections);
  const primaryNavItems = booksItem ? [...railItems, booksItem] : railItems;
  const { user } = useAuth();

  const userName = user?.name || user?.first_name || "User";
  const userInitials = userName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";
  const userPhoto = user?.avatar_url || user?.photoURL || user?.avatar || null;

  return (
    <>
      {/* This rail is intentionally NOT theme-reactive: it always wears the
          obsidian/mint palette regardless of the app's light/dark toggle. */}
      <aside className="hidden w-[76px] shrink-0 flex-col items-center justify-between border-r border-obsidian-border/60 bg-obsidian-rail py-5 text-mist/70 transition-colors lg:flex">
        <div className="flex w-full flex-col items-center">
          {/* Logo CM badge */}
          <Link
            to={`/workspace/${workspaceId}`}
            className="mb-7 flex h-10 w-10 items-center justify-center rounded-xl bg-mint text-sm font-black tracking-tight text-obsidian-rail shadow-sm transition hover:opacity-90"
            title={workspace?.name || "Chama Manager"}
          >
            CM
          </Link>

          {/* Primary destination rail (5 core links + Books) */}
          <nav className="flex w-full flex-col items-center gap-2" aria-label="Primary workspace navigation">
            {primaryNavItems.map(({ title, icon: Icon, to }) => {
              const label = RAIL_LABEL_OVERRIDES[title] || title;
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={title === "Overview"}
                  aria-label={label}
                  title={label}
                  className={({ isActive }) =>
                    `grid h-11 w-11 place-items-center rounded-xl transition ${
                      isActive
                        ? "bg-mint-deep text-mint font-bold shadow-xs shadow-black/30"
                        : "text-mist/60 hover:bg-obsidian-card hover:text-mist"
                    }`
                  }
                >
                  <Icon size={19} aria-hidden="true" />
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom actions: Leadership Desk, All tools button & User avatar */}
        <div className="flex w-full flex-col items-center gap-3">
          {leadershipItem ? (
            <NavLink
              to={leadershipItem.to}
              aria-label={leadershipItem.title}
              title={leadershipItem.title}
              className={({ isActive }) =>
                `grid h-11 w-11 place-items-center rounded-xl transition ${
                  isActive
                    ? "bg-mint-deep text-mint font-bold shadow-xs shadow-black/30"
                    : "text-mist/60 hover:bg-obsidian-card hover:text-mist"
                }`
              }
            >
              <leadershipItem.icon size={19} aria-hidden="true" />
            </NavLink>
          ) : null}

          <button
            type="button"
            onClick={onOpen}
            className="grid h-11 w-11 place-items-center rounded-xl border border-obsidian-border text-mist/80 transition hover:bg-obsidian-card hover:text-mist"
            aria-label="Open all workspace tools"
            title="All tools"
          >
            <SlidersHorizontal size={18} aria-hidden="true" />
          </button>

          <Link
            to="/account/settings"
            title={userName}
            className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-obsidian-border bg-obsidian-card text-xs font-bold text-mist transition hover:ring-2 hover:ring-mint"
          >
            {userPhoto ? (
              <img src={userPhoto} alt={userName} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              userInitials
            )}
          </Link>
        </div>
      </aside>

      <div
        className={`fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs transition-opacity ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(23rem,calc(100vw-1.5rem))] flex-col border-r border-slate-200 bg-white shadow-2xl transition-transform duration-300 dark:border-obsidian-border dark:bg-obsidian lg:left-[76px] lg:w-[360px] ${
          isOpen ? "translate-x-0" : "-translate-x-[calc(100%+76px)]"
        }`}
        aria-label="All workspace tools"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-5 dark:border-obsidian-border">
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <Logo />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-950 dark:text-mist">All tools</p>
              <p className="text-xs text-slate-500 dark:text-mist-muted">Everything available to your role</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-mist-muted dark:hover:bg-obsidian-card"
            aria-label="Close all tools"
          >
            <X size={20} />
          </button>
        </header>
        <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-mint-deep dark:bg-mint-deep/40 dark:text-mint">
          <Command size={14} aria-hidden="true" /> Choose a workspace or tool
        </div>
        <nav
          onClick={(event) => {
            if (event.target.closest("a")) onClose?.();
          }}
          className="flex-1 space-y-6 overflow-y-auto px-5 py-5"
        >
          {sections.map((section) => (
            <SidebarSection key={section.title || "workspace"} {...section} />
          ))}
        </nav>
        <footer className="border-t border-slate-200 p-4 dark:border-obsidian-border">
          <AdminInquiryBottomPanel workspace={workspace} workspaceId={workspaceId} />
        </footer>
      </aside>
    </>
  );
}