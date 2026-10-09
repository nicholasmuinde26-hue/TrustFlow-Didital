import { useCallback, useEffect, useState } from "react";
import financeService from "../services/finance.service";

export default function useReconciliationSessions(workspaceId, { status, bankAccountId } = {}) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const params = {};
      if (status) params.status = status;
      if (bankAccountId) params.bankAccountId = bankAccountId;
      const data = await financeService.getReconciliationSessions(workspaceId, params);
      setSessions(data);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, status, bankAccountId]);

  useEffect(() => {
    load();
    window.addEventListener("finance:updated", load);
    return () => window.removeEventListener("finance:updated", load);
  }, [load]);

  return { sessions, loading, error, refetch: load };
}
