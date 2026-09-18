import { useState } from "react";
import { AlertTriangle, Loader2, ShieldCheck, X } from "lucide-react";

import PinInput from "./PinInput";
import { STEP_UP_LABELS } from "../api/leadership.api";

// ========================================
// STEP-UP PIN MODAL
// ========================================
//
// Rendered by LeadershipSessionProvider whenever the API answers
// LEADERSHIP_STEP_UP_REQUIRED. It is deliberately NOT a generic "confirm
// your PIN" box: it names the specific action in plain language, because
// a prompt that always says the same thing trains people to type their
// PIN without reading — which is how a second factor becomes theatre.
//
// Cancelling is a first-class outcome, not an error. The provider
// rejects the pending promise and the calling page simply stops.
//
// ========================================

export default function StepUpPinModal({
  action,
  chamaId,
  serverMessage,
  onConfirmed,
  onCancel,
  onSubmitPin,
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const label = STEP_UP_LABELS[action] || {
    title: "Confirm this action",
    detail: serverMessage || "This action needs your Leadership Desk PIN.",
  };

  const submit = async (candidate) => {
    const value = candidate ?? pin;
    if (value.length < 4 || busy) return;

    setBusy(true);
    setError(null);

    try {
      const token = await onSubmitPin(value, chamaId);
      onConfirmed(token);
    } catch (err) {
      setPin("");
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not confirm that PIN. Try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
              <AlertTriangle size={20} />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Confirm with your PIN
              </p>
              <h2 className="text-lg font-black leading-tight text-slate-900 dark:text-white">
                {label.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Cancel"
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs leading-5 text-slate-600 dark:text-slate-400">
          {label.detail}
        </p>

        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Leadership Desk PIN
          </label>
          <PinInput
            length={4}
            value={pin}
            onChange={setPin}
            onComplete={submit}
            disabled={busy}
          />
          <p className="text-[11px] text-slate-400">
            Enter the first 4 digits if your PIN is longer, then press Confirm.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="w-1/2 rounded-2xl border border-slate-200 py-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => submit()}
            disabled={busy || pin.length < 4}
            className="inline-flex w-1/2 items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-xs font-black text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Confirming
              </>
            ) : (
              <>
                <ShieldCheck size={14} /> Confirm
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
