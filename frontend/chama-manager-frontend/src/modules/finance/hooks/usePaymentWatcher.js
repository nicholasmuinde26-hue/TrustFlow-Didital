import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

const formatKES = (value) => 
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(Number(value??0));

export default function usePaymentWatcher(workspaceId) {
  const queryClient = useQueryClient();
  const shown = useRef(new Set());

  useEffect(() => {
    if (!workspaceId) return;

    // Poll every 4 seconds for completed payments
    const interval = setInterval(async () => {
      try {
        // Replace with your actual API call
        const res = await fetch(`/api/finance/payments/pending/${workspaceId}`);
        const json = await res.json();
        const pending = json.data ?? json ?? [];

        pending.forEach(p => {
          if (p.status === "completed" && !shown.current.has(p.id)) {
            shown.current.add(p.id);
            
            toast.success(
              `Payment confirmed! ${formatKES(p.amount)} deposited`,
              {
                icon: '✅',
                description: `Receipt: ${p.receipt_reference || p.id}`
              }
            );

            // Auto refresh all finance data
            queryClient.invalidateQueries({ queryKey: ["transactions", workspaceId] });
            queryClient.invalidateQueries({ queryKey: ["ledger", workspaceId] });
            queryClient.invalidateQueries({ queryKey: ["financeSummary", workspaceId] });
            queryClient.invalidateQueries({ queryKey: ["balance", workspaceId] });
          }

          if (p.status === "failed" && !shown.current.has(p.id)) {
            shown.current.add(p.id);
            toast.error(`Payment failed: ${formatKES(p.amount)}`, {
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