import React from "react";
import { Truck, Plus, RefreshCw } from "lucide-react";
import { useWorkspace } from "../../../app/hooks/useWorkspace";
import { useBusinessSuppliers } from "../hooks/useBusiness";

export default function SuppliersPage() {
  const { workspaceId } = useWorkspace();
  const { suppliers, isLoading, isRefetching, refetch } = useBusinessSuppliers(workspaceId);
  const supplierList = Array.isArray(suppliers) ? suppliers : [];

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Suppliers</h1>
          <p className="text-xs text-slate-500">Manage vendor details and contact information.</p>
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
          <button className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white transition-colors">
            <Plus size={16} /> Add Supplier
          </button>
        </div>
      </div>

      {supplierList.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <Truck className="mx-auto h-10 w-10 text-slate-400 mb-2 opacity-50" />
          <p className="text-sm font-medium">No suppliers recorded yet.</p>
          <p className="text-xs text-slate-400 mt-1">Vendors receiving payouts 3+ times will automatically appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {supplierList.map((s) => {

            const id = s._id || s.id;
            const name = s.name || "Unnamed Supplier";
            const contact = s.contact_person || s.contact || "N/A";
            const phone = s.phone || s.phoneNumber || "N/A";
            const payoutCount = s.payout_count || 0;
            const totalPaidOut = Number(s.total_paid_out || s.totalPaidOut || 0);
            const isVerified3Plus = payoutCount >= 3 || s.is_auto_registered;

            return (
              <div
                key={id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <Truck size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-900 dark:text-white">{name}</p>
                      <p className="text-xs text-slate-400 font-mono">
                        {contact !== "N/A" ? `${contact} • ` : ""}{phone}
                      </p>
                    </div>
                  </div>
                  {isVerified3Plus && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-300">
                      Verified (3+ Payouts)
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Total Payouts: <strong className="text-slate-900 dark:text-white">{payoutCount}</strong></span>
                  <span className="font-bold font-mono text-slate-900 dark:text-white">
                    KES {totalPaidOut.toLocaleString()}
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