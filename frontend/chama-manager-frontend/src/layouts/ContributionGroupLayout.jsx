import { NavLink, Outlet } from "react-router-dom";
import {
  Activity,
  CalendarDays,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Users,
  Video,
} from "lucide-react";

import WorkspaceSwitcher from "@/shared/components/layout/WorkspaceSwitcher";
import ThemeToggle from "@/shared/components/layout/ThemeToggle";
import NotificationButton from "@/shared/components/layout/NotificationButton";
import UserMenu from "@/shared/components/layout/UserMenu";

const navigation = [
  { label: "Overview", icon: LayoutDashboard, to: "" },
  { label: "Contributions", icon: Users, to: "contributions" },
  { label: "Schedule", icon: CalendarDays, to: "schedule" },
  { label: "Activity", icon: Activity, to: "activity" },
  { label: "Members", icon: Users, to: "members" },
  { label: "Chat", icon: MessageCircle, to: "chat" },
  { label: "Updates", icon: Megaphone, to: "announcements" },
  { label: "Meetings", icon: Video, to: "meetings" },
];

export default function ContributionGroupLayout({ workspace, workspaceId }) {
  const base = `/workspace/${workspaceId}`;
  const name = workspace?.name || "Contribution group";

  return (
    <div className="min-h-screen bg-[#fcfaff] text-slate-900 dark:bg-slate-950 dark:text-white">
      <header className="sticky top-0 z-30 border-b border-violet-100 bg-white/85 px-5 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/85 lg:px-8">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
          <WorkspaceSwitcher />
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <NotificationButton />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-5 py-6 lg:px-8 lg:py-8">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 via-purple-700 to-fuchsia-600 px-6 py-7 text-white shadow-xl shadow-violet-200/60 dark:shadow-none lg:px-9">
          <div className="absolute -right-10 -top-14 h-48 w-48 rounded-full bg-white/10" />
          <div className="absolute bottom-0 right-28 h-24 w-24 rounded-full bg-pink-300/20" />
          <div className="relative">
            <p className="text-sm font-medium text-violet-100">CONTRIBUTION GROUP</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{name}</h1>
                <p className="mt-1 text-sm text-violet-100">Plan together, contribute together, celebrate together.</p>
              </div>
              {workspace?.role && (
                <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold capitalize">
                  {workspace.role.replaceAll("_", " ")}
                </span>
              )}
            </div>
          </div>
        </section>

        <nav className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="Contribution group navigation">
          {navigation.map(({ label, icon: Icon, to }) => (
            <NavLink
              key={label}
              to={to ? `${base}/${to}` : base}
              end={!to}
              className={({ isActive }) => `flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-violet-700 text-white shadow-md shadow-violet-200 dark:shadow-none"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-violet-50 hover:text-violet-700 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800 dark:hover:bg-slate-800"
              }`}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-7"><Outlet /></div>
      </main>
    </div>
  );
}
