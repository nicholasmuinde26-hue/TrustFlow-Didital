import { Link, useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import { useNotificationBadges } from "@/modules/notifications/hooks/useNotifications";
import { findWorkspaceNavigationMatch } from "@/modules/workspaces/config/workspaceNavigation";

/**
 * The ONE contextual navigation bar for a workspace.
 *
 * Shows the other pages in the section you are currently in, so moving
 * from "Contributions" to "Savings" to "Payouts" is one tap instead of
 * opening the all-tools drawer each time. It reads the same navigation
 * config as the sidebar, so it is role-filtered automatically and needs
 * no per-page changes.
 *
 * This is the only section-level tab bar. The per-group "Quick actions"
 * bars (loans, books, governance, collaboration, money, contributions)
 * were removed because they stacked on top of this one. If a page needs
 * to appear in a section's tabs, add it to workspaceNavigation.js.
 *
 * It is rendered by WorkspaceLayout *outside* the scrolling <main>, so it
 * never scrolls over (or hides) the breadcrumbs and page content.
 */

export default function SectionTabs({ sections = [] }) {
  const { pathname } = useLocation();
  const { countForRoute } = useNotificationBadges();

  const best = findWorkspaceNavigationMatch(sections, pathname);

  if (!best || !best.section.title) return null;

  const { section, item: current } = best;

  // Items tagged with `parentTo` (see chamaNavigation.js) are sub-pages of
  // another tab. They are hidden from the main row and shown as a second
  // row once their parent is open, so the top bar stays short.
  const topItems = section.items.filter((item) => !item.parentTo);
  const activeTop = current.parentTo || current.to;
  const subItems = section.items.filter(
    (item) => item.parentTo === activeTop || (item.to === activeTop && section.items.some((i) => i.parentTo === activeTop))
  );
  const showSubRow = subItems.length > 1;

  if (topItems.length < 2 && !showSubRow) return null;

  return (
    <nav
      aria-label={`${section.title} pages`}
      className="shrink-0 border-b border-slate-200 bg-[#f5f8f6] px-2 py-2 sm:px-4 sm:py-2.5 lg:px-8 dark:border-obsidian-border dark:bg-obsidian"
    >
      <div className="flex items-center gap-3">
        <p className="hidden shrink-0 text-xs font-medium text-slate-500 xl:block dark:text-mist-muted">
          {section.title}
        </p>

        <ul className="flex min-w-0 flex-1 gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-1.5">
          {topItems.map((item) => {
            const active = item.to === activeTop;
            const Icon = item.icon;
            const updateCount = countForRoute(item.to);
            const hasUpdate = updateCount > 0;

            // NOTE: the trailing "!" (important) on the text colours is
            // deliberate. globals.css has an un-layered `a { color: inherit }`
            // which otherwise beats Tailwind's layered text-* utilities and
            // made the active tab's label the same colour as its background.
            return (
              <li key={item.to} className="shrink-0">
                <Link
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    active
                    ? "bg-slate-900 text-white! dark:bg-mint dark:text-obsidian-rail!"
                      : "text-slate-600! hover:bg-slate-200/70 dark:text-mist-muted! dark:hover:bg-obsidian-card"
                  }`}
                >
                  {Icon ? <Icon size={15} aria-hidden="true" /> : null}
                  {item.title}
                  {item.locked ? (
                    <Lock size={12} aria-label="Locked: upgrade your plan to use" className="text-amber-500" />
                  ) : null}
                  {hasUpdate && (
                    <span
                      aria-label={`${updateCount} new`}
                      className={`grid h-4 min-w-4 shrink-0 place-items-center rounded-full px-1 text-[10px] font-bold leading-none ${
                        active
                          ? "bg-white text-slate-900! dark:bg-obsidian-rail dark:text-mint!"
                          : "bg-red-500 text-white!"
                      }`}
                    >
                      {updateCount > 9 ? "9+" : updateCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {showSubRow && (
        <ul
          aria-label="Sub pages"
          className="mt-2 flex gap-1 overflow-x-auto overscroll-x-contain border-t border-slate-200/70 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-obsidian-border"
        >
          {subItems.map((item) => {
            const isParent = item.to === activeTop;
            const subActive = item.to === current.to;
            return (
              <li key={item.to} className="shrink-0">
                <Link
                  to={item.to}
                  aria-current={subActive ? "page" : undefined}
                  className={`flex items-center rounded-full px-3 py-1 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    subActive
                      ? "bg-emerald-100 text-emerald-800! dark:bg-mint-deep dark:text-mint!"
                      : "text-slate-500! hover:bg-slate-200/70 dark:text-mist-muted! dark:hover:bg-obsidian-card"
                  }`}
                >
                  {isParent ? item.subTitle || item.title : item.title}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
