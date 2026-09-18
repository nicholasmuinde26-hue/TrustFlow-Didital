import { useCallback, useEffect, useRef, useState } from "react";
import financeService from "../services/finance.service";

const POLL_INTERVAL_MS = 60_000; // matches GlBalanceGuard's cadence

/**
 * useCashDepositStatus
 * ============================================================
 * Tracks the "no cash stays as cash" 48h clock for a workspace's CASH
 * account. Refetches:
 *  - once on mount
 *  - whenever a payment/operation posts elsewhere (the app-wide
 *    "finance:updated" event other finance hooks already dispatch)
 *  - on a background poll, so a treasurer watching the dashboard sees
 *    the countdown/overdue state change without reloading
 * ============================================================
 */
export default function useCashDepositStatus(workspaceId) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const data = await financeService.getCashDepositStatus(workspaceId);
      setStatus(data);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
    window.addEventListener("finance:updated", load);
    return () => window.removeEventListener("finance:updated", load);
  }, [load]);

  useEffect(() => {
    pollRef.current = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [load]);

  return { status, loading, refetch: load };
}
