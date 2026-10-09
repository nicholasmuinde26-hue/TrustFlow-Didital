import { useCallback, useEffect, useState } from "react";
import financeService from "../services/finance.service";

export default function useAdjustments(workspaceId, { status } = {}) {
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const data = await financeService.getAdjustments(workspaceId, status ? { status } : {});
      setAdjustments(data);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, status]);

  useEffect(() => {
    load();
    window.addEventListener("finance:updated", load);
    return () => window.removeEventListener("finance:updated", load);
  }, [load]);

  return { adjustments, loading, error, refetch: load };
}
