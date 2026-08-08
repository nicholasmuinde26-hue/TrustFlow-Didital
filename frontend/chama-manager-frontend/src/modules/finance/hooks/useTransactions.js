import { useEffect, useState } from "react";

import financeService from "../services/finance.service";

export default function useTransactions(workspaceId) {
  const [transactions, setTransactions] =
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
          await financeService.getTransactions(
            workspaceId
          );

        setTransactions(data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [workspaceId]);

  return {
    transactions,
    loading,
    error,
  };
}