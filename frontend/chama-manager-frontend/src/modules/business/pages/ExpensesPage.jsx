import React from "react";
import { Receipt, Plus, RefreshCw } from "lucide-react";
import { useWorkspace } from "../../../app/hooks/useWorkspace";
import { useBusinessExpenses } from "../hooks/useBusiness";

export default function ExpensesPage() {
  const { workspaceId } = useWorkspace();
  const { expenses, isLoading, isRefetching, refetch } = useBusinessExpenses(workspaceId);

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Expenses</h1>
          <p className="text-xs text-slate-500">Track operating costs, rent, supplier invoices, and petty cash.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50"
          >
            <RefreshCw size={14} className={isRefetching ? "animate-spin" : ""} />
            Refresh
          </button>
          <button className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition-colors">
            <Plus size={16} /> Record Expense
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {expenses.length === 0 ? (
          <div className="py-12 text-center text-slate-500 dark:text-slate-400">
            <Receipt className="mx-auto h-10 w-10 text-slate-400 mb-2 opacity-50" />
            <p className="text-sm font-medium">No expenses recorded yet.</p>
            <p className="text-xs text-slate-400 mt-1">Recorded operating costs will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {expenses.map((exp) => {
              const id = exp._id || exp.id;
              const category = exp.category || exp.title || "General Expense";
              const supplier = exp.supplier || exp.payee || exp.vendor || "N/A";
              const dateStr = exp.date || (exp.createdAt ? new Date(exp.createdAt).toLocaleDateString() : "N/A");
              const amount = Number(exp.amount || 0);

              return (
                <div key={id} className="flex items-center justify-between py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300">
                      <Receipt size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{category}</p>
                      <p className="text-xs text-slate-400">
                        {supplier} • {dateStr}
                      </p>
                    </div>
                  </div>
                  <p className="font-bold text-sm font-mono text-slate-900 dark:text-white">
                    KES {amount.toLocaleString()}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}