import { useMemo, useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Building2,
  Wallet,
  Store,
  UserPlus,
  Mail,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  AlertCircle,
  RotateCcw,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import useAuth from "@/app/hooks/useAuth";
import useWorkspace from "@/app/hooks/useWorkspace";
import {
  useMyInvitations,
  useAcceptInvitation,
} from "@/modules/invitations/hooks/useInvitations";
import InvitationCard from "@/modules/invitations/components/InvitationCard";
import Spinner from "@/shared/components/ui/Spinner";
import workspaceRequestService from "@/app/services/workspaceRequest.service";
import WorkspaceRequestModal from "@/modules/workspaces/components/WorkspaceRequestModal";

/* ============================================================
   HOME PAGE — onboarding entry point ONLY.

   This route exists for exactly one situation: a user who is
   authenticated but doesn't belong to any workspace yet (a
   brand-new registration, or an account that left/was removed
   from its last one). The instant that stops being true, this
   component redirects away and never shows itself again — a
   returning user with workspaces should land straight in their
   workspace, not back on a "homepage" like most multi-workspace
   apps do. The persistent, in-shell equivalent for someone who
   already has workspaces is /workspaces (see
   modules/workspaces/pages/WorkspacesPage.jsx), reachable any
   time from the WorkspaceSwitcher — nobody should need to come
   back here once they're set up.
============================================================ */

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

  const [myRequests, setMyRequests] = useState([]);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestModalType, setRequestModalType] = useState("chama");

  const isAdmin = user?.systemRole === "super_admin" || user?.systemRole === "sub_admin";

  async function loadMyRequests() {
    try {
      const res = await workspaceRequestService.getMyRequests();
      setMyRequests(res);
    } catch {
      // Soft fail
    }
  }

  useEffect(() => {
    loadMyRequests();
  }, []);

  /* ==========================================================
     RESOLVER — the moment workspaces are known and there's at
     least one, this page's job is done; hand off to it (the
     previously active one if we have it, otherwise the first)
     instead of ever rendering the onboarding UI below.
  ========================================================== */

  if (loading) {
    return <Spinner fullscreen />;
  }

  if (workspaces.length > 0) {
    const target = activeWorkspace || workspaces[0];
    const targetId = target?.id ?? target?._id;
    const targetType = String(target?.type || "").toLowerCase();

    const path =
      targetType === "business"
        ? `/workspace/${targetId}/business`
        : `/workspace/${targetId}`;

    return <Navigate to={path} replace />;
  }

  /* ==========================================================
     INVITATION
  ========================================================== */

  async function handleAccept(invitation) {
    await acceptInvitation.mutateAsync(invitation._id);
  }

  return (
    <div className="relative">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-violet-200/30 blur-[120px] dark:bg-violet-700/10" />
        <div className="absolute right-[-200px] top-[20%] h-[500px] w-[500px] rounded-full bg-blue-200/30 blur-[120px] dark:bg-blue-700/10" />
        <div className="absolute bottom-0 left-[30%] h-[400px] w-[400px] rounded-full bg-emerald-200/20 blur-[120px] dark:bg-emerald-700/10" />
      </div>

      <div className="mx-auto w-full max-w-3xl">
        {/* ==================================================
            ADMIN CONSOLE BANNER (IF ADMIN)
        ================================================== */}
        {isAdmin && (
          <div className="mb-8 overflow-hidden rounded-[28px] bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-950 p-6 text-white shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                  <ShieldCheck size={24} className="text-violet-300" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-violet-200">
                    {user?.systemRole === "super_admin" ? "Super Admin" : "Sub-Admin"}
                  </div>
                  <h3 className="text-base font-black mt-1">Admin Management Portal</h3>
                  <p className="text-xs text-violet-200/80">Review workspace creation requests & manage entities.</p>
                </div>
              </div>

              <Link
                to="/admin"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-black text-slate-950 shadow transition hover:bg-violet-50"
              >
                Open Admin Panel
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}

        {/* ==================================================
            GREETING
        ================================================== */}

        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-8 overflow-hidden rounded-[28px] border border-violet-100 bg-gradient-to-br from-white via-violet-50/70 to-blue-50/70 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-violet-950/20 dark:to-blue-950/20 sm:p-10"
        >
          <div className="absolute right-[-80px] top-[-120px] h-72 w-72 rounded-full bg-violet-300/30 blur-3xl dark:bg-violet-500/10" />

          <div className="relative">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-violet-600 shadow-sm backdrop-blur-sm dark:border-violet-500/20 dark:bg-slate-900/60 dark:text-violet-300">
              <Sparkles size={13} />
              <span>Welcome</span>
            </div>

            <h2 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
              Hey,{" "}
              <span className="bg-gradient-to-r from-violet-600 via-blue-600 to-emerald-500 bg-clip-text text-transparent">
                {firstName}
              </span>
              . Let's get you set up.
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-500 dark:text-slate-400 sm:text-base">
              {isAdmin
                ? "Manage platform workspaces, or create a new Chama, Business, or Contribution Group."
                : "Request a new verified workspace for your committee, or join an existing community workspace."}
            </p>
          </div>
        </motion.section>

        {/* ==================================================
            CREATE / REQUEST WORKSPACE OPTIONS
        ================================================== */}

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          {isAdmin ? (
            <>
              <CreateOption
                to="/admin/create"
                icon={Building2}
                title="Create a Chama"
                description="Members, treasury & rotational payouts"
                color="violet"
              />
              <CreateOption
                to="/admin/create"
                icon={Wallet}
                title="Create a Contribution Group"
                description="Structured savings & collections"
                color="emerald"
              />
              <CreateOption
                to="/admin/create"
                icon={Store}
                title="Create a Business"
                description="Sales, inventory & operational ledger"
                color="blue"
              />
            </>
          ) : (
            <>
              <CreateOption
                onClick={() => {
                  setRequestModalType("chama");
                  setRequestModalOpen(true);
                }}
                icon={Building2}
                title="Request a Chama"
                description="Submit committee contacts to set up your Chama"
                color="violet"
              />
              <CreateOption
                onClick={() => {
                  setRequestModalType("contribution_group");
                  setRequestModalOpen(true);
                }}
                icon={Wallet}
                title="Request a Group"
                description="Welfare, fundraisers & rotational pools"
                color="emerald"
              />
              <CreateOption
                onClick={() => {
                  setRequestModalType("business");
                  setRequestModalOpen(true);
                }}
                icon={Store}
                title="Request a Business"
                description="Sales, inventory & POS workspace"
                color="blue"
              />
            </>
          )}
        </section>

        {/* ==================================================
            MY PENDING WORKSPACE REQUESTS (IF ANY)
        ================================================== */}
        {myRequests.length > 0 && (
          <section className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 space-y-3">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-violet-600" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Your Workspace Creation Requests
              </h3>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {myRequests.map((req) => {
                const status = String(req.status || "").toUpperCase();
                const isPending = status === "PENDING" || status === "UNDER_REVIEW";
                const isApproved = status === "APPROVED";
                const isRejected = status === "REJECTED";

                return (
                  <div key={req._id} className="py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black text-slate-900 dark:text-white">
                          {req.name} ({req.entityType})
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Submitted: {new Date(req.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                          isPending
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            : isApproved
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>

                    {isApproved && (
                      <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-2.5 text-[11px] text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                        <span>
                          Fully created! You can{" "}
                          <Link to="/login" className="font-bold underline">
                            log in
                          </Link>{" "}
                          now to start using it.
                        </span>
                      </div>
                    )}

                    {isRejected && req.rejectionReason && (
                      <div className="flex items-start gap-2 rounded-xl bg-red-50 p-2.5 text-[11px] text-red-800 dark:bg-red-950/40 dark:text-red-300">
                        <XCircle size={14} className="mt-0.5 shrink-0" />
                        <span>Reason: {req.rejectionReason}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="mb-8">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 p-6 text-white shadow-xl sm:p-7">
            <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black">Have a Chama invitation code?</h3>
                  <p className="mt-1 text-xs text-slate-400">Join an existing community workspace.</p>
                </div>
              </div>

              <Link
                to="/chamas/join"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-violet-50 sm:w-auto"
              >
                Join Chama
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>

        {/* ==================================================
            INVITATIONS — a new user's other on-ramp: someone
            already invited them, so they don't need to create
            anything at all.
        ================================================== */}

        <section className="mb-4 rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-500 dark:bg-orange-500/10">
                <Mail size={18} />
              </div>
              <div>
                <h3 className="text-base font-black">Invitations</h3>
                <p className="text-xs text-slate-400">Workspace invitations waiting for you</p>
              </div>
              {invitations.length > 0 && (
                <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-black text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
                  {invitations.length}
                </span>
              )}
            </div>

            <Link to="/invitations" className="flex items-center gap-1 text-sm font-bold text-violet-600 dark:text-violet-400">
              View All
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="p-5">
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
                <button
                  type="button"
                  onClick={() => refetchInvitations()}
                  className="font-bold"
                  aria-label="Retry loading invitations"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            )}

            {!invitationsLoading && !invitationsError && invitations.length === 0 && (
              <div className="py-7 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 dark:bg-slate-800">
                  <Mail size={18} />
                </div>
                <p className="mt-3 text-sm font-bold">You're all caught up</p>
                <p className="mt-1 text-xs text-slate-400">No pending workspace invitations.</p>
              </div>
            )}

            {!invitationsLoading && !invitationsError && invitations.length > 0 && (
              <div className="space-y-3">
                {invitations.slice(0, 5).map((invitation) => (
                  <InvitationCard
                    key={invitation._id}
                    invitation={invitation}
                    accepting={
                      acceptInvitation.isPending && acceptInvitation.variables === invitation._id
                    }
                    onAccept={handleAccept}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

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
   CREATE / REQUEST OPTION
============================================================ */

function CreateOption({ to, onClick, icon: Icon, title, description, color }) {
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
        className="group w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/70 text-left"
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      to={to}
      className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/70"
    >
      {content}
    </Link>
  );
}
