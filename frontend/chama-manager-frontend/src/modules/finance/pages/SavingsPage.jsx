import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  PiggyBank,
  RotateCw,
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Search,
  Award,
  Wallet,
  Check,
} from "lucide-react";
import { useParams, Link } from "react-router-dom";
import useWorkspace from "@/app/hooks/useWorkspace";
import MpesaStkModal from "@/modules/finance/components/MpesaStkModal";
import savingsShareoutService from "@/modules/chama/services/savingsShareout.service";
import SavingsShareoutPreviewModal from "@/modules/chama/components/SavingsShareoutPreviewModal";

const money = (val) => `KES ${Number(val || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const timeAgo = (dateVal) => {
  if (!dateVal) return "No activity yet";
  const date = new Date(dateVal);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return date.toLocaleDateString();
};

const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("") || "?";

export default function SavingsPage() {
  const { workspaceId: routeWorkspaceId } = useParams();
  const workspace = useWorkspace();
  const chamaId = routeWorkspaceId || workspace.workspaceId;

  const userRole = (
    workspace?.activeWorkspace?.role ||
    workspace?.currentWorkspace?.role ||
    ""
  ).toLowerCase();

  const isTreasurer = userRole === "treasurer";
  const isChairperson = userRole === "chairperson";
  const isOfficial = isTreasurer || isChairperson || userRole === "admin" || userRole === "secretary";

  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'shareout'

  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberSearch, setMemberSearch] = useState("");

  // Savings Overview State (live, per-member data)
  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  // Share-Out State
  const [policies, setPolicies] = useState([]);
  const [shareouts, setShareouts] = useState([]);
  const [loadingShareouts, setLoadingShareouts] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedShareoutDetails, setSelectedShareoutDetails] = useState(null);
  const [payingItemId, setPayingItemId] = useState(null);
  const [notice, setNotice] = useState(null);

  const notify = (msg, type = "success") => {
    setNotice({ msg, type });
    setTimeout(() => setNotice(null), 4000);
  };

  const loadOverview = useCallback(async () => {
    if (!chamaId) return;
    setLoadingOverview(true);
    try {
      const data = await savingsShareoutService.getOverview(chamaId);
      setOverview(data);
    } catch {
      setOverview(null);
    } finally {
      setLoadingOverview(false);
    }
  }, [chamaId]);

  const loadShareoutData = useCallback(async () => {
    if (!chamaId) return;
    setLoadingShareouts(true);
    try {
      const [policiesRes, shareoutsRes] = await Promise.allSettled([
        savingsShareoutService.getPolicies(chamaId),
        savingsShareoutService.getAll(chamaId),
      ]);

      // Normalize defensively: some workspace types (e.g. burial chama)
      // can have this endpoint return a wrapped shape ({ data: [...] },
      // { policies: [...] }, etc.) instead of a bare array. Coerce to an
      // array either way so the rest of the page never has to guard.
      const toArray = (val) => {
        if (Array.isArray(val)) return val;
        if (Array.isArray(val?.data)) return val.data;
        if (Array.isArray(val?.policies)) return val.policies;
        if (Array.isArray(val?.shareouts)) return val.shareouts;
        if (Array.isArray(val?.items)) return val.items;
        return [];
      };

      if (policiesRes.status === "fulfilled") setPolicies(toArray(policiesRes.value));
      if (shareoutsRes.status === "fulfilled") setShareouts(toArray(shareoutsRes.value));
    } catch {
      // ignore
    } finally {
      setLoadingShareouts(false);
    }
  }, [chamaId]);

  useEffect(() => {
    loadOverview();
    loadShareoutData();
  }, [chamaId, loadOverview, loadShareoutData]);

  // The overview is a live aggregation of deposits/share-outs - so without
  // this listener a completed STK (savings deposit) never refreshes this
  // page until the user navigates away and back. Same "finance:updated"
  // signal MpesaStkModal already dispatches on success.
  useEffect(() => {
    window.addEventListener("finance:updated", loadOverview);
    return () => window.removeEventListener("finance:updated", loadOverview);
  }, [loadOverview]);

  const safePolicies = Array.isArray(policies) ? policies : [];
  const activePolicy = safePolicies.find((p) => p.status === "active") || safePolicies[0] || null;

  // Handle Approving Shareout (Chairperson)
  const handleApproveShareout = async (shareoutId) => {
    try {
      await savingsShareoutService.approve(chamaId, shareoutId);
      notify("Savings share-out batch approved successfully!");
      loadShareoutData();
      loadOverview();
    } catch (err) {
      notify(err.response?.data?.message || "Failed to approve share-out", "error");
    }
  };

  // Handle Paying an individual member's share (Treasurer)
  const handlePayItem = async (shareoutId, itemId, method = "mpesa") => {
    setPayingItemId(itemId);
    try {
      await savingsShareoutService.payItem(chamaId, shareoutId, itemId, {
        disbursementMethod: method,
        externalReference: `SAVINGS-DISBURSE-${Date.now()}`,
      });
      notify("Member savings share marked as paid!");
      loadShareoutData();
      loadOverview();
      if (selectedShareoutDetails && selectedShareoutDetails._id === shareoutId) {
        const updated = await savingsShareoutService.getOne(chamaId, shareoutId);
        setSelectedShareoutDetails(updated);
      }
    } catch (err) {
      notify(err.response?.data?.message || "Failed to disburse share-out item", "error");
    } finally {
      setPayingItemId(null);
    }
  };

  // ------------------------------------------------------------
  // Live savings numbers - all derived from the savings-overview
  // aggregation (per-member deposits minus what's already been
  // shared out), not the chart of accounts.
  // ------------------------------------------------------------
  const totals = overview?.totals || {
    total_savings: 0,
    deposits_30d: 0,
    shared_out_total: 0,
    active_savers: 0,
    deposit_count: 0,
  };

  const growth = useMemo(() => overview?.growth || [], [overview]);
  const allMembers = useMemo(() => overview?.members || [], [overview]);

  // Month-over-month comparison for the headline balance figure
  const momComparison = useMemo(() => {
    if (growth.length < 2) return null;
    const current = growth[growth.length - 1];
    const previous = growth[growth.length - 2];
    if (!previous || previous.balance === 0) return null;
    const change = current.balance - previous.balance;
    const pct = (change / Math.abs(previous.balance)) * 100;
    return { change, pct, isUp: change >= 0 };
  }, [growth]);

  const memberSavingsList = useMemo(
    () =>
      allMembers.map((m) => ({
        id: m.membership_id,
        name: m.name,
        role: m.role,
        avatarUrl: m.avatar_url,
        isActiveMember: m.is_active_member,
        balance: m.balance,
        recentDeposits: m.recent_deposits_30d,
        depositCount: m.deposit_count,
        lastActivity: m.last_activity,
        pctOfPool: totals.total_savings > 0 ? (m.balance / totals.total_savings) * 100 : 0,
      })),
    [allMembers, totals.total_savings]
  );

  const filteredMemberList = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return memberSavingsList;
    return memberSavingsList.filter((m) => m.name.toLowerCase().includes(q));
  }, [memberSavingsList, memberSearch]);

  const topSavers = memberSavingsList.slice(0, 5);

  // ------------------------------------------------------------
  // Chart geometry for the Savings Growth panel: a cumulative
  // balance line plus a net-flow (deposits vs share-outs) bar
  // strip beneath it, both computed straight off `growth`.
  // ------------------------------------------------------------
  const chartData = useMemo(() => {
    if (!growth.length) return null;

    const width = 500;
    const lineTop = 8;
    const lineBottom = 132;
    const lineHeight = lineBottom - lineTop;
    const barTop = 152;
    const barBottom = 200;
    const barHeight = barBottom - barTop;
    const barMid = barTop + barHeight / 2;

    const balances = growth.map((g) => g.balance);
    const maxBalance = Math.max(...balances, 0);
    const minBalance = Math.min(...balances, 0);
    const balanceRange = maxBalance - minBalance || 1;

    const n = growth.length;
    const stepX = n > 1 ? width / (n - 1) : width;

    const points = growth.map((g, i) => {
      const x = n > 1 ? i * stepX : width / 2;
      const y = lineBottom - ((g.balance - minBalance) / balanceRange) * lineHeight;
      return { x, y, ...g };
    });

    const linePath = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");

    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${lineBottom} L ${points[0].x.toFixed(1)} ${lineBottom} Z`;

    const netFlows = growth.map((g) => g.deposits - g.shared_out);
    const maxAbsFlow = Math.max(...netFlows.map((v) => Math.abs(v)), 1);
    const barWidth = n > 1 ? Math.min(24, (width / n) * 0.5) : 24;

    const bars = growth.map((g, i) => {
      const net = g.deposits - g.shared_out;
      const x = (n > 1 ? i * stepX : width / 2) - barWidth / 2;
      const h = Math.max((Math.abs(net) / maxAbsFlow) * (barHeight / 2), net === 0 ? 0 : 1.5);
      const y = net >= 0 ? barMid - h : barMid;
      return { x, y, width: barWidth, height: h, positive: net >= 0, net, ...g };
    });

    return { points, linePath, areaPath, bars, lineTop, lineBottom, barMid };
  }, [growth]);

  const growthWindowPct = useMemo(() => {
    if (growth.length < 2) return null;
    const first = growth[0].balance;
    const last = growth[growth.length - 1].balance;
    if (first === 0) return null;
    return ((last - first) / Math.abs(first)) * 100;
  }, [growth]);

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 pb-12">
      {/* Toast Notice */}
      {notice && (
        <div
          className={`flex items-center gap-3 rounded-2xl border p-4 shadow-lg animate-fade-in ${
            notice.type === "error"
              ? "border-rose-300 bg-rose-600 text-white"
              : "border-emerald-300 bg-emerald-600 text-white"
          }`}
        >
          {notice.type === "error" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <p className="text-xs font-bold">{notice.msg}</p>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Savings & Share-Outs
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Manage member deposits, flexible balances, and governed savings share-outs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsDepositModalOpen(true)}
            className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition"
          >
            <Plus size={16} /> Deposit Savings
          </button>
          {/* Configuring the policy itself (its share rule, trigger, and
              eligible approvers) is a leadership mutation and now lives
              only in the Leadership Desk's Treasury Oversight tab, behind
              the leadership PIN — see modules/leadership/tabs/
              TreasuryOversightTab.jsx. Triggering a share-out from an
              already-active policy stays here since it's an operational
              action, not a settings change. */}
          {isOfficial && activePolicy && (
            <button
              onClick={() => setShowPreviewModal(true)}
              className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition"
            >
              <PiggyBank size={16} /> Trigger Share-Out
            </button>
          )}
          {isOfficial && !activePolicy && (
            <Link
              to={`/workspace/${chamaId}/leadership?tab=treasury`}
              className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition"
            >
              <PiggyBank size={16} /> Set Up Share-Out Policy
            </Link>
          )}
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "overview"
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shadow-xs"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <PiggyBank size={15} /> Savings Overview
        </button>
        <button
          onClick={() => setActiveTab("shareout")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "shareout"
              ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 shadow-xs"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <RotateCw size={15} /> Share-Out & Distribution ({shareouts.length})
        </button>
      </div>

      {/* Top 4 Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">TOTAL SAVINGS POOL</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <Wallet size={14} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{money(totals.total_savings)}</p>
          {momComparison ? (
            <span
              className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold ${
                momComparison.isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
              }`}
            >
              {momComparison.isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(momComparison.pct).toFixed(1)}% vs last month
            </span>
          ) : (
            <span className="mt-1.5 block text-[11px] font-semibold text-slate-400">No prior month to compare</span>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">DEPOSITS (LAST 30 DAYS)</span>
          <p className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">+{money(totals.deposits_30d)}</p>
          <span className="mt-1.5 block text-[11px] font-semibold text-slate-400">
            {totals.deposit_count} deposit{totals.deposit_count === 1 ? "" : "s"} recorded in total
          </span>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">SHARED OUT (LIFETIME)</span>
          <p className="mt-2 text-2xl font-black text-rose-500">-{money(totals.shared_out_total)}</p>
          <span className="mt-1.5 block text-[11px] font-semibold text-slate-400">Across all approved share-out batches</span>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">ACTIVE SAVERS</span>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{totals.active_savers}</p>
          <span className="mt-1.5 block text-[11px] font-semibold text-slate-400">
            Avg. {money(totals.active_savers > 0 ? totals.total_savings / totals.active_savers : 0)} / saver
          </span>
        </div>
      </div>

      {loadingOverview && !overview && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-10 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold text-slate-400">Loading live savings data...</p>
        </div>
      )}

      {activeTab === "overview" && (
        <>
          {/* Savings Growth & Top Savers */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Savings Growth</h2>
                  <p className="text-[11px] font-semibold text-slate-400">
                    Net savings balance & monthly activity, last {growth.length || 12} months
                  </p>
                </div>
                {growthWindowPct !== null && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${
                      growthWindowPct >= 0
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                    }`}
                  >
                    {growthWindowPct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {Math.abs(growthWindowPct).toFixed(1)}% over the period
                  </span>
                )}
              </div>

              {chartData ? (
                <div className="relative h-64 w-full">
                  <svg className="h-full w-full overflow-visible" viewBox="0 0 500 200" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="savingsAreaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Gridlines for the balance line region */}
                    <line x1="0" y1={chartData.lineTop} x2="500" y2={chartData.lineTop} stroke="currentColor" strokeDasharray="4 4" className="text-slate-100 dark:text-slate-800" strokeWidth="1" />
                    <line x1="0" y1={(chartData.lineTop + chartData.lineBottom) / 2} x2="500" y2={(chartData.lineTop + chartData.lineBottom) / 2} stroke="currentColor" strokeDasharray="4 4" className="text-slate-100 dark:text-slate-800" strokeWidth="1" />
                    <line x1="0" y1={chartData.lineBottom} x2="500" y2={chartData.lineBottom} stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="1" />

                    {/* Cumulative balance area + line */}
                    <path d={chartData.areaPath} fill="url(#savingsAreaGradient)" />
                    <path d={chartData.linePath} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    {chartData.points.map((p, i) => (
                      <circle key={`pt-${i}`} cx={p.x} cy={p.y} r={i === chartData.points.length - 1 ? 4.5 : 2.5} fill="#10b981">
                        <title>{`${p.period}: ${money(p.balance)} balance`}</title>
                      </circle>
                    ))}

                    {/* Net monthly flow bars (deposits vs share-outs) */}
                    <line x1="0" y1={chartData.barMid} x2="500" y2={chartData.barMid} stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="1" />
                    {chartData.bars.map((b, i) => (
                      <rect
                        key={`bar-${i}`}
                        x={b.x}
                        y={b.y}
                        width={b.width}
                        height={b.height}
                        rx={2}
                        fill={b.positive ? "#10b981" : "#f43f5e"}
                        opacity={0.85}
                      >
                        <title>{`${b.period}: +${money(b.deposits)} deposits, -${money(b.shared_out)} shared out`}</title>
                      </rect>
                    ))}
                  </svg>

                  <div className="mt-2 flex justify-between text-[10px] font-bold text-slate-400 px-1">
                    {chartData.points.map((p, i) => (
                      <span
                        key={`lbl-${i}`}
                        className={
                          chartData.points.length > 8 && i % 2 !== 0 && i !== chartData.points.length - 1
                            ? "hidden sm:inline"
                            : ""
                        }
                      >
                        {p.period}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-4 rounded-full bg-emerald-500" /> Cumulative Balance
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Net Deposits
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-rose-500" /> Net Share-Outs
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex h-56 items-center justify-center">
                  <p className="text-xs text-slate-400 text-center">
                    No savings activity recorded yet. The growth trend appears once the first savings deposit is posted.
                  </p>
                </div>
              )}
            </div>

            <div className="lg:col-span-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Top Savers</h2>
                <Award size={16} className="text-amber-500" />
              </div>
              <div className="space-y-4">
                {topSavers.length > 0 ? (
                  topSavers.map((saver, idx) => (
                    <div key={saver.id}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                              idx === 0
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                : idx === 1
                                ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                                : idx === 2
                                ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {idx < 3 ? `#${idx + 1}` : initials(saver.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{saver.name}</p>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              {saver.pctOfPool.toFixed(1)}% of pool
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                          {money(saver.balance)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.min(saver.pctOfPool, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 text-center py-6">No member savings accounts recorded yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Member Savings Table */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Member Savings Accounts</h2>
                <p className="text-[11px] font-semibold text-slate-400">
                  {filteredMemberList.length} of {memberSavingsList.length} member{memberSavingsList.length === 1 ? "" : "s"}
                  {" "}· compared against a pool average of {money(totals.active_savers > 0 ? totals.total_savings / totals.active_savers : 0)}
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search members..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-100 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/50 uppercase text-[11px] font-extrabold text-slate-400 dark:border-slate-800 dark:bg-slate-800/40">
                  <tr>
                    <th className="px-6 py-4">MEMBER</th>
                    <th className="px-6 py-4">SAVINGS BALANCE</th>
                    <th className="px-6 py-4">EST. RECENT DEPOSITS</th>
                    <th className="px-6 py-4">VS. POOL AVERAGE</th>
                    <th className="px-6 py-4">LAST ACTIVITY</th>
                    <th className="px-6 py-4 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold">
                  {filteredMemberList.length > 0 ? (
                    filteredMemberList.map((row) => {
                      const avgBalance = totals.active_savers > 0 ? totals.total_savings / totals.active_savers : 0;
                      const vsAvgPct = avgBalance > 0 ? ((row.balance - avgBalance) / avgBalance) * 100 : null;

                      return (
                        <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-black text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                {initials(row.name)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-bold text-slate-900 dark:text-white">{row.name}</p>
                                {row.role && (
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                    {row.role}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-900 dark:text-white font-mono font-bold">{money(row.balance)}</td>
                          <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-mono font-bold">+{money(row.recentDeposits)}</td>
                          <td className="px-6 py-4">
                            {vsAvgPct === null ? (
                              <span className="text-slate-400 font-mono">—</span>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 font-mono font-bold ${
                                  vsAvgPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
                                }`}
                              >
                                {vsAvgPct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                {Math.abs(vsAvgPct).toFixed(0)}%
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-500 font-mono">{timeAgo(row.lastActivity)}</td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedMember(row);
                                setIsDepositModalOpen(true);
                              }}
                              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 transition"
                            >
                              Deposit
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-slate-400 font-medium">
                        {memberSearch
                          ? "No members match your search."
                          : "No savings accounts or deposits recorded yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "shareout" && (
        <div className="space-y-6">
          {/* Active Policy Status Card */}
          <div className="rounded-3xl border border-indigo-200 bg-indigo-50/70 p-6 dark:border-indigo-950 dark:bg-indigo-950/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                <ShieldCheck size={26} />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                  SAVINGS SHARE-OUT POLICY
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {activePolicy ? activePolicy.name : "No Policy Configured"}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {activePolicy
                    ? `Mode: ${activePolicy.share_rule?.mode === 'percentage_of_balance' ? `${activePolicy.share_rule?.percentage}% of contributor balance` : `Fixed KES ${activePolicy.share_rule?.fixed_amount}`} · Trigger: ${activePolicy.trigger_rule?.type || 'manual'}`
                    : "Configure a policy to enable automatic or one-click year-end savings share-outs."}
                </p>
              </div>
            </div>

            {isOfficial && (
              <div className="flex items-center gap-2">
                <Link
                  to={`/workspace/${chamaId}/leadership?tab=treasury`}
                  className="rounded-2xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300"
                >
                  {activePolicy ? "Edit Policy in Leadership Desk" : "Configure Policy in Leadership Desk"}
                </Link>
                {activePolicy && (
                  <button
                    onClick={() => setShowPreviewModal(true)}
                    className="flex items-center gap-1.5 rounded-2xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-indigo-700 transition"
                  >
                    <PiggyBank size={15} /> Trigger Share-Out
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Share-Out Batches Table */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Share-Out History & Batches</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/50 uppercase text-[11px] font-extrabold text-slate-400 dark:border-slate-800 dark:bg-slate-800/40">
                  <tr>
                    <th className="px-6 py-4">BATCH / DATE</th>
                    <th className="px-6 py-4">RECIPIENTS</th>
                    <th className="px-6 py-4">TOTAL AMOUNT</th>
                    <th className="px-6 py-4 text-center">STATUS</th>
                    <th className="px-6 py-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold">
                  {shareouts.length > 0 ? (
                    shareouts.map((sh) => (
                      <tr key={sh._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900 dark:text-white">
                            {sh.name || `Share-Out #${String(sh._id).slice(-4).toUpperCase()}`}
                          </p>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {sh.createdAt ? new Date(sh.createdAt).toLocaleDateString() : "Recent"}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {sh.items?.length || 0} Members
                        </td>
                        <td className="px-6 py-4 font-mono font-black text-emerald-600 dark:text-emerald-400">
                          {money(sh.total_amount || sh.items?.reduce((s, i) => s + Number(i.amount || 0), 0) || 0)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {sh.status === "approved" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                              <CheckCircle2 size={12} /> Approved
                            </span>
                          ) : sh.status === "completed" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-extrabold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                              <CheckCircle2 size={12} /> Disbursed
                            </span>
                          ) : sh.status === "cancelled" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-extrabold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                              <XCircle size={12} /> Cancelled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                              <Clock size={12} /> Pending Approval
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {sh.status === "pending_approval" && isChairperson && (
                              <button
                                onClick={() => handleApproveShareout(sh._id)}
                                className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs hover:bg-emerald-700"
                              >
                                Approve Batch
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedShareoutDetails(sh)}
                              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
                            >
                              View Breakdown
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-slate-400 font-medium">
                        No savings share-out runs recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Shareout Breakdown Details Modal */}
      {selectedShareoutDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  SHARE-OUT LINE ITEMS
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  {selectedShareoutDetails.name || `Shareout #${String(selectedShareoutDetails._id).slice(-4)}`}
                </h3>
              </div>
              <button
                onClick={() => setSelectedShareoutDetails(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="py-4 max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 uppercase text-[10px] font-extrabold text-slate-400 sticky top-0 bg-white dark:bg-slate-900">
                  <tr>
                    <th className="py-2.5">MEMBER</th>
                    <th className="py-2.5">SHARE AMOUNT</th>
                    <th className="py-2.5 text-center">STATUS</th>
                    {isTreasurer && <th className="py-2.5 text-right">ACTION</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(selectedShareoutDetails.items || []).map((item) => {
                    const memberName =
                      item.member_id?.user_id?.name ||
                      item.member_id?.name ||
                      item.member_name ||
                      "Member";
                    const isPaid = item.status === "paid";

                    return (
                      <tr key={item._id || item.member_id} className="hover:bg-slate-50/50">
                        <td className="py-3 font-bold text-slate-900 dark:text-white">{memberName}</td>
                        <td className="py-3 font-mono font-black text-emerald-600">{money(item.amount)}</td>
                        <td className="py-3 text-center">
                          {isPaid ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
                              Paid
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-700">
                              Pending
                            </span>
                          )}
                        </td>
                        {isTreasurer && (
                          <td className="py-3 text-right">
                            {!isPaid && (
                              <button
                                disabled={payingItemId === item._id}
                                onClick={() =>
                                  handlePayItem(selectedShareoutDetails._id, item._id, "mpesa")
                                }
                                className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50"
                              >
                                {payingItemId === item._id ? "Disbursing..." : "Disburse via M-Pesa"}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedShareoutDetails(null)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shareout Preview Modal */}
      {showPreviewModal && activePolicy && (
        <SavingsShareoutPreviewModal
          workspaceId={chamaId}
          policy={activePolicy}
          onClose={() => setShowPreviewModal(false)}
          onTriggered={(res) => {
            setShowPreviewModal(false);
            notify("Savings share-out generated & queued for official approval!");
            loadShareoutData();
          }}
        />
      )}

      <MpesaStkModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        chamaId={chamaId}
        title={`Deposit Savings${selectedMember ? ` (${selectedMember.name})` : ""}`}
      />
    </div>
  );
}