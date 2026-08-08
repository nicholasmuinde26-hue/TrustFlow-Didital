import React from "react";
import { Users, Plus, RefreshCw } from "lucide-react";
import { useWorkspace } from "../../../app/hooks/useWorkspace";
import { useBusinessCustomers } from "../hooks/useBusiness";

export default function CustomersPage() {
  const { workspaceId } = useWorkspace();
  const { customers, isLoading, isRefetching, refetch } = useBusinessCustomers(workspaceId);

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Customers</h1>
          <p className="text-xs text-slate-500">Manage customer records and purchase history.</p>
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
          <button className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors">
            <Plus size={16} /> Add Customer
          </button>
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <Users className="mx-auto h-10 w-10 text-slate-400 mb-2 opacity-50" />
          <p className="text-sm font-medium">No customers found.</p>
          <p className="text-xs text-slate-400 mt-1">Customer profiles and order histories will show up here.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => {
            const id = c._id || c.id;
            const name = c.name || "Unnamed Customer";
            const phone = c.phone || c.phoneNumber || "N/A";
            const totalSpent = Number(c.totalSpent || c.amountSpent || 0);

            return (
              <div
                key={id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
                    <Users size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">{name}</p>
                    <p className="text-xs text-slate-400 font-mono">{phone}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Total Spent:</span>
                  <span className="font-bold font-mono text-slate-900 dark:text-white">
                    KES {totalSpent.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}