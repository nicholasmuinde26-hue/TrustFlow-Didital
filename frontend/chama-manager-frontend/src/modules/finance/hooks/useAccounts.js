import { useEffect, useState } from "react";

import financeService from "../services/finance.service";

export default function useAccounts(workspaceId) {
  const [accounts, setAccounts] =
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
          await financeService.getAccounts(
            workspaceId
          );

        setAccounts(data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [workspaceId]);

  return {
    accounts,
    loading,
    error,
  };
}