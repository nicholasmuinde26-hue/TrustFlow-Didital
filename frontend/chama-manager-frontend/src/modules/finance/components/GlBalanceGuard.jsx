import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertOctagon, RefreshCw, ExternalLink } from "lucide-react";
import financeService from "../services/finance.service";

const POLL_INTERVAL_MS = 60_000; // re-check every minute while the chama is open
const SNOOZE_MS = 1 * 60_000; // "acknowledge" only silences it for 5 minutes

/**
 * GlBalanceGuard
 * ============================================================
 * Mounted once per chama workspace (see WorkspaceLayout). Polls the GL
 * balance check and, the moment the books don't balance, blocks the
 * workspace behind a modal that cannot be closed by clicking outside or
 * pressing Escape.
 *
 * "Infinite" here means: it re-checks on every poll tick AND on every
 * in-app navigation, and any dismissal is only a 5-minute snooze — not a
 * real close. As long as the backend keeps reporting `balanced: false`,
 * the modal keeps coming back. The moment the backend reports balanced,
 * it stops appearing entirely — this is deliberately NOT a dismiss-once
 * UI pattern, because a silent, unresolved accounting error is exactly
 * the kind of thing that shouldn't be easy to permanently ignore.
 *
 * It never blocks on a check that FAILED (network error, permission
 * issue) — only on a confirmed `balanced: false` from the backend. See
 * financeService.getGlBalance's fail-open comment.
 * ============================================================
 */
export default function GlBalanceGuard({ workspaceId, workspaceName }) {
  const [status, setStatus] = useState(null); // last known { balanced, totalDebits, totalCredits, difference, checkedAt }
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const location = useLocation();
  const pollRef = useRef(null);

  const runCheck = useCallback(async () => {
    if (!workspaceId) return;
    const result = await financeService.getGlBalance(workspaceId);
    setStatus(result);
  }, [workspaceId]);

  // Check on mount / whenever we switch chamas
  useEffect(() => {
    runCheck();
  }, [runCheck]);

  // Re-check on every in-app navigation inside this workspace — this is
  // what makes the alert "follow" the treasurer around instead of only
  // showing once on the dashboard.
  useEffect(() => {
    runCheck();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Background poll
  useEffect(() => {
    pollRef.current = setInterval(runCheck, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [runCheck]);

  if (!status || status.balanced || status.checkFailed) return null;

  const isSnoozed = Date.now() < snoozedUntil;
  if (isSnoozed) return null;

  const money = (n) =>
    `KES ${Number(n || 0).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="gl-balance-guard-title"
      className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      // Deliberately no onClick handler here — clicking the backdrop must
      // NOT dismiss this. See file header.
    >
      <div className="w-full max-w-md rounded-3xl border border-red-200 bg-white p-6 shadow-2xl dark:border-red-900/50 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300">
            <AlertOctagon size={22} />
          </span>
          <div className="min-w-0">
            <h2
              id="gl-balance-guard-title"
              className="text-lg font-black text-slate-950 dark:text-white"
            >
              General ledger is out of balance
            </h2>
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {workspaceName || "This chama"}'s books don't balance and need attention.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-1.5 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-800/60">
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Total debits</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {money(status.totalDebits)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Total credits</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {money(status.totalCredits)}
            </span>
          </div>
          <div className="mt-1 flex justify-between border-t border-slate-200 pt-1.5 dark:border-slate-700">
            <span className="text-red-600 dark:text-red-400">Difference</span>
            <span className="font-black text-red-600 dark:text-red-400">
              {money(Math.abs(status.difference))}
            </span>
          </div>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          This should never happen in a correctly posted double-entry system. Don't
          rely on any balance or report figures until this is investigated. This
          alert will keep reappearing — on every page you open, and again in 5
          minutes if you dismiss it — until the ledger balances again.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            to={`/workspace/${workspaceId}/finance/ledger`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-red-600 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-red-700"
          >
            Investigate in Ledger
            <ExternalLink size={14} />
          </Link>
          <button
            onClick={() => setSnoozedUntil(Date.now() + SNOOZE_MS)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw size={14} />
            Acknowledge — remind me in 1 min
          </button>
        </div>
      </div>
    </div>
  );
}