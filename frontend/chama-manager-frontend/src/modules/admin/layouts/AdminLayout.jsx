import { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Inbox,
  UserCheck,
  PlusCircle,
  FolderKanban,
  ArrowLeft,
  LayoutDashboard,
  ShieldAlert,
  MessageSquare,
} from "lucide-react";
import useAuth from "@/app/hooks/useAuth";
import ThemeToggle from "@/shared/components/layout/ThemeToggle";
import UserMenu from "@/shared/components/layout/UserMenu/UserMenu";
import adminService from "../services/admin.service";
import inquiryService from "@/app/services/inquiry.service";

export default function AdminLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isSuperAdmin = user?.systemRole === "super_admin";
  const [pendingCount, setPendingCount] = useState(0);
  const [inquiryCount, setInquiryCount] = useState(0);

  useEffect(() => {
    async function fetchCounts() {
      try {
        const [stats, inqStats] = await Promise.all([
          adminService.getOverview().catch(() => null),
          inquiryService.getAdminInquiryStats().catch(() => null),
        ]);
        if (typeof stats?.pendingRequests === "number") {
          setPendingCount(stats.pendingRequests);
        }
        if (typeof inqStats?.openCount === "number") {
          setInquiryCount(inqStats.openCount);
        }
      } catch {
        // Soft fail
      }
    }
    fetchCounts();
  }, [location.pathname]);

  const navItems = [
    {
      to: "/admin",
      label: "Overview",
      icon: LayoutDashboard,
      exact: true,
    },
    {
      to: "/admin/inquiries",
      label: "Inquiries & Reports",
      icon: MessageSquare,
      badge: inquiryCount > 0 ? inquiryCount : null,
    },
    {
      to: "/admin/requests",
      label: "Workspace Requests",
      icon: Inbox,
      badge: pendingCount > 0 ? pendingCount : null,
    },
    ...(isSuperAdmin
      ? [
          {
            to: "/admin/sub-admins",
            label: "Sub-Admins",
            icon: UserCheck,
          },
        ]
      : []),
    {
      to: "/admin/create",
      label: "Create Entity",
      icon: PlusCircle,
    },
    {
      to: "/admin/directory",
      label: "All Workspaces",
      icon: FolderKanban,
    },
  ];


  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top Admin Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex h-16 items-center justify-between px-6 lg:px-10">
          <div className="flex items-center gap-4">
            <Link
              to="/home"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              title="Return to App"
            >
              <ArrowLeft size={18} />
            </Link>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-md shadow-violet-600/30">
                <ShieldCheck size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-black tracking-tight text-slate-950 dark:text-white">
                    Admin Portal
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                      isSuperAdmin
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    }`}
                  >
                    {isSuperAdmin ? "Super Admin" : "Sub-Admin"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ChamaManager Central Administration
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto px-6 border-t border-slate-100 dark:border-slate-800/80 lg:px-10">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition whitespace-nowrap ${
                  isActive
                    ? "border-violet-600 text-violet-600 dark:border-violet-400 dark:text-violet-400"
                    : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main Admin Content */}
      <main className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-10">
        <Outlet />
      </main>
    </div>
  );
}