import React, { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import {
  TrendingUp,
  Wallet,
  PiggyBank,
  RefreshCw,
  AlertTriangle,
  Bell,
  Calendar,
  ChevronDown,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";
import useAuth from "@/app/hooks/useAuth";
import MpesaStkModal from "@/modules/finance/components/MpesaStkModal";
import useFinanceSummary from "@/modules/finance/hooks/useFinanceSummary";
import useLedger from "@/modules/finance/hooks/useLedger";
import mgrApi from "../api/mgr.api";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

export default function ChamaOverviewPage({ dashboard = {} }) {
  const { workspaceId: paramId } = useParams();
  const workspaceCtx = useWorkspace();
  const { user } = useAuth();
  const workspaceId = paramId || workspaceCtx?.workspaceId;

  const [isStkOpen, setIsStkOpen] = useState(false);
  const [chartTimeframe, setChartTimeframe] = useState("This Month");
  const [mgrData, setMgrData] = useState(null);

  const workspace = dashboard?.workspace || workspaceCtx?.currentWorkspace || {};
  const stats = dashboard?.stats || {};
  const { summary: financeSummary, isLoading: loadingSummary } = useFinanceSummary(workspaceId);
  const { entries: ledgerEntries, isLoading: loadingLedger } = useLedger(workspaceId, { limit: 10 });

  useEffect(() => {
    if (workspaceId) {
      mgrApi.getOverview(workspaceId)
        .then((res) => setMgrData(res?.data?.data))
        .catch(() => {});
    }
  }, [workspaceId]);

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

  // Dynamic Recent Activity from Ledger
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
    };
  });

  const currentDateStr = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 pb-12">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight sm:text-3xl text-slate-900 dark:text-white">
            Hello there!, {userName} <span className="inline-block animate-bounce">👋</span>
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Here's your chama's financial overview
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-600 animate-pulse" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {workspace?.name || "Chama Workspace"}
            </span>
            
          </div>

          

          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            <Calendar size={14} className="text-slate-400" />
            <span>{currentDateStr}</span>
          </div>
        </div>
      </div>

      {/* 5 KPI Stat Cards Header Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* TOTAL BALANCE */}
        <div className="group rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              TOTAL BALANCE
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Wallet size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
            {money(totalBalance)}
          </p>
          <div className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <TrendingUp size={14} />
            <span>Cash & Bank ledger</span>
          </div>
        </div>

        {/* THIS MONTH INCOME */}
        <div className="group rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              THIS MONTH INCOME
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <ArrowDownLeft size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
            {money(monthIncome)}
          </p>
          <div className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <TrendingUp size={14} />
            <span>Total group deposits</span>
          </div>
        </div>

        {/* SAVINGS BALANCE */}
        <div className="group rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              SAVINGS BALANCE
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400">
              <PiggyBank size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
            {money(savingsBalance)}
          </p>
          <div className="mt-2 flex items-center gap-1 text-xs font-bold text-violet-600 dark:text-violet-400">
            <span>Member savings pool</span>
          </div>
        </div>

        {/* MGR POOL (CURRENT) */}
        <div className="group rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              MGR POOL (CURRENT)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <RefreshCw size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
            {money(mgrPool)}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>{mgrData?.currentRound ? `Round #${mgrData.currentRound.round_number || '1'}` : 'Rotational Pool'}</span>
          </div>
        </div>

        {/* OUTSTANDING */}
        <div className="group rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              OUTSTANDING
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
              <AlertTriangle size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
            {money(outstanding)}
          </p>
          <div className="mt-2 flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400">
            <span>{stats?.memberCount || 0} active members</span>
          </div>
        </div>
      </div>

      {/* Middle Grid: Charts & Action Center */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Income vs Expenses Chart */}
        <div className="lg:col-span-5 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
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
            <select
              value={chartTimeframe}
              onChange={(e) => setChartTimeframe(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="This Month">This Month</option>
              <option value="Last Month">Last Month</option>
              <option value="This Year">This Year</option>
            </select>
          </div>

          <div className="relative h-56 w-full pt-4">
            <svg className="h-full w-full overflow-visible" viewBox="0 0 400 180" preserveAspectRatio="none">
              <line x1="0" y1="30" x2="400" y2="30" stroke="currentColor" strokeDasharray="4 4" className="text-slate-100 dark:text-slate-800" strokeWidth="1" />
              <line x1="0" y1="75" x2="400" y2="75" stroke="currentColor" strokeDasharray="4 4" className="text-slate-100 dark:text-slate-800" strokeWidth="1" />
              <line x1="0" y1="120" x2="400" y2="120" stroke="currentColor" strokeDasharray="4 4" className="text-slate-100 dark:text-slate-800" strokeWidth="1" />
              <line x1="0" y1="165" x2="400" y2="165" stroke="currentColor" strokeDasharray="4 4" className="text-slate-200 dark:text-slate-800" strokeWidth="1" />

              <defs>
                <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              <path d="M 10 140 Q 90 120, 150 90 T 250 65 T 390 40 L 390 165 L 10 165 Z" fill="url(#incomeGradient)" />
              <path d="M 10 140 Q 90 120, 150 90 T 250 65 T 390 40" fill="none" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M 10 160 Q 90 145, 150 130 T 250 120 T 390 110" fill="none" stroke="#f43f5e" strokeWidth="3.5" strokeLinecap="round" />
              <circle cx="390" cy="40" r="5" fill="#10b981" />
              <circle cx="390" cy="110" r="5" fill="#f43f5e" />
            </svg>

            <div className="mt-2 flex justify-between text-[11px] font-bold text-slate-400 px-1">
              <span>W1</span>
              <span>W2</span>
              <span>W3</span>
              <span>W4</span>
              <span>W5</span>
            </div>
          </div>
        </div>

        {/* Money Flow (This Month) */}
        <div className="lg:col-span-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Money Flow (This Month)
            </h2>
          </div>

          <div className="my-3 flex items-center justify-center relative">
            <svg className="h-44 w-44 transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="38" stroke="#e2e8f0" strokeWidth="12" fill="none" className="dark:stroke-slate-800" />
              <circle cx="50" cy="50" r="38" stroke="#10b981" strokeWidth="12" fill="none" strokeDasharray="238.7" strokeDashoffset={inflowDashoffset} strokeLinecap="round" />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">NET FLOW</span>
              <span className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{money(netFlow)}</span>
            </div>
          </div>

          <div className="space-y-2 text-xs font-semibold">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Total Inflow</span>
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">{money(totalInflow)} <ArrowDownLeft size={14} className="text-emerald-600" /></span>
            </div>

            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-purple-500" />Total Outflow</span>
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">{money(totalOutflow)} <ArrowUpRight size={14} className="text-rose-500" /></span>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between font-extrabold">
              <span className="text-slate-700 dark:text-slate-300">Net Flow</span>
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">{money(netFlow)} <ArrowDownLeft size={14} /></span>
            </div>
          </div>
        </div>

        {/* Action Center */}
        <div className="lg:col-span-3 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-600 text-white text-xs">⚡</span>
                Action Center
              </h2>
              <ChevronRight size={16} className="text-slate-400" />
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400"><XCircle size={16} /></div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{failedCount} payments failed</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Review M-Pesa reconciliation</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"><AlertTriangle size={16} /></div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{unpaidCount} members with unpaid balance</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Send reminders</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400"><Clock size={16} /></div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{pendingPayoutsCount} payout awaits approval</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Chair approval needed</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400"><RefreshCw size={16} /></div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{pendingWithdrawalsCount} pending transactions</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Review requests</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Recent Activity & Collection Performance */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Recent Activity */}
        <div className="lg:col-span-7 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Recent Activity
            </h2>
            <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><SlidersHorizontal size={16} /></button>
          </div>

          <div className="space-y-3">
            {recentActivities.length > 0 ? (
              recentActivities.map((act) => (
                <div key={act.id} className="flex items-center justify-between rounded-2xl bg-slate-50/70 p-3.5 dark:bg-slate-800/40">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{act.title}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{money(act.amount)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                      {act.status}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">{act.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">No recent ledger activity recorded yet.</p>
            )}
          </div>
        </div>

        {/* Collection Performance */}
        <div className="lg:col-span-5 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Collection Performance
            </h2>
            <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><SlidersHorizontal size={16} /></button>
          </div>

          <div className="my-4 flex items-center justify-center relative">
            <svg className="h-44 w-44 transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="38" stroke="#e2e8f0" strokeWidth="10" fill="none" className="dark:stroke-slate-800" />
              <circle cx="50" cy="50" r="38" stroke="#10b981" strokeWidth="10" fill="none" strokeDasharray="238.7" strokeDashoffset={collectionDashoffset} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{collectionRateNum}%</span>
              <span className="text-[11px] font-bold text-slate-400">of target</span>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Expected</span><span className="font-bold text-slate-900 dark:text-white">{money(targetCollection)}</span></div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Collected</span><span className="font-bold text-slate-900 dark:text-white">{money(monthIncome)}</span></div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Outstanding</span><span className="font-bold text-rose-600">{money(outstanding)}</span></div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-right">
            <Link to={`${base}/contributions`} className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400">
              View Contributors <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      <MpesaStkModal isOpen={isStkOpen} onClose={() => setIsStkOpen(false)} chamaId={workspaceId} title="Deposit to Savings via M-Pesa" />
    </div>
  );
}