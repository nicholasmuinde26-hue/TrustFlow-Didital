import { useQuery } from "@tanstack/react-query";
import financeService from "../services/finance.service";

export default function useLedger(workspaceId, filters = {}) {
  const { data, isLoading: loading, error, refetch } = useQuery({
    queryKey: ["ledger", workspaceId, filters],
    queryFn: () => financeService.getLedger(workspaceId, filters),
    enabled: !!workspaceId,
    refetchOnWindowFocus: true,
  });

  // Normalize: handles {data: {entries: []}} or {entries: []} or []
  const raw = data?.data ?? data ?? {};
  const entries = Array.isArray(raw.entries) ? raw.entries : Array.isArray(raw) ? raw : [];
  const totals = raw.totals ?? {};

  return {
    entries,
    totals,
    loading,
    error,
    refetch
  };
}