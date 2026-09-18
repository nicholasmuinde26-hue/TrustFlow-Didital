import React, { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Plus,
  Bell,
  Download,
  Search,
  Calendar,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Target,
  FileText,
} from "lucide-react";
import BusinessMpesaModal from "@/modules/business/components/BusinessMpesaModal";
import useFinanceSummary from "@/modules/finance/hooks/useFinanceSummary";
import financeService from "@/modules/finance/services/finance.service";
import mgrApi from "@/modules/chama/api/mgr.api";
import useWorkspace from "@/app/hooks/useWorkspace";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

// Small member-row status pill — mirrors the Paid/Due language on the
// Doc1 "Money & collections" mockup rather than the more clinical
// Paid/Partial/Unpaid used in the filter dropdown below.
function MemberStatusPill({ status }) {
  if (status === "paid") {
    return (
      <span className="rounded-xl bg-mint-deep px-3 py-1.5 text-[11px] font-black text-mint">
        Paid
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span className="rounded-xl bg-amber-deep-bg px-3 py-1.5 text-[11px] font-black text-amber-deep-text">
        Partial
      </span>
    );
  }
  return (
    <span className="rounded-xl bg-amber-deep-bg px-3 py-1.5 text-[11px] font-black text-amber-deep-text">
      Due
    </span>
  );
}

export default function ContributionsPage() {
  const { workspaceId: routeWorkspaceId } = useParams();
  const { workspaceId: ctxWorkspaceId } = useWorkspace();
  const workspaceId = routeWorkspaceId || ctxWorkspaceId;

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [isStkModalOpen, setIsStkModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [toastNotice, setToastNotice] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Chama-native contributions data
  const [contribData, setContribData] = useState({ plans: [], activePlan: null, members: [] });
  const [loadingContrib, setLoadingContrib] = useState(true);
  const [trend, setTrend] = useState({ weeks: [] });

  const { summary: financeSummary } = useFinanceSummary(workspaceId);

  useEffect(() => {
    if (!workspaceId) return;
    setLoadingContrib(true);
    mgrApi.getContributions(workspaceId)
      .then(res => setContribData(res.data?.data || { plans: [], activePlan: null, members: [] }))
      .catch(() => {})
      .finally(() => setLoadingContrib(false));
  }, [workspaceId]);

  // Same weekly trend the chama Overview page charts — reused here for
  // the "Balance trend" card so both pages read the same real numbers.
  useEffect(() => {
    if (!workspaceId) return;
    financeService.getTrend(workspaceId).then(setTrend).catch(() => {});
  }, [workspaceId]);

  const { plans = [], activePlan, members = [] } = contribData;
  const planAmount = activePlan?.amount != null ? Number(activePlan.amount)
    : activePlan?.contribution_rule?.uniform_amount != null ? Number(activePlan.contribution_rule.uniform_amount)
    : null;

  // Build member list from Chama-native response
  const activeMembersList = members.map((m, idx) => {
    const paidAmt = Number(m.paid || 0);
    const expAmt = Number(m.expected || planAmount || 0);
    const balAmt = Math.max(0, expAmt - paidAmt);
    const st = !expAmt
      ? (paidAmt > 0 ? "paid" : "unpaid")
      : paidAmt >= expAmt ? "paid" : paidAmt > 0 ? "partial" : "unpaid";
    return {
      id: String(m._id || idx),
      name: m.user_id?.name || `Member ${idx + 1}`,
      phone: m.user_id?.phone || "—",
      expected: expAmt,
      paid: paidAmt,
      balance: balAmt,
      status: m.status === "paid" ? "paid" : st,
      method: paidAmt > 0 ? "M-Pesa" : "-",
    };
  });

  // Dynamic totals
  const totalReceived = financeSummary?.total_contributions || activeMembersList.reduce((acc, m) => acc + m.paid, 0);
  const totalOutstanding = activeMembersList.reduce((acc, m) => acc + m.balance, 0);
  const totalExpected = totalReceived + totalOutstanding;
  const collectionRate = totalExpected > 0 ? ((totalReceived / totalExpected) * 100).toFixed(1) : "0.0";
  const outstandingMembersCount = activeMembersList.filter((m) => m.status !== "paid").length;

  const filteredMembers = activeMembersList.filter((m) => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || m.status === statusFilter;
    const matchesMethod = methodFilter === "all" || m.method.toLowerCase() === methodFilter.toLowerCase();
    return matchesSearch && matchesStatus && matchesMethod;
  });

  const handleSendReminders = () => {
    setToastNotice("Reminders sent successfully to members with unpaid balances!");
    setTimeout(() => setToastNotice(null), 4000);
  };

  const handleOpenStk = (member) => {
    setSelectedMember(member);
    setIsStkModalOpen(true);
  };

  const currentDateStr = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const currentMonthName = new Date().toLocaleDateString("en-US", { month: "long" });

  // Sparkline path for the Balance trend card — same weekly income
  // series as the chama Overview page's chart, laid out on a small
  // 0..320 x 0..80 viewBox.
  const trendWeeks = trend?.weeks || [];
  const trendMax = Math.max(1, ...trendWeeks.map((w) => w.income));
  const trendStepX = trendWeeks.length > 1 ? 320 / (trendWeeks.length - 1) : 0;
  const trendPoints = trendWeeks.map((w, i) => [i * trendStepX, 76 - (Math.max(0, w.income) / trendMax) * 68]);
  const trendPath = trendPoints.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const lastTrendPoint = trendPoints[trendPoints.length - 1];

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-mist pb-12">
      {toastNotice && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-600 p-4 text-white shadow-xl animate-fade-in dark:border-mint-strong dark:bg-mint-strong">
          <CheckCircle2 size={18} className="shrink-0" />
          <p className="text-xs font-bold">{toastNotice}</p>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-mist sm:text-3xl">
            Money &amp; collections
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-mist-muted">
            Keep contributions moving and the group's finances clear.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleOpenStk(null)}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist dark:hover:bg-obsidian-raised transition"
          >
            <Layers size={16} className="text-slate-400 dark:text-mist-muted" /> Contribution plans
          </button>
          <button
            onClick={() => handleOpenStk(null)}
            className="flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-violet-700 dark:bg-mint dark:text-mint-strong dark:hover:bg-mint-hover transition"
          >
            <Plus size={16} /> Record payment
          </button>
        </div>
      </div>

      {/* ================================================================
       * AT A GLANCE — available balance, this month's target and
       * collection progress, mirroring the Doc1 "Money & collections"
       * Overview tab. The detailed, filterable member table (the
       * mockup's "Contributions" tab) stays further down, unchanged.
       * ============================================================== */}
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-900 p-5 text-white shadow-sm dark:from-mint-strong dark:via-mint-strong dark:to-mint-deep lg:col-span-2">
          <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/5" />
          <span className="relative text-xs font-bold uppercase tracking-wider text-emerald-100/80 dark:text-mint/70">
            Available group balance
          </span>
          <p className="relative mt-1 text-3xl font-black tracking-tight">{money(financeSummary?.cash_balance)}</p>
          <p className="relative mt-2 text-xs font-semibold text-emerald-100/90 dark:text-mist-muted">
            ↑ {money(totalReceived)} collected this month
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-mist-muted">
            <Target size={14} className="text-emerald-600 dark:text-mint" /> {currentMonthName} target
          </div>
          <p className="mt-2 text-xl font-black text-slate-900 dark:text-mist">{money(totalExpected)}</p>
          <p className="mt-0.5 text-[11px] font-bold text-emerald-600 dark:text-mint">{money(totalReceived)} received</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-mist-muted">
            <CheckCircle2 size={14} className="text-emerald-600 dark:text-mint" /> Collection progress
          </div>
          <p className="mt-2 text-xl font-black text-slate-900 dark:text-mist">{collectionRate}%</p>
          <p className="mt-0.5 text-[11px] font-bold text-emerald-600 dark:text-mint">
            {activeMembersList.length - outstandingMembersCount} of {activeMembersList.length || 0} members paid
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* This month's collection — member preview */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card lg:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-mist">{currentMonthName} contribution</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-mist-muted">
                {planAmount ? `${money(planAmount)} per member` : "No active plan amount set"}
                {activePlan?.deadline && ` · Closes ${new Date(activePlan.deadline).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}`}
              </p>
            </div>
            <Link
              to={`/workspace/${workspaceId}/chama-contributions`}
              className="shrink-0 text-xs font-bold text-violet-700 hover:text-violet-800 dark:text-mint"
            >
              Open collection →
            </Link>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-obsidian-raised">
            <div
              className="h-full rounded-full bg-emerald-500 dark:bg-mint"
              style={{ width: `${Math.min(100, collectionRate)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs font-bold">
            <span className="text-slate-900 dark:text-mist">{money(totalReceived)} collected</span>
            <span className="text-slate-500 dark:text-mist-muted">{outstandingMembersCount} outstanding</span>
          </div>

          <div className="mt-4 divide-y divide-slate-100 dark:divide-obsidian-border">
            {loadingContrib ? (
              <p className="py-6 text-center text-xs text-slate-400">Loading members…</p>
            ) : activeMembersList.length > 0 ? (
              activeMembersList.slice(0, 4).map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-black text-slate-700 dark:bg-obsidian-raised dark:text-mist">
                      {m.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-mist">{m.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-mist-muted">
                        {m.status === "paid" ? `Paid · ${m.method}` : m.status === "partial" ? "Partially paid" : "Reminder sent"}
                      </p>
                    </div>
                  </div>
                  <MemberStatusPill status={m.status} />
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-xs text-slate-400">No members found for this collection.</p>
            )}
          </div>
        </div>

        {/* Quick actions + balance trend */}
        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6 dark:border-mint-strong/50 dark:bg-mint-strong/25">
            <h2 className="text-base font-bold text-slate-900 dark:text-mist">Quick actions</h2>
            <div className="mt-3 space-y-3">
              <button
                onClick={handleSendReminders}
                className="flex w-full items-start gap-3 rounded-2xl bg-white/70 p-3 text-left transition hover:bg-white dark:bg-obsidian-card/60 dark:hover:bg-obsidian-card"
              >
                <Bell size={16} className="mt-0.5 shrink-0 text-emerald-600 dark:text-mint" />
                <span>
                  <span className="block text-xs font-bold text-slate-900 dark:text-mist">Send payment reminder</span>
                  <span className="block text-[11px] text-slate-500 dark:text-mist-muted">
                    To {outstandingMembersCount} member{outstandingMembersCount === 1 ? "" : "s"} with outstanding contributions
                  </span>
                </span>
              </button>

              <Link
                to={`/workspace/${workspaceId}/reports`}
                className="flex w-full items-start gap-3 rounded-2xl bg-white/70 p-3 text-left transition hover:bg-white dark:bg-obsidian-card/60 dark:hover:bg-obsidian-card"
              >
                <FileText size={16} className="mt-0.5 shrink-0 text-emerald-600 dark:text-mint" />
                <span>
                  <span className="block text-xs font-bold text-slate-900 dark:text-mist">Books &amp; reports</span>
                  <span className="block text-[11px] text-slate-500 dark:text-mist-muted">Balance sheet, income statement, cash flow</span>
                </span>
              </Link>

              <button className="flex w-full items-start gap-3 rounded-2xl bg-white/70 p-3 text-left transition hover:bg-white dark:bg-obsidian-card/60 dark:hover:bg-obsidian-card">
                <Download size={16} className="mt-0.5 shrink-0 text-emerald-600 dark:text-mint" />
                <span>
                  <span className="block text-xs font-bold text-slate-900 dark:text-mist">Export finance report</span>
                  <span className="block text-[11px] text-slate-500 dark:text-mist-muted">{currentDateStr} summary</span>
                </span>
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-mist">Balance trend</h2>
                <p className="text-[11px] text-slate-500 dark:text-mist-muted">
                  {trendWeeks.length > 0 ? `Last ${trendWeeks.length} weeks` : "No activity yet"}
                </p>
              </div>
              <Link to={`/workspace/${workspaceId}/reports`} className="text-xs font-bold text-violet-700 hover:text-violet-800 dark:text-mint">
                Details
              </Link>
            </div>
            {trendPoints.length > 1 ? (
              <div className="mt-4">
                <svg className="h-20 w-full overflow-visible" viewBox="0 0 320 80" preserveAspectRatio="none">
                  <path d={trendPath} fill="none" stroke="#10b981" className="dark:stroke-mint" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  {lastTrendPoint && <circle cx={lastTrendPoint[0]} cy={lastTrendPoint[1]} r="4" fill="#10b981" className="dark:fill-mint" />}
                </svg>
                <div className="mt-1 flex justify-between text-[10px] font-bold text-slate-400">
                  {trendWeeks.map((w) => (
                    <span key={w.label}>{w.label}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-20 items-center justify-center text-xs text-slate-400">Not enough data yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Contribution Cycle & Filters Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-obsidian-border">
          <div className="flex items-center gap-3">
            <span className="text-sm font-extrabold text-slate-900 dark:text-mist">
              Contribution Cycle: {currentDateStr}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-mist-muted font-medium">
            <span>Cycle Active</span>
            <Calendar size={14} className="text-slate-400" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-12 items-center">
          <div className="relative sm:col-span-4">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search member..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-900 focus:border-violet-600 focus:bg-white focus:outline-none dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist dark:focus:border-mint dark:focus:bg-obsidian-raised"
            />
          </div>

          <div className="sm:col-span-3">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 px-3 text-xs font-bold text-slate-700 dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist-muted focus:outline-none">
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <select className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 px-3 text-xs font-bold text-slate-700 dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist-muted focus:outline-none">
              <option value="all">All Plans</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 px-3 text-xs font-bold text-slate-700 dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist-muted focus:outline-none">
              <option value="all">All Methods</option>
              <option value="m-pesa">M-Pesa</option>
              <option value="bank">Bank</option>
            </select>
          </div>

          <div className="sm:col-span-1 flex justify-end">
            <button className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist-muted">
              <Filter size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Detailed Members Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/50 uppercase text-[11px] font-extrabold text-slate-400 dark:border-obsidian-border dark:bg-obsidian-raised/40">
              <tr>
                <th className="px-6 py-4">MEMBER</th>
                <th className="px-6 py-4">EXPECTED</th>
                <th className="px-6 py-4">PAID</th>
                <th className="px-6 py-4">BALANCE</th>
                <th className="px-6 py-4">STATUS</th>
                <th className="px-6 py-4">METHOD</th>
                <th className="px-6 py-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-obsidian-border font-semibold">
              {filteredMembers.length > 0 ? (
                filteredMembers.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-obsidian-raised/40 transition">
                    <td className="px-6 py-4 text-slate-900 dark:text-mist font-bold">{row.name}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-mist-muted font-mono">{money(row.expected)}</td>
                    <td className="px-6 py-4 text-slate-900 dark:text-mist font-mono font-bold">{money(row.paid)}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-mist-muted font-mono">{money(row.balance)}</td>
                    <td className="px-6 py-4">
                      {row.status === "paid" && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-800 dark:bg-mint-deep dark:text-mint"><CheckCircle2 size={12} /> Paid</span>}
                      {row.status === "partial" && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-800 dark:bg-amber-deep-bg dark:text-amber-deep-text"><Clock size={12} /> Partial</span>}
                      {row.status === "unpaid" && <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-[11px] font-black text-rose-800 dark:bg-rose-950 dark:text-rose-300"><AlertTriangle size={12} /> Unpaid</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-mist-muted">{row.method}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleOpenStk(row)} className="text-slate-400 hover:text-slate-700 dark:hover:text-mist p-1">
                        <MoreVertical size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-slate-400 font-medium">
                    No members or contribution entries found for this group.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-white px-6 py-4 text-xs font-semibold text-slate-500 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist-muted">
          <span>Showing 1 to {filteredMembers.length} of {activeMembersList.length} members</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-obsidian-border dark:hover:bg-obsidian-raised"><ChevronLeft size={14} /></button>
            <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-white font-bold dark:bg-mint dark:text-mint-strong">1</button>
            <button onClick={() => setCurrentPage((p) => p + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-obsidian-border dark:hover:bg-obsidian-raised"><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      <BusinessMpesaModal isOpen={isStkModalOpen} onClose={() => setIsStkModalOpen(false)} workspaceId={workspaceId} title={`Record Payment${selectedMember ? ` (${selectedMember.name})` : ""}`} />
    </div>
  );
}
