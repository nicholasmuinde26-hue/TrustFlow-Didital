import React from "react";
import { CalendarDays, DollarSign, TrendingUp, Wallet } from "lucide-react";

const CATEGORY_COPY = {
  retail: { inflow: "Sales collected", outflow: "Purchases & expenses" },
  restaurant: { inflow: "Order revenue", outflow: "Food & operating costs" },
  rental: { inflow: "Rent collected", outflow: "Property expenses" },
  service: { inflow: "Service income", outflow: "Operating costs" },
  other: { inflow: "Money received", outflow: "Money spent" },
};

const money = (value, currency) => `${currency} ${Number(value ?? 0).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;

export function BusinessStatCards({ stats, category = "other", currency = "KES" }) {
  if (!stats) return null;
  const copy = CATEGORY_COPY[category] || CATEGORY_COPY.other;
  const cashIn = Number(stats.cashIn ?? stats.totalRevenue ?? 0);
  const cashOut = Number(stats.cashOut ?? stats.totalExpenses ?? 0);
  const netCash = Number(stats.netCash ?? stats.netProfit ?? cashIn - cashOut);
  const availableCash = Number(stats.availableCash ?? 0);

  const cards = [
    { title: copy.inflow, value: money(cashIn, currency), period: "Lifetime", hint: "Completed transactions", icon: DollarSign, tone: "emerald" },
    { title: copy.outflow, value: money(cashOut, currency), period: "Lifetime", hint: "Completed transactions", icon: Wallet, tone: "amber" },
    { title: "Net cash movement", value: money(netCash, currency), period: "Lifetime", hint: "Received less spent", icon: TrendingUp, tone: netCash >= 0 ? "violet" : "rose" },
    { title: "Available cash", value: money(availableCash, currency), period: "Current", hint: "Cash, bank and M-Pesa balances", icon: DollarSign, tone: "cyan" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ title, value, period, hint, icon: Icon, tone }) => (
        <article key={title} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${toneClass(tone)}`}><Icon size={19} /></span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400"><CalendarDays size={12} /> {period}</span>
          </div>
          <p className="mt-4 text-xs font-semibold text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-1 text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">{value}</p>
          <p className="mt-1 text-[10px] text-slate-400">{hint}</p>
        </article>
      ))}
    </div>
  );
}

function toneClass(tone) {
  return {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  }[tone];
}

export default BusinessStatCards;
