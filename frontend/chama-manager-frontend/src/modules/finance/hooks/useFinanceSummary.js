import { useCallback, useEffect, useState } from "react";
import financeService from "../services/finance.service";

export default function useFinanceSummary(workspaceId) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!workspaceId) return;

    try {
      const data = await financeService.getSummary(workspaceId);
      setSummary(data);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    setLoading(true);
    refetch();

    const timer = setInterval(refetch, 15000);
    window.addEventListener("finance:updated", refetch);
    return () => {
      clearInterval(timer);
      window.removeEventListener("finance:updated", refetch);
    };
  }, [refetch]);

  return {
    summary,
    loading,
    refetch,
  };
}
