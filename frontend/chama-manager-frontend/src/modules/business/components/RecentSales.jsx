import React from "react";
import { ArrowUpRight } from "lucide-react";
import { Link, useParams } from "react-router-dom";

const money = (value, currency) => `${currency} ${Number(value ?? 0).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;

export function RecentSales({ sales = [], title = "Recent Sales", currency = "KES", showType = false }) {
  const { workspaceId } = useParams();
  const completedSales = (Array.isArray(sales) ? sales : []).filter(
    (sale) => !sale.status || sale.status === "completed"
  );

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div><h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">{title}</h2><p className="mt-1 text-xs text-slate-500">Latest completed business transactions</p></div>
        <div className="flex items-center gap-3"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{completedSales.length}</span><Link to={`/workspace/${workspaceId}/business/sales`} className="text-xs font-bold text-violet-700 hover:underline dark:text-violet-300">View all</Link></div>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {completedSales.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No completed transactions yet. Completed sales and payments will appear here.</p>
        ) : (
          completedSales.map((sale) => (
            <div key={sale._id || sale.id} className="flex items-center justify-between py-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold capitalize text-slate-900 dark:text-white">
                    {showType ? String(sale.type || "transaction").replaceAll("_", " ") : sale.customer_name || sale.customer || "Walk-in customer"}
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    <ArrowUpRight size={10} /> {showType ? (sale.direction === "cash_out" ? "Money out" : "Money in") : "Completed"}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] font-mono text-slate-400">
                  {sale.external_reference || sale.mpesa_receipt_number || sale.invoiceNo || "Sale"} · {sale.payment_channel || sale.paymentMethod || "cash"} · {sale.createdAt ? new Date(sale.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" }) : "Date unavailable"}
                </p>
              </div>
              <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                {money(sale.amount, sale.currency || currency)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
