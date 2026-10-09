import { useCallback, useEffect, useState } from "react";
import financeService from "../services/finance.service";

export default function useReconciliationSession(workspaceId, sessionId) {
  const [session, setSession] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!workspaceId || !sessionId) return;
    setLoading(true);
    try {
      const { session: data, summary: sum } = await financeService.getReconciliationSession(workspaceId, sessionId);
      setSession(data);
      setSummary(sum);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  return { session, summary, loading, error, refetch: load };
}
