import React from "react";
import { RefreshCw } from "lucide-react";
import { useWorkspace } from "../../../app/hooks/useWorkspace";
import { useBusinessAccounts } from "../hooks/useBusiness";
import { CashAccountsCard } from "../components/CashAccountsCard";

export default function AccountsPage() {
  const { workspaceId } = useWorkspace();
  const { accounts, isLoading, isRefetching, refetch } = useBusinessAccounts(workspaceId);

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Cash & Bank Accounts</h1>
          <p className="text-xs text-slate-500">Overview of liquid assets, M-Pesa tills, and bank balances.</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/50"
        >
          <RefreshCw size={14} className={isRefetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <CashAccountsCard accounts={accounts || []} />
    </div>
  );
}