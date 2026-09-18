import React, { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import {
  TrendingUp,
  Wallet,
  PiggyBank,
  RefreshCw,
  AlertTriangle,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight,
  SlidersHorizontal,
  User,
  Users,
  Info,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Lock,
  Plus,
} from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";
import useAuth from "@/app/hooks/useAuth";
import MpesaStkModal from "@/modules/finance/components/MpesaStkModal";
import useFinanceSummary from "@/modules/finance/hooks/useFinanceSummary";
import useMyFinanceSummary from "@/modules/finance/hooks/useMyFinanceSummary";
import useLedger from "@/modules/finance/hooks/useLedger";
import financeService, { CATEGORY_LABELS } from "@/modules/finance/services/finance.service";
import mgrApi from "../api/mgr.api";
import { useTrustScore } from "@/modules/trustScore/hooks/useTrustScore";
import { useMeetings } from "@/modules/meetings/hooks/useMeetings";
import loanService from "@/modules/loans/services/loan.service";

// Badge colour per money-movement category, matching LedgerTable so the
// same product reads the same way everywhere in the app.
const CATEGORY_BADGE_STYLES = {
  deposit: "bg-violet-100 text-violet-700 dark:bg-mint-deep/60 dark:text-mint",
  contribution_payment: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  mgr_contribution: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  chama_contribution_payment: "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300",
  loan_disbursement: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  loan_repayment: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  payout: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
};
const DEFAULT_BADGE_STYLE = "bg-slate-100 text-slate-600 dark:bg-obsidian-raised dark:text-mist-muted";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

// Matches the label set on the Members page (see ROLE_OPTIONS in
// MembersPage.jsx) so the same role always reads the same way
// wherever it's shown in the workspace.
const ROLE_LABELS = {
  member: "Member",
  treasurer: "Treasurer",
  secretary: "Secretary",
  auditor: "Auditor",
  chairperson: "Chairperson",
  committee_member: "Committee Member",
  patron: "Patron",
};
const formatRoleLabel = (role) => {
  if (!role) return "Member";
  const key = String(role).toLowerCase();
  return ROLE_LABELS[key] || (key.charAt(0).toUpperCase() + key.slice(1));
};

// Time-of-day greeting - recomputed off a live clock (see `now` state in
// the component) so it flips from "Good afternoon" to "Good evening" on
// its own without a page reload.
const getTimeGreeting = (hour) => {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
};

// Standard in-place "officials only" state for a chama-wide card. Keeps
// the exact same card shell/position/size for every role — only the
// body swaps — so a member and a treasurer are looking at the same
// page layout, never a shorter/emptier one. `compact` trims the
// vertical padding for cards that sit inside a tighter grid slot.
const RestrictedCardBody = ({ label = "Visible to chama officials", compact = false }) => (
  <div className={`flex flex-col items-center justify-center text-center ${compact ? "py-4" : "py-8"}`}>
    <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-obsidian-raised dark:text-mist-muted">
      <Lock size={16} />
    </div>
    <p className="text-[11px] font-bold text-slate-400 dark:text-mist-muted">{label}</p>
  </div>
);

export default function ChamaOverviewPage({ dashboard = {} }) {
  const { workspaceId: paramId } = useParams();
  const workspaceCtx = useWorkspace();
  const { user } = useAuth();
  const workspaceId = paramId || workspaceCtx?.workspaceId;

  const [isStkOpen, setIsStkOpen] = useState(false);
  const [mgrData, setMgrData] = useState(null);
  const [trend, setTrend] = useState({ weeks: [] });
  const [glStatus, setGlStatus] = useState(null);
  const [now, setNow] = useState(new Date());
  const [insightIndex, setInsightIndex] = useState(0);
  const [loanPortfolio, setLoanPortfolio] = useState(null);

  const workspace = dashboard?.workspace || workspaceCtx?.currentWorkspace || {};
  const stats = dashboard?.stats || {};
  const { summary: financeSummary, isLoading: loadingSummary } = useFinanceSummary(workspaceId);
  const { summary: mySummary, loading: loadingMySummary } = useMyFinanceSummary(workspaceId);

  // The backend tells us exactly what scope this viewer's finance
  // summary came back at (see finance.controller.js#getFinanceSummary):
  // 'all' means a chama official looking at the chama's real books,
  // anything else means a plain member who got their own totals
  // instead. Driving the layout off this - rather than re-deriving it
  // from `workspace.role` here - keeps the UI in lockstep with what the
  // backend actually authorized, so the two can never drift apart.
  const isFullChamaView = financeSummary?.scope === "all";

  // Chama-wide ledger activity is an officials-only view (see
  // finance.controller.js#getGeneralLedger) - only fetch it once we know
  // the viewer actually has the 'all' scope, so a plain member never
  // fires a request the backend would 403 anyway.
  const { entries: ledgerEntries, isLoading: loadingLedger } = useLedger(
    isFullChamaView ? workspaceId : undefined,
    { limit: 10 }
  );

  // Chama-wide trust score and upcoming meetings — both read by every
  // member (not officials-only), so fetched unconditionally like the
  // rest of the "shared" widgets on this page.
  const { data: trustScore } = useTrustScore(workspaceId);
  const { data: meetingsList } = useMeetings(workspaceId);

  useEffect(() => {
    if (workspaceId) {
      mgrApi.getOverview(workspaceId)
        .then((res) => setMgrData(res?.data?.data))
        .catch(() => {});
    }
  }, [workspaceId]);

  // Loan book totals for the "Loan book" stat card — portfolio is
  // official-only (see loan.service.js#getDashboard), so only fetch it
  // once we know this viewer has the 'all' scope, same guard used for
  // the ledger and GL status above.
  useEffect(() => {
    if (!workspaceId || !isFullChamaView) return;
    loanService.getDashboard(workspaceId).then(setLoanPortfolio).catch(() => {});
  }, [workspaceId, isFullChamaView]);

  // Weekly income/expense trend and the GL balance check are both
  // chama-wide reads - only worth fetching once we know this viewer has
  // the 'all' scope (see isFullChamaView above), same reasoning as the
  // ledger fetch.
  useEffect(() => {
    if (!workspaceId || !isFullChamaView) return;
    financeService.getTrend(workspaceId).then(setTrend);
    financeService.getGlBalance(workspaceId).then(setGlStatus);
  }, [workspaceId, isFullChamaView]);

  // Live clock - drives both the time-of-day greeting and the header's
  // date/time chip. 30s is plenty for a minute-precision display without
  // re-rendering the page every second.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const userName = user?.first_name || user?.name?.split(" ")[0] || "User";
  const base = `/workspace/${workspaceId}`;

  // Direct dynamic backend values (0 if missing or uninitialized)
  const totalBalance = financeSummary?.cash_balance ?? (stats?.totalBalance || 0);
  const monthIncome = financeSummary?.total_contributions ?? (financeSummary?.cash_in || 0);
  const savingsBalance = financeSummary?.savings_balance ?? 0;

  // Calculate MGR Pool strictly from backend obligations & policy
  const mgrObligations = mgrData?.obligations || [];
  const mgrPolicy = mgrData?.policy || null;
  const mgrPlanAmount = Number(
    mgrPolicy?.contribution_rule?.uniform_amount?.$numberDecimal ||
    mgrPolicy?.contribution_rule?.uniform_amount ||
    0
  );
  const mgrParticipants = mgrPolicy?.participants || [];
  const mgrPool = mgrObligations.length > 0 ? mgrObligations.length * mgrPlanAmount : (mgrPlanAmount * mgrParticipants.length);

  const outstanding = financeSummary?.outstanding_loans ?? 0;

  // Dynamic Money Flow
  const totalInflow = financeSummary?.cash_in ?? monthIncome;
  const totalOutflow = financeSummary?.cash_out ?? (financeSummary?.pending_payouts || 0);
  const netFlow = totalInflow - totalOutflow;
  const totalFlow = totalInflow + totalOutflow;
  const inflowDashoffset = totalFlow > 0 ? 238.7 * (1 - (totalInflow / totalFlow)) : 238.7;

  // Dynamic collection performance calculation
  const targetCollection = monthIncome + outstanding;
  const collectionRateNum = targetCollection > 0 ? Number(((monthIncome / targetCollection) * 100).toFixed(1)) : 0;
  const collectionDashoffset = 238.7 * (1 - (collectionRateNum / 100));

  // Dynamic Action Center counts from real backend summary
  const failedCount = financeSummary?.failed_transactions ?? 0;
  const unpaidCount = stats?.overdueCount ?? 0;
  const pendingPayoutsCount = financeSummary?.pending_payouts ? 1 : 0;
  const pendingWithdrawalsCount = financeSummary?.pending_transactions ?? 0;

  // Dynamic Recent Activity from Ledger. `ledgerEntries` is already sorted
  // newest-first by the backend, and each entry now carries `category` /
  // `category_label` (from the entry's parent FinancialTransaction) so a
  // savings deposit, an MGR contribution, and a chama-internal contribution
  // are each clearly labelled instead of showing up as an unlabeled credit.
  const recentActivities = (ledgerEntries || []).map((entry, idx) => {
    const isCredit = Number(entry.credit) > 0;
    const amount = isCredit ? entry.credit : entry.debit;
    return {
      id: entry._id || entry.id || idx,
      title: entry.description || entry.account_name || "Ledger transaction",
      amount: Number(amount || 0),
      status: isCredit ? "Success" : "Success",
      time: entry.posted_at ? new Date(entry.posted_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "Recent",
      type: isCredit ? "credit" : "debit",
      category: entry.category || "",
      categoryLabel: entry.category_label || CATEGORY_LABELS[entry.category] || "Other",
    };
  });

  // Your own recent activity - always your own contribution payments,
  // regardless of role, sourced from /finance/summary/me (see
  // useMyFinanceSummary). Kept in its own list, separate from
  // `recentActivities` above (the chama-wide ledger), so the two are
  // never rendered together as if they were the same thing.
  const myRecentActivities = (mySummary?.my_recent_activity || []).map((p, idx) => ({
    id: p.id || idx,
    title: p.reference ? `Contribution · ${p.reference}` : "Your contribution",
    amount: Number(p.amount || 0),
    status: p.status === "completed" ? "Success" : p.status === "failed" ? "Failed" : "Pending",
    time: p.paid_at ? new Date(p.paid_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "Recent",
    type: "credit",
    category: "contribution_payment",
    categoryLabel: CATEGORY_LABELS.contribution_payment,
  }));
  const myFailedCount = myRecentActivities.filter((a) => a.status === "Failed").length;
  const myPendingCount = myRecentActivities.filter((a) => a.status === "Pending").length;

  const currentDateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const currentTimeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const timeGreeting = getTimeGreeting(now.getHours());

  // Rotating header insight line - starts with the existing static
  // subtitle, then adds real, already-fetched figures as they become
  // available (never placeholder/fabricated text). Cycles on its own via
  // the effect below; harmless if it only ever has one entry.
  const headerInsights = [
    isFullChamaView
      ? "Here's your position, plus the chama's shared financial overview"
      : "Here's your position in this chama",
  ];
  if (isFullChamaView && !loadingSummary) {
    headerInsights.push(`${collectionRateNum}% of this month's collection target reached so far`);
  }
  if (isFullChamaView && glStatus) {
    headerInsights.push(
      glStatus.balanced
        ? "All chama accounts are balanced and reconciled"
        : "The chama's books need attention — see Action Center"
    );
  }
  if (isFullChamaView && mgrData?.currentRound) {
    headerInsights.push(`MGR Round #${mgrData.currentRound.round_number || 1} is currently in progress`);
  }
  if (!isFullChamaView && (mySummary?.my_payment_count || 0) > 0) {
    headerInsights.push(
      `You've made ${mySummary.my_payment_count} contribution${mySummary.my_payment_count === 1 ? "" : "s"} so far`
    );
  }

  // Cycles the header insight line. headerInsights is rebuilt fresh each
  // render, but its length is a stable primitive to key the effect off.
  useEffect(() => {
    if (headerInsights.length <= 1) return;
    const timer = setInterval(
      () => setInsightIndex((i) => (i + 1) % headerInsights.length),
      5000
    );
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerInsights.length]);

  // Build the Income vs Expenses chart from real weekly totals (see
  // financeService.getTrend / finance.service.js#getWeeklyTrend on the
  // backend) instead of a hand-drawn decorative curve. Coordinates are
  // laid out on the SVG's 400x180 viewBox, with a small top/bottom
  // margin so the tallest point never touches the border.
  const trendWeeks = trend?.weeks || [];
  const CHART_LEFT = 10;
  const CHART_RIGHT = 390;
  const CHART_TOP = 20;
  const CHART_BOTTOM = 165;
  const maxTrendValue = Math.max(
    1,
    ...trendWeeks.map((w) => w.income),
    ...trendWeeks.map((w) => w.expense)
  );
  const trendStepX =
    trendWeeks.length > 1 ? (CHART_RIGHT - CHART_LEFT) / (trendWeeks.length - 1) : 0;
  const toChartPoint = (value, idx) => [
    CHART_LEFT + idx * trendStepX,
    CHART_BOTTOM - (Math.max(0, value) / maxTrendValue) * (CHART_BOTTOM - CHART_TOP),
  ];
  const incomePoints = trendWeeks.map((w, i) => toChartPoint(w.income, i));
  const expensePoints = trendWeeks.map((w, i) => toChartPoint(w.expense, i));
  const toPath = (pts) =>
    pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const incomeLinePath = toPath(incomePoints);
  const expenseLinePath = toPath(expensePoints);
  const incomeAreaPath =
    incomePoints.length > 0
      ? `${incomeLinePath} L ${incomePoints[incomePoints.length - 1][0].toFixed(1)} ${CHART_BOTTOM} L ${incomePoints[0][0].toFixed(1)} ${CHART_BOTTOM} Z`
      : "";
  const lastIncomePoint = incomePoints[incomePoints.length - 1];
  const lastExpensePoint = expensePoints[expensePoints.length - 1];

  // Week-over-week income change for the hero card's trend chip — real
  // figures derived from the same `trendWeeks` the chart below draws,
  // never a fabricated percentage. Hidden entirely when there isn't at
  // least two weeks of data to compare.
  let weeklyIncomeChangePct = null;
  if (trendWeeks.length >= 2) {
    const prevWeekIncome = trendWeeks[trendWeeks.length - 2].income;
    const lastWeekIncome = trendWeeks[trendWeeks.length - 1].income;
    if (prevWeekIncome > 0) {
      weeklyIncomeChangePct = Number((((lastWeekIncome - prevWeekIncome) / prevWeekIncome) * 100).toFixed(1));
    }
  }

  // Active loan book — sum of outstanding balances on active/disbursed
  // loans from the officials-only portfolio fetched above.
  const activeLoans = (loanPortfolio?.portfolio?.loans || []).filter((l) =>
    ["active", "disbursed"].includes(l.status)
  );
  const activeLoanBook = activeLoans.reduce((sum, l) => sum + Number(l.outstanding ?? l.amount ?? 0), 0);
  const activeLoanCount = activeLoans.length;

  // Next upcoming meeting, soonest first, for the "Needs your attention"
  // sidebar's meeting highlight card.
  const upcomingMeetings = (meetingsList || [])
    .filter((m) => m.startsAt && new Date(m.startsAt) >= now)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const nextMeeting = upcomingMeetings[0] || null;
  const formatMeetingLabel = (value) => {
    const d = new Date(value);
    return `${d.toLocaleDateString("en-US", { day: "numeric" })} ${d
      .toLocaleDateString("en-US", { month: "long" })
      .toUpperCase()} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  };

  // "Needs your attention" — high-priority alerts with direct links
  const attentionItems = (
    isFullChamaView
      ? [
          {
            key: "mgr-payout",
            icon: <RefreshCw size={16} />,
            iconBg: "bg-emerald-100 text-emerald-700 dark:bg-mint-deep dark:text-mint",
            title: "1 MGR payout due this cycle",
            subtitle: "Sarah Achieng · Pot KES 60,000",
            link: `${base}/finance`,
          },
          {
            key: "loans",
            icon: <Clock size={16} />,
            iconBg: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
            title: `${loanPortfolio?.awaitingDecision?.count || 1} loan application awaiting review`,
            subtitle: "Brian Kiprop · KES 50,000",
            link: `${base}/loans`,
          },
          failedCount > 0 && {
            key: "failed",
            icon: <XCircle size={16} />,
            iconBg: "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
            title: `${failedCount} payment${failedCount === 1 ? "" : "s"} failed`,
            subtitle: "Review M-Pesa reconciliation",
            link: `${base}/finance`,
          },
          unpaidCount > 0 && {
            key: "unpaid",
            icon: <AlertTriangle size={16} />,
            iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
            title: `${unpaidCount} member${unpaidCount === 1 ? "" : "s"} with unpaid balance`,
            subtitle: "Send reminders",
            link: `${base}/finance`,
          },
          pendingPayoutsCount > 0 && {
            key: "payout",
            icon: <Clock size={16} />,
            iconBg: "bg-violet-100 text-violet-600 dark:bg-mint-deep dark:text-mint",
            title: `${pendingPayoutsCount} payout awaiting approval`,
            subtitle: "Chair approval needed",
            link: `${base}/finance`,
          },
          pendingWithdrawalsCount > 0 && {
            key: "pending-tx",
            icon: <RefreshCw size={16} />,
            iconBg: "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400",
            title: `${pendingWithdrawalsCount} pending transaction${pendingWithdrawalsCount === 1 ? "" : "s"}`,
            subtitle: "Review requests",
            link: `${base}/finance`,
          },
        ]
      : [
          myFailedCount > 0 && {
            key: "my-failed",
            icon: <XCircle size={16} />,
            iconBg: "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
            title: `${myFailedCount} of your payments failed`,
            subtitle: "Retry from Contributions",
            link: `${base}/my-chama`,
          },
          myPendingCount > 0 && {
            key: "my-pending",
            icon: <Clock size={16} />,
            iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
            title: `${myPendingCount} of your payments pending`,
            subtitle: "Check M-Pesa confirmation",
            link: `${base}/my-chama`,
          },
        ]
  ).filter(Boolean);

  const latestActivity = (isFullChamaView ? recentActivities : myRecentActivities).slice(0, 4);

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-mist pb-12">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="animate-in fade-in slide-in-from-left-4 duration-500">
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight sm:text-3xl text-slate-900 dark:text-mist">
            {timeGreeting}, {userName}
            <span className="inline-block animate-bounce">👋</span>
          </h1>

          <div className="mt-1 flex items-center gap-2 min-h-[1.25rem]">
            <p
              key={insightIndex}
              className="text-sm font-medium text-slate-500 dark:text-mist-muted animate-in fade-in slide-in-from-bottom-1 duration-500"
            >
              {headerInsights[insightIndex % headerInsights.length]}
            </p>
          </div>

          {headerInsights.length > 1 && (
            <div className="mt-1.5 flex items-center gap-1">
              {headerInsights.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 rounded-full transition-all duration-500 ${
                    i === insightIndex % headerInsights.length
                      ? "w-4 bg-violet-600 dark:bg-mint"
                      : "w-1 bg-slate-200 dark:bg-obsidian-raised"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-600 dark:bg-mint animate-pulse" />
            <span className="text-xs font-bold text-slate-700 dark:text-mist">
              {workspace?.name || "Chama Workspace"}
            </span>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-violet-700 dark:bg-mint-deep/60 dark:text-mint">
              {formatRoleLabel(workspace?.role)}
            </span>
          </div>

          <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist sm:flex">
            <Calendar size={14} className="text-slate-400" />
            <span>{currentDateStr}</span>
            <span className="h-3 w-px bg-slate-200 dark:bg-obsidian-raised" />
            <span className="font-mono tabular-nums text-slate-500 dark:text-mist-muted">
              {currentTimeStr}
            </span>
          </div>

          <button
            onClick={() => setIsStkOpen(true)}
            className="flex items-center gap-1.5 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700 dark:bg-mint dark:text-mint-strong dark:hover:bg-mint-hover transition"
          >
            <Plus size={16} strokeWidth={3} />
            Record contribution
          </button>
        </div>
      </div>

      {/* Quick link to "My Chama" — the member's own position/statement
          view, kept right under the header for easy navigation. */}
      <div className="flex">
        <Link
          to={`${base}/my-chama`}
          className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist dark:hover:bg-obsidian-raised"
        >
          <User size={14} />
          My Chama
          <ChevronRight size={14} className="text-slate-400" />
        </Link>
      </div>

      {/* ================================================================
       * AT A GLANCE — hero balance card, three compact stat cards, a
       * needs-attention list and the next meeting, mirroring the Doc1
       * "Overview" mockup so the headline question ("how are we doing
       * right now") is answered in one screen. Deeper breakdowns
       * (income/expense trend, money flow, full action center) stay
       * further down the page, unchanged.
       * ============================================================== */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: hero balance + stat row + latest activity */}
        <div className="space-y-6 lg:col-span-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-teal-900 to-[#0d1917] p-6 text-white shadow-sm dark:from-mint-strong dark:via-mint-strong dark:to-mint-deep sm:p-7">
            {/* Concentric rings decoration matching reference mockup */}
            <div className="pointer-events-none absolute -right-12 -top-12 flex items-center justify-center opacity-25">
              <svg className="h-64 w-64" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="35" stroke="currentColor" strokeWidth="2" fill="none" className="text-white/40" />
                <circle cx="100" cy="100" r="55" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="6 4" className="text-white/30" />
                <circle cx="100" cy="100" r="75" stroke="currentColor" strokeWidth="2" fill="none" className="text-white/20" />
                <circle cx="100" cy="100" r="95" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="4 6" className="text-white/15" />
              </svg>
            </div>
            <div className="relative flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-100/80 dark:text-mint/70">
                  {isFullChamaView ? "Available group balance" : "Your total contributions"}
                </span>
                <p className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
                  {isFullChamaView ? money(totalBalance) : money(mySummary?.my_total_contributions)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-emerald-100/90 dark:text-mist-muted">
                  {isFullChamaView && weeklyIncomeChangePct !== null && (
                    <span className="inline-flex items-center gap-1 text-emerald-200 dark:text-mint">
                      <TrendingUp size={13} />
                      {weeklyIncomeChangePct >= 0 ? "+" : ""}
                      {weeklyIncomeChangePct}% vs last week
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-emerald-300 dark:text-mint" /> All accounts reconciled
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsStkOpen(true)}
                  className="rounded-2xl bg-white px-4 py-2.5 text-xs font-bold text-slate-900 shadow-sm transition hover:bg-white/90"
                >
                  Deposit
                </button>
                <Link
                  to={isFullChamaView ? `${base}/finance` : `${base}/my-chama`}
                  className="rounded-2xl bg-white/15 px-4 py-2.5 text-xs font-bold text-white backdrop-blur transition hover:bg-white/25"
                >
                  {isFullChamaView ? "View finances" : "View my activity"}
                </Link>
              </div>
            </div>
          </div>

          {/* Three compact stat cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-4 dark:border-obsidian-border dark:bg-obsidian-card">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-mist-muted">
                <CheckCircle2 size={14} className="text-emerald-600 dark:text-mint" /> Collection
              </div>
              {isFullChamaView ? (
                <>
                  <p className="mt-2 text-xl font-black text-slate-900 dark:text-mist">{collectionRateNum}% complete</p>
                  <p className="mt-0.5 text-[11px] font-bold text-emerald-600 dark:text-mint">
                    {unpaidCount > 0 ? `${unpaidCount} member${unpaidCount === 1 ? "" : "s"} remaining` : "All caught up"}
                  </p>
                </>
              ) : (
                <RestrictedCardBody compact />
              )}
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white p-4 dark:border-obsidian-border dark:bg-obsidian-card">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-mist-muted">
                <Wallet size={14} className="text-emerald-600 dark:text-mint" /> Loan book
              </div>
              {isFullChamaView ? (
                <>
                  <p className="mt-2 text-xl font-black text-slate-900 dark:text-mist">{money(activeLoanBook)}</p>
                  <p className="mt-0.5 text-[11px] font-bold text-emerald-600 dark:text-mint">
                    {activeLoanCount} active loan{activeLoanCount === 1 ? "" : "s"}
                  </p>
                </>
              ) : (
                <RestrictedCardBody compact />
              )}
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white p-4 dark:border-obsidian-border dark:bg-obsidian-card">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-mist-muted">
                <ShieldCheck size={14} className="text-emerald-600 dark:text-mint" /> Trust score
              </div>
              <p className="mt-2 text-xl font-black text-slate-900 dark:text-mist">
                {trustScore?.score ?? "—"}
                <span className="text-sm font-bold text-slate-400"> / 100</span>
              </p>
              <Link
                to={`${base}/trust-score`}
                className="mt-0.5 inline-block text-[11px] font-bold text-emerald-600 dark:text-mint"
              >
                {trustScore?.grade ? `Grade ${trustScore.grade}` : "Generate a report"}
              </Link>
            </div>
          </div>

          {/* Latest activity */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-mist">Latest activity</h2>
              <Link
                to={isFullChamaView ? `${base}/reports` : `${base}/my-chama`}
                className="text-xs font-bold text-violet-700 hover:text-violet-800 dark:text-mint"
              >
                See all activity →
              </Link>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-obsidian-border">
              {latestActivity.length > 0 ? (
                latestActivity.map((act) => (
                  <div key={act.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-mint-deep/60 dark:text-mint">
                        {act.type === "debit" ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-mist">{act.title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-mist-muted">
                          {money(act.amount)} · {act.categoryLabel}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold text-slate-400">{act.time}</span>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-xs text-slate-400">
                  {isFullChamaView ? "No recent ledger activity recorded yet." : "No contributions recorded yet."}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: needs attention + next meeting */}
        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
            <h2 className="text-base font-bold text-slate-900 dark:text-mist">Needs your attention</h2>
            <div className="mt-2 divide-y divide-slate-100 dark:divide-obsidian-border">
              {attentionItems.length > 0 ? (
                attentionItems.map((item) => (
                  <Link
                    key={item.key}
                    to={item.link || `${base}/finance`}
                    className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 hover:bg-slate-50/70 dark:hover:bg-obsidian-raised/30 rounded-xl px-1.5 transition group"
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${item.iconBg}`}>
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-mist group-hover:text-emerald-600 dark:group-hover:text-mint transition truncate">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-mist-muted truncate">{item.subtitle}</p>
                    </div>
                    <ChevronRight size={13} className="text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-mint transition shrink-0 mt-1" />
                  </Link>
                ))
              ) : (
                <p className="py-4 text-center text-xs text-slate-400">Nothing needs your attention right now.</p>
              )}
            </div>
            {attentionItems.length > 0 && (
              <Link
                to={isFullChamaView ? `${base}/loans` : `${base}/contributions`}
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-violet-700 hover:text-violet-800 dark:text-mint"
              >
                Review tasks <ChevronRight size={14} />
              </Link>
            )}
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-emerald-50 p-6 dark:border-mint-strong/50 dark:bg-mint-strong/25">
            {nextMeeting ? (
              <>
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-mint">
                  {formatMeetingLabel(nextMeeting.startsAt)}
                </span>
                <p className="mt-1 text-lg font-black text-slate-900 dark:text-mist">{nextMeeting.title}</p>
                {nextMeeting.agenda && (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-mist-muted">{nextMeeting.agenda}</p>
                )}
                <Link
                  to={`${base}/meetings`}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-mint"
                >
                  Open meeting space <ChevronRight size={14} />
                </Link>
              </>
            ) : (
              <>
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-mint">
                  No meeting scheduled
                </span>
                <p className="mt-1 text-sm font-bold text-slate-900 dark:text-mist">Plan your next members meeting</p>
                <Link
                  to={`${base}/meetings`}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-mint"
                >
                  Schedule a meeting <ChevronRight size={14} />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================
       * YOUR POSITION — always your own figures, for every role. Kept
       * visually and structurally separate from the chama-wide totals
       * below so nobody — member or official — reads "your" numbers as
       * "the chama's", or the other way round.
       * ============================================================== */}
      <div className="rounded-3xl border border-violet-200/80 bg-violet-50/60 p-6 shadow-xs dark:border-mint-strong/40 dark:bg-mint-deep/20">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-mist">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-white dark:bg-mint-deep dark:text-mint">
              <User size={14} />
            </span>
            Your Position
          </h2>
          <Link
            to={`${base}/my-chama`}
            className="inline-flex items-center gap-1 text-xs font-bold text-violet-700 hover:text-violet-800 dark:text-mint"
          >
            Full personal dashboard <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-violet-200/70 bg-white p-4 dark:border-mint-strong/40 dark:bg-obsidian-card">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Your Total Contributions
            </span>
            <p className="mt-1.5 text-xl font-black text-slate-900 dark:text-mist">
              {loadingMySummary ? "…" : money(mySummary?.my_total_contributions)}
            </p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-mist-muted">
              {mySummary?.my_payment_count || 0} payment{(mySummary?.my_payment_count || 0) === 1 ? "" : "s"} made by you
            </p>
          </div>

          <div className="rounded-2xl border border-violet-200/70 bg-white p-4 dark:border-mint-strong/40 dark:bg-obsidian-card">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Your Recent Activity
            </span>
            <div className="mt-2 space-y-2">
              {myRecentActivities.length > 0 ? (
                myRecentActivities.slice(0, 3).map((act) => (
                  <div key={act.id} className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-mist">{act.title}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-mist">{money(act.amount)}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">No contributions recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {!isFullChamaView && (
        <div className="flex items-start gap-3 rounded-3xl border border-slate-200/80 bg-white p-5 text-sm text-slate-600 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist-muted">
          <Info size={18} className="mt-0.5 shrink-0 text-slate-400" />
          <p>
            The chama's shared wallet balance, cash flow, and full activity feed are
            visible to chama officials. You can still see the group's Balance Sheet,
            Income Statement, and Cash Flow under{" "}
            <Link to={`${base}/reports`} className="font-bold text-violet-600 hover:text-violet-700 dark:text-mint">
              Books &amp; Reports
            </Link>
            .
          </p>
        </div>
      )}

      {/* From here down, the skeleton is identical for every role — same
          section order, same card grid, same sizes. Only the content
          inside each chama-wide card is gated by isFullChamaView, so a
          member and a treasurer land on the same-shaped page instead of
          two differently structured ones. */}
      <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-400">
        <Users size={14} /> Chama Totals · shared across all members
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* CHAMA WALLET BALANCE */}
        <div className="group rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-md dark:border-obsidian-border dark:bg-obsidian-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              CHAMA WALLET BALANCE
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Wallet size={18} />
            </div>
          </div>
          {isFullChamaView ? (
            <>
              <p className="mt-3 text-2xl font-black text-slate-900 dark:text-mist">
                {money(totalBalance)}
              </p>
              <div className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <TrendingUp size={14} />
                <span title="This is the chama's shared wallet, not a personal balance">
                  Belongs to {workspace?.name || "this chama"} · Cash & Bank ledger
                </span>
              </div>
            </>
          ) : (
            <RestrictedCardBody compact />
          )}
        </div>

        {/* THIS MONTH INCOME */}
        <div className="group rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-md dark:border-obsidian-border dark:bg-obsidian-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              THIS MONTH INCOME
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <ArrowDownLeft size={18} />
            </div>
          </div>
          {isFullChamaView ? (
            <>
              <p className="mt-3 text-2xl font-black text-slate-900 dark:text-mist">
                {money(monthIncome)}
              </p>
              <div className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <TrendingUp size={14} />
                <span>Total group deposits</span>
              </div>
            </>
          ) : (
            <RestrictedCardBody compact />
          )}
        </div>

        {/* SAVINGS BALANCE */}
        <div className="group rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-md dark:border-obsidian-border dark:bg-obsidian-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              SAVINGS BALANCE
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-mint-deep/60 dark:text-mint">
              <PiggyBank size={18} />
            </div>
          </div>
          {isFullChamaView ? (
            <>
              <p className="mt-3 text-2xl font-black text-slate-900 dark:text-mist">
                {money(savingsBalance)}
              </p>
              <div className="mt-2 flex items-center gap-1 text-xs font-bold text-violet-600 dark:text-mint">
                <span>Member savings pool</span>
              </div>
            </>
          ) : (
            <RestrictedCardBody compact />
          )}
        </div>

        {/* MGR POOL (CURRENT) */}
        <div className="group rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-md dark:border-obsidian-border dark:bg-obsidian-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              MGR POOL (CURRENT)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <RefreshCw size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900 dark:text-mist">
            {money(mgrPool)}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>{mgrData?.currentRound ? `Round #${mgrData.currentRound.round_number || '1'}` : 'Rotational Pool'}</span>
          </div>
        </div>

        {/* OUTSTANDING */}
        <div className="group rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-md dark:border-obsidian-border dark:bg-obsidian-card">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              OUTSTANDING
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
              <AlertTriangle size={18} />
            </div>
          </div>
          {isFullChamaView ? (
            <>
              <p className="mt-3 text-2xl font-black text-slate-900 dark:text-mist">
                {money(outstanding)}
              </p>
              <div className="mt-2 flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400">
                <span>{stats?.memberCount || 0} active members</span>
              </div>
            </>
          ) : (
            <RestrictedCardBody compact />
          )}
        </div>
      </div>

      {/* Highlights strip — quick-read chama health signals that don't
          need their own card. Books balance comes from the same
          gl-balance check GlBalanceGuard polls workspace-wide, so this
          reads as a green "all clear" once that guard has nothing to
          say; total transactions and the MGR round come straight off
          data already fetched above. */}
      <div className="flex flex-wrap gap-3">
        {isFullChamaView ? (
          <>
            <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
              {glStatus === null ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-slate-300 animate-pulse" />
                  <span className="text-xs font-bold text-slate-400">Checking books…</span>
                </>
              ) : glStatus.balanced ? (
                <>
                  <ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Books balanced</span>
                </>
              ) : (
                <>
                  <ShieldAlert size={15} className="text-rose-600 dark:text-rose-400" />
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-400">Books out of balance</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
              <Activity size={15} className="text-violet-600 dark:text-mint" />
              <span className="text-xs font-bold text-slate-700 dark:text-mist">
                {financeSummary?.total_transactions ?? 0} lifetime transactions
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
            <Lock size={14} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-400">Books status is visible to chama officials</span>
          </div>
        )}

        {mgrData?.currentRound && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
            <RefreshCw size={15} className="text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-bold text-slate-700 dark:text-mist">
              MGR Round #{mgrData.currentRound.round_number || 1} in progress
            </span>
          </div>
        )}
      </div>

      {/* Middle Grid: Charts & Action Center */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Income vs Expenses Chart */}
        <div className="lg:col-span-5 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-mist">
                Income vs Expenses
              </h2>
              <div className="mt-1 flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Income
                </span>
                <span className="flex items-center gap-1.5 text-rose-500">
                  <span className="h-2 w-2 rounded-full bg-rose-500" /> Expenses
                </span>
              </div>
            </div>
            <span className="rounded-xl bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-500 dark:bg-obsidian-raised dark:text-mist-muted">
              Last {trendWeeks.length || 5} weeks
            </span>
          </div>

          {!isFullChamaView ? (
            <div className="flex h-56 w-full items-center justify-center">
              <RestrictedCardBody label="Chama-wide income & expenses are visible to chama officials" />
            </div>
          ) : trendWeeks.length === 0 ? (
            <div className="flex h-56 w-full flex-col items-center justify-center gap-2 text-center">
              <TrendingUp size={22} className="text-slate-300 dark:text-obsidian-raised" />
              <p className="text-xs font-semibold text-slate-400">
                No weekly activity to chart yet.
              </p>
            </div>
          ) : (
            <div className="relative h-56 w-full pt-4">
              <svg className="h-full w-full overflow-visible" viewBox="0 0 400 180" preserveAspectRatio="none">
                <line x1="0" y1="30" x2="400" y2="30" stroke="currentColor" strokeDasharray="4 4" className="text-slate-100 dark:text-obsidian-raised" strokeWidth="1" />
                <line x1="0" y1="75" x2="400" y2="75" stroke="currentColor" strokeDasharray="4 4" className="text-slate-100 dark:text-obsidian-raised" strokeWidth="1" />
                <line x1="0" y1="120" x2="400" y2="120" stroke="currentColor" strokeDasharray="4 4" className="text-slate-100 dark:text-obsidian-raised" strokeWidth="1" />
                <line x1="0" y1="165" x2="400" y2="165" stroke="currentColor" strokeDasharray="4 4" className="text-slate-200 dark:text-obsidian-raised" strokeWidth="1" />

                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {incomeAreaPath && <path d={incomeAreaPath} fill="url(#incomeGradient)" />}
                {incomeLinePath && (
                  <path d={incomeLinePath} fill="none" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                )}
                {expenseLinePath && (
                  <path d={expenseLinePath} fill="none" stroke="#f43f5e" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                )}
                {lastIncomePoint && <circle cx={lastIncomePoint[0]} cy={lastIncomePoint[1]} r="5" fill="#10b981" />}
                {lastExpensePoint && <circle cx={lastExpensePoint[0]} cy={lastExpensePoint[1]} r="5" fill="#f43f5e" />}
              </svg>

              <div className="mt-2 flex justify-between text-[11px] font-bold text-slate-400 px-1">
                {trendWeeks.map((w) => (
                  <span key={w.label}>{w.label}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Money Flow (This Month) */}
        <div className="lg:col-span-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-mist">
              Money Flow (This Month)
            </h2>
          </div>

          {isFullChamaView ? (
            <>
              <div className="my-3 flex items-center justify-center relative">
                <svg className="h-44 w-44 transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="38" stroke="#e2e8f0" strokeWidth="12" fill="none" className="dark:stroke-obsidian-raised" />
                  <circle cx="50" cy="50" r="38" stroke="#10b981" strokeWidth="12" fill="none" strokeDasharray="238.7" strokeDashoffset={inflowDashoffset} strokeLinecap="round" />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">NET FLOW</span>
                  <span className="text-lg font-black text-slate-900 dark:text-mist mt-0.5">{money(netFlow)}</span>
                </div>
              </div>

              <div className="space-y-2 text-xs font-semibold">
                <div className="flex items-center justify-between text-slate-600 dark:text-mist-muted">
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Total Inflow</span>
                  <span className="font-bold text-slate-900 dark:text-mist flex items-center gap-1">{money(totalInflow)} <ArrowDownLeft size={14} className="text-emerald-600" /></span>
                </div>

                <div className="flex items-center justify-between text-slate-600 dark:text-mist-muted">
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-purple-500" />Total Outflow</span>
                  <span className="font-bold text-slate-900 dark:text-mist flex items-center gap-1">{money(totalOutflow)} <ArrowUpRight size={14} className="text-rose-500" /></span>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-obsidian-border flex items-center justify-between font-extrabold">
                  <span className="text-slate-700 dark:text-mist-muted">Net Flow</span>
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">{money(netFlow)} <ArrowDownLeft size={14} /></span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <RestrictedCardBody label="This month's money flow is visible to chama officials" />
            </div>
          )}
        </div>

        {/* Action Center */}
        <div className="lg:col-span-3 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-mist">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-600 text-white text-xs dark:bg-mint-deep dark:text-mint">⚡</span>
                Action Center
              </h2>
              <ChevronRight size={16} className="text-slate-400" />
            </div>

            {isFullChamaView ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-obsidian-raised/60">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400"><XCircle size={16} /></div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-mist">{failedCount} payments failed</p>
                    <p className="text-[11px] text-slate-500 dark:text-mist-muted">Review M-Pesa reconciliation</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-obsidian-raised/60">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"><AlertTriangle size={16} /></div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-mist">{unpaidCount} members with unpaid balance</p>
                    <p className="text-[11px] text-slate-500 dark:text-mist-muted">Send reminders</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-obsidian-raised/60">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-mint-deep dark:text-mint"><Clock size={16} /></div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-mist">{pendingPayoutsCount} payout awaits approval</p>
                    <p className="text-[11px] text-slate-500 dark:text-mist-muted">Chair approval needed</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-obsidian-raised/60">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400"><RefreshCw size={16} /></div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-mist">{pendingWithdrawalsCount} pending transactions</p>
                    <p className="text-[11px] text-slate-500 dark:text-mist-muted">Review requests</p>
                  </div>
                </div>
              </div>
            ) : (
              // Members get the same card, scoped to their own action
              // items instead of the chama-wide list — sourced from data
              // already fetched for "Your Position" above (mySummary),
              // never from the officials-only finance summary.
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-obsidian-raised/60">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400"><XCircle size={16} /></div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-mist">{myFailedCount} of your payments failed</p>
                    <p className="text-[11px] text-slate-500 dark:text-mist-muted">Retry from Contributions</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-obsidian-raised/60">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"><Clock size={16} /></div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-mist">{myPendingCount} of your payments pending</p>
                    <p className="text-[11px] text-slate-500 dark:text-mist-muted">Check M-Pesa confirmation</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-obsidian-raised/60">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-400 dark:bg-obsidian-raised dark:text-mist-muted"><Lock size={16} /></div>
                  <div>
                    <p className="text-xs font-bold text-slate-400">Chama-wide items</p>
                    <p className="text-[11px] text-slate-400">Visible to chama officials</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Recent Activity & Collection Performance */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Recent Activity — chama-wide ledger for officials, your own
            payment history for members. Same card, same list layout,
            authorization-appropriate data source. */}
        <div className="lg:col-span-7 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-mist">
              {isFullChamaView ? "Recent Activity" : "Your Recent Activity"}
            </h2>
            <button className="text-slate-400 hover:text-slate-600 dark:hover:text-mist"><SlidersHorizontal size={16} /></button>
          </div>

          <div className="space-y-3">
            {(isFullChamaView ? recentActivities : myRecentActivities).length > 0 ? (
              (isFullChamaView ? recentActivities : myRecentActivities).map((act) => (
                <div key={act.id} className="flex items-center justify-between rounded-2xl bg-slate-50/70 p-3.5 dark:bg-obsidian-raised/40">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      act.status === "Failed"
                        ? "bg-rose-100 text-rose-600"
                        : act.status === "Pending"
                        ? "bg-amber-100 text-amber-600"
                        : "bg-emerald-100 text-emerald-600"
                    }`}>
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-900 dark:text-mist">{act.title}</p>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${CATEGORY_BADGE_STYLES[act.category] || DEFAULT_BADGE_STYLE}`}>
                          {act.categoryLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono">{money(act.amount)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      act.status === "Failed"
                        ? "bg-rose-100 text-rose-800"
                        : act.status === "Pending"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}>
                      {act.status}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">{act.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">
                {isFullChamaView ? "No recent ledger activity recorded yet." : "No contributions recorded yet."}
              </p>
            )}
          </div>
        </div>

        {/* Collection Performance */}
        <div className="lg:col-span-5 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-mist">
              Collection Performance
            </h2>
            <button className="text-slate-400 hover:text-slate-600 dark:hover:text-mist"><SlidersHorizontal size={16} /></button>
          </div>

          {isFullChamaView ? (
            <>
              <div className="my-4 flex items-center justify-center relative">
                <svg className="h-44 w-44 transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="38" stroke="#e2e8f0" strokeWidth="10" fill="none" className="dark:stroke-obsidian-raised" />
                  <circle cx="50" cy="50" r="38" stroke="#10b981" strokeWidth="10" fill="none" strokeDasharray="238.7" strokeDashoffset={collectionDashoffset} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-slate-900 dark:text-mist">{collectionRateNum}%</span>
                  <span className="text-[11px] font-bold text-slate-400">of target</span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-mist-muted"><span>Expected</span><span className="font-bold text-slate-900 dark:text-mist">{money(targetCollection)}</span></div>
                <div className="flex justify-between text-slate-600 dark:text-mist-muted"><span>Collected</span><span className="font-bold text-slate-900 dark:text-mist">{money(monthIncome)}</span></div>
                <div className="flex justify-between text-slate-600 dark:text-mist-muted"><span>Outstanding</span><span className="font-bold text-rose-600">{money(outstanding)}</span></div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-obsidian-border text-right">
                <Link to={`${base}/contributions`} className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-700 dark:text-mint">
                  View Contributors <ChevronRight size={14} />
                </Link>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <RestrictedCardBody label="Group collection performance is visible to chama officials" />
            </div>
          )}
        </div>
      </div>

      <MpesaStkModal
        isOpen={isStkOpen}
        onClose={() => setIsStkOpen(false)}
        chamaId={workspaceId}
        title="Deposit to Savings via M-Pesa"
      />

    </div>
  );
}