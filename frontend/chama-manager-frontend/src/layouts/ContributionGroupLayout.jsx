import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Activity,
  CalendarDays,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Users,
  Video,
  Menu,
  X,
  Settings,
  Coins,
} from "lucide-react";

import WorkspaceSwitcher from "@/shared/components/layout/WorkspaceSwitcher";
import ThemeToggle from "@/shared/components/layout/ThemeToggle";
import NotificationButton from "@/shared/components/layout/NotificationButton";
import UserMenu from "@/shared/components/layout/UserMenu";
import Logo from "@/shared/components/layout/Logo";
import { canViewAdministration } from "@/modules/workspaces/permissions/Permissions";

const navigation = [
  { label: "Overview", icon: LayoutDashboard, to: "" },
  { label: "Contributions", icon: Coins, to: "contributions" },
  { label: "Schedule", icon: CalendarDays, to: "schedule" },
  { label: "Activity", icon: Activity, to: "activity" },
  { label: "Members", icon: Users, to: "members" },
  { label: "Chat", icon: MessageCircle, to: "chat" },
  { label: "Updates", icon: Megaphone, to: "announcements" },
  { label: "Meetings", icon: Video, to: "meetings" },
  // "Settings" is filtered out below for non-managers — see canViewAdministration.
  { label: "Settings", icon: Settings, to: "settings", administration: true },
];

export default function ContributionGroupLayout({ workspace, workspaceId }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const base = `/workspace/${workspaceId}`;
  const name = workspace?.name || "Contribution group";

  const visibleNavigation = navigation.filter(
    (item) => !item.administration || canViewAdministration(workspace?.role, "contribution-group")
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
      {/* Mobile Sidebar Backdrop */}
      <div
        className={`
          fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden
          ${sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
        `}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar navigation panel */}
      <aside
        className={`
          fixed top-0 bottom-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-violet-100 bg-white transition-transform duration-300 dark:border-slate-800 dark:bg-slate-900
          lg:static lg:z-0 lg:translate-x-0 lg:flex
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between border-b border-violet-50 p-6 dark:border-slate-800">
          <Logo />
          
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sidebar Group info badge */}
        <div className="p-4 border-b border-violet-50 dark:border-slate-800 bg-gradient-to-r from-violet-50/50 to-purple-50/50 dark:from-slate-800/10 dark:to-purple-900/10">
          <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 tracking-wider uppercase">Contribution Group</p>
          <p className="font-semibold text-slate-900 dark:text-white truncate mt-0.5 text-sm">{name}</p>
          {workspace?.role && (
            <span className="inline-block mt-2 rounded-full bg-violet-100 dark:bg-violet-950 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300 capitalize">
              {workspace.role.replaceAll("_", " ")}
            </span>
          )}
        </div>

        {/* Navigation list */}
        <nav
          onClick={() => setSidebarOpen(false)}
          className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5 scrollbar-thin"
        >
          {visibleNavigation.map(({ label, icon: Icon, to }) => (
            <NavLink
              key={label}
              to={to ? `${base}/${to}` : base}
              end={!to}
              className={({ isActive }) => `
                flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200
                ${
                  isActive
                    ? "bg-violet-600 text-white shadow-md shadow-violet-200 dark:shadow-none"
                    : "text-slate-600 hover:bg-violet-50 hover:text-violet-700 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-violet-400"
                }
              `}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer Banner */}
        <div className="border-t border-violet-50 p-4 dark:border-slate-800">
          <div className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 p-4 text-white shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Accountability First</p>
            <p className="mt-1 text-[11px] text-violet-100 leading-relaxed">
              Clarity, compliance and zero excuses. Plan together, build trust.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <WorkspaceSwitcher />
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <NotificationButton />
            <UserMenu />
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}