import { useCallback, useEffect, useState } from "react";
import financeService from "../services/finance.service";

export default function useBankAccounts(workspaceId, { includeInactive = false } = {}) {
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const data = await financeService.getBankAccounts(workspaceId, {
        includeInactive: includeInactive ? "true" : undefined,
      });
      setBankAccounts(data);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, includeInactive]);

  useEffect(() => {
    load();
    window.addEventListener("finance:updated", load);
    return () => window.removeEventListener("finance:updated", load);
  }, [load]);

  return { bankAccounts, loading, error, refetch: load };
}
