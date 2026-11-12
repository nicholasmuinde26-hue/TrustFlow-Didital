import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { Smartphone, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

import { useBusinessSummary, useInitiateBusinessStkPush } from "../hooks/useBusiness";
import { BusinessHeader } from "../components/BusinessHeader";
import { BusinessStatCards } from "../components/BusinessStatCards";
import { CashAccountsCard } from "../components/CashAccountsCard";
import { RecentSales } from "../components/RecentSales";
import { SalesChart } from "../components/SalesChart";
import { QuickActions } from "../components/QuickActions";
import { RentalOccupancySnapshot } from "../components/RentalOccupancySnapshot";
import { RetailInventorySnapshot } from "../components/RetailInventorySnapshot";
import { RestaurantKitchenSnapshot } from "../components/RestaurantKitchenSnapshot";
import { ServiceJobsSnapshot } from "../components/ServiceJobsSnapshot";
import { ChamaBusinessDashboard } from "../components/ChamaBusinessDashboard";
import { GeneralBusinessSnapshot } from "../components/GeneralBusinessSnapshot";
import { useWorkspace } from "../../../app/hooks/useWorkspace";
import BusinessMpesaModal from "../components/BusinessMpesaModal";

// Copy + widget per business category — keeps the overview honest about
// what this specific business actually does, instead of one generic
// "sales" framing for a landlord, a shopkeeper, a kitchen and a
// freelancer alike.
const CATEGORY_CONFIG = {
  rental: {
    badge: "Rental Portfolio",
    tagline: "Collect rent directly via M-Pesa STK Push and track occupancy across your units.",
    recentListTitle: "Recent Rent Payments",
    Snapshot: RentalOccupancySnapshot,
  },
  retail: {
    badge: "Retail Operations",
    tagline: "Collect payments directly via M-Pesa STK Push and monitor real-time sales performance.",
    recentListTitle: "Recent Sales",
    Snapshot: RetailInventorySnapshot,
  },
  restaurant: {
    badge: "Restaurant Floor",
    tagline: "Collect payments directly via M-Pesa STK Push and keep an eye on the kitchen queue.",
    recentListTitle: "Recent Orders",
    Snapshot: RestaurantKitchenSnapshot,
  },
  service: {
    badge: "Service Operations",
    tagline: "Collect payments directly via M-Pesa STK Push and track jobs through to invoice.",
    recentListTitle: "Recent Jobs",
    Snapshot: ServiceJobsSnapshot,
  },
  other: {
    badge: "Business Operations",
    tagline: "Track sales, customers, stock and day-to-day business activity in one place.",
    recentListTitle: "Recent Transactions",
    Snapshot: GeneralBusinessSnapshot,
  },
};

function getCategoryConfig(category) {
  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
}

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

  if (!data) {
    return <div className="mx-auto max-w-3xl p-6"><div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"><AlertCircle size={18} className="mt-0.5 shrink-0" /><div><p className="font-bold">Business overview could not be loaded</p><p className="mt-1 text-sm">Check your connection and try again.</p><button type="button" onClick={() => refetch()} className="mt-3 rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white hover:bg-rose-800">Try again</button></div></div></div>;
  }

  const profile = data?.profile || data;
  const stats = data?.dashboard || data?.stats || data;
  const accounts = data?.accounts || [];
  const category = ["retail", "rental", "restaurant", "service", "other"].includes(profile?.category) ? profile.category : "other";
  const recentSales = category === "other"
    ? (data?.recentTransactions || data?.recentSales || data?.sales || [])
    : (data?.recentSales || data?.sales || []);
  const chartData = data?.salesChart || data?.chartData || [];

  const config = getCategoryConfig(category);
  const Snapshot = config.Snapshot;
  // Chama-owned businesses get the chama + category-aware dashboard (served by
  // /chama-dashboard) instead of the single client-side snapshot.
  const isChamaOwned = profile?.owner_type === "chama";

  const handleMpesaSubmit = async (payload) => {
    const response = await stkPush.mutateAsync({
      workspaceId,
      amount: payload.amount,
      phoneNumber: payload.phoneNumber,
      customerName: payload.customerName || "Customer",
      description: payload.description || `Payment to ${profile?.name || "Business"}`,
    });

    setToastNotice(`Payment request sent to ${payload.phoneNumber} for ${profile?.currency || "KES"} ${Number(payload.amount).toLocaleString()}.`);
    setTimeout(() => setToastNotice(null), 6000);

    // Refresh dashboard stats and sales to show newly pending transaction
    refetch();

    return response;
  };



  const handlePaymentSuccess = () => {
    refetch();
    setToastNotice("Payment completed. Business totals and payment balances have been refreshed.");
    setTimeout(() => setToastNotice(null), 7000);
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-7 p-4 font-sans sm:p-6 xl:p-8">
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
              {profile?.category_label || config.badge}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black">Business overview</h1>
          <p className="mt-1 max-w-2xl text-sm text-emerald-100">
            {config.tagline}
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
            Collect Payment
          </button>
        </div>
      </div>

      <BusinessHeader
        profile={profile}
      />

      <BusinessStatCards stats={stats} category={category} currency={profile?.currency || "KES"} />

      {isChamaOwned ? (
        <ChamaBusinessDashboard workspaceId={workspaceId} currency={profile?.currency || "KES"} />
      ) : (
        Snapshot && <Snapshot workspaceId={workspaceId} currency={profile?.currency || "KES"} />
      )}

      <QuickActions category={category} />

      {isChamaOwned ? (
        <CashAccountsCard accounts={accounts} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <SalesChart data={chartData} category={category} currency={profile?.currency || "KES"} />
          <CashAccountsCard accounts={accounts} currency={profile?.currency || "KES"} />
        </div>
      )}

      <RecentSales sales={recentSales} title={config.recentListTitle} currency={profile?.currency || "KES"} showType={category === "other"} />

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
