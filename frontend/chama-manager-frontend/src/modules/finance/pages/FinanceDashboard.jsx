import React from "react";
import { useParams } from "react-router-dom";

import useWorkspace from "../../../app/hooks/useWorkspace";
import useFinanceSummary from "../hooks/useFinanceSummary";

import BalanceCard from "../components/BalanceCard";
import CashFlowCard from "../components/CashFlowCard";
import FinanceActions from "../components/FinanceActions";
import Spinner from "../../../shared/components/ui/Spinner";

export default function FinanceDashboard() {
  const routeParams = useParams();
  const workspaceCtx = useWorkspace();
  
  // Resolve workspace ID from workspace hook context or route params
  const workspaceId = workspaceCtx?.workspaceId || routeParams?.workspaceId;

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

        {/* Action controls including Treasurer M-Pesa STK push */}
        <FinanceActions onRefresh={() => refetch && refetch()} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <BalanceCard
          title="Current Balance"
          amount={financeData?.cash_balance ?? financeData?.balance ?? "0"}
        />

        <BalanceCard
          title="Total Contributions"
          amount={financeData?.total_contributions ?? "0"}
        />

        <BalanceCard
          title="Pending Payouts"
          amount={financeData?.pending_payouts ?? "0"}
        />

        <BalanceCard
          title="Outstanding Loans"
          amount={financeData?.outstanding_loans ?? "0"}
        />
      </div>

      <CashFlowCard summary={financeData} />
    </div>
  );
}