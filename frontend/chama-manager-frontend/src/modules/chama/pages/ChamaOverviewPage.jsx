import React, { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Calendar,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Clock,
  Coins,
  Info,
  Landmark,
  PiggyBank,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import clsx from "clsx";

import useWorkspace from "@/app/hooks/useWorkspace";
import useAuth from "@/app/hooks/useAuth";

import MpesaStkModal from "@/modules/finance/components/MpesaStkModal";
import useFinanceSummary from "@/modules/finance/hooks/useFinanceSummary";
import useMyFinanceSummary from "@/modules/finance/hooks/useMyFinanceSummary";
import useTransactions from "@/modules/finance/hooks/useTransactions";
import useWorkspacePermissions from "@/modules/finance/hooks/useworkspacepermissions";

import { useTrustScore } from "@/modules/trustScore/hooks/useTrustScore";
import { useMeetings } from "@/modules/meetings/hooks/useMeetings";

import useChamaOverviewData, {
  useSectionState,
} from "../hooks/useChamaOverviewData";

import {
  buildCollection,
  buildLoans,
  buildMgr,
  compact,
  formatWhen,
  greeting,
  money,
  normalizeMyPayment,
  normalizeTransaction,
  num,
  pct,
  roleLabel,
} from "../utils/overview";

import {
  DetailRows,
  EmptyState,
  ErrorNote,
  Section,
  Skeleton,
  Stat,
  StatStrip,
  TONE_BAR,
  TONE_TEXT,
} from "../components/overview/primitives";

import {
  CashFlowChart,
  ProgressBar,
  Ring,
  StackedBar,
} from "../components/overview/charts";

import {
  ActivityList,
  MemberPaymentsTable,
} from "../components/overview/tables";

import { BalanceHero } from "../components/overview/hero";
import BusinessFundsSeparationNotice from "@/modules/finance/components/BusinessFundsSeparationNotice";

import useOverviewPro from "../hooks/useOverviewPro";
import {
  buildCalendar,
  buildCompliance,
  buildFlows,
  buildFundsBreakdown,
  buildGovTodos,
  buildHealth,
  buildLoanToFund,
  buildLoanWatch,
  buildMeetingState,
  buildMemberPulse,
  buildPriorityList,
  buildRiskFlags,
  buildRoleCoverage,
  buildSnapshotText,
  buildTreasury,
  buildTrustExplain,
  daysFromNow,
  findMemberPhone,
  plural,
} from "../utils/overviewPro";
import { printDocument } from "@/modules/finance/lib/proKit";
import HealthStrip, { TrustExplainModal } from "../components/overview/pro/HealthStrip";
import { FinancialSnapshot, LoansPanel } from "../components/overview/pro/MoneyPanels";
import { AttentionCard, AuditPanel, ExpensesPanel, GovernancePanel, MeetingCard, MemberPulse, TimelinePanel } from "../components/overview/pro/PeoplePanels";
import { Nudge, OverviewTabs, Panel as ProPanel } from "../components/overview/pro/ProParts";
import { AdminControl, InsightCharts, NudgeModal, QuickActionsCard, UpcomingCard } from "../components/overview/pro/ActionPanels";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const DEFAULT_OPEN = {
  // The command view above already answers "is the chama healthy?", so the
  // detailed books below start collapsed as a drill-down.
  official: {
    attention: false,
    cashflow: false,
    activity: false,
    collections: false,
    position: false,
    mgr: false,
    loans: false,
    governance: false,
  },

  member: {
    attention: true,
    activity: true,
    mgr: false,
    governance: false,
  },
};

const OVERVIEW_TABS = ["summary", "money", "people", "governance", "reports"];

const linkCls =
  "inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-800 focus-visible:outline-2 focus-visible:outline-violet-500 dark:text-mint dark:hover:text-mint-hover";

const SeeAll = ({ to, children }) => (
  <Link to={to} className={linkCls}>
    {children}
    <ChevronRight size={14} aria-hidden="true" />
  </Link>
);

const btnBase =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-violet-500 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist dark:hover:bg-obsidian-raised";

const btnCls = clsx(btnBase, "px-3.5");

const iconBtnCls = clsx(btnBase, "w-10");

/* -------------------------------------------------------------------------- */
/* Loading                                                                    */
/* -------------------------------------------------------------------------- */

function PageSkeleton() {
  return (
    <div
      className="mx-auto max-w-[90rem] space-y-5 pb-28"
      aria-busy="true"
      aria-label="Loading overview"
    >
      <div className="grid gap-4 lg:grid-cols-4">
        <Skeleton className="h-28 lg:col-span-2" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>

      <Skeleton className="h-72 rounded-3xl" />

      <div className="grid gap-5 lg:grid-cols-12">
        <Skeleton className="h-80 lg:col-span-8" />
        <Skeleton className="h-80 lg:col-span-4" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Small dashboard primitives                                                 */
/* -------------------------------------------------------------------------- */

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
  trend,
}) {
  const toneClasses = {
    default:
      "border-slate-200/80 bg-white dark:border-obsidian-border dark:bg-obsidian-card",
    emerald:
      "border-emerald-100/90 bg-emerald-50/45 dark:border-emerald-900/40 dark:bg-emerald-950/20",
    amber:
      "border-amber-100/90 bg-amber-50/45 dark:border-amber-900/40 dark:bg-amber-950/20",
    violet:
      "border-violet-100/90 bg-violet-50/45 dark:border-violet-900/40 dark:bg-violet-950/20",
    rose:
      "border-rose-100/90 bg-rose-50/45 dark:border-rose-900/40 dark:bg-rose-950/20",
  };

  const iconClasses = {
    default:
      "bg-slate-100 text-slate-600 dark:bg-obsidian-raised dark:text-mist",
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
    amber:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300",
    violet:
      "bg-violet-100 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300",
    rose:
      "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300",
  };

  return (
    <div
      className={clsx(
        "group relative overflow-hidden rounded-2xl border p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md",
        toneClasses[tone]
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-[0.08]" />

      <div className="flex items-center justify-between gap-3">
        <span
          className={clsx(
            "flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105",
            iconClasses[tone]
          )}
        >
          <Icon size={16} aria-hidden="true" />
        </span>

        {trend ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-black/5 bg-white/70 px-2 py-1 text-[10px] font-bold text-slate-600 dark:border-white/5 dark:bg-black/10 dark:text-mist-muted">
            {trend}
          </span>
        ) : null}
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400 dark:text-mist-muted/70">
          {label}
        </p>

        <p className="mt-1.5 truncate text-[1.35rem] font-extrabold tracking-tight tabular-nums text-slate-950 dark:text-mist">
          {value}
        </p>

        {sub ? (
          <p className="mt-1 truncate text-[11px] font-medium text-slate-500 dark:text-mist-muted">
            {sub}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-600 dark:text-mint">
            {eyebrow}
          </p>
        ) : null}

        <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-mist">
          {title}
        </h2>

        {description ? (
          <p className="mt-1 text-xs text-slate-500 dark:text-mist-muted">
            {description}
          </p>
        ) : null}
      </div>

      {action}
    </div>
  );
}

function QuickAction({ icon: Icon, label, description, to, onClick }) {
  const content = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300">
        <Icon size={17} />
      </span>

      <span className="min-w-0 flex-1 text-left">
        <span className="block text-xs font-bold text-slate-900 dark:text-mist">
          {label}
        </span>

        {description ? (
          <span className="mt-0.5 block truncate text-[11px] text-slate-500 dark:text-mist-muted">
            {description}
          </span>
        ) : null}
      </span>

      <ChevronRight
        size={15}
        className="shrink-0 text-slate-300 dark:text-mist-muted/50"
      />
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="flex min-h-[66px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 transition hover:border-violet-200 hover:bg-violet-50/30 dark:border-obsidian-border dark:bg-obsidian-card dark:hover:bg-obsidian-raised"
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[66px] w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 transition hover:border-violet-200 hover:bg-violet-50/30 dark:border-obsidian-border dark:bg-obsidian-card dark:hover:bg-obsidian-raised"
    >
      {content}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Main page                                                                  */
/* -------------------------------------------------------------------------- */

export default function ChamaOverviewPage({
  dashboard = {},
  refreshing = false,
}) {
  const { workspaceId: paramId } = useParams();
  const workspaceCtx = useWorkspace();
  const { user } = useAuth();

  const workspaceId = paramId || workspaceCtx?.workspaceId;
  const base = `/workspace/${workspaceId}`;

  const workspace =
    dashboard?.workspace || workspaceCtx?.currentWorkspace || {};

  const stats = dashboard?.stats || {};

  const [stkOpen, setStkOpen] = useState(false);
  const [trustOpen, setTrustOpen] = useState(false);
  const [nudgeOpen, setNudgeOpen] = useState(false);

  // Which section of the command view is showing lives in the URL, so a tab
  // is linkable and survives a refresh. Summary is the default and stays clean.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("section");
  const activeTab = OVERVIEW_TABS.includes(rawTab) ? rawTab : "summary";
  const setTab = (id) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id === "summary") next.delete("section");
        else next.set("section", id);
        return next;
      },
      { replace: true }
    );

  // What this person may do comes from the API. Only the treasurer holds
  // contributions.record at 'all' scope, so only the treasurer is offered the
  // flow that collects for other members; everyone else pays their own.
  const { canForOthers } = useWorkspacePermissions(workspaceId);
  const canRecordForOthers = canForOthers("contributions.record");
  const hasContributions = !workspaceCtx?.hasModule || workspaceCtx.hasModule("contributions");
  const hasSavings = !workspaceCtx?.hasModule || workspaceCtx.hasModule("savings");
  // Contribution settings (create / edit / pause / archive) live in the
  // Leadership Desk.
  const canOpenDesk = ["treasurer", "chairperson"].includes(
    String(workspace?.role || "").toLowerCase().replaceAll(" ", "_")
  );
  const deskContributionsLink = `${base}/leadership?tab=contributions`;

  /* ---------------------------------------------------------------------- */
  /* Finance data                                                            */
  /* ---------------------------------------------------------------------- */

  const { summary, isLoading: loadingSummary } =
    useFinanceSummary(workspaceId);

  const { summary: mine } = useMyFinanceSummary(workspaceId);

  const isFull = summary?.scope === "all";

  const viewModeKey = `chama-overview:view-mode:${workspaceId}`;

  const [viewMode, setViewMode] = useState(() => {
    if (!isFull) return "chama";

    try {
      return localStorage.getItem(viewModeKey) === "mine"
        ? "mine"
        : "chama";
    } catch {
      return "chama";
    }
  });

  const setAndPersistViewMode = (mode) => {
    setViewMode(mode);

    try {
      localStorage.setItem(viewModeKey, mode);
    } catch {
      /* private browsing */
    }
  };

  const viewingFull = isFull && viewMode === "chama";

  const data = useChamaOverviewData(workspaceId, isFull, workspaceCtx?.modules);

  const { data: trust } = useTrustScore(workspaceId);
  const { data: meetings } = useMeetings(workspaceId);

  const { transactions } = useTransactions(
    isFull ? workspaceId : undefined
  );

  /* ---------------------------------------------------------------------- */
  /* Derived state                                                           */
  /* ---------------------------------------------------------------------- */

  const variant = viewingFull ? "official" : "member";

  const [openState, toggle, setMany] = useSectionState(
    workspaceId,
    DEFAULT_OPEN[variant],
    variant
  );
  const sec = (id) => ({
    id,
    open: Boolean(openState[id]),
    onToggle: () => toggle(id),
  });

  const collection = useMemo(
    () => buildCollection(data.contrib.data),
    [data.contrib.data]
  );

  const mgr = useMemo(
    () => buildMgr(data.mgr.data),
    [data.mgr.data]
  );

  const loans = useMemo(
    () => buildLoans(data.loans.data),
    [data.loans.data]
  );

  // Mirrors requireAuditAccess on the backend (treasurer or auditor only).
  const canViewAudit = ["treasurer", "auditor"].includes(
    String(workspace?.role || "").toLowerCase().replaceAll(" ", "_")
  );

  const pro = useOverviewPro(workspaceId, isFull, workspaceCtx?.modules, canViewAudit);

  if (loadingSummary && !summary) {
    return <PageSkeleton />;
  }

  const userName =
    user?.first_name ||
    user?.name?.split(" ")[0] ||
    "there";

  const now = new Date();

  /* ---------------------------------------------------------------------- */
  /* Cash flow                                                               */
  /* ---------------------------------------------------------------------- */

  const weeks = data.trend.data?.weeks || [];

  const income = weeks.reduce(
    (total, week) => total + num(week.income),
    0
  );

  const expense = weeks.reduce(
    (total, week) => total + num(week.expense),
    0
  );

  const net = income - expense;

  const prev =
    weeks.length >= 2
      ? num(weeks[weeks.length - 2].income)
      : 0;

  const wow =
    weeks.length >= 2 && prev > 0
      ? Math.round(
          ((num(weeks[weeks.length - 1].income) - prev) /
            prev) *
            1000
        ) / 10
      : null;

  /* ---------------------------------------------------------------------- */
  /* Activity                                                                */
  /* ---------------------------------------------------------------------- */

  const activity = (
    viewingFull
      ? [...(transactions?.items || [])]
          .map(normalizeTransaction)
          .sort(
            (a, b) =>
              new Date(b.at || 0) -
              new Date(a.at || 0)
          )
      : (mine?.my_recent_activity || []).map(
          normalizeMyPayment
        )
  ).slice(0, 8);

  const myFailed = (
    mine?.my_recent_activity || []
  ).filter((payment) => payment.status === "failed").length;

  const myPending = (
    mine?.my_recent_activity || []
  ).filter(
    (payment) =>
      !["completed", "failed"].includes(payment.status)
  ).length;

  /* ---------------------------------------------------------------------- */
  /* Meetings / trust                                                        */
  /* ---------------------------------------------------------------------- */

  const upcoming = (meetings || [])
    .filter(
      (meeting) =>
        meeting.startsAt &&
        new Date(meeting.startsAt) >= now
    )
    .sort(
      (a, b) =>
        new Date(a.startsAt) -
        new Date(b.startsAt)
    );

  const nextMeeting = upcoming[0] || null;

  const trustScore = trust?.score;

  const trustColor =
    trustScore >= 70
      ? "#10b981"
      : trustScore >= 40
        ? "#f59e0b"
        : "#ef4444";

  /* ---------------------------------------------------------------------- */
  /* Contributions                                                           */
  /* ---------------------------------------------------------------------- */

  const unpaidMembers = data.contrib.data
    ? collection.counts.unpaid +
      collection.counts.partial
    : num(stats.overdueCount);

  const collectionTone =
    collection.rate >= 80
      ? "emerald"
      : collection.rate >= 50
        ? "amber"
        : "rose";

  /* ---------------------------------------------------------------------- */
  /* Ledger                                                                  */
  /* ---------------------------------------------------------------------- */

  const gl = data.gl.data;

  /* ---------------------------------------------------------------------- */
  /* Attention                                                               */
  /* ---------------------------------------------------------------------- */

  const attention = (
    viewingFull
      ? [
          gl &&
            gl.balanced === false && {
              key: "books",
              tone: "rose",
              icon: ShieldAlert,
              title: "Books are out of balance",
              sub: `Difference ${money(gl.difference)}`,
              to: `${base}/finance/trial-balance`,
            },

          num(summary?.failed_transactions) > 0 && {
            key: "failed",
            tone: "rose",
            icon: XCircle,
            title: `${summary.failed_transactions} failed payment${
              summary.failed_transactions === 1
                ? ""
                : "s"
            }`,
            sub: "Check M-Pesa reconciliation",
            to: `${base}/finance/transactions`,
          },

          loans?.awaiting > 0 && {
            key: "loans",
            tone: "amber",
            icon: Clock,
            title: `${loans.awaiting} loan application${
              loans.awaiting === 1 ? "" : "s"
            } awaiting review`,
            sub:
              loans.pending
                ?.slice(0, 2)
                .map(
                  (loan) =>
                    `${loan.member_name || "Member"} · ${money(
                      loan.amount
                    )}`
                )
                .join(", ") || "Open the loan book",
            to: `${base}/loans`,
          },

          num(summary?.pending_payouts) > 0 && {
            key: "payouts",
            tone: "violet",
            icon: Clock,
            title: `${money(
              summary.pending_payouts
            )} in payouts awaiting approval`,
            sub: "Approval needed before release",
            to: `${base}/finance/payouts`,
          },

          unpaidMembers > 0 && {
            key: "unpaid",
            tone: "amber",
            icon: AlertTriangle,
            title: `${unpaidMembers} member${
              unpaidMembers === 1 ? "" : "s"
            } with an unpaid balance`,
            sub: data.contrib.data
              ? `${money(collection.balance)} outstanding`
              : "Send reminders",
            to: `${base}/contributions`,
          },

          mgr.active &&
            mgr.pending > 0 && {
              key: "mgr",
              tone: "sky",
              icon: RefreshCw,
              title: `MGR round #${mgr.number}: ${mgr.pending} of ${mgr.total} yet to pay`,
              sub: mgr.due
                ? `Due ${formatWhen(mgr.due, false)}`
                : "Round in progress",
              to: `${base}/mgr`,
            },

          num(summary?.pending_transactions) > 0 && {
            key: "pending",
            tone: "sky",
            icon: RefreshCw,
            title: `${summary.pending_transactions} pending transaction${
              summary.pending_transactions === 1
                ? ""
                : "s"
            }`,
            sub: "Awaiting confirmation",
            to: `${base}/finance/transactions`,
          },
        ]
      : [
          myFailed > 0 && {
            key: "my-failed",
            tone: "rose",
            icon: XCircle,
            title: `${myFailed} of your payments failed`,
            sub: "Retry from My Chama",
            to: `${base}/my-chama`,
          },

          myPending > 0 && {
            key: "my-pending",
            tone: "amber",
            icon: Clock,
            title: `${myPending} of your payments pending`,
            sub: "Check M-Pesa confirmation",
            to: `${base}/my-chama`,
          },

          mgr.active &&
            mgr.pending > 0 && {
              key: "mgr",
              tone: "sky",
              icon: RefreshCw,
              title: `MGR round #${mgr.number} is collecting`,
              sub: mgr.due
                ? `Due ${formatWhen(mgr.due, false)}`
                : "Round in progress",
              to: `${base}/mgr`,
            },
        ]
  ).filter(Boolean);

  /* ---------------------------------------------------------------------- */
  /* Books status                                                            */
  /* ---------------------------------------------------------------------- */

  const booksPill = !viewingFull
    ? null
    : data.gl.loading
      ? {
          c: "text-slate-500 bg-slate-100 dark:bg-obsidian-raised dark:text-mist-muted",
          t: "Checking books…",
          I: Clock,
        }
      : gl && gl.balanced === false
        ? {
            c: "text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300",
            t: "Books need attention",
            I: ShieldAlert,
          }
        : gl?.checkFailed
          ? {
              c: "text-slate-500 bg-slate-100 dark:bg-obsidian-raised dark:text-mist-muted",
              t: "Books check unavailable",
              I: Info,
            }
          : {
              c: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300",
              t: "Books balanced",
              I: ShieldCheck,
            };

  const lastPayment =
    (mine?.my_recent_activity || [])[0];

  /* ---------------------------------------------------------------------- */
  /* Sections                                                                */
  /* ---------------------------------------------------------------------- */

  /* ---------------------------------------------------------------------- */
  /* Pro command view (Chairperson / Treasurer)                              */
  /* ---------------------------------------------------------------------- */

  const proMembersList = pro.members.data || [];
  const membersLoaded = pro.members.data !== undefined;

  const pulse = buildMemberPulse(proMembersList, collection, now);
  const roleCoverage = buildRoleCoverage(proMembersList);
  const rolesKnown = membersLoaded ? roleCoverage : null;

  const trustComp = (key) =>
    trust?.components?.[key]?.hasData && (trust?.componentsUsed || []).includes(key)
      ? num(trust.components[key].score)
      : null;
  const kycPct = trustComp("kyc");

  const meetingState = buildMeetingState(meetings || [], now);
  const loanWatch = buildLoanWatch(data.loans.data?.portfolio?.loans || [], now);
  const flows = buildFlows(weeks);
  const treasury = buildTreasury(pro.accounts.data || [], summary);
  const funds = buildFundsBreakdown(summary);
  const loanToFund = buildLoanToFund(summary);

  const health = buildHealth({
    collectionRate: collection.hasData ? collection.rate : null,
    repayment: loans?.repayment ?? trustComp("repayment"),
    kyc: kycPct,
    attendance: meetingState.attendanceRate,
  });

  const trustExplain = buildTrustExplain(trust);
  const compliance = buildCompliance({ roles: rolesKnown, kycPct, meeting: meetingState, gl, trust });

  const risks = buildRiskFlags({
    base,
    meeting: meetingState,
    roles: rolesKnown,
    kycPct,
    loanWatch,
    gl,
    collectionRate: collection.rate,
    collectionHasData: collection.hasData,
    ltf: loanToFund,
  });

  const todos = buildGovTodos({ base, loans, summary, meeting: meetingState, hasGl: true });
  const priority = buildPriorityList({ risks, alerts: attention, todos });

  const activePlan = data.contrib.data?.activePlan;
  const contribDue = activePlan?.due_date || activePlan?.next_due_date || activePlan?.nextDueDate || null;
  const contribDueIn = contribDue ? daysFromNow(contribDue, now) : null;
  const dueContribs = contribDueIn == null || contribDueIn <= 7 ? unpaidMembers : 0;
  const owing = pulse.atRisk;
  const calendar = buildCalendar({ now, meetings: upcoming, loanWatch, contribDue, mgrDue: mgr.due });

  const recordUrl = canRecordForOthers
    ? `${base}/finance/record-contribution`
    : `${base}/finance/contributions`;
  const recordLabel = canRecordForOthers ? "Record payment" : "Pay my contribution";

  const shareText = buildSnapshotText({
    name: workspace?.name || "Chama",
    health,
    treasury: treasury.total,
    collection,
    members: pulse,
    trust,
    compliance,
  });

  const exportOverview = () => {
    const rows = [
      ["Measure", "Detail", "Value"],
      ["Health score", health.label, health.score != null ? `${health.score}/100` : "n/a"],
      ["Treasury", "Cash and bank ledger position", money(treasury.total)],
      ["Total fund value", "Pooled since inception", money(summary?.total_contributions)],
      ["Loans outstanding", loans ? `${loans.count} on the book` : "Owed to the chama", money(summary?.outstanding_loans)],
      ["Collection this cycle", collection.hasData ? `${collection.counts.paid} of ${collection.members.length} paid` : "No plan", collection.rate != null ? `${Math.round(collection.rate)}%` : "n/a"],
      ["Arrears", plural(owing.length, "member"), money(collection.balance)],
      ["Members", `${pulse.active} active of ${pulse.total}`, String(pulse.total)],
      ["Trust score", trust?.grade ? `Grade ${trust.grade}` : "Not generated", trust?.score != null ? `${trust.score}/100` : "n/a"],
      ["Compliance", compliance.label, compliance.passPct != null ? `${compliance.passPct}%` : "n/a"],
    ];
    printDocument({
      title: `${workspace?.name || "Chama"} overview`,
      group: workspace?.name || "Chama",
      kind: "Board report",
      meta: [
        ["Prepared", now.toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })],
        ["Prepared by", roleLabel(workspace?.role)],
      ],
      rows,
      signer: userName,
    });
  };

  // The one primary action, top right: fix arrears when there are any,
  // otherwise record a payment.
  const peopleFlags = (membersLoaded ? roleCoverage.missing.length : 0) + pulse.pending;
  const hasLoansModule = !workspaceCtx?.hasModule || workspaceCtx.hasModule("loans");
  const hasMeetingsModule = !workspaceCtx?.hasModule || workspaceCtx.hasModule("meetings");

  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "money", label: "Money", badge: owing.length || null, badgeTone: "amber" },
    { id: "people", label: "People", badge: peopleFlags || null, badgeTone: "amber" },
    {
      id: "governance",
      label: "Governance",
      badge: priority.length || null,
      badgeTone: priority.some((i) => i.tone === "rose") ? "rose" : "amber",
    },
    { id: "reports", label: "Reports" },
  ];

  const fixArrears = viewingFull && hasContributions && collection.hasData && collection.balance > 0;

  const alertRibbon = viewingFull
    ? attention.find((item) => item.tone === "rose") || null
    : null;

  const panelIds = viewingFull
    ? [
        "cashflow",
        "activity",
        "collections",
        "position",
        "mgr",
        "loans",
        "governance",
      ]
    : ["activity", "mgr", "governance"];

  const allIds = !viewingFull && attention.length
    ? ["attention", ...panelIds]
    : panelIds;

  const openCount = allIds.filter(
    (id) => openState[id]
  ).length;

  const allOpen = openCount === allIds.length;

  /* ---------------------------------------------------------------------- */
  /* Attention panel                                                         */
  /* ---------------------------------------------------------------------- */

  const attentionPanel = attention.length ? (
    <Section
      {...sec("attention")}
      icon={Bell}
      title="Needs your attention"
      summary={`${attention.length} item${
        attention.length === 1 ? "" : "s"
      } requiring action`}
      badge={
        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold tabular-nums text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
          {attention.length}
        </span>
      }
    >
      <ul className="grid gap-3 @2xl:grid-cols-2">
        {attention.map((item) => (
          <li key={item.key}>
            <Link
              to={item.to}
              className="group flex min-h-[70px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-violet-500 dark:border-obsidian-border dark:bg-obsidian-card dark:hover:bg-obsidian-raised"
            >
              <span
                className={clsx(
                  "h-10 w-1 shrink-0 rounded-full",
                  TONE_BAR[item.tone]
                )}
              />

              <span
                className={clsx(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 dark:bg-obsidian-raised",
                  TONE_TEXT[item.tone]
                )}
              >
                <item.icon
                  size={17}
                  aria-hidden="true"
                />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">
                  {item.title}
                </span>

                <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-mist-muted">
                  {item.sub}
                </span>
              </span>

              <ChevronRight
                size={17}
                className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-600 dark:text-mist-muted/50 dark:group-hover:text-mint"
              />
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  ) : (
    <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/20 lg:px-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
        <ShieldCheck size={17} />
      </span>

      <div className="min-w-0">
        <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
          Everything looks good
        </p>

        <p className="text-xs text-emerald-700/70 dark:text-emerald-300/70">
          Payments, loans and books are currently in order.
        </p>
      </div>
    </div>
  );

  /* ---------------------------------------------------------------------- */
  /* Cash flow                                                               */
  /* ---------------------------------------------------------------------- */

  const cashflowPanel = viewingFull && (
    <Section
      {...sec("cashflow")}
      icon={TrendingUp}
      title="Financial performance"
      summary={
        weeks.length
          ? `Income ${compact(income)} · Expenses ${compact(
              expense
            )} · Net ${net >= 0 ? "+" : ""}${compact(net)}`
          : "No weekly activity yet"
      }
    >
      {data.trend.error ? (
        <ErrorNote onRetry={data.trend.refetch} />
      ) : data.trend.loading ? (
        <Skeleton className="h-64 w-full" />
      ) : weeks.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No financial activity yet"
          hint="Contributions, payouts and other financial activity will appear here."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard
              icon={ArrowUpRight}
              label="Income"
              value={money(income)}
              sub={`Last ${weeks.length} weeks`}
              tone="emerald"
            />

            <KpiCard
              icon={ArrowDownRight}
              label="Expenses"
              value={money(expense)}
              sub={`Last ${weeks.length} weeks`}
              tone="rose"
            />

            <KpiCard
              icon={net >= 0 ? TrendingUp : TrendingDown}
              label="Net movement"
              value={`${net >= 0 ? "+" : "−"}${money(
                Math.abs(net)
              )}`}
              sub={
                wow !== null
                  ? `${wow >= 0 ? "+" : ""}${wow}% vs previous week`
                  : "No comparison available"
              }
              tone={net >= 0 ? "violet" : "rose"}
            />
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-obsidian-border dark:bg-obsidian-raised/30">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-mist">
                  Income & expenses
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-mist-muted">
                  Weekly movement across the chama
                </p>
              </div>

              <span className="rounded-lg bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500 shadow-sm dark:bg-obsidian-card dark:text-mist-muted">
                Last {weeks.length} weeks
              </span>
            </div>

            <CashFlowChart weeks={weeks} />
          </div>
        </div>
      )}
    </Section>
  );

  /* ---------------------------------------------------------------------- */
  /* Contributions                                                           */
  /* ---------------------------------------------------------------------- */

  const collectionsPanel = viewingFull && (
    <Section
      {...sec("collections")}
      icon={Users}
      title="Member contributions"
      summary={
        data.contrib.data
          ? `${
              collection.rate == null
                ? "—"
                : `${Math.round(collection.rate)}%`
            } collected · ${unpaidMembers} to pay`
          : "No contribution plan yet"
      }
      footer={
        <SeeAll to={`${base}/contributions`}>
          Manage contributions
        </SeeAll>
      }
    >
      {data.contrib.error ? (
        <ErrorNote onRetry={data.contrib.refetch} />
      ) : data.contrib.loading ? (
        <>
          <Skeleton className="mb-3 h-12 w-full" />
          <Skeleton className="h-44 w-full" />
        </>
      ) : !collection.hasData ? (
        <EmptyState
          icon={Users}
          title="No contribution plan yet"
          hint="Create a plan to track expected, paid and outstanding member contributions."
          action={
            canOpenDesk ? (
              <SeeAll to={deskContributionsLink}>
                Create a plan in the Leadership Desk
              </SeeAll>
            ) : null
          }
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard
              icon={PiggyBank}
              label="Expected"
              value={money(collection.expected)}
              sub="Current contribution cycle"
              tone="violet"
            />

            <KpiCard
              icon={Wallet}
              label="Collected"
              value={money(collection.paid)}
              sub={`${Math.round(
                collection.rate || 0
              )}% of expected`}
              tone="emerald"
            />

            <KpiCard
              icon={AlertTriangle}
              label="Outstanding"
              value={money(collection.balance)}
              sub={`${unpaidMembers} member${
                unpaidMembers === 1 ? "" : "s"
              }`}
              tone={
                collection.balance > 0
                  ? "amber"
                  : "emerald"
              }
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2 text-xs">
              <span className="font-bold">
                {collection.planName ||
                  "Current contribution plan"}
              </span>

              <span className="tabular-nums text-slate-500 dark:text-mist-muted">
                <b className="font-bold text-slate-900 dark:text-mist">
                  {money(collection.paid)}
                </b>{" "}
                of {money(collection.expected)}
              </span>
            </div>

            <ProgressBar
              value={collection.rate}
              label="Collection progress"
              tone={collectionTone}
            />
          </div>

          <MemberPaymentsTable
            members={collection.members}
            counts={collection.counts}
          />
        </div>
      )}
    </Section>
  );

  /* ---------------------------------------------------------------------- */
  /* Activity                                                                */
  /* ---------------------------------------------------------------------- */

  const activityPanel = (
    <Section
      {...sec("activity")}
      icon={Activity}
      title={
        viewingFull
          ? "Recent transactions"
          : "Your recent payments"
      }
      summary={
        activity.length
          ? `${activity.length} recent · latest ${formatWhen(
              activity[0].at
            )}`
          : "Nothing recorded yet"
      }
      footer={
        <SeeAll
          to={
            viewingFull
              ? `${base}/finance/transactions`
              : `${base}/my-chama`
          }
        >
          {viewingFull
            ? "All transactions"
            : "All my payments"}
        </SeeAll>
      }
    >
      {activity.length ? (
        <ActivityList items={activity} />
      ) : (
        <EmptyState
          icon={Activity}
          title={
            viewingFull
              ? "No transactions recorded yet"
              : "No contributions recorded yet"
          }
          hint="Confirmed payments and financial activity will appear here."
        />
      )}
    </Section>
  );

  /* ---------------------------------------------------------------------- */
  /* Financial position                                                      */
  /* ---------------------------------------------------------------------- */

  const positionPanel = viewingFull && (
    <Section
      {...sec("position")}
      icon={Landmark}
      title="Financial position"
      summary={`Equity ${money(
        summary?.equity
      )} · ${
        gl && gl.balanced === false
          ? "books out of balance"
          : "books balanced"
      }`}
      footer={
        <SeeAll to={`${base}/finance/balance-sheet`}>
          Balance sheet
        </SeeAll>
      }
    >
      {num(summary?.assets) === 0 &&
      num(summary?.liabilities) === 0 &&
      num(summary?.equity) === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No balances posted yet"
          hint="Assets, liabilities and equity will appear once financial transactions are posted."
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard
              icon={Wallet}
              label="Assets"
              value={money(summary.assets)}
              tone="emerald"
            />

            <KpiCard
              icon={Coins}
              label="Liabilities"
              value={money(summary.liabilities)}
              tone="amber"
            />

            <KpiCard
              icon={Landmark}
              label="Equity"
              value={money(summary.equity)}
              tone="violet"
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-bold text-slate-600 dark:text-mist-muted">
              How assets are funded
            </p>

            <StackedBar
              segments={[
                {
                  key: "eq",
                  label: "Equity",
                  value: Math.max(
                    0,
                    num(summary.equity)
                  ),
                  color: "#10b981",
                  display: `${Math.round(
                    pct(
                      summary.equity,
                      summary.assets
                    )
                  )}%`,
                },
                {
                  key: "li",
                  label: "Liabilities",
                  value: Math.max(
                    0,
                    num(summary.liabilities)
                  ),
                  color: "#f59e0b",
                  display: `${Math.round(
                    pct(
                      summary.liabilities,
                      summary.assets
                    )
                  )}%`,
                },
              ]}
            />
          </div>

          <DetailRows
            rows={[
              [
                "Ledger debits",
                gl && !gl.checkFailed
                  ? money(gl.totalDebits)
                  : "—",
              ],
              [
                "Ledger credits",
                gl && !gl.checkFailed
                  ? money(gl.totalCredits)
                  : "—",
              ],
              [
                "Lifetime transactions",
                num(
                  summary?.total_transactions
                ).toLocaleString(),
              ],
            ]}
          />
        </div>
      )}
    </Section>
  );

  /* ---------------------------------------------------------------------- */
  /* Merry-go-round                                                          */
  /* ---------------------------------------------------------------------- */

  const mgrPanel = (
    <Section
      {...sec("mgr")}
      icon={RefreshCw}
      title="Merry-go-round"
      summary={
        mgr.active
          ? `Round #${mgr.number} · ${Math.round(
              mgr.pct
            )}% collected`
          : "No active round"
      }
      footer={
        <SeeAll to={`${base}/mgr`}>
          Open merry-go-round
        </SeeAll>
      }
    >
      {data.mgr.error ? (
        <ErrorNote onRetry={data.mgr.refetch} />
      ) : data.mgr.loading ? (
        <Skeleton className="h-36 w-full" />
      ) : !mgr.active ? (
        <EmptyState
          icon={RefreshCw}
          title={
            mgr.hasPolicy
              ? "Policy created, no round running"
              : "No merry-go-round yet"
          }
          hint={
            viewingFull
              ? "Set up a rotation to start collecting."
              : "Your chama has not started a rotation."
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
          <Ring
            value={mgr.pct}
            size={96}
            stroke={9}
            label="Round collection"
            color="#f59e0b"
          >
            <span className="text-lg font-bold tabular-nums">
              {Math.round(mgr.pct)}%
            </span>
            <span className="text-[10px] text-slate-400">
              collected
            </span>
          </Ring>

          <DetailRows
            rows={[
              [
                "Round",
                `#${mgr.number}${
                  mgr.roundCount
                    ? ` of ${mgr.roundCount}`
                    : ""
                }`,
              ],
              [
                "Recipient",
                mgr.recipient || "—",
              ],
              [
                "Pot",
                `${money(
                  mgr.collected
                )} / ${money(mgr.expected)}`,
              ],
              [
                "Paid",
                `${mgr.paid} of ${mgr.total} members`,
              ],
              mgr.due && [
                "Due",
                formatWhen(mgr.due, false),
              ],
            ]}
          />
        </div>
      )}
    </Section>
  );

  /* ---------------------------------------------------------------------- */
  /* Loans                                                                   */
  /* ---------------------------------------------------------------------- */

  const loansPanel = viewingFull && (
    <Section
      {...sec("loans")}
      icon={Coins}
      title="Loan portfolio"
      summary={
        loans
          ? `${loans.awaiting} awaiting review${
              loans.repayment != null
                ? ` · ${loans.repayment}% repaid`
                : ""
            }`
          : "Loan data unavailable"
      }
      footer={
        <SeeAll to={`${base}/loans`}>
          Open loan book
        </SeeAll>
      }
    >
      {data.loans.error ? (
        <ErrorNote onRetry={data.loans.refetch} />
      ) : data.loans.loading ? (
        <Skeleton className="h-48 w-full" />
      ) : !loans ? (
        <EmptyState
          icon={Coins}
          title="Loan portfolio unavailable"
          hint="Loan information is visible to authorised officials."
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard
              icon={ShieldCheck}
              label="Repayment"
              value={
                loans.repayment != null
                  ? `${loans.repayment}%`
                  : "—"
              }
              sub={
                loans.allCurrent
                  ? "All current"
                  : "Some overdue"
              }
              tone={
                loans.allCurrent
                  ? "emerald"
                  : "amber"
              }
            />

            <KpiCard
              icon={AlertTriangle}
              label="At risk"
              value={money(loans.atRisk)}
              sub="Overdue + defaulted"
              tone={
                loans.atRisk > 0
                  ? "rose"
                  : "emerald"
              }
            />

            <KpiCard
              icon={TrendingUp}
              label="Interest earned"
              value={money(loans.interest)}
              sub="Portfolio income"
              tone="violet"
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-bold text-slate-600 dark:text-mist-muted">
              Loans by status
            </p>

            <StackedBar
              segments={loans.buckets}
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-bold text-slate-600 dark:text-mist-muted">
                Awaiting review
              </p>

              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                {loans.awaiting}
              </span>
            </div>

            {loans.pending.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-500">
                No applications waiting.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-obsidian-border dark:border-obsidian-border">
                {loans.pending
                  .slice(0, 4)
                  .map((loan) => (
                    <li
                      key={
                        loan.id ||
                        loan._id
                      }
                      className="flex items-center justify-between gap-3 px-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold">
                          {loan.member_name ||
                            "Chama member"}
                        </p>

                        <p className="truncate text-[11px] text-slate-500 dark:text-mist-muted">
                          {loan.purpose ||
                            "Personal credit"}
                        </p>
                      </div>

                      <span className="shrink-0 text-xs font-bold tabular-nums">
                        {money(loan.amount)}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Section>
  );

  /* ---------------------------------------------------------------------- */
  /* Governance                                                              */
  /* ---------------------------------------------------------------------- */

  const governancePanel = (
    <Section
      {...sec("governance")}
      icon={ShieldCheck}
      title="Trust & governance"
      summary={`Trust ${
        trustScore ?? "—"
      }/100 · ${
        nextMeeting
          ? formatWhen(nextMeeting.startsAt)
          : "no meeting scheduled"
      }`}
      footer={
        <>
          {viewingFull ? (
            <SeeAll to={`${base}/trust-score`}>
              {trust
                ? "Trust report"
                : "Generate a report"}
            </SeeAll>
          ) : null}

          <SeeAll to={`${base}/meetings`}>
            {nextMeeting
              ? "Meeting space"
              : "Schedule a meeting"}
          </SeeAll>
        </>
      }
    >
      <div className="space-y-4">
        {viewingFull && (
          <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-obsidian-border dark:bg-obsidian-raised/30">
            <Ring
              value={trustScore ?? 0}
              size={78}
              stroke={8}
              color={trustColor}
              label="Trust score"
            >
              <span className="text-base font-bold tabular-nums">
                {trustScore ?? "—"}
              </span>

              <span className="text-[10px] text-slate-400">
                / 100
              </span>
            </Ring>

            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-mist-muted">
                Governance health
              </p>

              <p className="mt-1 text-sm font-bold">
                {trust?.grade
                  ? `Grade ${trust.grade}`
                  : "No score generated yet"}
              </p>

              <p className="mt-1 text-[11px] text-slate-500 dark:text-mist-muted">
                Based on available trust and governance signals.
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-3 rounded-2xl border border-slate-200 p-4 dark:border-obsidian-border">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-obsidian-raised dark:text-mist-muted">
            <Calendar size={16} />
          </span>

          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Next meeting
            </p>

            <p className="mt-1 text-sm font-bold">
              {nextMeeting
                ? nextMeeting.title
                : "Plan your next members meeting"}
            </p>

            <p className="mt-1 text-xs text-slate-500 dark:text-mist-muted">
              {nextMeeting
                ? formatWhen(
                    nextMeeting.startsAt
                  )
                : "No meeting scheduled"}
            </p>

            {nextMeeting?.agenda ? (
              <p className="mt-2 line-clamp-2 text-xs text-slate-500 dark:text-mist-muted">
                {nextMeeting.agenda}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </Section>
  );

  /* ---------------------------------------------------------------------- */
  /* Render                                                                  */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="mx-auto max-w-[96rem] space-y-6 pb-28 font-sans text-slate-900 dark:text-mist lg:space-y-8 lg:pb-12">
      {/* ------------------------------------------------------------------ */}
      {/* COMMAND HEADER                                                     */}
      {/* ------------------------------------------------------------------ */}
      <header className="chama-overview-header relative overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_12px_40px_-28px_rgba(15,23,42,0.28)] dark:border-obsidian-border dark:bg-obsidian-card">
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-violet-500/[0.06] blur-3xl dark:bg-mint/[0.05]" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-sky-400/[0.05] blur-3xl" />

        <div className="chama-overview-header-content relative flex flex-col gap-5 p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-mint">
                <Wallet size={15} />
              </span>

              <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400 dark:text-mist-muted">
                Chama financial workspace
              </span>

              {booksPill ? (
                <span
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold",
                    booksPill.c
                  )}
                >
                  <booksPill.I size={11} />
                  {booksPill.t}
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-2">
              <h1 className="chama-overview-title text-2xl font-extrabold tracking-tight sm:text-3xl">
                {greeting(now.getHours())}, {userName}
              </h1>

              <span className="hidden h-1.5 w-1.5 rounded-full bg-slate-300 sm:block" />

              <span className="chama-overview-workspace text-sm font-bold text-slate-600 dark:text-mist-muted">
                {workspace?.name || "Chama"}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-slate-500 dark:text-mist-muted">
              <span className="rounded-lg bg-slate-100 px-2 py-1 font-bold text-slate-700 dark:bg-obsidian-raised dark:text-mist">
                {roleLabel(workspace?.role)}
              </span>

              <span className="h-1 w-1 rounded-full bg-slate-300" />

              <span>
                {now.toLocaleDateString("en-KE", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>

              {refreshing ? (
                <>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span
                    aria-live="polite"
                    className="inline-flex items-center gap-1 font-semibold text-violet-600 dark:text-mint"
                  >
                    <RefreshCw size={11} className="animate-spin" />
                    Updating figures
                  </span>
                </>
              ) : null}
            </div>
          </div>

          <div className="chama-overview-actions flex flex-wrap items-center gap-2">
            {isFull ? (
              <div
                role="tablist"
                aria-label="Dashboard view"
                className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50/80 p-1 dark:border-obsidian-border dark:bg-obsidian-raised"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === "chama"}
                  onClick={() => setAndPersistViewMode("chama")}
                  className={clsx(
                    "min-h-9 rounded-lg px-3 text-xs font-bold transition",
                    viewMode === "chama"
                      ? "bg-white text-slate-950 shadow-sm dark:bg-obsidian-card dark:text-mist"
                      : "text-slate-500 hover:text-slate-900 dark:text-mist-muted dark:hover:text-mist"
                  )}
                >
                  Chama
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === "mine"}
                  onClick={() => setAndPersistViewMode("mine")}
                  className={clsx(
                    "min-h-9 rounded-lg px-3 text-xs font-bold transition",
                    viewMode === "mine"
                      ? "bg-white text-slate-950 shadow-sm dark:bg-obsidian-card dark:text-mist"
                      : "text-slate-500 hover:text-slate-900 dark:text-mist-muted dark:hover:text-mist"
                  )}
                >
                  My view
                </button>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("finance:updated"))}
              className={clsx(
                iconBtnCls,
                "bg-white/80 shadow-sm dark:bg-obsidian-raised"
              )}
              aria-label="Refresh figures"
              title="Refresh figures"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            </button>

            <Link
              to={`${base}/my-chama`}
              className={clsx(btnCls, "bg-white/80 shadow-sm dark:bg-obsidian-raised")}
            >
              <User size={14} />
              My Chama
            </Link>

            {hasSavings ? (
              <button
                type="button"
                onClick={() => setStkOpen(true)}
                className={clsx(btnCls, "bg-white/80 shadow-sm dark:bg-obsidian-raised")}
              >
                <PiggyBank size={14} />
                Deposit to savings
              </button>
            ) : null}

            {hasContributions ? (
              <Link
                to={fixArrears ? `${base}/contributions` : recordUrl}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-extrabold text-white shadow-[0_8px_22px_-12px_rgba(124,58,237,0.7)] transition hover:-translate-y-0.5 hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 dark:bg-mint dark:text-mint-strong dark:hover:bg-mint-hover"
              >
                {fixArrears ? <AlertTriangle size={16} strokeWidth={2.5} /> : <Plus size={16} strokeWidth={2.5} />}
                {fixArrears
                  ? "Fix arrears"
                  : canRecordForOthers
                    ? "Record contribution"
                    : "Pay my contribution"}
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* PRIMARY MONEY SURFACE                                               */}
      {/* ------------------------------------------------------------------ */}
      {viewingFull ? (
        <BusinessFundsSeparationNotice workspaceId={workspaceId} pending={summary?.business_separation_pending} />
      ) : null}
      {viewingFull ? (
        <div className="space-y-6">
          <HealthStrip
            base={base}
            workspace={workspace}
            verified={Boolean(workspace?.verified || workspace?.is_verified)}
            established={workspace?.createdAt || workspace?.created_at}
            members={pulse}
            summary={summary}
            treasury={treasury}
            health={health}
            collection={collection}
            unpaid={unpaidMembers}
            compliance={compliance}
            trust={trust}
            onExplainTrust={() => setTrustOpen(true)}
          />

          <OverviewTabs tabs={tabs} value={activeTab} onChange={setTab} />

          <div
            role="tabpanel"
            id={`ov-panel-${activeTab}`}
            aria-labelledby={`ov-tab-${activeTab}`}
            className="space-y-8"
          >
            {/* Other tabs keep one slim reminder of the most urgent problem. */}
            {activeTab !== "summary" && alertRibbon ? (
              <Link
                to={alertRibbon.to}
                className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-3 transition hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-rose-500 dark:border-rose-900/50 dark:bg-rose-950/20"
              >
                <alertRibbon.icon size={17} className="shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-rose-900 dark:text-rose-200">{alertRibbon.title}</span>
                <span className="hidden shrink-0 text-xs font-semibold text-rose-700 dark:text-rose-300 sm:inline">{alertRibbon.sub}</span>
                <ChevronRight size={16} className="shrink-0 text-rose-400" aria-hidden="true" />
              </Link>
            ) : null}

            {activeTab === "summary" ? (
              <div className="grid gap-6 xl:grid-cols-12">
                <div className="min-w-0 space-y-6 xl:col-span-8">
                  <div className="xl:hidden">
                    <AttentionCard base={base} items={priority} />
                  </div>

                  <FinancialSnapshot
                    compact
                    base={base}
                    collection={collection}
                    flows={flows}
                    summary={summary}
                    treasury={treasury}
                    funds={funds}
                    contribDue={contribDue}
                    loanWatch={loanWatch}
                    unpaid={unpaidMembers}
                    atRiskMembers={owing}
                    onNudge={() => setNudgeOpen(true)}
                  />

                  <ProPanel icon={TrendingUp} title="Income vs expenses" eyebrow={weeks.length ? `Weekly, last ${weeks.length} weeks` : "Weekly"}>
                    {weeks.length ? (
                      <CashFlowChart weeks={weeks} height={200} />
                    ) : (
                      <Nudge icon={Coins} title="No cashflow yet" hint="Income and expenses chart once money moves." to={recordUrl} cta="Record payment" />
                    )}
                  </ProPanel>

                  <TimelinePanel base={base} activity={activity} loans={loans} />
                </div>

                <aside className="min-w-0 space-y-6 xl:col-span-4">
                  <div className="hidden xl:block">
                    <AttentionCard base={base} items={priority} />
                  </div>
                  <MeetingCard base={base} meeting={meetingState} />
                  <QuickActionsCard
                    base={base}
                    recordUrl={recordUrl}
                    recordLabel={recordLabel}
                    showRecord={hasContributions}
                    onNudge={() => setNudgeOpen(true)}
                    onExport={exportOverview}
                    hasLoans={hasLoansModule}
                    hasMeetings={hasMeetingsModule}
                  />
                  <UpcomingCard
                    dueContribs={dueContribs}
                    loanWatch={loanWatch}
                    meeting={meetingState}
                    calendar={calendar}
                    hasLoans={hasLoansModule}
                  />
                </aside>
              </div>
            ) : null}

            {activeTab === "money" ? (
              <>
                <FinancialSnapshot
                  base={base}
                  collection={collection}
                  flows={flows}
                  summary={summary}
                  treasury={treasury}
                  funds={funds}
                  contribDue={contribDue}
                  loanWatch={loanWatch}
                  unpaid={unpaidMembers}
                  atRiskMembers={owing}
                  onNudge={() => setNudgeOpen(true)}
                />
                <div className="grid gap-4 xl:grid-cols-2">
                  {hasLoansModule ? (
                    <LoansPanel
                      base={base}
                      loans={loans}
                      loanWatch={loanWatch}
                      ltf={loanToFund}
                      summary={summary}
                      loading={data.loans.loading}
                    />
                  ) : null}
                  <ExpensesPanel base={base} activity={activity} />
                </div>
              </>
            ) : null}

            {activeTab === "people" ? (
              <MemberPulse
                base={base}
                pulse={pulse}
                roles={roleCoverage}
                kycPct={kycPct}
                meeting={meetingState}
                loading={pro.members.loading}
              />
            ) : null}

            {activeTab === "governance" ? (
              <>
                <GovernancePanel
                  base={base}
                  todos={todos}
                  trust={trust}
                  trustExplain={trustExplain}
                  onExplainTrust={() => setTrustOpen(true)}
                  compliance={compliance}
                  risks={risks}
                  meeting={meetingState}
                  polls={pro.polls.data || []}
                />
                <AuditPanel base={base} audit={pro.audit} canView={canViewAudit} />
              </>
            ) : null}

            {activeTab === "reports" ? (
              <>
                <InsightCharts
                  base={base}
                  weeks={weeks}
                  growth={pulse.growth}
                  trustHistory={pro.trustHistory.data}
                  meeting={meetingState}
                />
                <AdminControl
                  base={base}
                  pulse={pulse}
                  shareText={shareText}
                  onExport={exportOverview}
                />
              </>
            ) : null}
          </div>
        </div>
      ) : (
        <BalanceHero
          label="Your financial position"
          icon={Wallet}
          value={mine?.my_total_contributions}
          caption="Your total confirmed contributions to this chama"
        >
          <StatStrip onDark>
            <Stat
              onDark
              label="Last payment"
              value={lastPayment ? money(lastPayment.amount) : "—"}
              sub={lastPayment ? formatWhen(lastPayment.paid_at, false) : "None yet"}
            />
            <Stat
              onDark
              label="Payments made"
              value={num(mine?.my_payment_count).toLocaleString()}
              sub="Confirmed"
            />
            <Stat
              onDark
              label="Trust score"
              value={
                <>
                  {trustScore ?? "—"}
                  <span className="text-sm font-medium text-white/50"> / 100</span>
                </>
              }
              sub={trust?.grade ? `Grade ${trust.grade}` : "Not generated yet"}
            />
          </StatStrip>
        </BalanceHero>
      )}

      {!viewingFull ? (
        <>
      {/* ------------------------------------------------------------------ */}
      {/* EXECUTIVE SNAPSHOT                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section className="space-y-3">
        <SectionHeader
          eyebrow="At a glance"
          title={viewingFull ? "Financial health" : "Your chama activity"}
          description={
            viewingFull
              ? "The four signals worth seeing before opening the detailed books."
              : "Your contribution activity, payment rhythm and trust position."
          }
        />

        {viewingFull ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={Wallet}
              label="Group balance"
              value={money(summary?.cash_balance ?? stats.totalBalance)}
              sub="Cash and bank ledger"
              tone="violet"
              trend={wow !== null ? `${wow >= 0 ? "+" : ""}${wow}% WoW` : undefined}
            />
            <KpiCard
              icon={PiggyBank}
              label="Savings pool"
              value={money(summary?.savings_balance)}
              sub="Member savings"
              tone="emerald"
            />
            <KpiCard
              icon={Coins}
              label="Loans outstanding"
              value={money(summary?.outstanding_loans)}
              sub={
                loans
                  ? `${loans.count} loan${loans.count === 1 ? "" : "s"} on the book`
                  : "Owed to the chama"
              }
              tone="amber"
            />
            <KpiCard
              icon={Users}
              label="Collection rate"
              value={
                data.contrib.loading
                  ? "…"
                  : collection.rate == null
                    ? "—"
                    : `${Math.round(collection.rate)}%`
              }
              sub={
                collection.hasData
                  ? unpaidMembers > 0
                    ? `${unpaidMembers} member${unpaidMembers === 1 ? "" : "s"} still to pay`
                    : "Everyone is up to date"
                  : "No contribution plan yet"
              }
              tone={collectionTone}
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={Wallet}
              label="Your contributions"
              value={money(mine?.my_total_contributions)}
              sub="Total paid into this chama"
              tone="violet"
            />
            <KpiCard
              icon={Activity}
              label="Payments made"
              value={num(mine?.my_payment_count).toLocaleString()}
              sub="Confirmed payments"
              tone="emerald"
            />
            <KpiCard
              icon={Clock}
              label="Last payment"
              value={lastPayment ? money(lastPayment.amount) : "—"}
              sub={lastPayment ? formatWhen(lastPayment.paid_at, false) : "No payment yet"}
              tone="amber"
            />
            <KpiCard
              icon={ShieldCheck}
              label="Chama trust"
              value={trustScore != null ? `${trustScore}/100` : "—"}
              sub={trust?.grade ? `Grade ${trust.grade}` : "Not generated yet"}
              tone="emerald"
            />
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* ACTION RAIL                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-obsidian-border dark:bg-obsidian-raised/40">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="px-1 lg:w-48 lg:shrink-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400 dark:text-mist-muted">
              Shortcuts
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-mist">
              Move money or inspect the books.
            </p>
          </div>

          <div className="grid flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {hasContributions ? (
              <QuickAction
                icon={Plus}
                label={canRecordForOthers ? "Record contribution" : "Pay my contribution"}
                description={
                  canRecordForOthers
                    ? "Collect from a member"
                    : "Pay what you owe by M-Pesa"
                }
                to={
                  canRecordForOthers
                    ? `${base}/finance/record-contribution`
                    : `${base}/finance/contributions`
                }
              />
            ) : (
              <QuickAction
                icon={PiggyBank}
                label="Deposit to savings"
                description="Start an M-Pesa deposit"
                onClick={() => setStkOpen(true)}
              />
            )}
            <QuickAction
              icon={Activity}
              label={viewingFull ? "Transactions" : "My payments"}
              description={viewingFull ? "Review financial activity" : "Contribution history"}
              to={viewingFull ? `${base}/finance/transactions` : `${base}/my-chama`}
            />
            <QuickAction
              icon={Users}
              label="Contributions"
              description="Track member collections"
              to={`${base}/contributions`}
            />
            <QuickAction
              icon={ShieldCheck}
              label="Trust & governance"
              description="Meetings, trust and governance"
              to={`${base}/meetings`}
            />
          </div>
        </div>
      </section>

        </>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* ATTENTION                                                            */}
      {/* ------------------------------------------------------------------ */}
      {!viewingFull ? (
        <div className="space-y-2">
          {attentionPanel}
        </div>
      ) : null}

      {!viewingFull || activeTab === "reports" ? (
        <>
      {/* ------------------------------------------------------------------ */}
      {/* DETAIL TOOLBAR                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-3 border-t border-slate-200/80 pt-5 sm:flex-row sm:items-end sm:justify-between dark:border-obsidian-border">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400 dark:text-mist-muted">
            Financial intelligence
          </p>
          <p className="mt-1 text-sm font-bold">Detailed books, activity and governance</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-mist-muted">
            Open only the sections you need; the overview stays focused on the money that matters now.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setMany(allIds, !allOpen)}
          className={clsx(btnCls, "shrink-0")}
        >
          {allOpen ? <ChevronsDownUp size={15} /> : <ChevronsUpDown size={15} />}
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* ANALYTICS GRID                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
          {cashflowPanel}
          {collectionsPanel}
          {activityPanel}
          {positionPanel}
        </div>

        <aside className="flex min-w-0 flex-col gap-5 xl:col-span-4">
          {loansPanel}
          {mgrPanel}
          {governancePanel}
        </aside>
      </div>

        </>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* MEMBER VISIBILITY                                                    */}
      {/* ------------------------------------------------------------------ */}
      {!viewingFull ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-obsidian-border dark:bg-obsidian-card">
          <div className="flex items-start gap-3 p-4 sm:p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-obsidian-raised dark:text-mist-muted">
              <Info size={16} />
            </span>

            <div className="min-w-0">
              <p className="text-sm font-extrabold">Your financial visibility</p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-mist-muted">
                The chama wallet, cash flow and full transaction records are available to authorised officials.
                Members can still access published financial reports from{" "}
                <Link
                  to={`${base}/reports`}
                  className="font-bold text-violet-600 hover:underline dark:text-mint"
                >
                  Books &amp; Reports
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {viewingFull ? (
        <>
          <TrustExplainModal
            open={trustOpen}
            onClose={() => setTrustOpen(false)}
            explain={trustExplain}
            base={base}
          />
          <NudgeModal
            open={nudgeOpen}
            onClose={() => setNudgeOpen(false)}
            members={owing}
            groupName={workspace?.name}
            phoneFor={(row) => findMemberPhone(proMembersList, row)}
          />
        </>
      ) : null}

      <MpesaStkModal
        isOpen={stkOpen}
        onClose={() => setStkOpen(false)}
        chamaId={workspaceId}
        title="Deposit to Savings via M-Pesa"
      />
    </div>
  );
}