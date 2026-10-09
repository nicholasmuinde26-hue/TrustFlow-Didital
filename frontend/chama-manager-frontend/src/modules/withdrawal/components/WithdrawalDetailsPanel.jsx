import { useState } from "react";
import { X, CheckCircle2, XCircle, Banknote, Ban, ShieldAlert } from "lucide-react";
import WithdrawalStatusBadge from "./WithdrawalStatusBadge";

const money = (n) => `KES ${Number(n || 0).toLocaleString()}`;
const DISBURSEMENT_METHODS = ["cash", "bank", "mpesa", "wallet"];

export default function WithdrawalDetailsPanel({
  withdrawal,
  onClose,
  canDecide,
  canSettle,
  canCancel,
  onDecide,
  onSettle,
  onCancel,
  busy,
}) {
  const [comment, setComment] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [disbursementMethod, setDisbursementMethod] = useState("mpesa");
  const [externalReference, setExternalReference] = useState("");
  const [showCancelBox, setShowCancelBox] = useState(false);

  if (!withdrawal) return null;

  const isPending = withdrawal.status === "pending";
  const isApproved = withdrawal.status === "approved";
  const isCancellable = ["pending", "approved"].includes(withdrawal.status) && canCancel;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-obsidian-border dark:bg-obsidian-card space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-obsidian-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-slate-900 dark:text-mist">Withdrawal Request</h3>
            <WithdrawalStatusBadge status={withdrawal.status} />
          </div>
          {withdrawal.member_id?.user_id?.name && (
            <p className="text-xs text-slate-500 dark:text-mist-muted">Member: {withdrawal.member_id.user_id.name}</p>
          )}
          {withdrawal.reason && <p className="text-xs text-slate-500 dark:text-mist-muted">Reason: {withdrawal.reason}</p>}
        </div>
        <button
          onClick={onClose}
          className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-500 hover:text-slate-900 dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist-muted transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-obsidian-border dark:bg-obsidian-raised/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Amount</p>
          <b className="mt-1 block text-lg font-black text-slate-900 dark:text-mist">{money(withdrawal.amount)}</b>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-obsidian-border dark:bg-obsidian-raised/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Requested</p>
          <b className="mt-1 block text-lg font-black text-slate-900 dark:text-mist">
            {withdrawal.createdAt ? new Date(withdrawal.createdAt).toLocaleDateString() : "—"}
          </b>
        </div>
      </div>

      {withdrawal.policy_decision?.reasons?.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <ShieldAlert className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs leading-relaxed">
            <p className="font-bold uppercase tracking-wider text-[10px]">Policy flags</p>
            <p>{withdrawal.policy_decision.reasons.join("; ")}</p>
          </div>
        </div>
      )}

      {withdrawal.status === "paid" && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>
            Paid via {withdrawal.disbursement_method || "—"}
            {withdrawal.external_reference ? ` · Ref: ${withdrawal.external_reference}` : ""}
          </span>
        </div>
      )}

      {withdrawal.status === "rejected" && withdrawal.rejection_reason && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-800 border border-red-200 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <XCircle className="h-4 w-4" />
          <span>Rejected: {withdrawal.rejection_reason}</span>
        </div>
      )}

      {withdrawal.status === "cancelled" && (
        <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-3 text-xs text-slate-700 border border-slate-200 dark:border-obsidian-border dark:bg-obsidian-raised/60 dark:text-mist-muted">
          <Ban className="h-4 w-4" />
          <span>Cancelled{withdrawal.cancellation_reason ? `: ${withdrawal.cancellation_reason}` : ""}</span>
        </div>
      )}

      {/* Officer decision — approve/reject a pending request */}
      {isPending && canDecide && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-obsidian-border dark:bg-obsidian-raised/50">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Sign off</p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional comment"
            rows={2}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium text-slate-900 focus:border-emerald-600 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist"
          />
          <div className="flex gap-3">
            <button
              disabled={busy}
              onClick={() => onDecide("rejected", comment)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 transition disabled:opacity-50 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            >
              <XCircle className="h-3.5 w-3.5" /> Reject
            </button>
            <button
              disabled={busy}
              onClick={() => onDecide("approved", comment)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
            </button>
          </div>
        </div>
      )}

      {/* Treasurer settlement — mark an approved withdrawal as paid */}
      {isApproved && canSettle && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-obsidian-border dark:bg-obsidian-raised/50">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Settle disbursement</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={disbursementMethod}
              onChange={(e) => setDisbursementMethod(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-900 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist"
            >
              {DISBURSEMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m.toUpperCase()}</option>
              ))}
            </select>
            <input
              type="text"
              value={externalReference}
              onChange={(e) => setExternalReference(e.target.value)}
              placeholder="Reference (optional)"
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium text-slate-900 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist"
            />
          </div>
          <button
            disabled={busy}
            onClick={() => onSettle(disbursementMethod, externalReference || undefined)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 transition disabled:opacity-50"
          >
            <Banknote className="h-3.5 w-3.5" /> Mark as Paid
          </button>
        </div>
      )}

      {/* Cancel — requester (while pending) or an officer at any open stage */}
      {isCancellable && (
        <div className="space-y-2">
          {showCancelBox ? (
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-obsidian-border dark:bg-obsidian-raised/50">
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancelling (optional)"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium text-slate-900 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCancelBox(false)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-600 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist-muted"
                >
                  Back
                </button>
                <button
                  disabled={busy}
                  onClick={() => onCancel(cancelReason)}
                  className="flex-1 rounded-xl bg-slate-800 py-2 text-xs font-bold text-white hover:bg-slate-700 transition disabled:opacity-50 dark:bg-obsidian-raised dark:hover:bg-obsidian-border"
                >
                  Confirm Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCancelBox(true)}
              className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-red-600 dark:text-mist-muted dark:hover:text-red-400 transition"
            >
              <Ban className="h-3.5 w-3.5" /> Cancel this request
            </button>
          )}
        </div>
      )}
    </section>
  );
}
