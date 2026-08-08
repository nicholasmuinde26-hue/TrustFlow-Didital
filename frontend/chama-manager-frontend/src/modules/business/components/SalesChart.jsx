import React from "react";

const money = (value) => Number(value ?? 0).toLocaleString();

export function SalesChart({ data = [] }) {
  const chartData = Array.isArray(data) ? data : [];
  const maxValue = Math.max(...chartData.map((item) => Math.max(Number(item.sales ?? item.cashIn ?? 0), Number(item.expenses ?? item.cashOut ?? 0))), 1);

  return <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="mb-6 flex items-center justify-between"><h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Revenue vs Expense Trend</h2><div className="flex gap-4 text-xs font-medium"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-600" /> Sales</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Expenses</span></div></div>{chartData.length === 0 ? <div className="flex h-48 items-center justify-center rounded-xl border border-dashed text-sm text-slate-500">No transaction trend yet.</div> : <div className="flex h-48 items-end gap-3 border-b border-slate-100 pb-2 pt-6 dark:border-slate-800">{chartData.map((item, index) => { const sales = Number(item.sales ?? item.cashIn ?? 0); const expenses = Number(item.expenses ?? item.cashOut ?? 0); return <div key={item.month || item.label || index} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"><div className="flex h-full w-full items-end justify-center gap-1"><div style={{ height: `${(sales / maxValue) * 100}%` }} className="w-1/2 max-w-[14px] rounded-t-sm bg-violet-600" title={`Sales: KES ${money(sales)}`} /><div style={{ height: `${(expenses / maxValue) * 100}%` }} className="w-1/2 max-w-[14px] rounded-t-sm bg-amber-500" title={`Expenses: KES ${money(expenses)}`} /></div><span className="text-[10px] font-mono text-slate-400">{item.month || item.label || ""}</span></div>; })}</div>}</div>;
}
