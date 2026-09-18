import { useState } from "react";
import { Link } from "react-router-dom";
import { Banknote, AlertTriangle, Clock, Lock, Building2 } from "lucide-react";
import useCashDepositStatus from "../hooks/useCashDepositStatus";
import DepositCashModal from "./DepositCashModal";

/**
 * CashDepositStatusCard
 * ============================================================
 * "No money stays as cash" - surfaces the CASH account's 48h deposit
 * clock on the finance dashboard:
 *  - nothing outstanding -> a quiet, neutral state
 *  - a clock running -> hours remaining until the deadline
 *  - overdue -> an urgent banner (new cash payments are locked backend-
 *    side the moment this happens - see CashProvider.initiate())
 *
 * `canDeposit` should reflect the viewer's role (treasurer) - the
 * backend enforces this regardless, but hiding the action for anyone
 * else keeps the card honest about who can actually act on it.
 * ============================================================
 */
export default function CashDepositStatusCard({ workspaceId, canDeposit = false }) {
  const { status, loading, refetch } = useCashDepositStatus(workspaceId);
  const [showDepositModal, setShowDepositModal] = useState(false);

  if (loading && !status) {
    return (
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mt-3 h-8 w-40 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
    );
  }

  if (!status) return null;

  const hasOutstandingCash = status.cash_balance > 0 && status.due_at;
  const isOverdue = status.is_overdue;

  const tone = isOverdue
    ? "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30"
    : hasOutstandingCash
      ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20"
      : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900";

  const iconTone = isOverdue
    ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"
    : hasOutstandingCash
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";

  return (
    <>
      <div className={`rounded-2xl border p-5 ${tone}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconTone}`}>
              {isOverdue ? <AlertTriangle size={20} /> : <Banknote size={20} />}
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Cash-in-hand
              </p>
              <p className="mt-0.5 text-2xl font-black text-slate-900 dark:text-white">
                {status.formatted_cash_balance}
              </p>
            </div>
          </div>

          {status.inflow_locked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
              <Lock size={11} />
              Cash on hold
            </span>
          )}
        </div>

        {!hasOutstandingCash && (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            No cash is currently sitting un-banked.
          </p>
        )}

        {hasOutstandingCash && !isOverdue && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <Clock size={13} />
            {status.hours_remaining != null
              ? `Deposit within ${status.hours_remaining}h (by ${new Date(status.due_at).toLocaleString()})`
              : `Must be deposited by ${new Date(status.due_at).toLocaleString()}`}
          </p>
        )}

        {isOverdue && (
          <p className="mt-3 text-xs font-semibold text-red-700 dark:text-red-300">
            Overdue{status.hours_overdue != null ? ` by ${status.hours_overdue}h` : ""} — new cash
            payments are on hold until this is deposited. All members have been notified.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {canDeposit && hasOutstandingCash && (
            <button
              onClick={() => setShowDepositModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              <Banknote size={14} />
              Deposit to Bank
            </button>
          )}
          <Link
            to={`/workspace/${workspaceId}/finance/bank-accounts`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Building2 size={14} />
            Bank Accounts
          </Link>
        </div>
      </div>

      <DepositCashModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        workspaceId={workspaceId}
        maxAmount={status.cash_balance}
        onDeposited={() => {
          setShowDepositModal(false);
          refetch();
          window.dispatchEvent(new Event("finance:updated"));
        }}
      />
    </>
  );
}
