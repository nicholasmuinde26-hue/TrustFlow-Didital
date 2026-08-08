import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
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
// WORKSPACE CONFIG
// ============================================================

const workspaceConfig = {
  business: {
    icon: Store,
    label: "Business",
    description: "Sales, inventory & operations",
    shortDescription: "Run your business operations",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    accent: "bg-blue-600",
    softAccent: "bg-blue-50",
    badge: "border-blue-100 bg-blue-50 text-blue-700",
  },

  chama: {
    icon: Building2,
    label: "Chama",
    description: "Members, treasury & payouts",
    shortDescription: "Manage your community treasury",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    accent: "bg-violet-600",
    softAccent: "bg-violet-50",
    badge: "border-violet-100 bg-violet-50 text-violet-700",
  },

  contribution: {
    icon: Wallet,
    label: "Contribution Group",
    description: "Savings, collections & obligations",
    shortDescription: "Track structured contributions",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    accent: "bg-emerald-600",
    softAccent: "bg-emerald-50",
    badge: "border-emerald-100 bg-emerald-50 text-emerald-700",
  },

  contribution_group: {
    icon: Wallet,
    label: "Contribution Group",
    description: "Savings, collections & obligations",
    shortDescription: "Track structured contributions",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    accent: "bg-emerald-600",
    softAccent: "bg-emerald-50",
    badge: "border-emerald-100 bg-emerald-50 text-emerald-700",
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

  if (normalized === "chama") {
    return "chama";
  }

  return "chama";
}

function getWorkspaceMeta(type) {
  const normalizedType = normalizeWorkspaceType(type);

  return workspaceConfig[normalizedType] || workspaceConfig.chama;
}

function formatRole(role) {
  if (!role) return "Workspace member";

  return String(role)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// ============================================================
// PAGE
// ============================================================

export default function HomePage() {
  const { user } = useAuth();

  const {
    workspaces = [],
    loading,
    selectWorkspace,
  } = useWorkspace();

  const navigate = useNavigate();

  const {
    data: invitations = [],
    isLoading: invitationsLoading,
    isError: invitationsError,
    refetch: refetchInvitations,
  } = useMyInvitations("pending");

  const acceptInvitation = useAcceptInvitation();

  // ==========================================================
  // COUNTS
  // ==========================================================

  const businessCount = workspaces.filter(
    (workspace) =>
      normalizeWorkspaceType(workspace.type) === "business"
  ).length;

  const chamaCount = workspaces.filter(
    (workspace) =>
      normalizeWorkspaceType(workspace.type) === "chama"
  ).length;

  const contributionCount = workspaces.filter(
    (workspace) =>
      normalizeWorkspaceType(workspace.type) === "contribution"
  ).length;

  // ==========================================================
  // OPEN WORKSPACE
  // ==========================================================

  function openWorkspace(workspace) {
    selectWorkspace(workspace);

    const workspaceId =
      workspace.id ?? workspace._id;

    const type = normalizeWorkspaceType(workspace.type);

    if (type === "business") {
      navigate(`/workspace/${workspaceId}/business`);
      return;
    }

    navigate(`/workspace/${workspaceId}`);
  }

  // ==========================================================
  // ACCEPT INVITATION
  // ==========================================================

  async function handleAccept(invitation) {
    const result = await acceptInvitation.mutateAsync(
      invitation._id
    );

    const groupId =
      result?.group?._id ||
      result?.membership?.contribution_group_id;

    if (groupId) {
      navigate(`/workspace/${groupId}`);
    }
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-[#f8fafc]">
      {/* ======================================================
          BACKGROUND
      ====================================================== */}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="
            absolute inset-0
            opacity-[0.35]
            bg-[linear-gradient(to_right,rgba(15,23,42,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.025)_1px,transparent_1px)]
            bg-[size:48px_48px]
          "
        />

        <div
          className="
            absolute
            -left-48
            -top-48
            h-[520px]
            w-[520px]
            rounded-full
            bg-violet-200/20
            blur-3xl
          "
        />

        <div
          className="
            absolute
            -right-48
            top-[18%]
            h-[520px]
            w-[520px]
            rounded-full
            bg-blue-200/20
            blur-3xl
          "
        />

        <div
          className="
            absolute
            bottom-[-300px]
            left-[35%]
            h-[500px]
            w-[500px]
            rounded-full
            bg-emerald-200/10
            blur-3xl
          "
        />
      </div>

      {/* ======================================================
          MAIN
      ====================================================== */}

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

        {/* ====================================================
            HEADER / HERO
        ==================================================== */}

        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="
            relative
            overflow-hidden
            rounded-[28px]
            border
            border-slate-200
            bg-white
            px-6
            py-7
            shadow-sm
            sm:px-8
            sm:py-8
          "
        >
          <div
            className="
              pointer-events-none
              absolute
              right-[-80px]
              top-[-100px]
              h-[280px]
              w-[280px]
              rounded-full
              bg-violet-100/70
              blur-3xl
            "
          />

          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">

            <div className="max-w-2xl">

              <div
                className="
                  mb-4
                  inline-flex
                  items-center
                  gap-2
                  rounded-full
                  border
                  border-violet-100
                  bg-violet-50
                  px-3
                  py-1.5
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-[0.14em]
                  text-violet-700
                "
              >
                <Sparkles size={12} />
                Financial workspace
              </div>

              <h1
                className="
                  text-3xl
                  font-black
                  tracking-[-0.04em]
                  text-slate-950
                  sm:text-4xl
                  lg:text-5xl
                "
              >
                Welcome
                {user?.name
                  ? `, ${user.name.split(" ")[0]}`
                  : ""}
                <span className="text-violet-600">.</span>
              </h1>

              <p
                className="
                  mt-3
                  max-w-xl
                  text-sm
                  leading-6
                  text-slate-500
                  sm:text-[15px]
                "
              >
                Everything you manage, collect and grow —
                organized in one trusted workspace.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <StatusPill
                  icon={ShieldCheck}
                  label="Secure workspace"
                />

                <StatusPill
                  icon={TrendingUp}
                  label="Financial operations"
                />

                <StatusPill
                  icon={Users}
                  label={`${workspaces.length} active workspace${
                    workspaces.length === 1 ? "" : "s"
                  }`}
                />
              </div>
            </div>

            {/* PRIMARY ACTIONS */}

            <div className="flex flex-wrap gap-2.5 lg:max-w-sm lg:justify-end">

              <CreateButton
                to="/business/new"
                icon={Store}
                label="Business"
                color="blue"
              />

              <CreateButton
                to="/chamas/new"
                icon={Building2}
                label="Chama"
                color="violet"
              />

              <CreateButton
                to="/contribution-groups/new"
                icon={Wallet}
                label="Contribution Group"
                color="emerald"
              />

            </div>
          </div>
        </motion.section>

        {/* ====================================================
            SUMMARY
        ==================================================== */}

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.45,
            delay: 0.08,
          }}
          className="
            mt-5
            grid
            overflow-hidden
            rounded-2xl
            border
            border-slate-200
            bg-white
            shadow-sm
            sm:grid-cols-3
          "
        >
          <SummaryItem
            icon={Store}
            label="Businesses"
            value={businessCount}
            color="blue"
            description="Business workspaces"
          />

          <SummaryItem
            icon={Building2}
            label="Chamas"
            value={chamaCount}
            color="violet"
            description="Community workspaces"
          />

          <SummaryItem
            icon={Wallet}
            label="Contribution Groups"
            value={contributionCount}
            color="emerald"
            description="Contribution workspaces"
          />
        </motion.section>

        {/* ====================================================
            WORKSPACES
        ==================================================== */}

        <section className="mt-10">

          <SectionHeader
            icon={Layers3}
            title="Your workspaces"
            description="Choose a workspace to continue where you left off."
            count={workspaces.length}
          />

          {loading ? (
            <LoadingWorkspace />
          ) : workspaces.length === 0 ? (
            <EmptyWorkspace />
          ) : (
            <div
              className="
                grid
                gap-4
                sm:grid-cols-2
                xl:grid-cols-3
              "
            >
              {workspaces.map((workspace, index) => {
                const id =
                  workspace.id ??
                  workspace._id;

                const meta =
                  getWorkspaceMeta(workspace.type);

                const Icon = meta.icon;

                return (
                  <WorkspaceCard
                    key={id}
                    workspace={workspace}
                    meta={meta}
                    Icon={Icon}
                    index={index}
                    onOpen={() =>
                      openWorkspace(workspace)
                    }
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* ====================================================
            QUICK ACTIONS
        ==================================================== */}

        <section className="mt-11">

          <SectionHeader
            icon={Plus}
            title="Create something new"
            description="Start a workspace for the way you manage money."
          />

          <div
            className="
              grid
              gap-4
              md:grid-cols-3
            "
          >
            <ActionCard
              to="/business/new"
              icon={Store}
              title="Create a Business"
              description="Sales, inventory, customers and daily operations."
              color="blue"
            />

            <ActionCard
              to="/chamas/new"
              icon={Building2}
              title="Create a Chama"
              description="Members, treasury, contributions and payouts."
              color="violet"
            />

            <ActionCard
              to="/contribution-groups/new"
              icon={Wallet}
              title="Create a Contribution Group"
              description="Structured contributions, collections and obligations."
              color="emerald"
            />
          </div>
        </section>

        {/* ====================================================
            INVITATIONS
        ==================================================== */}

        <section className="mt-11">

          <div
            className="
              overflow-hidden
              rounded-2xl
              border
              border-slate-200
              bg-white
              shadow-sm
            "
          >

            <div
              className="
                flex
                flex-col
                gap-4
                border-b
                border-slate-100
                px-5
                py-5
                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >

              <div className="flex items-center gap-3">

                <div
                  className="
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-xl
                    bg-orange-50
                    text-orange-600
                  "
                >
                  <Mail size={17} />
                </div>

                <div>
                  <div className="flex items-center gap-2">

                    <h2
                      className="
                        text-sm
                        font-black
                        text-slate-950
                      "
                    >
                      Invitations
                    </h2>

                    {invitations.length > 0 && (
                      <span
                        className="
                          rounded-full
                          bg-orange-100
                          px-2
                          py-0.5
                          text-[9px]
                          font-bold
                          text-orange-700
                        "
                      >
                        {invitations.length}
                      </span>
                    )}
                  </div>

                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Workspace invitations waiting for you.
                  </p>
                </div>
              </div>

              {invitations.length > 0 && (
                <Link
                  to="/invitations"
                  className="
                    inline-flex
                    items-center
                    gap-1
                    text-xs
                    font-bold
                    text-violet-600
                    transition
                    hover:text-violet-700
                  "
                >
                  View all
                  <ArrowUpRight size={13} />
                </Link>
              )}
            </div>

            <div className="p-4">

              {invitationsLoading && (
                <div className="flex justify-center py-8">
                  <Spinner />
                </div>
              )}

              {invitationsError && (
                <div
                  className="
                    flex
                    flex-col
                    gap-3
                    rounded-xl
                    border
                    border-red-100
                    bg-red-50
                    p-4
                    text-xs
                    text-red-600
                    sm:flex-row
                    sm:items-center
                    sm:justify-between
                  "
                >
                  <span className="flex items-center gap-2">
                    <AlertCircle size={14} />
                    Unable to load invitations.
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      refetchInvitations()
                    }
                    className="
                      flex
                      items-center
                      gap-1
                      font-bold
                      hover:underline
                    "
                  >
                    <RotateCcw size={12} />
                    Retry
                  </button>
                </div>
              )}

              {!invitationsLoading &&
                !invitationsError &&
                invitations.length === 0 && (
                  <div
                    className="
                      flex
                      flex-col
                      items-center
                      justify-center
                      py-8
                      text-center
                    "
                  >
                    <div
                      className="
                        flex
                        h-11
                        w-11
                        items-center
                        justify-center
                        rounded-xl
                        bg-slate-50
                        text-slate-300
                      "
                    >
                      <Mail size={18} />
                    </div>

                    <p
                      className="
                        mt-3
                        text-xs
                        font-bold
                        text-slate-600
                      "
                    >
                      No pending invitations
                    </p>

                    <p className="mt-1 text-[11px] text-slate-400">
                      You're all caught up.
                    </p>
                  </div>
                )}

              {!invitationsLoading &&
                !invitationsError &&
                invitations.length > 0 && (
                  <div className="space-y-2">
                    {invitations
                      .slice(0, 3)
                      .map((invitation) => (
                        <InvitationCard
                          key={invitation._id}
                          invitation={invitation}
                          accepting={
                            acceptInvitation.isPending &&
                            acceptInvitation.variables ===
                              invitation._id
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
            JOIN CHAMA
        ==================================================== */}

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          whileInView={{
            opacity: 1,
            y: 0,
          }}
          viewport={{ once: true }}
          className="
            relative
            mt-6
            overflow-hidden
            rounded-2xl
            bg-slate-950
            px-5
            py-6
            shadow-xl
            shadow-slate-900/10
            sm:px-7
          "
        >

          <div
            className="
              pointer-events-none
              absolute
              right-[-100px]
              top-[-140px]
              h-[320px]
              w-[320px]
              rounded-full
              bg-violet-600/20
              blur-3xl
            "
          />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-4">

              <div
                className="
                  flex
                  h-11
                  w-11
                  shrink-0
                  items-center
                  justify-center
                  rounded-xl
                  bg-white/10
                  text-white
                "
              >
                <UserPlus size={18} />
              </div>

              <div>
                <p
                  className="
                    text-sm
                    font-black
                    text-white
                  "
                >
                  Already invited to a Chama?
                </p>

                <p
                  className="
                    mt-1
                    text-[11px]
                    text-slate-400
                  "
                >
                  Join an existing community workspace.
                </p>
              </div>
            </div>

            <Link
              to="/chamas/join"
              className="
                inline-flex
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-white
                px-5
                py-2.5
                text-xs
                font-bold
                text-slate-950
                transition
                hover:bg-violet-50
                hover:text-violet-700
              "
            >
              Join Chama
              <ArrowUpRight size={13} />
            </Link>
          </div>
        </motion.section>

        {/* ====================================================
            FOOTER
        ==================================================== */}

        <footer
          className="
            flex
            flex-wrap
            items-center
            justify-center
            gap-3
            py-9
            text-[10px]
            font-medium
            text-slate-400
          "
        >
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={12} />
            Secure workspace access
          </span>

          <span className="text-slate-300">•</span>

          <span>VeriCircle Financial OS</span>
        </footer>
      </main>
    </div>
  );
}

// ============================================================
// STATUS PILL
// ============================================================

function StatusPill({
  icon: Icon,
  label,
}) {
  return (
    <div
      className="
        inline-flex
        items-center
        gap-1.5
        rounded-full
        border
        border-slate-200
        bg-slate-50
        px-2.5
        py-1.5
        text-[10px]
        font-semibold
        text-slate-500
      "
    >
      <Icon size={11} className="text-slate-400" />
      {label}
    </div>
  );
}

// ============================================================
// SECTION HEADER
// ============================================================

function SectionHeader({
  icon: Icon,
  title,
  description,
  count,
}) {
  return (
    <div className="mb-5 flex items-end justify-between">

      <div>
        <div className="flex items-center gap-2">

          <div
            className="
              flex
              h-7
              w-7
              items-center
              justify-center
              rounded-lg
              bg-slate-100
              text-slate-500
            "
          >
            <Icon size={14} />
          </div>

          <h2
            className="
              text-base
              font-black
              tracking-tight
              text-slate-950
            "
          >
            {title}
          </h2>
        </div>

        <p className="mt-1.5 text-xs text-slate-400">
          {description}
        </p>
      </div>

      {typeof count === "number" && count > 0 && (
        <span
          className="
            rounded-full
            bg-white
            px-2.5
            py-1
            text-[10px]
            font-bold
            text-slate-500
            shadow-sm
            ring-1
            ring-slate-200
          "
        >
          {count} active
        </span>
      )}
    </div>
  );
}

// ============================================================
// SUMMARY ITEM
// ============================================================

function SummaryItem({
  icon: Icon,
  label,
  value,
  color,
  description,
}) {
  const colors = {
    blue: {
      icon: "bg-blue-50 text-blue-600",
      number: "text-blue-700",
    },
    violet: {
      icon: "bg-violet-50 text-violet-600",
      number: "text-violet-700",
    },
    emerald: {
      icon: "bg-emerald-50 text-emerald-600",
      number: "text-emerald-700",
    },
  };

  const style = colors[color];

  return (
    <div
      className="
        flex
        items-center
        gap-3
        border-b
        border-slate-100
        px-5
        py-4
        last:border-b-0
        sm:border-b-0
        sm:border-r
        sm:last:border-r-0
      "
    >
      <div
        className={`
          flex
          h-10
          w-10
          shrink-0
          items-center
          justify-center
          rounded-xl
          ${style.icon}
        `}
      >
        <Icon size={17} />
      </div>

      <div className="min-w-0">

        <p
          className="
            text-[10px]
            font-bold
            uppercase
            tracking-wider
            text-slate-400
          "
        >
          {label}
        </p>

        <div className="mt-0.5 flex items-baseline gap-2">
          <p
            className={`
              text-xl
              font-black
              tracking-tight
              ${style.number}
            `}
          >
            {value}
          </p>

          <span className="hidden text-[9px] text-slate-400 sm:block">
            {description}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CREATE BUTTON
// ============================================================

function CreateButton({
  to,
  icon: Icon,
  label,
  color,
}) {
  const colors = {
    blue: `
      bg-blue-600
      hover:bg-blue-700
      shadow-blue-600/20
    `,
    violet: `
      bg-violet-600
      hover:bg-violet-700
      shadow-violet-600/20
    `,
    emerald: `
      bg-emerald-600
      hover:bg-emerald-700
      shadow-emerald-600/20
    `,
  };

  return (
    <Link
      to={to}
      className={`
        inline-flex
        items-center
        gap-2
        rounded-xl
        px-3.5
        py-2.5
        text-[11px]
        font-bold
        text-white
        shadow-lg
        transition
        hover:-translate-y-0.5
        ${colors[color]}
      `}
    >
      <Icon size={14} />
      {label}
    </Link>
  );
}

// ============================================================
// WORKSPACE CARD
// ============================================================

function WorkspaceCard({
  workspace,
  meta,
  Icon,
  index,
  onOpen,
}) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{
        opacity: 0,
        y: 15,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        delay: index * 0.06,
        duration: 0.35,
      }}
      whileHover={{
        y: -4,
      }}
      className="
        group
        relative
        overflow-hidden
        rounded-2xl
        border
        border-slate-200
        bg-white
        p-5
        text-left
        shadow-sm
        transition
        hover:border-slate-300
        hover:shadow-xl
      "
    >
      {/* Left Accent */}

      <div
        className={`
          absolute
          left-0
          top-0
          h-full
          w-1
          ${meta.accent}
        `}
      />

      {/* Top */}

      <div className="flex items-start justify-between">

        <div
          className={`
            flex
            h-12
            w-12
            items-center
            justify-center
            rounded-2xl
            ${meta.iconBg}
            ${meta.iconColor}
            transition
            duration-300
            group-hover:scale-105
          `}
        >
          <Icon size={21} />
        </div>

        <div
          className="
            flex
            h-8
            w-8
            items-center
            justify-center
            rounded-lg
            text-slate-300
            transition
            group-hover:bg-slate-50
            group-hover:text-slate-700
          "
        >
          <ArrowUpRight size={16} />
        </div>
      </div>

      {/* Identity */}

      <div className="mt-5">

        <span
          className={`
            inline-flex
            rounded-full
            border
            px-2
            py-1
            text-[9px]
            font-bold
            uppercase
            tracking-wider
            ${meta.badge}
          `}
        >
          {meta.label}
        </span>

        <h3
          className="
            mt-3
            truncate
            text-[17px]
            font-black
            tracking-tight
            text-slate-950
          "
        >
          {workspace.name}
        </h3>

        <p
          className="
            mt-1
            truncate
            text-xs
            text-slate-400
          "
        >
          {meta.description}
        </p>
      </div>

      {/* Bottom */}

      <div
        className="
          mt-6
          flex
          items-center
          justify-between
          border-t
          border-slate-100
          pt-4
        "
      >
        <span
          className="
            flex
            items-center
            gap-1.5
            text-[10px]
            font-semibold
            text-slate-400
          "
        >
          <Users size={12} />
          {formatRole(workspace.role)}
        </span>

        <span
          className="
            flex
            items-center
            gap-1
            text-[10px]
            font-bold
            text-slate-400
            transition
            group-hover:text-slate-950
          "
        >
          Open workspace
          <ChevronRight
            size={12}
            className="transition group-hover:translate-x-0.5"
          />
        </span>
      </div>
    </motion.button>
  );
}

// ============================================================
// ACTION CARD
// ============================================================

function ActionCard({
  to,
  icon: Icon,
  title,
  description,
  color,
}) {
  const styles = {
    blue: {
      border: "hover:border-blue-200",
      icon: "bg-blue-50 text-blue-600",
      hover: "group-hover:bg-blue-600 group-hover:text-white",
      arrow: "group-hover:text-blue-600",
    },

    violet: {
      border: "hover:border-violet-200",
      icon: "bg-violet-50 text-violet-600",
      hover: "group-hover:bg-violet-600 group-hover:text-white",
      arrow: "group-hover:text-violet-600",
    },

    emerald: {
      border: "hover:border-emerald-200",
      icon: "bg-emerald-50 text-emerald-600",
      hover: "group-hover:bg-emerald-600 group-hover:text-white",
      arrow: "group-hover:text-emerald-600",
    },
  };

  const style = styles[color];

  return (
    <Link
      to={to}
      className={`
        group
        relative
        flex
        items-center
        gap-4
        rounded-2xl
        border
        border-slate-200
        bg-white
        p-5
        shadow-sm
        transition
        hover:-translate-y-1
        hover:shadow-lg
        ${style.border}
      `}
    >
      <div
        className={`
          flex
          h-11
          w-11
          shrink-0
          items-center
          justify-center
          rounded-xl
          transition
          ${style.icon}
          ${style.hover}
        `}
      >
        <Icon size={19} />
      </div>

      <div className="min-w-0 flex-1">

        <h3
          className="
            text-xs
            font-black
            text-slate-900
          "
        >
          {title}
        </h3>

        <p
          className="
            mt-1.5
            text-[10px]
            leading-5
            text-slate-400
          "
        >
          {description}
        </p>
      </div>

      <ArrowUpRight
        size={15}
        className={`
          shrink-0
          text-slate-300
          transition
          group-hover:translate-x-0.5
          ${style.arrow}
        `}
      />
    </Link>
  );
}

// ============================================================
// LOADING
// ============================================================

function LoadingWorkspace() {
  return (
    <div
      className="
        flex
        min-h-[220px]
        items-center
        justify-center
        rounded-2xl
        border
        border-slate-200
        bg-white
        shadow-sm
      "
    >
      <Spinner />
    </div>
  );
}

// ============================================================
// EMPTY WORKSPACE
// ============================================================

function EmptyWorkspace() {
  return (
    <div
      className="
        flex
        min-h-[280px]
        flex-col
        items-center
        justify-center
        rounded-2xl
        border
        border-dashed
        border-slate-300
        bg-white
        px-6
        text-center
        shadow-sm
      "
    >
      <div
        className="
          flex
          h-14
          w-14
          items-center
          justify-center
          rounded-2xl
          bg-violet-50
          text-violet-600
        "
      >
        <Layers3 size={24} />
      </div>

      <h3
        className="
          mt-4
          text-base
          font-black
          text-slate-950
        "
      >
        Your workspace starts here
      </h3>

      <p
        className="
          mt-1.5
          max-w-sm
          text-xs
          leading-5
          text-slate-400
        "
      >
        Create a Business, Chama, or Contribution Group
        and manage everything from one place.
      </p>

      <div className="mt-5 flex flex-wrap justify-center gap-2">

        <Link
          to="/business/new"
          className="
            inline-flex
            items-center
            gap-1.5
            rounded-xl
            bg-blue-600
            px-4
            py-2.5
            text-[11px]
            font-bold
            text-white
            transition
            hover:bg-blue-700
          "
        >
          <Store size={13} />
          Business
        </Link>

        <Link
          to="/chamas/new"
          className="
            inline-flex
            items-center
            gap-1.5
            rounded-xl
            bg-violet-600
            px-4
            py-2.5
            text-[11px]
            font-bold
            text-white
            transition
            hover:bg-violet-700
          "
        >
          <Building2 size={13} />
          Chama
        </Link>

        <Link
          to="/contribution-groups/new"
          className="
            inline-flex
            items-center
            gap-1.5
            rounded-xl
            bg-emerald-600
            px-4
            py-2.5
            text-[11px]
            font-bold
            text-white
            transition
            hover:bg-emerald-700
          "
        >
          <Wallet size={13} />
          Contribution Group
        </Link>
      </div>
    </div>
  );
}