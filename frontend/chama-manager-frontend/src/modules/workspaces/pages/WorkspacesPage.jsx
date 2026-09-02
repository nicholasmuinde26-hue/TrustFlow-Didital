import React, { useMemo, useState } from "react";

import { Link, useNavigate } from "react-router-dom";

import { motion, AnimatePresence } from "framer-motion";

import {
  Building2,
  Wallet,
  Store,
  Plus,
  Mail,
  AlertCircle,
  RotateCcw,
  ArrowUpRight,
  UserPlus,
  Search,
  ArrowRight,
  Clock3,
  Layers3,
} from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";

import {
  useMyInvitations,
  useAcceptInvitation,
} from "@/modules/invitations/hooks/useInvitations";

import InvitationCard from "@/modules/invitations/components/InvitationCard";
import Spinner from "@/shared/components/ui/Spinner";

/* ============================================================
   TYPE META — single source of truth for how each workspace
   type is labeled, iconed and colored. Shared by the filter
   tabs, the workspace rows and the mobile bottom bar so a
   Chama is the same shade of violet everywhere on this page.
============================================================ */

const TYPE_META = {
  chama: {
    icon: Building2,
    label: "Chama",
    createTo: "/chamas/new",
    iconBg:
      "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/70 dark:text-violet-300 dark:border-violet-800",
    badge:
      "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800",
  },

  contribution: {
    icon: Wallet,
    label: "Groups",
    createTo: "/contribution-groups/new",
    iconBg:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800",
    badge:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  },

  business: {
    icon: Store,
    label: "Business",
    createTo: "/business/new",
    iconBg:
      "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800",
    badge:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  },
};

/* ============================================================
   HELPERS
============================================================ */

function normalizeWorkspaceType(type) {
  const normalized = String(type || "")
    .trim()
    .toLowerCase();

  if (
    normalized === "contribution" ||
    normalized === "contribution_group" ||
    normalized === "contribution-group"
  ) {
    return "contribution";
  }

  if (normalized === "business") {
    return "business";
  }

  return "chama";
}

function getTypeMeta(type) {
  return TYPE_META[normalizeWorkspaceType(type)] || TYPE_META.chama;
}

function formatRole(role) {
  if (!role) return "Member";

  return String(role)
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getWorkspaceId(workspace) {
  return workspace?.id ?? workspace?._id;
}

function getMemberCount(workspace) {
  const value =
    workspace?.memberCount ??
    workspace?.membersCount ??
    workspace?.totalMembers ??
    (Array.isArray(workspace?.members) ? workspace.members.length : null);

  return typeof value === "number" ? value : null;
}

function getTreasury(workspace) {
  const value =
    workspace?.treasuryBalance ??
    workspace?.balance ??
    workspace?.totalBalance ??
    workspace?.treasury?.balance ??
    workspace?.treasury ??
    null;

  return typeof value === "number" ? value : null;
}

function getMonthlySales(workspace) {
  const value =
    workspace?.monthlySales ??
    workspace?.salesThisMonth ??
    workspace?.monthlyRevenue ??
    workspace?.sales ??
    null;

  return typeof value === "number" ? value : null;
}

function getContributionAmount(workspace) {
  const value =
    workspace?.contributionAmount ??
    workspace?.monthlyContribution ??
    workspace?.contributionPlan?.amount ??
    workspace?.contribution?.amount ??
    null;

  return typeof value === "number" ? value : null;
}

function getNextPayout(workspace) {
  return (
    workspace?.nextPayout ??
    workspace?.nextPayoutDate ??
    workspace?.payoutDate ??
    workspace?.payout?.date ??
    null
  );
}

function formatCurrency(value) {
  if (value === undefined || value === null || value === "") {
    return "—";
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return String(value);
  }

  return `KES ${numericValue.toLocaleString("en-KE", {
    maximumFractionDigits: 2,
  })}`;
}

function formatPayout(value) {
  if (!value) {
    return "Not scheduled";
  }

  if (typeof value === "number") {
    return `in ${value} ${value === 1 ? "day" : "days"}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const today = new Date();

  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const startOfPayout = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const difference = Math.ceil(
    (startOfPayout.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (difference > 0) {
    return `in ${difference} ${difference === 1 ? "day" : "days"}`;
  }

  if (difference === 0) {
    return "Today";
  }

  return "Scheduled";
}

/* ============================================================
   WORKSPACES HUB

   Deliberately narrow in scope: this is the switchboard for
   moving between workspaces the user already belongs to
   (Chama / Groups / Business), responding to invitations, and
   joining a chama by code. Nothing else lives here — creation
   already has a home in the header's WorkspaceSwitcher on
   desktop and in the "+" sheet on the mobile bottom bar below.
============================================================ */

export default function WorkspacesPage() {
  const { workspaces = [], loading, selectWorkspace } = useWorkspace();

  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  /* ==========================================================
     TYPE NAVIGATION — shared by the mobile bottom bar and the
     filter tabs. Tapping the already-active type on the bottom
     bar clears back to "All" instead of doing nothing.
  ========================================================== */

  function goToWorkspaceType(type) {
    setActiveTab((current) => (current === type ? "all" : type));

    const target = document.getElementById("workspaces-section");

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /* ==========================================================
     INVITATIONS
  ========================================================== */

  const {
    data: invitations = [],
    isLoading: invitationsLoading,
    isError: invitationsError,
    refetch: refetchInvitations,
  } = useMyInvitations("pending");

  const acceptInvitation = useAcceptInvitation();

  /* ==========================================================
     COUNTS
  ========================================================== */

  const businessCount = useMemo(
    () =>
      workspaces.filter((workspace) => normalizeWorkspaceType(workspace.type) === "business")
        .length,
    [workspaces]
  );

  const chamaCount = useMemo(
    () =>
      workspaces.filter((workspace) => normalizeWorkspaceType(workspace.type) === "chama")
        .length,
    [workspaces]
  );

  const contributionCount = useMemo(
    () =>
      workspaces.filter(
        (workspace) => normalizeWorkspaceType(workspace.type) === "contribution"
      ).length,
    [workspaces]
  );

  const allCount = workspaces.length;

  /* ==========================================================
     FILTER
  ========================================================== */

  const filteredWorkspaces = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return workspaces.filter((workspace) => {
      const type = normalizeWorkspaceType(workspace.type);

      const searchableText = [
        workspace.name,
        workspace.type,
        workspace.role,
        workspace.category,
        workspace.businessType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);

      const matchesTab = activeTab === "all" ? true : type === activeTab;

      return matchesSearch && matchesTab;
    });
  }, [workspaces, searchQuery, activeTab]);

  /* ==========================================================
     OPEN WORKSPACE
  ========================================================== */

  function openWorkspace(workspace) {
    selectWorkspace(workspace);

    const workspaceId = getWorkspaceId(workspace);

    const type = normalizeWorkspaceType(workspace.type);

    if (type === "business") {
      navigate(`/workspace/${workspaceId}/business`);

      return;
    }

    navigate(`/workspace/${workspaceId}`);
  }

  /* ==========================================================
     INVITATION
  ========================================================== */

  async function handleAccept(invitation) {
    const result = await acceptInvitation.mutateAsync(invitation._id);

    const groupId = result?.group?._id || result?.membership?.contribution_group_id;

    if (groupId) {
      navigate(`/workspace/${groupId}`);
    }
  }

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="pb-24 lg:pb-4">
      <div className="w-full xl:px-6 2xl:px-12">
        {/* ====================================================
            HEADER
        ==================================================== */}

        <header className="mb-6 sm:mb-8">
          <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
            Workspaces
          </h1>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Your chamas, groups and businesses, all in one place.
          </p>

          <div className="relative mt-5 max-w-md">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              placeholder="Search workspaces..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 dark:border-slate-800 dark:bg-slate-900"
            />
          </div>
        </header>

        {/* ====================================================
            WORKSPACES
        ==================================================== */}

        <section id="workspaces-section" className="mb-8 scroll-mt-24 sm:mb-9">
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none sm:mb-4">
            <FilterButton
              active={activeTab === "all"}
              onClick={() => setActiveTab("all")}
              label="All"
              count={allCount}
            />

            <FilterButton
              active={activeTab === "chama"}
              onClick={() => setActiveTab("chama")}
              label="Chama"
              count={chamaCount}
            />

            <FilterButton
              active={activeTab === "contribution"}
              onClick={() => setActiveTab("contribution")}
              label="Groups"
              count={contributionCount}
            />

            <FilterButton
              active={activeTab === "business"}
              onClick={() => setActiveTab("business")}
              label="Business"
              count={businessCount}
            />
          </div>

          {loading ? (
            <LoadingState />
          ) : filteredWorkspaces.length === 0 ? (
            <EmptyState searchQuery={searchQuery} activeTab={activeTab} />
          ) : (
            <div className="space-y-2 sm:space-y-2.5">
              {filteredWorkspaces.map((workspace, index) => (
                <WorkspaceRow
                  key={getWorkspaceId(workspace)}
                  workspace={workspace}
                  index={index}
                  onOpen={() => openWorkspace(workspace)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ====================================================
            INVITATIONS
        ==================================================== */}

        <section className="mb-5 rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70 sm:mb-6">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:p-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500 dark:bg-orange-500/10">
                <Mail size={18} />
              </div>

              <div className="min-w-0">
                <h2 className="text-base font-black">Invitations</h2>

                <p className="truncate text-xs text-slate-400">Waiting for your response</p>
              </div>

              {invitations.length > 0 && (
                <span className="shrink-0 rounded-full bg-orange-100 px-2 py-1 text-xs font-black text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
                  {invitations.length}
                </span>
              )}
            </div>

            <Link
              to="/invitations"
              className="shrink-0 text-sm font-bold text-violet-600 dark:text-violet-400"
            >
              View all
            </Link>
          </div>

          <div className="p-4 sm:p-5">
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
              <div className="py-6 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 dark:bg-slate-800">
                  <Mail size={18} />
                </div>

                <p className="mt-3 text-sm font-bold">You're all caught up</p>

                <p className="mt-1 text-xs text-slate-400">No pending workspace invitations.</p>
              </div>
            )}

            {!invitationsLoading && !invitationsError && invitations.length > 0 && (
              <div className="space-y-3">
                {invitations.slice(0, 3).map((invitation) => (
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

        {/* ====================================================
            JOIN CHAMA
        ==================================================== */}

        <section className="mb-2 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 p-5 text-white shadow-xl sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
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
        </section>
      </div>

      {/* ======================================================
          BOTTOM NAVIGATION — mobile only
      ====================================================== */}

      <BottomNavigation
        activeTab={activeTab}
        onSelectType={goToWorkspaceType}
        chamaCount={chamaCount}
        contributionCount={contributionCount}
        businessCount={businessCount}
      />
    </div>
  );
}

/* ============================================================
   FILTER BUTTON
============================================================ */

function FilterButton({ active, onClick, label, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold transition sm:px-4 sm:py-2.5 ${
        active
          ? "bg-slate-950 text-white shadow-md dark:bg-white dark:text-slate-950"
          : "border border-slate-200 bg-white text-slate-500 hover:border-violet-200 hover:text-violet-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
      }`}
    >
      {label}

      <span
        className={`rounded-full px-2 py-0.5 text-xs ${
          active ? "bg-white/15" : "bg-slate-100 dark:bg-slate-800"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

/* ============================================================
   LOADING
============================================================ */

function LoadingState() {
  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/70">
      <Spinner />
    </div>
  );
}

/* ============================================================
   EMPTY
============================================================ */

function EmptyState({ searchQuery, activeTab }) {
  const filtered = searchQuery || activeTab !== "all";

  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900/50 sm:p-10">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-500 dark:bg-violet-500/10">
        <Layers3 size={22} />
      </div>

      <h3 className="mt-4 text-base font-black">
        {filtered ? "No matching workspaces" : "No workspaces yet"}
      </h3>

      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
        {filtered
          ? "Try a different search or filter."
          : "Create or join a workspace to get started."}
      </p>
    </div>
  );
}

/* ============================================================
   WORKSPACE ROW

   One shared, compact row for every tab (including "All"): an
   icon, the name and role, a type-appropriate metric line, and
   an open affordance. Built mobile-first — the role badge and
   payout chip step in only once there's room for them.
============================================================ */

function WorkspaceRow({ workspace, index, onOpen }) {
  const type = normalizeWorkspaceType(workspace.type);
  const meta = getTypeMeta(type);
  const Icon = meta.icon;

  const isBusiness = type === "business";
  const isContribution = type === "contribution";

  const memberCount = getMemberCount(workspace);
  const treasury = getTreasury(workspace);
  const monthlySales = getMonthlySales(workspace);
  const contributionAmount = getContributionAmount(workspace);
  const nextPayout = getNextPayout(workspace);

  let subtitle = "";

  if (isBusiness) {
    const catLabel = workspace.businessType || workspace.category || "Business";
    const salesStr = monthlySales !== null ? ` · ${formatCurrency(monthlySales)} sales` : "";
    subtitle = `${catLabel}${salesStr}`;
  } else if (isContribution) {
    const memberStr = memberCount !== null ? `${memberCount} members` : "Contribution group";
    const contribStr =
      contributionAmount !== null ? ` · ${formatCurrency(contributionAmount)} target` : "";
    subtitle = `${memberStr}${contribStr}`;
  } else {
    const memberStr = memberCount !== null ? `${memberCount} members` : "Chama workspace";
    const balStr = treasury !== null ? ` · ${formatCurrency(treasury)} treasury` : "";
    subtitle = `${memberStr}${balStr}`;
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18, delay: Math.min(index, 8) * 0.02 }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200/90 bg-white p-3 text-left shadow-xs transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:bg-slate-800/80 sm:p-3.5"
      >
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${meta.iconBg}`}
        >
          <Icon size={20} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-sm font-black text-slate-900 dark:text-white">
              {workspace.name || "Unnamed Workspace"}
            </h4>

            <span
              className={`hidden shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide sm:inline-flex ${meta.badge}`}
            >
              {formatRole(workspace.role)}
            </span>
          </div>

          <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>

        {!isBusiness && nextPayout && (
          <span className="hidden shrink-0 items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300 md:inline-flex">
            <Clock3 size={11} className="text-slate-400" />
            {formatPayout(nextPayout)}
          </span>
        )}

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400 transition group-hover:bg-slate-900 group-hover:text-white dark:bg-slate-800 dark:group-hover:bg-white dark:group-hover:text-slate-950">
          <ArrowUpRight size={15} />
        </div>
      </button>
    </motion.div>
  );
}

/* ============================================================
   BOTTOM NAVIGATION — mobile only (lg:hidden)

   - Chama / Groups / Business -> filters "Your Workspaces" to
     that type and scrolls it into view (tapping the active one
     again clears back to "all")
   - Create (+) -> opens an in-place sheet with the three
     creation routes, plus "Join Chama" for entering a code
============================================================ */

function BottomNavigation({ activeTab, onSelectType, chamaCount, contributionCount, businessCount }) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <nav className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-24px)] max-w-xl -translate-x-1/2 lg:hidden">
      <AnimatePresence>
        {createOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            className="mb-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-2xl shadow-slate-900/10 backdrop-blur-2xl dark:border-slate-700/80 dark:bg-slate-900/95"
          >
            <CreateSheetItem
              to="/business/new"
              icon={Store}
              label="New Business"
              onNavigate={() => setCreateOpen(false)}
            />
            <CreateSheetItem
              to="/chamas/new"
              icon={Building2}
              label="New Chama"
              onNavigate={() => setCreateOpen(false)}
            />
            <CreateSheetItem
              to="/contribution-groups/new"
              icon={Wallet}
              label="New Contribution Group"
              onNavigate={() => setCreateOpen(false)}
            />
            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
            <CreateSheetItem
              to="/chamas/join"
              icon={UserPlus}
              label="Join Chama with a Code"
              onNavigate={() => setCreateOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-2 shadow-2xl shadow-slate-900/10 backdrop-blur-2xl dark:border-slate-700/80 dark:bg-slate-900/90">
        <div className="flex items-center justify-around">
          <WorkspaceTypeNavItem
            type="chama"
            active={activeTab === "chama"}
            count={chamaCount}
            onClick={() => onSelectType("chama")}
          />

          <WorkspaceTypeNavItem
            type="contribution"
            active={activeTab === "contribution"}
            count={contributionCount}
            onClick={() => onSelectType("contribution")}
          />

          <button
            type="button"
            onClick={() => setCreateOpen((prev) => !prev)}
            className="relative -mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-xl shadow-violet-600/30 ring-4 ring-white transition-transform dark:ring-slate-900"
            aria-label={createOpen ? "Close create menu" : "Create a workspace"}
            aria-expanded={createOpen}
          >
            <motion.span animate={{ rotate: createOpen ? 135 : 0 }} className="flex">
              <Plus size={24} />
            </motion.span>
          </button>

          <WorkspaceTypeNavItem
            type="business"
            active={activeTab === "business"}
            count={businessCount}
            onClick={() => onSelectType("business")}
          />
        </div>
      </div>
    </nav>
  );
}

/* ============================================================
   CREATE SHEET ITEM
============================================================ */

function CreateSheetItem({ to, icon: Icon, label, onNavigate }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <Icon size={16} />
      </span>
      {label}
    </Link>
  );
}

/* ============================================================
   WORKSPACE TYPE NAV ITEM
============================================================ */

function WorkspaceTypeNavItem({ type, active, count, onClick }) {
  const meta = getTypeMeta(type);
  const Icon = meta.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition"
    >
      <span
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition ${
          active
            ? meta.iconBg
            : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        }`}
      >
        <Icon size={18} strokeWidth={active ? 2.4 : 2} />

        {count > 0 && (
          <span
            className={`absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-black ${
              active
                ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            }`}
          >
            {count}
          </span>
        )}
      </span>

      <span
        className={`text-[11px] font-bold ${
          active ? "text-slate-900 dark:text-white" : "text-slate-400"
        }`}
      >
        {meta.label}
      </span>
    </button>
  );
}