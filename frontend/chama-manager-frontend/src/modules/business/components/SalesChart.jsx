import React from "react";

const COPY = {
  rental: { title: "Rent received vs property costs", income: "Rent received", spending: "Property costs" },
  retail: { title: "Sales vs purchases and expenses", income: "Sales", spending: "Purchases & expenses" },
  restaurant: { title: "Order revenue vs operating costs", income: "Order revenue", spending: "Operating costs" },
  service: { title: "Service income vs operating costs", income: "Service income", spending: "Operating costs" },
  other: { title: "Money received vs money spent", income: "Received", spending: "Spent" },
};

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const money = (value, currency) => `${currency} ${number(value).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;

export function SalesChart({ data = [], category = "other", currency = "KES" }) {
  const chartData = Array.isArray(data) ? data : [];
  const copy = COPY[category] || COPY.other;
  const maxValue = Math.max(...chartData.map((item) => Math.max(number(item.sales ?? item.cashIn), number(item.expenses ?? item.cashOut))), 1);
  const hasValues = chartData.some((item) => number(item.sales ?? item.cashIn) > 0 || number(item.expenses ?? item.cashOut) > 0);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{copy.title}</h2><p className="mt-1 text-xs text-slate-400">Completed transactions · last six months</p></div>
        <div className="flex gap-4 text-xs font-medium text-slate-500 dark:text-slate-400"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-600" />{copy.income}</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />{copy.spending}</span></div>
      </div>
      {!chartData.length || !hasValues ? (
        <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 text-center text-sm text-slate-500 dark:border-slate-700">Your six-month activity trend will appear here once transactions are completed.</div>
      ) : (
        <div className="flex h-48 items-end gap-2 border-b border-slate-100 pb-2 pt-4 dark:border-slate-800 sm:gap-3" role="img" aria-label={`${copy.income} and ${copy.spending} over the last six months`}>
          {chartData.map((item, index) => {
            const income = number(item.sales ?? item.cashIn);
            const spending = number(item.expenses ?? item.cashOut);
            const incomeHeight = income > 0 ? Math.max(3, (income / maxValue) * 100) : 0;
            const spendingHeight = spending > 0 ? Math.max(3, (spending / maxValue) * 100) : 0;
            return <div key={`${item.month || item.label || "month"}-${index}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
              <div className="flex h-full w-full items-end justify-center gap-1"><div style={{ height: `${incomeHeight}%` }} className="w-1/2 max-w-4 rounded-t-sm bg-violet-600" title={`${copy.income}: ${money(income, currency)}`} /><div style={{ height: `${spendingHeight}%` }} className="w-1/2 max-w-4 rounded-t-sm bg-amber-500" title={`${copy.spending}: ${money(spending, currency)}`} /></div>
              <span className="text-[10px] font-mono text-slate-400">{item.month || item.label || ""}</span>
            </div>;
          })}
        </div>
      )}
    </section>
  );
}

export default SalesChart;
