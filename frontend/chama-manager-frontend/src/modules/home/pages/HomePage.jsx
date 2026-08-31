import React, { useEffect, useMemo, useState } from "react";

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
  Users,
  Sparkles,
  Layers3,
  TrendingUp,
  UserPlus,
  Search,
  ArrowRight,
  Clock3,
  UserCircle,
  ChevronDown,
  ChevronUp,
  List,
  LayoutGrid,
} from "lucide-react";

import useAuth from "@/app/hooks/useAuth";
import useWorkspace from "@/app/hooks/useWorkspace";

import {
  useMyInvitations,
  useAcceptInvitation,
} from "@/modules/invitations/hooks/useInvitations";

import InvitationCard from "@/modules/invitations/components/InvitationCard";
import Spinner from "@/shared/components/ui/Spinner";

/* ============================================================
   WORKSPACE CONFIG
============================================================ */

const workspaceConfig = {
  business: {
    icon: Store,
    label: "Business Hub",
    pluralLabel: "Businesses",
    description: "Sales, inventory & operational ledger",
    createTo: "/business/new",

    iconBg:
      "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",

    accent: "from-blue-500 to-cyan-500",

    badge:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300",

    hover:
      "hover:border-blue-200 hover:shadow-blue-100/50 dark:hover:border-blue-500/30",

    sectionHeader:
      "border-blue-200/80 bg-blue-50/60 dark:border-blue-900/60 dark:bg-blue-950/30",

    solidIconBg: "bg-blue-600",
  },

  chama: {
    icon: Building2,
    label: "Chama Circle",
    pluralLabel: "Chamas",
    description: "Members, treasury & rotational payouts",
    createTo: "/chamas/new",

    iconBg:
      "bg-violet-50 text-violet-600 border-violet-100 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20",

    accent: "from-violet-500 to-fuchsia-500",

    badge:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300",

    hover:
      "hover:border-violet-200 hover:shadow-violet-100/50 dark:hover:border-violet-500/30",

    sectionHeader:
      "border-violet-200/80 bg-violet-50/60 dark:border-violet-900/60 dark:bg-violet-950/30",

    solidIconBg: "bg-violet-600",
  },

  contribution: {
    icon: Wallet,
    label: "Contribution Group",
    pluralLabel: "Contribution Groups",
    description: "Structured savings, collections & obligations",
    createTo: "/contribution-groups/new",

    iconBg:
      "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",

    accent: "from-emerald-500 to-teal-500",

    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",

    hover:
      "hover:border-emerald-200 hover:shadow-emerald-100/50 dark:hover:border-emerald-500/30",

    sectionHeader:
      "border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/30",

    solidIconBg: "bg-emerald-600",
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

function getWorkspaceMeta(type) {
  const normalizedType = normalizeWorkspaceType(type);

  return workspaceConfig[normalizedType] || workspaceConfig.chama;
}

/* ============================================================
   ROLE FORMATTER
============================================================ */

function formatRole(role) {
  if (!role) return "Member";

  return String(role)
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/* ============================================================
   TIME-AWARE GREETING
============================================================ */

function getTimeGreeting(date = new Date()) {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) {
    return "Good morning";
  }

  if (hour >= 12 && hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
}

function getGreetingIcon(date = new Date()) {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) {
    return "☀️";
  }

  if (hour >= 12 && hour < 17) {
    return "🌤️";
  }

  return "🌙";
}

/* ============================================================
   WORKSPACE DATA HELPERS

   Every one of these reads a real field off the workspace object
   the API returned (or a documented alias of it) and falls back to
   null — never a placeholder figure — when the backend hasn't sent
   that value for this workspace.
============================================================ */

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

function getGrowth(workspace) {
  const value =
    workspace?.growth ?? workspace?.growthPercentage ?? workspace?.monthlyGrowth ?? null;

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

function getContributionAmount(workspace) {
  const value =
    workspace?.contributionAmount ??
    workspace?.monthlyContribution ??
    workspace?.contributionPlan?.amount ??
    workspace?.contribution?.amount ??
    null;

  return typeof value === "number" ? value : null;
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

/* Sums a numeric getter across workspaces. Returns null (not 0) when
   not a single workspace actually reported the field, so the UI can
   show "—" instead of a fabricated zero. */
function sumField(workspaces, getter, predicate = () => true) {
  let total = 0;
  let sawAny = false;

  workspaces.forEach((workspace) => {
    if (!predicate(workspace)) return;

    const value = getter(workspace);

    if (typeof value === "number") {
      total += value;
      sawAny = true;
    }
  });

  return sawAny ? total : null;
}

/* ============================================================
   HOME PAGE
============================================================ */

export default function HomePage() {
  const { user } = useAuth();

  const { workspaces = [], loading, selectWorkspace } = useWorkspace();

  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("chama");
  const [viewStyle, setViewStyle] = useState("compact"); // 'compact' (list) | 'cards'

  /* ==========================================================
     TYPE NAVIGATION — shared by the mobile bottom bar and the
     filter tabs: switches "Your Workspaces" to that type and
     scrolls it into view. There's always exactly one type
     selected (Chama, Contribution Group, or Business) — no "all".
  ========================================================== */

  function goToWorkspaceType(type) {
    setActiveTab(type);

    const target = document.getElementById("workspaces-section");

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /* ==========================================================
     LIVE CLOCK
  ========================================================== */

  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date());
    };

    updateTime();

    const interval = window.setInterval(updateTime, 60 * 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const greeting = useMemo(() => getTimeGreeting(currentTime), [currentTime]);

  const greetingIcon = useMemo(() => getGreetingIcon(currentTime), [currentTime]);

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
     COUNTS — all derived from the real workspaces the API returned
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

  const totalMembers = useMemo(
    () => sumField(workspaces, getMemberCount, (w) => normalizeWorkspaceType(w.type) !== "business"),
    [workspaces]
  );

  const totalBalance = useMemo(() => sumField(workspaces, getTreasury), [workspaces]);

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

      const matchesTab = type === activeTab;

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
     USER
  ========================================================== */

  const firstName = user?.name?.split(" ")[0] || "there";

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="relative">
      {/* ======================================================
          BACKGROUND — decorative only, sits behind the platform
          header/content, doesn't add its own chrome.
      ====================================================== */}

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-violet-200/30 blur-[120px] dark:bg-violet-700/10" />

        <div className="absolute right-[-200px] top-[20%] h-[500px] w-[500px] rounded-full bg-blue-200/30 blur-[120px] dark:bg-blue-700/10" />

        <div className="absolute bottom-0 left-[30%] h-[400px] w-[400px] rounded-full bg-emerald-200/20 blur-[120px] dark:bg-emerald-700/10" />
      </div>

      {/* ======================================================
          MAIN — horizontal padding/rhythm comes from
          PlatformLayout; only extra scaling for very wide
          screens lives here, so there's a single source of
          truth for page gutters and nothing re-centers the
          page inside a narrow column.
      ====================================================== */}

      <div className="w-full pb-28 xl:px-6 2xl:px-12">
        {/* ====================================================
            HERO
        ==================================================== */}

        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-8 overflow-hidden rounded-[28px] border border-violet-100 bg-gradient-to-br from-white via-violet-50/70 to-blue-50/70 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-violet-950/20 dark:to-blue-950/20 sm:p-8 lg:p-10 2xl:p-14"
        >
          <div className="absolute right-[-80px] top-[-120px] h-80 w-80 rounded-full bg-violet-300/30 blur-3xl dark:bg-violet-500/10" />

          <div className="absolute bottom-[-120px] right-[15%] h-72 w-72 rounded-full bg-blue-300/20 blur-3xl dark:bg-blue-500/10" />

          <div className="relative flex flex-col justify-between gap-10 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              {/* Dynamic greeting badge */}

              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-violet-600 shadow-sm backdrop-blur-sm dark:border-violet-500/20 dark:bg-slate-900/60 dark:text-violet-300">
                <Sparkles size={13} />

                <span>{greeting}</span>

                <span className="text-sm">{greetingIcon}</span>
              </div>

              {/* Dynamic greeting */}

              <h2 className="text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl 2xl:text-6xl">
                {greeting},{" "}
                <span className="bg-gradient-to-r from-violet-600 via-blue-600 to-emerald-500 bg-clip-text text-transparent">
                  {firstName}
                </span>
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-500 dark:text-slate-400 sm:text-base">
                Here's what's happening across your financial ecosystem today.
              </p>

              {/* Search — the one place it lives, not duplicated in a
                  second header */}

              <div className="relative mt-6 max-w-md">
                <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                <input
                  type="text"
                  placeholder="Search workspaces, members..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white/90 pl-11 pr-4 text-sm outline-none backdrop-blur-xl transition focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 dark:border-slate-800 dark:bg-slate-900/70"
                />
              </div>

              {/* Hero stats — real, aggregated from the fetched
                  workspaces; "—" when the backend hasn't sent a field */}

              <div className="mt-6 grid grid-cols-3 gap-3 sm:flex sm:flex-wrap">
                <HeroStat value={workspaces.length} label="Workspaces" />

                <HeroStat value={totalMembers ?? "—"} label="Members" />

                <HeroStat value={formatCurrency(totalBalance)} label="Total Balance" />
              </div>
            </div>

            {/* Hero visual — a real breakdown of the user's own
                workspaces by type, not a decorative placeholder stat */}

            <div className="hidden lg:flex lg:w-72 lg:shrink-0 lg:flex-col lg:gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
                  <Building2 size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-400">Chamas</p>
                  <p className="text-lg font-black">{chamaCount}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                  <Store size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-400">Businesses</p>
                  <p className="text-lg font-black">{businessCount}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <Wallet size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-400">Contribution Groups</p>
                  <p className="text-lg font-black">{contributionCount}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ====================================================
            CREATE A WORKSPACE — trimmed to exactly the three
            workspace types (mirrors the mobile bottom bar's type
            tabs), so this row and the tab bar teach the same
            mental model instead of listing five mixed actions.
            "Send Invite" now lives in the Invitations panel and
            "Join Chama" has its own dedicated card below, so
            neither is duplicated up here.
        ==================================================== */}

      

        {/* ====================================================
            WORKSPACES
        ==================================================== */}

        <section id="workspaces-section" className="mb-9 scroll-mt-28">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight">Your Workspaces</h2>

              <p className="mt-1 text-sm text-slate-400">Everything you manage in one place.</p>
            </div>

            <Link
              to="/workspaces"
              className="hidden items-center gap-1 text-sm font-bold text-violet-600 sm:flex dark:text-violet-400"
            >
              View All
              <ArrowUpRight size={15} />
            </Link>
          </div>

          {/* Filters & View Style Switcher Toolbar — Chama, Groups,
              and Business only; there's always exactly one selected,
              so the list below is a single unified block per type
              instead of three collapsible groups. */}

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
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

            {/* View Style Switcher */}
            <div className="flex items-center gap-1 shrink-0 rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setViewStyle("compact")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  viewStyle === "compact"
                    ? "bg-slate-950 text-white shadow-xs dark:bg-white dark:text-slate-950"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <List size={14} /> List View
              </button>
              <button
                type="button"
                onClick={() => setViewStyle("cards")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  viewStyle === "cards"
                    ? "bg-slate-950 text-white shadow-xs dark:bg-white dark:text-slate-950"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <LayoutGrid size={14} /> Card View
              </button>
            </div>
          </div>

          {/* Workspace Results — one type at a time, matching the
              tab above; no per-type header/collapse since the tab
              already tells you which type you're looking at. */}

          {loading ? (
            <LoadingState />
          ) : filteredWorkspaces.length === 0 ? (
            <EmptyState searchQuery={searchQuery} activeTab={activeTab} />
          ) : viewStyle === "compact" ? (
            <div className="space-y-2">
              {filteredWorkspaces.map((workspace, index) => (
                <CompactWorkspaceRow
                  key={getWorkspaceId(workspace)}
                  workspace={workspace}
                  meta={getWorkspaceMeta(workspace.type)}
                  Icon={getWorkspaceMeta(workspace.type).icon}
                  index={index}
                  onOpen={() => openWorkspace(workspace)}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 2xl:grid-cols-2">
              {filteredWorkspaces.map((workspace, index) => (
                <WorkspaceCard
                  key={getWorkspaceId(workspace)}
                  workspace={workspace}
                  meta={getWorkspaceMeta(workspace.type)}
                  Icon={getWorkspaceMeta(workspace.type).icon}
                  index={index}
                  onOpen={() => openWorkspace(workspace)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ====================================================
            INVITATIONS + JOIN CHAMA — paired on wide screens
        ==================================================== */}

        <section className="mb-4 grid gap-5 2xl:grid-cols-[1.4fr_1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
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

              <div className="flex items-center gap-4">
                <Link
                  to="/invitations"
                  className="hidden items-center gap-1 text-sm font-bold text-orange-600 sm:flex dark:text-orange-400"
                >
                  <Mail size={14} />
                  Send Invite
                </Link>

                <Link to="/invitations" className="text-sm font-bold text-violet-600 dark:text-violet-400">
                  View All
                </Link>
              </div>
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
          </div>

          {/* ==================================================
              JOIN CHAMA
          ================================================== */}

          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 p-6 text-white shadow-xl sm:p-7">
            <div className="flex h-full flex-col justify-between gap-6">
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
      </div>

      {/* ======================================================
          BOTTOM NAVIGATION — mobile only. On small screens this
          is the fast path to each workspace type (Chama /
          Contribution Group / Business) plus the create button;
          on large screens the same three types are already one
          click away via the "Create a Workspace" row and the
          filter tabs above the workspace list, so no bottom bar
          is needed there.
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
   HERO STAT
============================================================ */

function HeroStat({ value, label }) {
  return (
    <div className="rounded-xl border border-white/80 bg-white/70 px-4 py-3 backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-900/50">
      <p className="text-lg font-black leading-tight">{value}</p>

      <p className="mt-0.5 text-xs font-medium text-slate-400">{label}</p>
    </div>
  );
}

/* ============================================================
   SECTION HEADING
============================================================ */

function SectionHeading({ title }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-xl font-black tracking-tight">{title}</h2>
    </div>
  );
}

/* ============================================================
   QUICK ACTION
============================================================ */

function QuickAction({ to, icon: Icon, title, description, color }) {
  const styles = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",

    violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400",

    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",

    orange: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400",

    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
  };

  return (
    <Link
      to={to}
      className="group min-w-[200px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/70 lg:min-w-0"
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${styles[color]}`}>
          <Icon size={19} />
        </div>

        <ArrowUpRight
          size={16}
          className="text-slate-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-violet-500"
        />
      </div>

      <h3 className="mt-4 text-sm font-black">{title}</h3>

      <p className="mt-1 text-xs leading-relaxed text-slate-400">{description}</p>
    </Link>
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
      className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
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
   WORKSPACE CARD
============================================================ */

function WorkspaceCard({ workspace, meta, Icon, index, onOpen }) {
  const type = normalizeWorkspaceType(workspace.type);

  const isBusiness = type === "business";

  const isContribution = type === "contribution";

  const memberCount = getMemberCount(workspace);

  const treasury = getTreasury(workspace);

  const monthlySales = getMonthlySales(workspace);

  const growth = getGrowth(workspace);

  const nextPayout = getNextPayout(workspace);

  const contributionAmount = getContributionAmount(workspace);

  const members = Array.isArray(workspace?.members) ? workspace.members : [];

  const visibleMembers = members.slice(0, 3);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className="group h-full"
    >
      <button
        type="button"
        onClick={onOpen}
        className={`relative flex h-full w-full flex-col overflow-hidden rounded-[26px] border border-slate-200/90 bg-white text-left shadow-[0_8px_35px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(15,23,42,0.09)] focus:outline-none focus:ring-4 focus:ring-violet-500/10 dark:border-slate-800 dark:bg-slate-900/80 ${meta.hover}`}
      >
        {/* Top accent */}

        <div className={`absolute left-0 right-0 top-0 h-1 bg-gradient-to-r ${meta.accent}`} />

        <div className="flex flex-1 flex-col gap-6 p-5 sm:p-6">
          {/* ==================================================
              IDENTITY
          ================================================== */}

          <div className="flex min-w-0 items-center gap-4">
            <div
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border sm:h-20 sm:w-20 ${meta.iconBg}`}
            >
              <Icon size={32} strokeWidth={1.6} />
            </div>

            <div className="min-w-0">
              <span
                className={`mb-2 inline-flex items-center rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${meta.badge}`}
              >
                {meta.label}
              </span>

              <h3 className="truncate text-lg font-black tracking-tight text-slate-950 sm:text-xl dark:text-white">
                {workspace.name || "Unnamed Workspace"}
              </h3>

              <p className="mt-1 truncate text-xs font-medium text-slate-500 sm:text-sm dark:text-slate-400">
                {meta.description}
              </p>
            </div>
          </div>

          {/* ==================================================
              MEMBER AVATARS
          ================================================== */}

          {!isBusiness && (
            <div className="flex items-center">
              {visibleMembers.length > 0 ? (
                visibleMembers.map((member, memberIndex) => {
                  const avatar = member?.avatar || member?.profilePicture || member?.photo;

                  const name = member?.name || member?.fullName || "Member";

                  return (
                    <div
                      key={member?.id || member?._id || memberIndex}
                      className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-100 dark:border-slate-900 ${
                        memberIndex > 0 ? "-ml-3" : ""
                      }`}
                      title={name}
                    >
                      {avatar ? (
                        <img src={avatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <UserCircle size={22} className="text-slate-400" />
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-slate-400 dark:border-slate-900 dark:bg-slate-800">
                  <Users size={16} />
                </div>
              )}

              {memberCount !== null && (
                <span className="ml-3 flex h-9 min-w-[44px] items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {visibleMembers.length > 0
                    ? `+${Math.max(memberCount - visibleMembers.length, 0)}`
                    : `${memberCount}`}
                </span>
              )}
            </div>
          )}

          {/* ==================================================
              METRICS
          ================================================== */}

          <div className="grid grid-cols-2 gap-y-4 border-t border-slate-100 pt-5 dark:border-slate-800">
            {/* Role */}

            <WorkspaceMetric icon={UserCircle} label="Role" value={formatRole(workspace.role)} />

            {/* Type / Members */}

            {isBusiness ? (
              <WorkspaceMetric
                icon={Store}
                label="Type"
                value={workspace.businessType || workspace.category || "Business"}
              />
            ) : (
              <WorkspaceMetric
                icon={Users}
                label="Members"
                value={memberCount !== null ? `${memberCount}` : "—"}
              />
            )}

            {/* Financial metric */}

            {isBusiness ? (
              <WorkspaceMetric icon={TrendingUp} label="Monthly Sales" value={formatCurrency(monthlySales)} />
            ) : isContribution ? (
              <WorkspaceMetric icon={Wallet} label="Contribution" value={formatCurrency(contributionAmount)} />
            ) : (
              <WorkspaceMetric icon={Wallet} label="Treasury" value={formatCurrency(treasury)} />
            )}

            {/* Final metric */}

            {isBusiness ? (
              <WorkspaceMetric
                icon={TrendingUp}
                label="Growth"
                value={growth !== null ? `${growth > 0 ? "+" : ""}${growth}%` : "—"}
                positive={growth !== null && growth >= 0}
              />
            ) : (
              <WorkspaceMetric icon={Clock3} label="Next Payout" value={formatPayout(nextPayout)} />
            )}
          </div>

          {/* ==================================================
              OPEN WORKSPACE
          ================================================== */}

          <div className="mt-auto flex h-13 items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 transition-all group-hover:border-violet-200 group-hover:bg-violet-50 dark:border-slate-700 dark:bg-slate-800/70 dark:group-hover:border-violet-500/30 dark:group-hover:bg-violet-500/10">
            <span className="text-sm font-black">Open Workspace</span>

            <ArrowRight
              size={19}
              className="transition-transform duration-300 group-hover:translate-x-1 group-hover:text-violet-600 dark:group-hover:text-violet-400"
            />
          </div>
        </div>

        {/* Bottom accent */}

        <div className={`h-1 w-full bg-gradient-to-r ${meta.accent} opacity-70`} />
      </button>
    </motion.div>
  );
}

/* ============================================================
   WORKSPACE METRIC
============================================================ */

function WorkspaceMetric({ icon: Icon, label, value, positive = false }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <Icon size={13} className="shrink-0 text-slate-400" />

        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</span>
      </div>

      <p
        className={`mt-1 truncate text-sm font-black sm:text-base ${
          positive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-200"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/* ============================================================
   BOTTOM NAVIGATION — mobile only (lg:hidden)

   Small screens don't have room for the "Create a Workspace" row
   and the filter tabs to both stay in view, so the bottom bar is
   the fast path to each workspace type:
   - Chama / Groups / Business -> filters "Your Workspaces" to that
     type and scrolls it into view (tapping the active one again
     clears back to "all")
   - Create (+) -> opens an in-place sheet with the three creation
     routes, plus "Join Chama" for entering an invitation code —
     the same actions Quick Actions/the Join Chama card expose on
     larger screens, just consolidated into one sheet here since
     there's no room for four separate cards on mobile
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
            label="Chama"
            Icon={Building2}
            active={activeTab === "chama"}
            count={chamaCount}
            onClick={() => onSelectType("chama")}
          />

          <WorkspaceTypeNavItem
            type="contribution"
            label="Groups"
            Icon={Wallet}
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
            label="Business"
            Icon={Store}
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

   One of the three bottom-bar tabs. Colors reuse workspaceConfig
   so a Chama looks the same shade of violet here as it does on
   its badge and card everywhere else on the page.
============================================================ */

function WorkspaceTypeNavItem({ type, label, Icon, active, count, onClick }) {
  const meta = getWorkspaceMeta(type);

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
        {label}
      </span>
    </button>
  );
}

/* ============================================================
   LOADING
============================================================ */

function LoadingState() {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/70">
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
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900/50">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-500 dark:bg-violet-500/10">
        <Layers3 size={24} />
      </div>

      <h3 className="mt-4 text-base font-black">
        {filtered ? "No matching workspaces" : "Your workspace starts here"}
      </h3>

      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
        {filtered
          ? "Try changing your search or workspace filter."
          : "Create your first Business, Chama, or Contribution Group workspace."}
      </p>

      {!filtered && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link to="/business/new" className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white">
            Business
          </Link>

          <Link to="/chamas/new" className="rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-black text-white">
            Chama
          </Link>

          <Link
            to="/contribution-groups/new"
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white"
          >
            Contribution Group
          </Link>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   COMPACT WORKSPACE ROW (WhatsApp-Style)
============================================================ */

function CompactWorkspaceRow({ workspace, meta, Icon, index, onOpen }) {
  const type = normalizeWorkspaceType(workspace.type);
  const isBusiness = type === "business";
  const isContribution = type === "contribution";
  const memberCount = getMemberCount(workspace);
  const treasury = getTreasury(workspace);
  const monthlySales = getMonthlySales(workspace);
  const contributionAmount = getContributionAmount(workspace);
  const nextPayout = getNextPayout(workspace);

  const iconBgMap = {
    chama: "bg-violet-100 text-violet-700 dark:bg-violet-950/80 dark:text-violet-300 border-violet-200 dark:border-violet-800",
    contribution: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    business: "bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  };

  const badgeBgMap = {
    chama: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800",
    contribution: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    business: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  };

  let subtitleMetric = "";
  if (isBusiness) {
    const catLabel = workspace.businessType || workspace.category || "Business";
    const salesStr = monthlySales !== null ? ` • ${formatCurrency(monthlySales)} Sales` : "";
    subtitleMetric = `${catLabel}${salesStr}`;
  } else if (isContribution) {
    const mStr = memberCount !== null ? `${memberCount} Members` : "";
    const contribStr = contributionAmount !== null ? ` • ${formatCurrency(contributionAmount)} Target` : "";
    subtitleMetric = `${mStr}${contribStr}` || "Contribution Group";
  } else {
    const mStr = memberCount !== null ? `${memberCount} Members` : "";
    const balStr = treasury !== null ? ` • ${formatCurrency(treasury)} Treasury` : "";
    subtitleMetric = `${mStr}${balStr}` || "Chama Workspace";
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18, delay: index * 0.02 }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="group relative flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-3 sm:px-4 shadow-xs transition-all hover:bg-slate-50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:bg-slate-800/80 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Left Avatar with status dot */}
          <div className="relative shrink-0">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border font-bold ${iconBgMap[type] || iconBgMap.chama}`}>
              <Icon size={20} />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
          </div>

          {/* Center Details */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="truncate text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                {workspace.name || "Unnamed Workspace"}
              </h4>
              <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${badgeBgMap[type] || badgeBgMap.chama}`}>
                {formatRole(workspace.role)}
              </span>
            </div>

            <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {subtitleMetric}
            </p>
          </div>
        </div>

        {/* Right Side Info */}
        <div className="flex items-center gap-3 shrink-0">
          {nextPayout && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Clock3 size={11} className="text-slate-400" />
              {formatPayout(nextPayout)}
            </span>
          )}

          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-slate-400 group-hover:bg-slate-900 group-hover:text-white dark:bg-slate-800 dark:group-hover:bg-white dark:group-hover:text-slate-950 transition">
            <ArrowUpRight size={14} />
          </div>
        </div>
      </button>
    </motion.div>
  );
}