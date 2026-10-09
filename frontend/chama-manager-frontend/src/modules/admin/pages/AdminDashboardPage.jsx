import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  FolderKanban,
  Inbox,
  LifeBuoy,
  MessageSquare,
  PlusCircle,
  Receipt,
  ShieldAlert,
  Store,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import clsx from "clsx";
import useAuth from "@/app/hooks/useAuth";
import inquiryService from "@/app/services/inquiry.service";
import adminService from "../services/admin.service";
import useAdminAccess from "../hooks/useAdminAccess";
import { ComplianceWorkspacePage, FinanceWorkspacePage, SupportWorkspacePage } from "./CategoryWorkspacePages";
import {
  PageHeader,
  PageSkeleton,
  Panel,
  PanelLink,
  Pill,
  TONES,
  adminBtn,
  panelSurface,
} from "../components/ui/AdminUi";

const kes = (n) => `KES ${Number(n || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
const num = (n) => Number(n || 0).toLocaleString("en-KE");

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function timeAgo(value) {
  if (!value) return null;
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

export default function AdminDashboardPage() {
  const { loading, category } = useAdminAccess();

  if (loading) return <PageSkeleton />;

  // Category is assigned and permission-scoped on the server. Each entry
  // route leads with the work that matters to that operator, while the
  // Super Admin keeps the whole-platform overview.
  switch (category) {
    case "security":
      return <Navigate to="/admin/security" replace />;
    case "finance":
      return <FinanceWorkspacePage />;
    case "support":
      return <SupportWorkspacePage />;
    case "compliance":
      return <ComplianceWorkspacePage />;
    case "onboarding":
      return <Navigate to="/admin/requests" replace />;
    default:
      return <PlatformOverview />;
  }
}

function PlatformOverview() {
  const { user } = useAuth();
  const { isSuperAdmin, can } = useAdminAccess();
  const [state, setState] = useState({ loading: true, stats: null, exec: null, inq: null, requests: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [stats, exec, requests, inq] = await Promise.all([
        adminService.getOverview().catch(() => null),
        adminService.getExecutiveOverview().catch(() => null),
        adminService.getWorkspaceRequests("pending").catch(() => []),
        inquiryService.getAdminInquiryStats().catch(() => null),
      ]);
      if (!cancelled) {
        setState({ loading: false, stats, exec, inq, requests: (requests || []).slice(0, 5) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.loading) return <PageSkeleton />;

  const { stats, exec, inq, requests } = state;
  const firstName = (user?.name || "Admin").split(" ")[0];
  const today = new Date().toLocaleDateString("en-KE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const attention = [
    {
      label: "Pending requests",
      value: stats?.pendingRequests ?? 0,
      hint: "Workspace creation awaiting a decision",
      icon: Inbox,
      tone: "amber",
      to: "/admin/requests",
      show: can("onboarding"),
    },
    {
      label: "Open inquiries",
      value: inq?.openCount ?? 0,
      hint: "Member and workspace reports to triage",
      icon: MessageSquare,
      tone: "rose",
      to: "/admin/inquiries",
      show: can("support"),
    },
    {
      label: "Risk signals",
      value: exec?.riskAlerts ?? 0,
      hint: "Unresolved financial & fraud signals",
      icon: ShieldAlert,
      tone: "rose",
      to: can("security") ? "/admin/security" : "/admin/directory",
      show: Boolean(exec),
    },
  ].filter((item) => item.show);

  const totalAttention = attention.reduce((sum, item) => sum + item.value, 0);

  const composition = [
    { label: "Chamas", value: stats?.totalChamas ?? 0, icon: Building2, tone: "violet", to: "/admin/directory?tab=chamas" },
    { label: "Businesses", value: stats?.totalBusinesses ?? 0, icon: Store, tone: "sky", to: "/admin/directory?tab=businesses" },
    { label: "Contribution groups", value: stats?.totalGroups ?? 0, icon: Wallet, tone: "emerald", to: "/admin/directory?tab=groups" },
  ];
  const workspaceTotal = composition.reduce((sum, item) => sum + item.value, 0);

  const verified = exec?.verifiedTransactionPercent;

  const quickActions = [
    { label: "Create workspace", icon: PlusCircle, to: "/admin/create", show: can("onboarding") },
    { label: "Review requests", icon: Inbox, to: "/admin/requests", show: can("onboarding") },
    { label: "Browse workspaces", icon: FolderKanban, to: "/admin/directory", show: can("chamas") || can("businesses") || can("contributionGroups") },
    { label: "Find a person", icon: Users, to: "/admin/people", show: can("users") },
    { label: "Support desk", icon: LifeBuoy, to: "/admin/support", show: isSuperAdmin || can("support") || can("finance") },
    { label: "Marketplace moderation", icon: Store, to: "/admin/marketplace", show: isSuperAdmin || can("marketplace") || can("approveListings") },
    { label: "Security center", icon: ShieldAlert, to: "/admin/security", show: can("security") },
  ].filter((item) => item.show);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={today}
        title={`${greeting()}, ${firstName}`}
        description={
          totalAttention > 0
            ? `${num(totalAttention)} item${totalAttention === 1 ? "" : "s"} across the platform need your attention.`
            : "Everything on the platform is in good order."
        }
        actions={
          can("onboarding") && (
            <>
              <Link to="/admin/requests" className={adminBtn.secondary}>
                Review requests
                {stats?.pendingRequests > 0 && (
                  <span className="rounded-full bg-amber-500/15 px-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                    {stats.pendingRequests}
                  </span>
                )}
              </Link>
              <Link to="/admin/create" className={adminBtn.primary}>
                <PlusCircle size={16} />
                Create workspace
              </Link>
            </>
          )
        }
      />

      {/* Needs attention */}
      {attention.length > 0 && (
        <section aria-label="Needs attention" className="grid gap-4 md:grid-cols-3">
          {attention.map((item) => {
            const Icon = item.icon;
            const t = TONES[item.value > 0 ? item.tone : "emerald"];
            return (
              <Link
                key={item.label}
                to={item.to}
                className={clsx(
                  panelSurface,
                  "group relative overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                )}
              >
                <span className={clsx("absolute inset-y-0 left-0 w-1", t.edge)} />
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{item.label}</p>
                    <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-950 dark:text-white">
                      {num(item.value)}
                    </p>
                  </div>
                  <span className={clsx("flex h-9 w-9 items-center justify-center rounded-lg", t.chip)}>
                    {item.value > 0 ? <Icon size={18} /> : <CheckCircle2 size={18} />}
                  </span>
                </div>
                <p className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  {item.value > 0 ? item.hint : "All clear"}
                  <ArrowRight size={14} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-500" />
                </p>
              </Link>
            );
          })}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Platform pulse */}
        <Panel
          title="Platform pulse"
          description="Money and activity processed across every workspace"
          className="lg:col-span-2"
        >
          {exec ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Money processed</p>
                  <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-slate-950 dark:text-white">
                    {kes(exec.moneyProcessed)}
                  </p>
                </div>
                <div className="w-full sm:w-56">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-slate-500 dark:text-slate-400">
                      <BadgeCheck size={14} className="text-emerald-500" />
                      Verified transactions
                    </span>
                    <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                      {verified != null ? `${verified}%` : "—"}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.min(Math.max(verified ?? 0, 0), 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-100 bg-slate-100 dark:border-slate-800 dark:bg-slate-800 sm:grid-cols-4">
                {[
                  { label: "Transactions", value: num(exec.transactions), icon: Receipt },
                  { label: "Members", value: num(exec.members), icon: Users },
                  { label: "Groups", value: num(exec.groups), icon: Building2 },
                  { label: "Pending approvals", value: num(exec.pendingApprovals), icon: Clock },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-white p-4 dark:bg-slate-900">
                    <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <Icon size={13} />
                      {label}
                    </dt>
                    <dd className="mt-1.5 text-xl font-semibold tabular-nums text-slate-950 dark:text-white">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Banknote size={22} className="text-slate-300" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Executive metrics are unavailable</p>
              <p className="max-w-sm text-xs text-slate-500">
                Your account may not include financial reporting, or the service didn&apos;t respond. Directory and queue
                data below is unaffected.
              </p>
            </div>
          )}
        </Panel>

        {/* Quick actions */}
        <Panel title="Quick actions" description="Jump straight into common work">
          <div className="-m-1.5 grid gap-1">
            {quickActions.map(({ label, icon: Icon, to }) => (
              <Link
                key={to}
                to={to}
                className="group flex items-center gap-3 rounded-lg p-2.5 text-[13px] font-medium text-slate-700 transition hover:bg-violet-500/10 hover:text-violet-700 dark:text-slate-200 dark:hover:text-violet-200"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-violet-500/15 group-hover:text-violet-600 dark:bg-slate-800 dark:text-slate-400">
                  <Icon size={16} />
                </span>
                {label}
                <ArrowRight size={14} className="ml-auto text-slate-300 opacity-0 transition group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Composition */}
        <Panel
          title="Platform footprint"
          description={`${num(workspaceTotal)} workspaces · ${num(stats?.totalUsers)} registered users`}
          className="lg:col-span-2"
        >
          <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            {workspaceTotal > 0 &&
              composition.map((item) => (
                <div
                  key={item.label}
                  className={TONES[item.tone].bar}
                  style={{ width: `${(item.value / workspaceTotal) * 100}%` }}
                  title={`${item.label}: ${item.value}`}
                />
              ))}
          </div>

          <ul className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">
            {composition.map(({ label, value, icon: Icon, tone, to }) => (
              <li key={label}>
                <Link to={to} className="flex items-center gap-3 py-3 text-[13px] transition hover:text-violet-600 dark:hover:text-violet-300">
                  <span className={clsx("h-2 w-2 rounded-full", TONES[tone].bar)} />
                  <Icon size={15} className="text-slate-400" />
                  <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
                  <span className="ml-auto font-semibold tabular-nums text-slate-950 dark:text-white">{num(value)}</span>
                </Link>
              </li>
            ))}
            {can("users") && (
              <li>
                <Link to="/admin/people" className="flex items-center gap-3 py-3 text-[13px] transition hover:text-violet-600 dark:hover:text-violet-300">
                  <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                  <Users size={15} className="text-slate-400" />
                  <span className="font-medium text-slate-700 dark:text-slate-200">Registered users</span>
                  <span className="ml-auto font-semibold tabular-nums text-slate-950 dark:text-white">{num(stats?.totalUsers)}</span>
                </Link>
              </li>
            )}
            {isSuperAdmin && (
              <li>
                <Link to="/admin/sub-admins" className="flex items-center gap-3 py-3 text-[13px] transition hover:text-violet-600 dark:hover:text-violet-300">
                  <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                  <UserCheck size={15} className="text-slate-400" />
                  <span className="font-medium text-slate-700 dark:text-slate-200">Active sub-admins</span>
                  <span className="ml-auto font-semibold tabular-nums text-slate-950 dark:text-white">{num(stats?.totalSubAdmins)}</span>
                </Link>
              </li>
            )}
          </ul>
        </Panel>

        {/* Approval queue */}
        <Panel
          title="Approval queue"
          description="Newest workspace creation requests"
          className="lg:col-span-3"
          flush
          action={can("onboarding") ? <PanelLink to="/admin/requests">View all</PanelLink> : null}
        >
          {requests.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 size={22} />
              </span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Queue is clear</p>
              <p className="text-xs text-slate-500">Every workspace request has been reviewed.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {requests.map((req) => {
                const age = timeAgo(req.createdAt);
                return (
                  <li key={req._id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">{req.name}</p>
                        <Pill tone="violet">{req.entityType}</Pill>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                        {req.chairperson?.name || "Chairperson not specified"} ·{" "}
                        {req.committeeMembers?.length || 0} committee member
                        {(req.committeeMembers?.length || 0) === 1 ? "" : "s"}
                        {age ? ` · ${age}` : ""}
                      </p>
                    </div>
                    <Link to="/admin/requests" className={clsx(adminBtn.secondary, "!px-3 !py-1.5")}>
                      Review
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
