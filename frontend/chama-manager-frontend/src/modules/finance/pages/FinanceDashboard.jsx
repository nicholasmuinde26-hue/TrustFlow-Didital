import React from "react";
import { useParams } from "react-router-dom";
import { Toaster } from "react-hot-toast"; // not needed here if in App

import useWorkspace from "../../../app/hooks/useWorkspace";
import useFinanceSummary from "../hooks/useFinanceSummary";
import usePaymentWatcher from "../hooks/usePaymentWatcher"; // ADD THIS

import BalanceCard from "../components/BalanceCard";
import CashFlowCard from "../components/CashFlowCard";
import FinanceActions from "../components/FinanceActions";
import Spinner from "../../../shared/components/ui/Spinner";

export default function FinanceDashboard() {
  const routeParams = useParams();
  const workspaceCtx = useWorkspace();
  
  const workspaceId = workspaceCtx?.workspaceId || routeParams?.workspaceId;

  usePaymentWatcher(workspaceId); // ADD THIS - runs in background

  const {
    summary,
    data,
    loading,
    isLoading,
    refetch,
  } = useFinanceSummary(workspaceId);

  const isDataLoading = loading ?? isLoading;
  const financeData = summary || data;

  if (isDataLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Finance Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Financial overview of this workspace.
          </p>
        </div>

        <FinanceActions onRefresh={() => refetch && refetch()} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <BalanceCard
          title="Current Balance"
          value={financeData?.cash_balance ?? financeData?.balance ?? 0}
        />

        <BalanceCard
          title="Total Contributions"
          value={financeData?.total_contributions ?? 0}
        />

        <BalanceCard
          title="Pending Payouts"
          value={financeData?.pending_payouts ?? 0}
        />

        <BalanceCard
          title="Outstanding Loans"
          value={financeData?.outstanding_loans ?? 0}
        />
      </div>

      <CashFlowCard summary={financeData} />
    </div>
  );
}