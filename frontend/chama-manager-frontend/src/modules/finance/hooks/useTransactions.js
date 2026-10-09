import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import financeService from "../services/finance.service";

export default function useTransactions(workspaceId, filters = {}) {
  const {
    data,
    isLoading: loading,
    error,
    refetch
  } = useQuery({
    queryKey: ["transactions", workspaceId, filters],
    queryFn: () => financeService.getTransactions(workspaceId, filters),
    enabled: !!workspaceId,
    staleTime: 0, // always refetch
    keepPreviousData: true, // switching My / Chama keeps the page on screen
    refetchOnWindowFocus: true, // refresh when user comes back to tab
  });

  // Same reasoning as useLedger: catch a payment completing in-tab
  // (STK modal poll success) instead of only on window refocus.
  useEffect(() => {
    window.addEventListener("finance:updated", refetch);
    return () => window.removeEventListener("finance:updated", refetch);
  }, [refetch]);

  // Normalize response so page never crashes
  const transactions = {
    items: data?.items ?? data ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    view: data?.view ?? null,
    canToggle: data?.canToggle ?? false,
  };

  return {
    transactions,
    loading,
    error,
    refetch
  };
}