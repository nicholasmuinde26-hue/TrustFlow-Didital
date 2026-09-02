import React from "react";
import { ArrowUpRight } from "lucide-react";

const money = (value) => `KES ${Number(value ?? 0).toLocaleString()}`;

export function RecentSales({ sales = [], title = "Recent Sales" }) {
  const completedSales = (Array.isArray(sales) ? sales : []).filter(
    (sale) => !sale.status || sale.status === "completed"
  );

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">{title}</h2>
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{completedSales.length} completed</span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {completedSales.length === 0 ? (
          <p className="py-3 text-sm text-slate-500">No completed sales recorded yet.</p>
        ) : (
          completedSales.map((sale) => (
            <div key={sale._id || sale.id} className="flex items-center justify-between py-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {sale.customer_name || sale.customer || "Walk-in customer"}
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    <ArrowUpRight size={10} /> Completed
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] font-mono text-slate-400">
                  {sale.external_reference || sale.mpesa_receipt_number || sale.invoiceNo || "Sale"} • {sale.payment_channel || sale.paymentMethod || "cash"}
                </p>
              </div>
              <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                {money(sale.amount)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
