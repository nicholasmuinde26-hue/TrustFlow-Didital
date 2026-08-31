import React from "react";
import { ChefHat, Clock, CheckCircle2 } from "lucide-react";
import { useWorkspace } from "../../../app/hooks/useWorkspace";
import { useKitchenOrders } from "../hooks/useBusiness";
import PageHeader from "../../../shared/components/ui/PageHeader";
import Spinner from "../../../shared/components/ui/Spinner";

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export default function KitchenPage() {
  const { workspaceId } = useWorkspace();
  const { tickets, isLoading, markReady, isMarkingReady, refetch } = useKitchenOrders(workspaceId);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Kitchen & Food Prep"
        subtitle="Orders placed but not yet marked ready. This is the same order queue Sales & POS write to — nothing extra to keep in sync."
        onRefresh={refetch}
      />

      {tickets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
          No orders waiting on the kitchen right now. New orders placed through POS or Sales will land here until they're marked ready.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tickets.map((order) => {
            const id = order._id || order.id;
            return (
              <div
                key={id}
                className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm dark:border-amber-900 dark:bg-amber-950/20"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                    <ChefHat size={14} /> In prep
                  </span>
                  <div className="flex items-center gap-2">
                    {order.status === "pending" && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        Payment pending
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[11px] text-gray-500">
                      <Clock size={12} /> {timeAgo(order.createdAt)}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {order.customer_name || order.customerName || "Walk-in"}
                  </p>
                  {order.description && (
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{order.description}</p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    KES {Number(order.amount || 0).toLocaleString()}
                  </span>
                  <button
                    disabled={isMarkingReady}
                    onClick={() => markReady(id)}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} /> Mark Ready
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}