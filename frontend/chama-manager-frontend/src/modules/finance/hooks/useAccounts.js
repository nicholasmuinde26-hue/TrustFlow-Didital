import { useCallback, useEffect, useState } from "react";

import financeService from "../services/finance.service";

export default function useAccounts(workspaceId) {
  const [accounts, setAccounts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;

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
  }, [workspaceId]);

  useEffect(() => {
    load();

    // Account balances (MEMBER_SAVINGS, MPESA_CLEARING, etc.) change the
    // moment a payment posts to the ledger - refetch immediately instead
    // of waiting for the next mount/navigation, same pattern as
    // useFinanceSummary. See MpesaStkModal / usePaymentWatcher, which
    // dispatch this event once a payment intent completes.
    window.addEventListener("finance:updated", load);
    return () => {
      window.removeEventListener("finance:updated", load);
    };
  }, [load]);

  return {
    accounts,
    loading,
    error,
    refetch: load,
  };
}