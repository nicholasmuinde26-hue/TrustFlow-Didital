import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { Smartphone, RefreshCw, CheckCircle2 } from "lucide-react";

import { useBusinessSummary, useInitiateBusinessStkPush } from "../hooks/useBusiness";
import { BusinessHeader } from "../components/BusinessHeader";
import { BusinessStatCards } from "../components/BusinessStatCards";
import { CashAccountsCard } from "../components/CashAccountsCard";
import { RecentSales } from "../components/RecentSales";
import { SalesChart } from "../components/SalesChart";
import { QuickActions } from "../components/QuickActions";
import { useWorkspace } from "../../../app/hooks/useWorkspace";
import BusinessMpesaModal from "../components/BusinessMpesaModal";

export default function BusinessDashboard() {
  const { workspaceId: paramId } = useParams();
  const workspaceCtx = useWorkspace();
  const workspaceId =
    paramId ||
    workspaceCtx?.workspaceId ||
    workspaceCtx?.currentWorkspace?._id ||
    workspaceCtx?.currentWorkspace?.id;

  const { data, isLoading, refetch, isRefetching } = useBusinessSummary(workspaceId);
  const stkPush = useInitiateBusinessStkPush();
  const isMpesaLoading = stkPush.isPending;

  const [isMpesaModalOpen, setIsMpesaModalOpen] = useState(false);
  const [toastNotice, setToastNotice] = useState(null);

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  const profile = data?.profile || data;
  const stats = data?.dashboard || data?.stats || data;
  const accounts = data?.accounts || [];
  const recentSales = data?.recentSales || data?.sales || [];
  const chartData = data?.salesChart || data?.chartData || [];

  const handleQuickAction = (action) => {
    const actionKey = String(action).toLowerCase();
    if (["mpesa", "stk", "stk_push", "payment", "collect"].includes(actionKey)) {
      setIsMpesaModalOpen(true);
    } else {
      console.log(`Action triggered: ${action}`);
    }
  };

  const handleMpesaSubmit = async (payload) => {
    const response = await stkPush.mutateAsync({
      workspaceId,
      amount: payload.amount,
      phoneNumber: payload.phoneNumber,
      customerName: payload.customerName || "Customer",
      description: payload.description || `Payment to ${profile?.name || "Business"}`,
    });

    setToastNotice(`STK prompt sent to ${payload.phoneNumber} for KES ${payload.amount.toLocaleString()}. Verified receipt with VeriCircle- guarantee queued!`);
    setTimeout(() => setToastNotice(null), 6000);

    // Refresh dashboard stats and sales to show newly pending transaction
    refetch();

    return response;
  };



  const handlePaymentSuccess = () => {
    refetch();
    setToastNotice(`Payment completed and posted to ledger! Dashboard sales & cash accounts updated.`);
    setTimeout(() => setToastNotice(null), 7000);
  };

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto font-sans">
      {/* Toast Notification Banner */}
      {toastNotice && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-500 p-4 text-white shadow-xl dark:border-emerald-600 dark:bg-emerald-600 animate-bounce">
          <CheckCircle2 size={20} className="shrink-0 text-white" />
          <p className="text-xs font-bold">{toastNotice}</p>
        </div>
      )}

      {/* Hero Banner with Payment Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 p-6 text-white shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-200 uppercase tracking-wider">
              Live Operations
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black">
            {profile?.name || profile?.businessName || "Business Dashboard"}
          </h1>
          <p className="mt-1 text-xs text-emerald-100">
            Collect payments directly via M-Pesa STK Push and monitor real-time sales performance.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2.5 text-xs font-semibold text-white backdrop-blur-md hover:bg-white/20 transition-all border border-white/20"
          >
            <RefreshCw size={14} className={isRefetching ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setIsMpesaModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-xs font-black text-emerald-950 shadow-lg hover:bg-emerald-300 transition-all transform hover:-translate-y-0.5"
          >
            <Smartphone size={18} className="text-emerald-950" />
            Collect M-Pesa Payment
          </button>
        </div>
      </div>

      <BusinessHeader
        profile={profile}
        onRefresh={() => refetch()}
        refreshing={isRefetching}
      />

      <BusinessStatCards stats={stats} />

      <QuickActions
        onAction={handleQuickAction}
        onOpenMpesa={() => setIsMpesaModalOpen(true)}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SalesChart data={chartData} />
        <CashAccountsCard accounts={accounts} />
      </div>

      <RecentSales sales={recentSales} />

      {/* Operational Business M-Pesa STK Modal */}
      <BusinessMpesaModal
        isOpen={isMpesaModalOpen}
        onClose={() => setIsMpesaModalOpen(false)}
        onSubmit={handleMpesaSubmit}
        onSuccess={handlePaymentSuccess}
        workspaceId={workspaceId}
        loading={Boolean(isMpesaLoading)}
        title="Business M-Pesa STK Collection"
      />
    </div>
  );
}