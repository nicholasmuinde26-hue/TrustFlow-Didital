import { useMemo, useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Building2,
  Wallet,
  Store,
  UserPlus,
  Mail,
  ArrowRight,
  ArrowUpRight,
  AlertCircle,
  RotateCcw,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Circle,
  Inbox,
  Layers,
  Users,
  MessageSquare,
} from "lucide-react";

import useAuth from "@/app/hooks/useAuth";
import useWorkspace from "@/app/hooks/useWorkspace";
import {
  useMyInvitations,
  useAcceptInvitation,
} from "@/modules/invitations/hooks/useInvitations";
import InvitationCard from "@/modules/invitations/components/InvitationCard";
import Spinner from "@/shared/components/ui/Spinner";
import BrandMark from "@/shared/components/layout/BrandMark";
import workspaceRequestService from "@/app/services/workspaceRequest.service";
import adminService from "@/modules/admin/services/admin.service";
import WorkspaceRequestModal from "@/modules/workspaces/components/WorkspaceRequestModal";

/* ============================================================
   HOME PAGE — one page, four audiences.

   The page works out who is looking at it and only renders what
   that person can act on:

   - admin    super_admin / sub_admin. Gets the console, the live
              request queue and direct "create" shortcuts. Never
              sees "request a workspace" (they approve those) or the
              "join with a code" prompt.
   - invited  has a pending invitation. Invitations lead the page;
              the create options drop to a quiet secondary row.
   - pending  has submitted a workspace request. The request tracker
              leads; creating more is secondary.
   - new      nothing yet. A three-step setup guide plus the three
              ways in (request, join by code, wait for an invite).

   Panels with nothing in them (no invitations, no requests) are
   not rendered at all rather than showing an "all caught up" box.

   Someone who is NOT an admin and already belongs to a workspace
   is still handed straight to it (unchanged behaviour); admins are
   not redirected so they can reach the console from here.
============================================================ */

const REQUEST_OPTIONS = [
  { type: "chama", icon: Building2, title: "Request a Chama", description: "Members, treasury & rotational payouts", color: "violet" },
  { type: "contribution_group", icon: Wallet, title: "Request a Group", description: "Welfare, fundraisers & collections", color: "emerald" },
  { type: "business", icon: Store, title: "Request a Business", description: "Sales, inventory & POS", color: "blue" },
];

function isOpen(status) {
  const s = String(status || "").toUpperCase();
  return s === "PENDING" || s === "UNDER_REVIEW";
}

export default function HomePage() {
  const { user } = useAuth();
  const { workspaces = [], loading, activeWorkspace } = useWorkspace();

  const {
    data: invitations = [],
    isLoading: invitationsLoading,
    isError: invitationsError,
    refetch: refetchInvitations,
  } = useMyInvitations("pending");

  const acceptInvitation = useAcceptInvitation();

  const firstName = useMemo(() => user?.name?.split(" ")[0] || "there", [user]);

  const isSuperAdmin = user?.systemRole === "super_admin";
  const isAdmin = isSuperAdmin || user?.systemRole === "sub_admin";

  const [myRequests, setMyRequests] = useState([]);
  const [requestsLoaded, setRequestsLoaded] = useState(false);
  const [adminStats, setAdminStats] = useState(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestModalType, setRequestModalType] = useState("chama");

  async function loadMyRequests() {
    try {
      setMyRequests(await workspaceRequestService.getMyRequests());
    } catch {
      // Soft fail — the page simply omits the tracker.
    } finally {
      setRequestsLoaded(true);
    }
  }

  useEffect(() => {
    if (!isAdmin) loadMyRequests();
    else setRequestsLoaded(true);
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    Promise.all([
      adminService.getOverview().catch(() => null),
      adminService.getWorkspaceRequests("pending").catch(() => []),
    ]).then(([overview, pending]) => {
      if (!cancelled) setAdminStats({ overview, pendingList: pending || [] });
    });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (loading) {
    return <Spinner fullscreen />;
  }

  // Members who already belong somewhere go straight to their workspace.
  if (!isAdmin && workspaces.length > 0) {
    const target = activeWorkspace || workspaces[0];
    const targetId = target?.id ?? target?._id;
    const targetType = String(target?.type || "").toLowerCase();
    return (
      <Navigate
        to={targetType === "business" ? `/workspace/${targetId}/business` : `/workspace/${targetId}`}
        replace
      />
    );
  }

  const openRequests = myRequests.filter((r) => isOpen(r.status));
  const persona = isAdmin
    ? "admin"
    : invitations.length > 0
    ? "invited"
    : openRequests.length > 0
    ? "pending"
    : "new";

  function openRequest(type) {
    setRequestModalType(type);
    setRequestModalOpen(true);
  }

  async function handleAccept(invitation) {
    await acceptInvitation.mutateAsync(invitation._id);
  }

  const showInvitations = invitationsLoading || invitationsError || invitations.length > 0;
  const showRequests = myRequests.length > 0;

  return (
    <div className="relative mx-auto w-full max-w-5xl pb-6">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-emerald-200/30 blur-[120px] dark:bg-emerald-500/10" />
        <div className="absolute right-[-200px] top-[25%] h-[480px] w-[480px] rounded-full bg-sky-200/30 blur-[120px] dark:bg-sky-500/10" />
      </div>

      <HomeHero
        persona={persona}
        firstName={firstName}
        isSuperAdmin={isSuperAdmin}
        invitationCount={invitations.length}
        pendingCount={openRequests.length}
        adminPending={adminStats?.overview?.pendingRequests ?? adminStats?.pendingList?.length ?? null}
      />

      {persona === "new" && <SetupSteps />}

      {persona === "admin" && (
        <AdminPanel stats={adminStats} workspaces={workspaces} />
      )}

      {/* Invitations lead for invited users; otherwise only show if there is something to show. */}
      {!isAdmin && showInvitations && (
        <Panel
          icon={Mail}
          tone="orange"
          title="Invitations"
          subtitle="Workspaces that have invited you"
          count={invitations.length}
          action={{ to: "/invitations", label: "View all" }}
        >
          {invitationsLoading && (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          )}
          {invitationsError && (
            <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              <span className="flex items-center gap-2">
                <AlertCircle size={16} />
                Unable to load invitations.
              </span>
              <button type="button" onClick={() => refetchInvitations()} className="font-bold" aria-label="Retry loading invitations">
                <RotateCcw size={14} />
              </button>
            </div>
          )}
          {!invitationsLoading && !invitationsError && invitations.length > 0 && (
            <div className="space-y-3">
              {invitations.slice(0, 5).map((invitation) => (
                <InvitationCard
                  key={invitation._id}
                  invitation={invitation}
                  accepting={acceptInvitation.isPending && acceptInvitation.variables === invitation._id}
                  onAccept={handleAccept}
                />
              ))}
            </div>
          )}
        </Panel>
      )}

      {!isAdmin && showRequests && (
        <Panel icon={Clock} tone="violet" title="Your workspace requests" subtitle="We review each request before it goes live">
          <RequestList requests={myRequests} />
        </Panel>
      )}

      {/* Create / request options */}
      <section className="mb-6">
        <div className="mb-3 flex items-end justify-between">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isAdmin ? "Create a workspace" : persona === "new" ? "Start your own" : "Need another workspace?"}
          </h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {REQUEST_OPTIONS.map((o) =>
            isAdmin ? (
              <CreateOption
                key={o.type}
                to="/admin/create"
                icon={o.icon}
                title={o.title.replace("Request", "Create")}
                description={o.description}
                color={o.color}
              />
            ) : (
              <CreateOption
                key={o.type}
                onClick={() => openRequest(o.type)}
                icon={o.icon}
                title={o.title}
                description={o.description}
                color={o.color}
                compact={persona === "invited" || persona === "pending"}
              />
            )
          )}
        </div>
      </section>

      {/* Join by code — irrelevant to admins */}
      {!isAdmin && (
        <section className="mb-6">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-obsidian via-obsidian-card to-obsidian p-5 text-white shadow-xl sm:p-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mint/15 text-mint">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black">Have a chama invitation code?</h3>
                  <p className="mt-0.5 text-xs text-mist-muted">Join an existing community workspace in a minute.</p>
                </div>
              </div>
              <Link
                to="/chamas/join"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-mint px-5 py-3 text-sm font-black text-obsidian! transition hover:bg-mint-hover sm:w-auto"
              >
                Join with a code
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {persona === "new" && !showInvitations && requestsLoaded && (
        <p className="flex items-center justify-center gap-2 pb-4 text-xs text-slate-400">
          <Inbox size={14} />
          If someone invites you to a workspace, it will appear here.
        </p>
      )}

      <WorkspaceRequestModal
        isOpen={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        initialType={requestModalType}
        onSuccess={loadMyRequests}
      />
    </div>
  );
}

/* ============================================================
   HERO — copy and call-to-action change with the persona.
============================================================ */

function HomeHero({ persona, firstName, isSuperAdmin, invitationCount, pendingCount, adminPending }) {
  const copy = {
    admin: {
      eyebrow: isSuperAdmin ? "Super admin" : "Sub-admin",
      title: "Platform console",
      text:
        adminPending > 0
          ? `${adminPending} workspace ${adminPending === 1 ? "request is" : "requests are"} waiting for your review.`
          : "Review workspace requests, manage entities and support members.",
      cta: { to: "/admin", label: "Open admin panel" },
    },
    invited: {
      eyebrow: "You have been invited",
      title: "A workspace is waiting for you",
      text: `You have ${invitationCount} pending ${invitationCount === 1 ? "invitation" : "invitations"}. Accept one to get started.`,
      cta: { href: "#", label: null },
    },
    pending: {
      eyebrow: "Request received",
      title: "We are reviewing your workspace",
      text: `${pendingCount} ${pendingCount === 1 ? "request is" : "requests are"} with our team. You will be notified as soon as it is approved.`,
      cta: null,
    },
    new: {
      eyebrow: "Welcome to VeriCircle",
      title: "Let's get you set up",
      text: "Request a verified workspace for your group, or join one you were invited to.",
      cta: null,
    },
  }[persona];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mb-6 overflow-hidden rounded-[28px] bg-obsidian p-6 text-white shadow-xl sm:p-9"
    >
      <div
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_85%_0%,rgba(110,224,182,0.22),transparent_55%)]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full border border-mint/20 bg-mint/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-mint">
            {persona === "admin" ? <ShieldCheck size={13} /> : <BrandMark size={14} tile={false} title="" />}
            {copy.eyebrow}
          </span>
          <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl">
            {persona === "admin" || persona === "new" ? (
              <>
                {persona === "new" ? `Hey ${firstName}. ` : `Hi ${firstName}, `}
                <span className="bg-gradient-to-r from-mint to-sky-300 bg-clip-text text-transparent">
                  {copy.title.charAt(0).toLowerCase() + copy.title.slice(1)}
                </span>
              </>
            ) : (
              copy.title
            )}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-mist-muted sm:text-base">{copy.text}</p>
        </div>

        {copy.cta?.to && (
          <Link
            to={copy.cta.to}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-mint px-5 py-3 text-sm font-black text-obsidian! transition hover:bg-mint-hover"
          >
            {copy.cta.label}
            <ArrowRight size={15} />
          </Link>
        )}
      </div>
    </motion.section>
  );
}

/* ============================================================
   SETUP STEPS — only for someone with nothing yet.
============================================================ */

function SetupSteps() {
  const steps = [
    { title: "Account created", text: "You're signed in and verified.", done: true },
    { title: "Request or join a workspace", text: "Pick an option below." },
    { title: "Start running it", text: "Invite members and collect." },
  ];
  return (
    <ol className="mb-6 grid gap-3 sm:grid-cols-3">
      {steps.map((s, i) => (
        <li
          key={s.title}
          className={`flex items-start gap-3 rounded-2xl border p-4 ${
            s.done
              ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10"
              : "border-slate-200 bg-white dark:border-obsidian-border dark:bg-obsidian-card"
          }`}
        >
          {s.done ? (
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
          ) : (
            <Circle size={20} className="mt-0.5 shrink-0 text-slate-300" />
          )}
          <div>
            <p className="text-sm font-black text-slate-900 dark:text-white">
              {i + 1}. {s.title}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ============================================================
   ADMIN PANEL — live queue + shortcuts + the admin's own workspaces.
============================================================ */

function AdminPanel({ stats, workspaces }) {
  const overview = stats?.overview || {};
  const pending = stats?.pendingList || [];

  const tiles = [
    { label: "Pending requests", value: overview.pendingRequests ?? pending.length, to: "/admin/requests", icon: Clock },
    { label: "Chamas", value: overview.totalChamas, to: "/admin/directory?tab=chamas", icon: Building2 },
    { label: "Inquiries", to: "/admin/inquiries", icon: MessageSquare },
    { label: "People", to: "/admin/people", icon: Users },
  ];

  return (
    <>
      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ label, value, to, icon: Icon }) => (
          <Link
            key={label}
            to={to}
            className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-obsidian-border dark:bg-obsidian-card"
          >
            <div className="flex items-center justify-between text-slate-400">
              <Icon size={18} />
              <ArrowUpRight size={14} className="transition group-hover:text-emerald-500" />
            </div>
            <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">{value ?? "—"}</p>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
          </Link>
        ))}
      </section>

      {pending.length > 0 && (
        <Panel
          icon={Clock}
          tone="amber"
          title="Awaiting review"
          subtitle="Newest workspace requests"
          count={pending.length}
          action={{ to: "/admin/requests", label: "Review all" }}
        >
          <ul className="divide-y divide-slate-100 dark:divide-obsidian-border">
            {pending.slice(0, 4).map((r) => (
              <li key={r._id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-900 dark:text-white">{r.name}</p>
                  <p className="text-[11px] capitalize text-slate-500">
                    {String(r.entityType || "").replace(/_/g, " ")} · {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Link to="/admin/requests" className="shrink-0 text-xs font-bold text-emerald-600! hover:underline">
                  Review
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {workspaces.length > 0 && (
        <Panel
          icon={Layers}
          tone="sky"
          title="Your workspaces"
          subtitle="Workspaces you belong to"
          action={{ to: "/workspaces", label: "Open hub" }}
        >
          <ul className="grid gap-2 sm:grid-cols-2">
            {workspaces.slice(0, 4).map((w) => {
              const id = w.id ?? w._id;
              const isBiz = String(w.type || "").toLowerCase() === "business";
              return (
                <li key={id}>
                  <Link
                    to={isBiz ? `/workspace/${id}/business` : `/workspace/${id}`}
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800! transition hover:bg-slate-50 dark:border-obsidian-border dark:text-white! dark:hover:bg-obsidian-raised"
                  >
                    <span className="truncate">{w.name || "Unnamed workspace"}</span>
                    <ArrowUpRight size={14} className="shrink-0 text-slate-400" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </>
  );
}

/* ============================================================
   SHARED PANEL + REQUEST LIST
============================================================ */

const TONES = {
  orange: "bg-orange-50 text-orange-500 dark:bg-orange-500/10",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/10",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10",
  sky: "bg-sky-50 text-sky-600 dark:bg-sky-500/10",
};

function Panel({ icon: Icon, tone, title, subtitle, count, action, children }) {
  return (
    <section className="mb-6 rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-obsidian-border dark:bg-obsidian-card">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-obsidian-border sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>
            <Icon size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-black text-slate-900 dark:text-white">{title}</h3>
            {subtitle && <p className="truncate text-xs text-slate-400">{subtitle}</p>}
          </div>
          {count > 0 && (
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-600 dark:bg-obsidian-raised dark:text-mist">
              {count}
            </span>
          )}
        </div>
        {action && (
          <Link to={action.to} className="flex shrink-0 items-center gap-1 text-sm font-bold text-emerald-600! dark:text-mint!">
            {action.label}
            <ArrowUpRight size={14} />
          </Link>
        )}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function RequestList({ requests }) {
  return (
    <div className="divide-y divide-slate-100 dark:divide-obsidian-border">
      {requests.map((req) => {
        const status = String(req.status || "").toUpperCase();
        const pending = isOpen(status);
        const approved = status === "APPROVED";
        const rejected = status === "REJECTED";
        return (
          <div key={req._id} className="space-y-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900 dark:text-white">
                  {req.name} <span className="font-medium text-slate-400">({String(req.entityType || "").replace(/_/g, " ")})</span>
                </p>
                <p className="text-[11px] text-slate-500">Submitted {new Date(req.createdAt).toLocaleDateString()}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                  pending
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    : approved
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                }`}
              >
                {req.status}
              </span>
            </div>
            {approved && (
              <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-2.5 text-[11px] text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                <span>
                  Approved and created.{" "}
                  <Link to="/workspaces" className="font-bold underline">
                    Open your workspaces
                  </Link>
                  .
                </span>
              </div>
            )}
            {rejected && req.rejectionReason && (
              <div className="flex items-start gap-2 rounded-xl bg-red-50 p-2.5 text-[11px] text-red-800 dark:bg-red-950/40 dark:text-red-300">
                <XCircle size={14} className="mt-0.5 shrink-0" />
                <span>Reason: {req.rejectionReason}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   CREATE / REQUEST OPTION
============================================================ */

function CreateOption({ to, onClick, icon: Icon, title, description, color, compact = false }) {
  const styles = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  };

  const content = (
    <>
      <div className="flex items-start justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${styles[color]}`}>
          <Icon size={20} />
        </div>
        <ArrowUpRight
          size={16}
          className="text-slate-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-violet-500"
        />
      </div>

      <h3 className="mt-4 text-sm font-black text-left">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-400 text-left">{description}</p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`group w-full rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-obsidian-border dark:bg-obsidian-card text-left ${compact ? "p-4" : "p-5"}`}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      to={to}
      className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-obsidian-border dark:bg-obsidian-card"
    >
      {content}
    </Link>
  );
}
