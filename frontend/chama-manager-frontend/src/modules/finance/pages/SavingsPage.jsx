import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  RotateCw,
  TrendingUp,
  TrendingDown,
  Search,
  Award,
  Wallet,
} from "lucide-react";
import { useParams, Link } from "react-router-dom";
import useWorkspace from "@/app/hooks/useWorkspace";
import useWorkspacePermissions from "../hooks/useworkspacepermissions";
import MpesaStkModal from "@/modules/finance/components/MpesaStkModal";
import savingsShareoutService from "@/modules/chama/services/savingsShareout.service";

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

  // Same permission the Contributions page already gates "record for
  // others" on: contributions.record at 'all' scope is treasurer-only
  // (a chairperson's grant is deliberately 'own'). Reused here so a
  // member's Deposit button only ever appears on their own row, and
  // the treasurer sees it on every row to initiate on anyone's behalf.
  const { canForOthers } = useWorkspacePermissions(chamaId);
  const canDepositForOthers = canForOthers("contributions.record");

  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberSearch, setMemberSearch] = useState("");

  // The chama-wide pool (total pool, growth chart, top savers, every
  // member's balance) is collapsed behind this by default - a member
  // opening Savings should see their own balance and activity first,
  // not everyone else's. Off by default for everyone; anyone can
  // uncollapse it, officials included.
  const [showChamaSavings, setShowChamaSavings] = useState(false);

  // Savings Overview State (live, per-member data)
  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  // Share-out batch count, shown only as a hand-off badge. The batches
  // themselves, the policy, approval and disbursement all live on the
  // Savings Share-Out page - this page is the pool, not its release.
  const [shareoutCount, setShareoutCount] = useState(0);

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

  const loadShareoutCount = useCallback(async () => {
    if (!chamaId) return;
    try {
      const result = await savingsShareoutService.getAll(chamaId);
      const list = Array.isArray(result)
        ? result
        : result?.data ?? result?.shareouts ?? result?.items ?? [];
      setShareoutCount(Array.isArray(list) ? list.length : 0);
    } catch {
      setShareoutCount(0);
    }
  }, [chamaId]);

  useEffect(() => {
    loadOverview();
    loadShareoutCount();
  }, [chamaId, loadOverview, loadShareoutCount]);

  // The overview is a live aggregation of deposits/share-outs - so without
  // this listener a completed STK (savings deposit) never refreshes this
  // page until the user navigates away and back. Same "finance:updated"
  // signal MpesaStkModal already dispatches on success.
  useEffect(() => {
    window.addEventListener("finance:updated", loadOverview);
    return () => window.removeEventListener("finance:updated", loadOverview);
  }, [loadOverview]);

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

  // My own row, picked out of the same overview already fetched above -
  // no separate "my savings" endpoint needed since overview.members
  // already carries every member's figures, keyed by membership_id.
  const myMembershipId = workspace?.membership?._id ? String(workspace.membership._id) : null;
  const myRow = useMemo(
    () => memberSavingsList.find((m) => String(m.id) === myMembershipId) || null,
    [memberSavingsList, myMembershipId]
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
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Savings
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            The savings pool — member deposits, balances and how it has grown
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsDepositModalOpen(true)}
            className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-emerald-700"
          >
            <Plus size={16} /> Deposit savings
          </button>

          {/* Releasing the pool is a governed, multi-step process with
              its own policy, approval and disbursement steps, so it gets
              its own page rather than a tab here. This is the hand-off,
              not a second copy of it. */}
          {isOfficial && (
            <Link
              to={`/workspace/${chamaId}/finance/savings-shareout`}
              className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-indigo-700"
            >
              <RotateCw size={16} /> Share-outs
              {shareoutCount > 0 && (
                <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-black">
                  {shareoutCount}
                </span>
              )}
            </Link>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------
          MY SAVINGS — always visible first, using the same overview
          already fetched above (overview.members carries every
          member's row keyed by membership_id, so this is just the
          viewer's own row, not a second request). The chama-wide pool
          below stays tucked behind the toggle until asked for.
          ------------------------------------------------------------ */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">My Savings</h2>
          <button
            type="button"
            onClick={() => setShowChamaSavings((v) => !v)}
            className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 transition"
          >
            {showChamaSavings ? "Hide chama savings" : "View chama savings"}
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">MY BALANCE</span>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{money(myRow?.balance)}</p>
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">MY DEPOSITS (30d)</span>
            <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">
              +{money(myRow?.recentDeposits)}
            </p>
            <span className="mt-1 block text-[11px] font-semibold text-slate-400">
              {myRow?.depositCount || 0} deposit{myRow?.depositCount === 1 ? "" : "s"} total
            </span>
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">LAST ACTIVITY</span>
            <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-300">{timeAgo(myRow?.lastActivity)}</p>
          </div>
        </div>
      </div>

      {showChamaSavings && (
        <>
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
                            {(canDepositForOthers || String(row.id) === myMembershipId) && (
                              <button
                                onClick={() => {
                                  setSelectedMember(row);
                                  setIsDepositModalOpen(true);
                                }}
                                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 transition"
                              >
                                Deposit
                              </button>
                            )}
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

      <MpesaStkModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        chamaId={chamaId}
        title={`Deposit Savings${selectedMember ? ` (${selectedMember.name})` : ""}`}
      />
    </div>
  );
}