import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Activity, ArrowDownLeft, ArrowUpRight, BookOpen, CircleDollarSign, RefreshCw, Wallet } from "lucide-react";
import useWorkspace from "@/app/hooks/useWorkspace";
import useFinanceSummary from "../hooks/useFinanceSummary";
import financeService from "../services/finance.service";
import Spinner from "@/shared/components/ui/Spinner";

const amount = (value, currency) => `${currency} ${Number(value || 0).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;

export default function BusinessFinanceDashboard() {
  const { workspaceId: routeId } = useParams();
  const workspace = useWorkspace();
  const workspaceId = routeId || workspace?.workspaceId;
  const currency = workspace?.currentWorkspace?.currency || "KES";
  const { summary, loading, refetch } = useFinanceSummary(workspaceId);
  const [recent, setRecent] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  const loadBusinessActivity = useCallback(async () => {
    if (!workspaceId) return;
    setLoadingActivity(true);
    try {
      const [transactions, accountRows] = await Promise.all([
        financeService.getTransactions(workspaceId, { scope: "all" }),
        financeService.getAccounts(workspaceId, { scope: "all" }),
      ]);
      setRecent(transactions.items || []);
      setAccounts(accountRows || []);
    } catch (error) {
      console.error("Could not load business finance activity", error);
    } finally {
      setLoadingActivity(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadBusinessActivity();
    window.addEventListener("finance:updated", loadBusinessActivity);
    return () => window.removeEventListener("finance:updated", loadBusinessActivity);
  }, [loadBusinessActivity]);

  const refresh = () => { refetch(); loadBusinessActivity(); };
  const tiles = [
    { label: "Sales this month", value: summary?.cash_in, icon: ArrowDownLeft, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" },
    { label: "Expenses this month", value: summary?.cash_out, icon: ArrowUpRight, color: "text-rose-600 bg-rose-50 dark:bg-rose-500/10" },
    { label: "Cash, bank & M-Pesa", value: summary?.cash_balance, icon: Wallet, color: "text-sky-600 bg-sky-50 dark:bg-sky-500/10" },
    { label: "Net activity this month", value: summary?.net_activity, icon: CircleDollarSign, color: "text-violet-600 bg-violet-50 dark:bg-violet-500/10" },
  ];

  if (loading && !summary) return <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-black text-slate-900 dark:text-white">Business Finance</h1><p className="mt-1 text-sm text-slate-500">Sales, expenses, cash accounts, and recent business transactions.</p></div>
        <button type="button" onClick={refresh} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><RefreshCw size={15} /> Refresh</button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => { const Icon = tile.icon; return <article key={tile.label} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-500">{tile.label}</span><span className={`rounded-xl p-2 ${tile.color}`}><Icon size={17} /></span></div><p className="mt-4 text-2xl font-black text-slate-900 dark:text-white">{amount(tile.value, currency)}</p></article>; })}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-800"><div className="flex items-center gap-3"><span className="rounded-xl bg-violet-50 p-2 text-violet-600 dark:bg-violet-500/10"><Activity size={18} /></span><div><h2 className="font-bold text-slate-900 dark:text-white">Recent business activity</h2><p className="text-xs text-slate-500">Sales and expenses recorded for this business.</p></div></div><div className="flex gap-2"><Link to={`/workspace/${workspaceId}/finance/transactions`} className="rounded-lg px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-500/10">Transactions</Link><Link to={`/workspace/${workspaceId}/finance/ledger`} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-500/10"><BookOpen size={14} /> Ledger</Link></div></div>
        {loadingActivity ? <div className="flex h-32 items-center justify-center"><Spinner /></div> : recent.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">No business transactions have been recorded yet.</div> : <div className="divide-y divide-slate-100 dark:divide-slate-800">{recent.slice(0, 8).map((tx) => <div key={tx._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div className="min-w-0"><p className="truncate text-sm font-semibold capitalize text-slate-900 dark:text-white">{String(tx.transaction_type || "activity").replaceAll("_", " ")}</p><p className="mt-0.5 truncate text-xs text-slate-500">{tx.description || tx.reference || "Business transaction"} · {new Date(tx.createdAt).toLocaleString()}</p></div><span className="shrink-0 text-sm font-bold text-slate-800 dark:text-slate-200">{amount(tx.amount, tx.currency || currency)}</span></div>)}</div>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold text-slate-900 dark:text-white">Business accounts</h2><span className="text-xs text-slate-500">{accounts.length} accounts</span></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{accounts.map((account) => <div key={account._id} className="rounded-xl border border-slate-100 p-4 dark:border-slate-800"><p className="text-xs font-semibold text-slate-500">{account.name}</p><p className="mt-2 text-lg font-extrabold text-slate-900 dark:text-white">{amount(account.balance, currency)}</p></div>)}</div></section>
    </div>
  );
}
