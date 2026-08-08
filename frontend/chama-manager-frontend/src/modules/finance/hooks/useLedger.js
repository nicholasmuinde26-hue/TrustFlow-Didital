import { useEffect, useState } from "react";

import financeService from "../services/finance.service";

export default function useLedger(workspaceId) {
  const [entries, setEntries] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);

  useEffect(() => {
    if (!workspaceId) return;

    async function load() {
      setLoading(true);

      try {
        const data =
          await financeService.getLedger(
            workspaceId
          );

        setEntries(data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [workspaceId]);

  return {
    entries,
    loading,
    error,
  };
}