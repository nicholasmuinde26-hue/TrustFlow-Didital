import React from "react";
import { Users, Plus, RefreshCw } from "lucide-react";
import { useWorkspace } from "../../../app/hooks/useWorkspace";
import { useBusinessCustomers } from "../hooks/useBusiness";

export default function CustomersPage() {
  const { workspaceId, currentWorkspace } = useWorkspace();
  const { customers, isLoading, isRefetching, refetch } = useBusinessCustomers(workspaceId);
  const customerList = Array.isArray(customers) ? customers : [];

  const isRental = currentWorkspace?.category === "rental";
  const copy = isRental
    ? {
        heading: "Tenants",
        subtitle: "Manage tenant records and rent payment history.",
        addLabel: "Add Tenant",
        emptyTitle: "No tenants recorded yet.",
        emptyHint: "Tenants paying rent via your business till/accounts 3+ times will automatically appear here.",
        countLabel: "Rent payments",
        verifiedLabel: "Verified (3+ Rent Payments)",
        totalLabel: "Total paid",
        unnamed: "Unnamed Tenant",
      }
    : {
        heading: "Customers",
        subtitle: "Manage customer records and purchase history.",
        addLabel: "Add Customer",
        emptyTitle: "No customers recorded yet.",
        emptyHint: "Customers paying via business till/accounts 3+ times will automatically appear here.",
        countLabel: "Purchases",
        verifiedLabel: "Verified (3+ Purchases)",
        totalLabel: "Total spent",
        unnamed: "Unnamed Customer",
      };

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
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">{copy.heading}</h1>
          <p className="text-xs text-slate-500">{copy.subtitle}</p>
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
            <Plus size={16} /> {copy.addLabel}
          </button>
        </div>
      </div>

      {customerList.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <Users className="mx-auto h-10 w-10 text-slate-400 mb-2 opacity-50" />
          <p className="text-sm font-medium">{copy.emptyTitle}</p>
          <p className="text-xs text-slate-400 mt-1">{copy.emptyHint}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {customerList.map((c) => {

            const id = c._id || c.id;
            const name = c.name || copy.unnamed;
            const phone = c.phone || c.phoneNumber || "N/A";
            const email = c.email || null;
            const txCount = c.transaction_count || c.orderCount || 0;
            const totalSpent = Number(c.total_spent || c.totalSpent || c.amountSpent || 0);
            const isVerified3Plus = txCount >= 3 || c.is_auto_registered;

            return (
              <div
                key={id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
                      <Users size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-900 dark:text-white">{name}</p>
                      <p className="text-xs text-slate-400 font-mono">{phone}</p>
                      {email && <p className="text-[11px] text-slate-400">{email}</p>}
                    </div>
                  </div>
                  {isVerified3Plus && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                      {copy.verifiedLabel}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">{copy.countLabel}: <strong className="text-slate-900 dark:text-white">{txCount}</strong></span>
                  <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
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