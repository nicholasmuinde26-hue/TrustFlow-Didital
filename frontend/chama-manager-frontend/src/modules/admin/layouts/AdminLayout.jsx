import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  CornerUpLeft,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import clsx from "clsx";
import useAuth from "@/app/hooks/useAuth";
import ThemeToggle from "@/shared/components/layout/ThemeToggle";
import inquiryService from "@/app/services/inquiry.service";
import adminService from "../services/admin.service";
import adminSupportService from "../services/adminSupport.service";
import useAdminProfile from "../hooks/useAdminProfile";
import { AdminAccessContext } from "../hooks/useAdminAccess";
import AdminAccountMenu from "../components/AdminAccountMenu";
import AdminCommandPalette from "../components/AdminCommandPalette";
import {
  WORKSPACE_NAMES,
  buildAdminNavigation,
  findActiveItem,
  flattenNavigation,
  isNavActive,
} from "../config/adminNavigation";

const COLLAPSE_KEY = "admin:sidebar-collapsed";
const FULL_ACCESS = {
  users: true,
  chamas: true,
  businesses: true,
  contributionGroups: true,
  finance: true,
  auditLogs: true,
  security: true,
  support: true,
  onboarding: true,
  marketplace: true,
  approveListings: true,
};

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export default function AdminLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const { profile, loading } = useAdminProfile();

  const isSuperAdmin = user?.systemRole === "super_admin";
  const permissions = profile?.permissions || (isSuperAdmin ? FULL_ACCESS : {});
  const category = profile?.category || (isSuperAdmin ? "super_admin" : "operations");
  const can = useCallback((key) => isSuperAdmin || Boolean(permissions[key]), [isSuperAdmin, permissions]);
  const canSupportDesk = isSuperAdmin || Boolean(permissions.support) || Boolean(permissions.finance);

  const [counts, setCounts] = useState({ requests: 0, inquiries: 0, support: 0 });
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Queue badges: refresh on navigation and every minute, soft-failing.
  useEffect(() => {
    let cancelled = false;
    async function fetchCounts() {
      try {
        const [stats, inqStats] = await Promise.all([
          adminService.getOverview().catch(() => null),
          inquiryService.getAdminInquiryStats().catch(() => null),
        ]);
        const support = canSupportDesk ? await adminSupportService.getOverview().catch(() => null) : null;
        if (cancelled) return;
        setCounts({
          requests: typeof stats?.pendingRequests === "number" ? stats.pendingRequests : 0,
          inquiries: typeof inqStats?.openCount === "number" ? inqStats.openCount : 0,
          support: support ? (support.reviewInvoices || 0) + (support.urgentCases || 0) : 0,
        });
      } catch {
        /* soft fail */
      }
    }
    fetchCounts();
    const timer = setInterval(fetchCounts, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [location.pathname, canSupportDesk]);

  const groups = useMemo(
    () => buildAdminNavigation({ category, can, isSuperAdmin, counts }),
    [category, can, isSuperAdmin, counts]
  );
  const flatItems = useMemo(() => flattenNavigation(groups), [groups]);
  const activeItem = findActiveItem(flatItems, location.pathname);

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* optional */
    }
  }, [collapsed]);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (event.key === "Escape") {
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const access = useMemo(
    () => ({ profile, loading, isSuperAdmin, category, permissions, can, counts }),
    [profile, loading, isSuperAdmin, category, permissions, can, counts]
  );

  return (
    <AdminAccessContext.Provider value={access}>
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {/* Desktop rail */}
        <aside
          className={clsx(
            "fixed inset-y-0 left-0 z-40 hidden border-r border-white/5 bg-[#090b14] transition-[width] duration-200 lg:block",
            collapsed ? "w-[76px]" : "w-64"
          )}
        >
          <SidebarContent
            groups={groups}
            pathname={location.pathname}
            collapsed={collapsed}
            isSuperAdmin={isSuperAdmin}
            category={category}
            profileCategory={profile?.category}
            onToggle={() => setCollapsed((v) => !v)}
          />
        </aside>

        {/* Mobile drawer */}
        <div className={clsx("fixed inset-0 z-50 lg:hidden", drawerOpen ? "visible" : "invisible")}>
          <div
            onClick={() => setDrawerOpen(false)}
            className={clsx(
              "absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity",
              drawerOpen ? "opacity-100" : "opacity-0"
            )}
          />
          <aside
            className={clsx(
              "absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-white/5 bg-[#090b14] shadow-2xl transition-transform duration-200",
              drawerOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <X size={18} />
            </button>
            <SidebarContent
              groups={groups}
              pathname={location.pathname}
              collapsed={false}
              isSuperAdmin={isSuperAdmin}
              category={category}
              profileCategory={profile?.category}
              onNavigate={() => setDrawerOpen(false)}
            />
          </aside>
        </div>

        <div className={clsx("transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900 lg:hidden"
            >
              <Menu size={18} />
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Admin console</p>
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {activeItem?.label || "Admin"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-400 shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 md:flex md:w-64"
            >
              <Search size={15} />
              <span>Jump to…</span>
              <kbd className="ml-auto rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold dark:border-slate-700">
                ⌘K
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Jump to"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 dark:border-slate-800 md:hidden"
            >
              <Search size={16} />
            </button>

            <div className="hidden sm:block"><RoleChip isSuperAdmin={isSuperAdmin} category={profile?.category} /></div>
            <ThemeToggle />
            <AdminAccountMenu />
          </header>

          <main className="admin-page-container mx-auto w-full min-w-0 max-w-[1360px] overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <Outlet />
          </main>
        </div>

        <AdminCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={flatItems} />
      </div>
    </AdminAccessContext.Provider>
  );
}

function RoleChip({ isSuperAdmin, category }) {
  return (
    <span
      className={clsx(
        "hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide sm:inline-flex",
        isSuperAdmin
          ? "bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300"
          : "bg-violet-500/10 text-violet-700 ring-1 ring-violet-500/20 dark:text-violet-300"
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", isSuperAdmin ? "bg-amber-500" : "bg-violet-500")} />
      {isSuperAdmin ? "Super Admin" : category || "Sub-Admin"}
    </span>
  );
}

function SidebarContent({ groups, pathname, collapsed, isSuperAdmin, category, profileCategory, onToggle, onNavigate }) {
  return (
    <div className="flex h-full flex-col">
      <div className={clsx("flex h-16 shrink-0 items-center gap-3 border-b border-white/5", collapsed ? "justify-center" : "px-5")}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-600/30">
          <ShieldCheck size={19} />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-white">Admin Console</p>
            <p className="truncate text-[11px] text-slate-400">Control plane</p>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="mx-4 mt-4 rounded-xl border border-white/5 bg-white/[0.03] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Signed in as</p>
          <p className="mt-1 text-[13px] font-semibold text-slate-100">
            {isSuperAdmin ? "Super Admin" : profileCategory ? `${profileCategory[0].toUpperCase()}${profileCategory.slice(1)} admin` : "Sub-Admin"}
          </p>
          <p className="text-[11px] text-slate-400">{WORKSPACE_NAMES[category] || "Admin workspace"}</p>
        </div>
      )}

      <nav className="admin-scroll mt-2 flex-1 overflow-y-auto px-3 pb-4" aria-label="Admin navigation">
        {groups.map((group) => (
          <div key={group.id}>
            {collapsed ? (
              <div className="mx-3 my-3 h-px bg-white/5" />
            ) : (
              <p className="px-3 pb-1.5 pt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem
                  key={item.to}
                  item={item}
                  active={isNavActive(item, pathname)}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-1 border-t border-white/5 p-3">
        <Link
          to="/home"
          onClick={onNavigate}
          title={collapsed ? "Exit to member app" : undefined}
          className={clsx(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-300! transition hover:bg-white/5 hover:text-white!",
            collapsed && "justify-center px-0"
          )}
        >
          <CornerUpLeft size={18} className="shrink-0 text-slate-500" />
          {!collapsed && <span>Exit to member app</span>}
        </Link>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={clsx(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-400 transition hover:bg-white/5 hover:text-white",
              collapsed && "justify-center px-0"
            )}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        )}
      </div>
    </div>
  );
}

function NavItem({ item, active, collapsed, onNavigate }) {
  const Icon = item.icon;
  const badge = item.badge > 0 ? (item.badge > 99 ? "99+" : item.badge) : null;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
        collapsed && "justify-center px-0",
        active ? "bg-violet-500/15 text-white!" : "text-slate-300! hover:bg-white/5 hover:text-white!"
      )}
    >
      {active && <span className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-violet-400" />}
      <Icon
        size={18}
        className={clsx("shrink-0", active ? "text-violet-300" : "text-slate-400 group-hover:text-slate-200")}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {badge &&
        (collapsed ? (
          <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-[#090b14]" />
        ) : (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500/90 px-1.5 text-[10px] font-bold tabular-nums text-white">
            {badge}
          </span>
        ))}
    </Link>
  );
}
