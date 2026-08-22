import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Wallet,
  Store,
  Plus,
  Mail,
  ChevronRight,
  AlertCircle,
  RotateCcw,
  ArrowUpRight,
  Users,
  Sparkles,
  Layers3,
  ShieldCheck,
  TrendingUp,
  CircleDollarSign,
  BriefcaseBusiness,
  UserPlus,
  Search,
  SlidersHorizontal,
  Zap,
  Activity,
  Compass,
  CheckCircle2,
  Lock,
  ArrowRight,
} from "lucide-react";

import useAuth from "@/app/hooks/useAuth";
import useWorkspace from "@/app/hooks/useWorkspace";

import {
  useMyInvitations,
  useAcceptInvitation,
} from "@/modules/invitations/hooks/useInvitations";

import InvitationCard from "@/modules/invitations/components/InvitationCard";
import Spinner from "@/shared/components/ui/Spinner";

// ============================================================
// WORKSPACE CONFIG (ADAPTIVE LIGHT / DARK TECH MATRIX)
// ============================================================

const workspaceConfig = {
  business: {
    icon: Store,
    label: "Business Hub",
    description: "Sales, inventory & operational ledger",
    shortDescription: "Enterprise Operations",
    iconBg: "bg-blue-50 border border-blue-200/60 text-blue-600 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400",
    iconGlow: "shadow-[0_4px_12px_rgba(37,99,235,0.12)] dark:shadow-[0_0_20px_rgba(59,130,246,0.25)]",
    accent: "bg-gradient-to-r from-blue-600 to-cyan-500",
    badge: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
    cardGlow: "hover:border-blue-300 dark:hover:border-blue-500/40 hover:shadow-xl dark:hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]",
  },

  chama: {
    icon: Building2,
    label: "Chama Circle",
    description: "Members, treasury & rotational payouts",
    shortDescription: "Community Treasury",
    iconBg: "bg-violet-50 border border-violet-200/60 text-violet-600 dark:bg-violet-500/10 dark:border-violet-500/20 dark:text-violet-400",
    iconGlow: "shadow-[0_4px_12px_rgba(124,58,237,0.12)] dark:shadow-[0_0_20px_rgba(139,92,246,0.25)]",
    accent: "bg-gradient-to-r from-violet-600 to-fuchsia-500",
    badge: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300",
    cardGlow: "hover:border-violet-300 dark:hover:border-violet-500/40 hover:shadow-xl dark:hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]",
  },

  contribution: {
    icon: Wallet,
    label: "Contribution Group",
    description: "Structured savings, collections & obligations",
    shortDescription: "Group Savings Ledger",
    iconBg: "bg-emerald-50 border border-emerald-200/60 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400",
    iconGlow: "shadow-[0_4px_12px_rgba(5,150,105,0.12)] dark:shadow-[0_0_20px_rgba(16,185,129,0.25)]",
    accent: "bg-gradient-to-r from-emerald-600 to-teal-500",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
    cardGlow: "hover:border-emerald-300 dark:hover:border-emerald-500/40 hover:shadow-xl dark:hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]",
  },
};

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

function formatRole(role) {
  if (!role) return "Member";
  return String(role)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// ============================================================
// MAIN PAGE COMPONENT (THEME ADAPTIVE)
// ============================================================

export default function HomePage() {
  const { user } = useAuth();
  const { workspaces = [], loading, selectWorkspace } = useWorkspace();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const {
    data: invitations = [],
    isLoading: invitationsLoading,
    isError: invitationsError,
    refetch: refetchInvitations,
  } = useMyInvitations("pending");

  const acceptInvitation = useAcceptInvitation();

  // Counts
  const businessCount = useMemo(
    () => workspaces.filter((w) => normalizeWorkspaceType(w.type) === "business").length,
    [workspaces]
  );
  const chamaCount = useMemo(
    () => workspaces.filter((w) => normalizeWorkspaceType(w.type) === "chama").length,
    [workspaces]
  );
  const contributionCount = useMemo(
    () => workspaces.filter((w) => normalizeWorkspaceType(w.type) === "contribution").length,
    [workspaces]
  );

  // Filtered workspaces
  const filteredWorkspaces = useMemo(() => {
    return workspaces.filter((w) => {
      const matchesSearch =
        !searchQuery.trim() ||
        w.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        String(w.type || "").toLowerCase().includes(searchQuery.toLowerCase().trim());

      const normType = normalizeWorkspaceType(w.type);
      const matchesTab = activeTab === "all" || normType === activeTab;

      return matchesSearch && matchesTab;
    });
  }, [workspaces, searchQuery, activeTab]);

  function openWorkspace(workspace) {
    selectWorkspace(workspace);
    const workspaceId = workspace.id ?? workspace._id;
    const type = normalizeWorkspaceType(workspace.type);

    if (type === "business") {
      navigate(`/workspace/${workspaceId}/business`);
      return;
    }

    navigate(`/workspace/${workspaceId}`);
  }

  async function handleAccept(invitation) {
    const result = await acceptInvitation.mutateAsync(invitation._id);
    const groupId = result?.group?._id || result?.membership?.contribution_group_id;

    if (groupId) {
      navigate(`/workspace/${groupId}`);
    }
  }

  return (
    <div className="relative min-h-screen bg-[#f8fafc] dark:bg-[#090d16] text-slate-900 dark:text-slate-100 font-sans selection:bg-violet-500 selection:text-white pb-16 overflow-hidden transition-colors duration-300">
      {/* ======================================================
          AMBIENT BACKGROUND & MESH GRID
      ====================================================== */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        {/* Subtle Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.035] dark:opacity-[0.07] bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:36px_36px]" />

        {/* Ambient Soft Light Orbs */}
        <div className="absolute -top-32 -left-32 h-[550px] w-[550px] rounded-full bg-violet-200/35 dark:bg-violet-600/25 blur-[130px]" />
        <div className="absolute top-[20%] -right-40 h-[550px] w-[550px] rounded-full bg-blue-200/35 dark:bg-cyan-600/15 blur-[130px]" />
        <div className="absolute bottom-10 left-[30%] h-[450px] w-[450px] rounded-full bg-emerald-200/25 dark:bg-emerald-600/15 blur-[130px]" />
      </div>

      {/* ======================================================
          MAIN CONTENT CONTAINER
      ====================================================== */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 space-y-8">
        
        {/* ====================================================
            HERO COMMAND SECTION
        ==================================================== */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 dark:border-slate-800/80 dark:bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl shadow-slate-200/50 dark:shadow-2xl sm:p-8 lg:p-10"
        >
          {/* Top Subtle Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-emerald-500" />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-4">
              
              {/* Matrix Status Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/10 px-3.5 py-1.5 text-xs font-bold text-violet-700 dark:text-violet-300 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Sparkles size={13} className="text-violet-600 dark:text-violet-400" />
                <span className="uppercase tracking-widest text-[10px] font-extrabold">FINANCIAL OS MATRIX</span>
              </div>

              {/* Dynamic Header Greeting */}
              <h1 className="text-3xl font-black tracking-tight sm:text-5xl text-slate-950 dark:text-white">
                Welcome back,{" "}
                <span className="bg-gradient-to-r from-violet-600 via-indigo-600 to-emerald-600 dark:from-violet-400 dark:via-cyan-300 dark:to-emerald-400 bg-clip-text text-transparent">
                  {user?.name ? user.name.split(" ")[0] : "Commander"}
                </span>
              </h1>

              <p className="text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300 max-w-xl font-normal">
                Everything you manage, collect, and grow — organized in your trusted financial operational workspace.
              </p>

              {/* Telemetry Status Pills */}
              <div className="pt-2 flex flex-wrap items-center gap-2.5">
                <AdaptiveStatusPill icon={Lock} label="End-to-End Encrypted" color="emerald" />
                <AdaptiveStatusPill icon={Activity} label="Real-Time Telemetry" color="blue" />
                <AdaptiveStatusPill icon={Layers3} label={`${workspaces.length} Active Workspace${workspaces.length === 1 ? "" : "s"}`} color="violet" />
              </div>
            </div>

            {/* Hero Quick Launcher Actions */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[220px]">
              <HeroActionButton
                to="/business/new"
                icon={Store}
                title="Launch Business"
                sub="Sales & Operations"
                gradient="from-blue-600 to-cyan-600"
                shadow="shadow-blue-600/20"
              />
              <HeroActionButton
                to="/chamas/new"
                icon={Building2}
                title="Start Chama"
                sub="Treasury & Payouts"
                gradient="from-violet-600 to-fuchsia-600"
                shadow="shadow-violet-600/20"
              />
              <HeroActionButton
                to="/contribution-groups/new"
                icon={Wallet}
                title="New Group"
                sub="Savings & Obligations"
                gradient="from-emerald-600 to-teal-600"
                shadow="shadow-emerald-600/20"
              />
            </div>
          </div>
        </motion.section>

        {/* ====================================================
            TELEMETRY METRICS SUMMARY BAR
        ==================================================== */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <AdaptiveMetricCard
            icon={Layers3}
            title="Total Workspaces"
            count={workspaces.length}
            color="violet"
            label="Active Consoles"
          />
          <AdaptiveMetricCard
            icon={Store}
            title="Business Hubs"
            count={businessCount}
            color="blue"
            label="Operations"
          />
          <AdaptiveMetricCard
            icon={Building2}
            title="Chama Circles"
            count={chamaCount}
            color="fuchsia"
            label="Treasuries"
          />
          <AdaptiveMetricCard
            icon={Wallet}
            title="Savings Groups"
            count={contributionCount}
            color="emerald"
            label="Contributions"
          />
        </motion.section>

        {/* ====================================================
            WORKSPACE EXPLORER SECTION (SEARCH & TABS)
        ==================================================== */}
        <section className="space-y-5 pt-2">
          
          {/* Controls Bar: Title, Search & Filter Tabs */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white flex items-center gap-2.5">
                <Compass className="text-violet-600 dark:text-cyan-400" size={20} />
                Your Workspaces
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Select a workspace console to launch your management dashboard</p>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              
              {/* Search Bar */}
              <div className="relative flex-1 sm:w-64">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search workspace..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/80 pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all shadow-sm backdrop-blur-md"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Type Category Tabs */}
              <div className="flex items-center rounded-xl border border-slate-200/80 bg-slate-100 dark:border-slate-800 dark:bg-slate-900/80 p-1 shadow-inner backdrop-blur-md overflow-x-auto scrollbar-none">
                <AdaptiveFilterTab
                  active={activeTab === "all"}
                  onClick={() => setActiveTab("all")}
                  label="All"
                  count={workspaces.length}
                />
                <AdaptiveFilterTab
                  active={activeTab === "business"}
                  onClick={() => setActiveTab("business")}
                  label="Business"
                  count={businessCount}
                />
                <AdaptiveFilterTab
                  active={activeTab === "chama"}
                  onClick={() => setActiveTab("chama")}
                  label="Chama"
                  count={chamaCount}
                />
                <AdaptiveFilterTab
                  active={activeTab === "contribution"}
                  onClick={() => setActiveTab("contribution")}
                  label="Groups"
                  count={contributionCount}
                />
              </div>
            </div>
          </div>

          {/* Workspaces Grid */}
          {loading ? (
            <LoadingState />
          ) : filteredWorkspaces.length === 0 ? (
            <EmptyState searchQuery={searchQuery} activeTab={activeTab} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {filteredWorkspaces.map((workspace, index) => {
                  const id = workspace.id ?? workspace._id;
                  const meta = getWorkspaceMeta(workspace.type);
                  const Icon = meta.icon;

                  return (
                    <AdaptiveWorkspaceCard
                      key={id}
                      workspace={workspace}
                      meta={meta}
                      Icon={Icon}
                      index={index}
                      onOpen={() => openWorkspace(workspace)}
                    />
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* ====================================================
            FEATURE LAUNCHPAD (CREATE NEW WORKSPACE)
        ==================================================== */}
        <section className="space-y-4 pt-4">
          <div className="flex items-center gap-2">
            <Zap className="text-amber-500" size={18} />
            <h2 className="text-base font-bold text-slate-950 dark:text-white">Create New Workspace</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <AdaptiveActionCard
              to="/business/new"
              icon={Store}
              title="New Business Workspace"
              description="Inventory, POS sales, customer records & financial reports."
              color="blue"
              badge="ENTERPRISE"
            />
            <AdaptiveActionCard
              to="/chamas/new"
              icon={Building2}
              title="New Chama Workspace"
              description="Member roster, rotational payouts, loan policy & treasury."
              color="violet"
              badge="COMMUNITY"
            />
            <AdaptiveActionCard
              to="/contribution-groups/new"
              icon={Wallet}
              title="New Contribution Group"
              description="Scheduled savings, obligations & automated reminders."
              color="emerald"
              badge="SAVINGS"
            />
          </div>
        </section>

        {/* ====================================================
            PENDING INVITATIONS HUB
        ==================================================== */}
        <section className="pt-2">
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 backdrop-blur-xl shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 dark:border-slate-800/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600 border border-orange-200/60 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30">
                  <Mail size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-950 dark:text-white">Pending Invitations</h3>
                    {invitations.length > 0 && (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700 dark:bg-amber-500/10 dark:text-amber-300 animate-pulse">
                        {invitations.length} NEW
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">Workspace invitations waiting for your response</p>
                </div>
              </div>

              {invitations.length > 0 && (
                <Link
                  to="/invitations"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 transition-colors"
                >
                  View All Invitations
                  <ArrowUpRight size={14} />
                </Link>
              )}
            </div>

            <div className="p-5">
              {invitationsLoading && (
                <div className="flex justify-center py-6">
                  <Spinner />
                </div>
              )}

              {invitationsError && (
                <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10 p-4 text-xs text-red-700 dark:text-red-300">
                  <span className="flex items-center gap-2">
                    <AlertCircle size={15} />
                    Unable to load invitations right now.
                  </span>
                  <button
                    type="button"
                    onClick={() => refetchInvitations()}
                    className="flex items-center gap-1 font-bold hover:underline"
                  >
                    <RotateCcw size={12} />
                    Retry
                  </button>
                </div>
              )}

              {!invitationsLoading && !invitationsError && invitations.length === 0 && (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 dark:bg-slate-900 dark:text-slate-500 border border-slate-200 dark:border-slate-800">
                    <Mail size={18} />
                  </div>
                  <p className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-300">No pending invitations</p>
                  <p className="text-[11px] text-slate-400">You're all caught up on invitations.</p>
                </div>
              )}

              {!invitationsLoading && !invitationsError && invitations.length > 0 && (
                <div className="space-y-3">
                  {invitations.slice(0, 3).map((invitation) => (
                    <InvitationCard
                      key={invitation._id}
                      invitation={invitation}
                      accepting={
                        acceptInvitation.isPending &&
                        acceptInvitation.variables === invitation._id
                      }
                      onAccept={handleAccept}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ====================================================
            JOIN CHAMA FOOTER BANNER
        ==================================================== */}
        <section className="relative overflow-hidden rounded-2xl border border-slate-900 bg-slate-950 p-6 text-white shadow-xl">
          <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-violet-600/20 blur-[60px]" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white border border-white/10">
                <UserPlus size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Have a Chama Invitation Code?</h3>
                <p className="text-xs text-slate-400 mt-0.5">Join an existing Chama or community group workspace directly.</p>
              </div>
            </div>

            <Link
              to="/chamas/join"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-slate-950 transition-all hover:bg-violet-50 hover:text-violet-700 shadow-md"
            >
              Join Chama Workspace
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        {/* ====================================================
            FOOTER
        ==================================================== */}
        <footer className="flex flex-wrap items-center justify-center gap-4 pt-6 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5 text-slate-500 font-medium">
            <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400" />
            Secure Multi-Tenant Infrastructure
          </span>
          <span>•</span>
          <span>VeriCircle Financial Operating System</span>
        </footer>

      </main>
    </div>
  );
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function AdaptiveStatusPill({ icon: Icon, label, color }) {
  const colors = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
    blue: "border-blue-200 bg-blue-50 text-blue-800 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300",
    violet: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300",
  };

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold backdrop-blur-md ${colors[color]}`}>
      <Icon size={12} />
      <span>{label}</span>
    </div>
  );
}

function HeroActionButton({ to, icon: Icon, title, sub, gradient, shadow }) {
  return (
    <Link
      to={to}
      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-r ${gradient} p-3.5 text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl ${shadow}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
            <Icon size={18} />
          </div>
          <div>
            <div className="text-xs font-bold">{title}</div>
            <div className="text-[10px] text-white/80 font-normal">{sub}</div>
          </div>
        </div>
        <ArrowUpRight size={16} className="text-white/80 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
    </Link>
  );
}

function AdaptiveMetricCard({ icon: Icon, title, count, color, label }) {
  const themes = {
    violet: "bg-violet-50 text-violet-600 border-violet-100 dark:bg-violet-500/5 dark:text-violet-400 dark:border-violet-500/20",
    blue: "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/5 dark:text-blue-400 dark:border-blue-500/20",
    fuchsia: "bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100 dark:bg-fuchsia-500/5 dark:text-fuchsia-400 dark:border-fuchsia-500/20",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/5 dark:text-emerald-400 dark:border-emerald-500/20",
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 p-4 shadow-sm backdrop-blur-md transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700">
      <div className="flex items-center justify-between text-slate-400 mb-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl border ${themes[color]}`}>
          <Icon size={15} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</span>
      </div>
      <div className="text-2xl font-black text-slate-950 dark:text-white tracking-tight">{count}</div>
      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{title}</div>
    </div>
  );
}

function AdaptiveFilterTab({ active, onClick, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
        active
          ? "bg-white text-slate-950 shadow-sm border border-slate-200/80 dark:bg-violet-600 dark:text-white dark:border-violet-500 dark:shadow-[0_0_12px_rgba(139,92,246,0.4)]"
          : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60"
      }`}
    >
      <span>{label}</span>
      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${active ? "bg-slate-100 text-slate-900 dark:bg-white/20 dark:text-white" : "bg-slate-200/60 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}`}>
        {count}
      </span>
    </button>
  );
}

function AdaptiveWorkspaceCard({ workspace, meta, Icon, index, onOpen }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="group relative cursor-pointer"
      onClick={onOpen}
    >
      <div className={`relative overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900/70 p-5 shadow-sm backdrop-blur-xl transition-all duration-300 ${meta.cardGlow} hover:-translate-y-1`}>
        
        {/* Top Gradient Accent Line */}
        <div className={`absolute top-0 left-0 right-0 h-1 ${meta.accent}`} />

        {/* Card Header */}
        <div className="flex items-start justify-between">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${meta.iconBg} ${meta.iconGlow}`}>
            <Icon size={20} />
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.badge}`}>
              {meta.label}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-400 group-hover:border-violet-300 dark:group-hover:border-violet-500/50 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
              <ArrowUpRight size={14} />
            </div>
          </div>
        </div>

        {/* Workspace Identity */}
        <div className="mt-4 space-y-1">
          <h3 className="text-base font-black tracking-tight text-slate-950 dark:text-white group-hover:text-violet-600 dark:group-hover:text-cyan-300 transition-colors truncate">
            {workspace.name}
          </h3>
          <p className="text-xs text-slate-400 font-normal truncate">{meta.description}</p>
        </div>

        {/* Footer info */}
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-3.5 text-xs text-slate-500">
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
            <Users size={13} className="text-slate-400" />
            {formatRole(workspace.role)}
          </span>

          <span className="flex items-center gap-1 text-[11px] font-bold text-violet-600 dark:text-violet-400 group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
            Open Console
            <ChevronRight size={13} className="transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function AdaptiveActionCard({ to, icon: Icon, title, description, color, badge }) {
  const styles = {
    blue: {
      border: "hover:border-blue-300 dark:hover:border-blue-500/40",
      icon: "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400",
      badge: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
      arrow: "group-hover:text-blue-600 dark:group-hover:text-blue-400",
    },
    violet: {
      border: "hover:border-violet-300 dark:hover:border-violet-500/40",
      icon: "border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-400",
      badge: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300",
      arrow: "group-hover:text-violet-600 dark:group-hover:text-violet-400",
    },
    emerald: {
      border: "hover:border-emerald-300 dark:hover:border-emerald-500/40",
      icon: "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400",
      badge: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
      arrow: "group-hover:text-emerald-600 dark:group-hover:text-emerald-400",
    },
  };

  const current = styles[color];

  return (
    <Link
      to={to}
      className={`group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 p-5 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${current.border}`}
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${current.icon}`}>
            <Icon size={18} />
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold tracking-wider ${current.badge}`}>
            {badge}
          </span>
        </div>

        <h3 className="text-sm font-black text-slate-950 dark:text-white group-hover:text-violet-600 dark:group-hover:text-cyan-300 transition-colors">{title}</h3>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-normal">{description}</p>
      </div>

      <div className="mt-4 flex items-center justify-end">
        <ArrowUpRight size={16} className={`text-slate-300 dark:text-slate-500 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${current.arrow}`} />
      </div>
    </Link>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm backdrop-blur-xl">
      <Spinner />
    </div>
  );
}

function EmptyState({ searchQuery, activeTab }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-8 text-center shadow-sm backdrop-blur-md">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-400">
        <Layers3 size={22} />
      </div>

      <h3 className="mt-3.5 text-base font-black text-slate-950 dark:text-white">
        {searchQuery || activeTab !== "all" ? "No matching workspaces found" : "Your workspace starts here"}
      </h3>

      <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
        {searchQuery || activeTab !== "all"
          ? "Try adjusting your search query or category filter."
          : "Create your first Business, Chama, or Contribution Group workspace."}
      </p>

      {!searchQuery && activeTab === "all" && (
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          <Link
            to="/business/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20"
          >
            <Store size={14} />
            Business
          </Link>
          <Link
            to="/chamas/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700 transition-all shadow-md shadow-violet-600/20"
          >
            <Building2 size={14} />
            Chama
          </Link>
          <Link
            to="/contribution-groups/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/20"
          >
            <Wallet size={14} />
            Contribution Group
          </Link>
        </div>
      )}
    </div>
  );
}