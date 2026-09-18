import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import financeService from "../services/finance.service";

export default function useLedger(workspaceId, filters = {}) {
  const { data, isLoading: loading, error, refetch } = useQuery({
    queryKey: ["ledger", workspaceId, filters],
    queryFn: () => financeService.getLedger(workspaceId, filters),
    enabled: !!workspaceId,
    refetchOnWindowFocus: true,
  });

  // refetchOnWindowFocus alone doesn't catch a payment completing while
  // the tab already has focus (e.g. the STK modal polling in the same
  // tab). Listen for the same "finance:updated" signal useFinanceSummary
  // uses so the general ledger reflects a new posting immediately.
  useEffect(() => {
    window.addEventListener("finance:updated", refetch);
    return () => window.removeEventListener("finance:updated", refetch);
  }, [refetch]);

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