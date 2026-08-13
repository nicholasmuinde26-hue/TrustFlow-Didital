import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import financeService from "../services/finance.service";

const formatKES = (value) => 
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(Number(value??0));

export default function usePaymentWatcher(workspaceId) {
  const queryClient = useQueryClient();
  const shown = useRef(new Set());

  useEffect(() => {
    if (!workspaceId) return;

    // Poll every 4 seconds for payments that reached a final status
    // (completed/failed/reversed/cancelled) in the last couple of minutes.
    // This catches payments made by OTHER workspace members too, not just
    // ones initiated from this browser tab.
    const interval = setInterval(async () => {
      try {
        const payments = await financeService.getRecentPayments(workspaceId);

        payments.forEach(p => {
          if (p.status === "completed" && !shown.current.has(p.id)) {
            shown.current.add(p.id);
            
            toast.success(
              `Payment confirmed! ${formatKES(p.amount)} deposited`,
              {
                icon: '✅',
                description: `Receipt: ${p.receipt_reference || p.id}`
              }
            );

            // Auto refresh all finance data.
            queryClient.invalidateQueries({ queryKey: ["transactions", workspaceId] });
            queryClient.invalidateQueries({ queryKey: ["ledger", workspaceId] });

            // useFinanceSummary (balance cards on the dashboard) isn't on
            // React Query — it listens for this event instead, same as
            // MpesaStkModal/useRecordContribution/SavingsPage do elsewhere.
            window.dispatchEvent(new Event("finance:updated"));
          }

          if (["failed", "reversed", "cancelled"].includes(p.status) && !shown.current.has(p.id)) {
            shown.current.add(p.id);
            toast.error(`Payment ${p.status}: ${formatKES(p.amount)}`, {
              description: p.failure_reason || "Please try again"
            });
          }
        });
      } catch (e) {
        console.error("Payment poll error", e);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [workspaceId, queryClient]);
}