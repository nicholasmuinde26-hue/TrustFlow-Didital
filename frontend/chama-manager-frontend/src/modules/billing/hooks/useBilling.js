import { useQuery, useQueryClient } from "@tanstack/react-query";
import billingService from "../services/billing.service";

export const billingKey = (chamaId) => ["billing", chamaId, "summary"];

// Plan, state (trial / active / grace / read_only / free) and any open invoice.
// Every member can read this; the banner and the billing page both use it.
export default function useBillingSummary(chamaId, enabled = true) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: billingKey(chamaId),
    queryFn: () => billingService.getSummary(chamaId),
    enabled: Boolean(chamaId) && enabled,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: true,
  });
  return {
    summary: query.data || null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    refresh: () => qc.invalidateQueries({ queryKey: ["billing", chamaId] }),
  };
}