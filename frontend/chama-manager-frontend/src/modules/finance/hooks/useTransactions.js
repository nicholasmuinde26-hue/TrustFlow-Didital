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
    refetchOnWindowFocus: true, // refresh when user comes back to tab
  });

  // Normalize response so page never crashes
  const transactions = {
    items: data?.items ?? data ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
  };

  return {
    transactions,
    loading,
    error,
    refetch
  };
}