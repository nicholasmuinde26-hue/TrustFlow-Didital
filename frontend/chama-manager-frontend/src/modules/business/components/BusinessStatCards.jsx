import React from "react";
import { DollarSign, ArrowUpRight, ArrowDownRight, Wallet, TrendingUp } from "lucide-react";

const money = (value) => `KES ${Number(value ?? 0).toLocaleString()}`;

export function BusinessStatCards({ stats }) {
  if (!stats) return null;

  const cashIn = stats.cashIn ?? stats.totalRevenue ?? 0;
  const cashOut = stats.cashOut ?? stats.totalExpenses ?? 0;
  const netCash = stats.netCash ?? stats.netProfit ?? Number(cashIn) - Number(cashOut);
  const revenueGrowth = Number(stats.revenueGrowth ?? 0);
  const expenseGrowth = Number(stats.expenseGrowth ?? 0);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard title="Cash In" value={money(cashIn)} growth={`${revenueGrowth > 0 ? "+" : ""}${revenueGrowth}%`} isPositive={revenueGrowth >= 0} icon={DollarSign} tone="emerald" />
      <StatCard title="Cash Out" value={money(cashOut)} growth={`${expenseGrowth > 0 ? "+" : ""}${expenseGrowth}%`} isPositive={expenseGrowth <= 0} icon={Wallet} tone="amber" />
      <StatCard title="Net Cash" value={money(netCash)} growth="Recorded transactions" isPositive={Number(netCash) >= 0} icon={TrendingUp} tone="violet" />
      <StatCard title="Available Cash" value={money(netCash)} growth="Current balance" isPositive={Number(netCash) >= 0} icon={DollarSign} tone="cyan" />
    </div>
  );
}

function StatCard({ title, value, growth, isPositive, icon: Icon, tone }) {
  const toneClasses = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  }[tone];

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${toneClasses}`}><Icon size={20} /></span>
        <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
          {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{growth}
        </span>
      </div>
      <p className="mt-4 text-xs font-medium text-slate-500 dark:text-slate-400">{title}</p>
      <p className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">{value}</p>
    </div>
  );
}