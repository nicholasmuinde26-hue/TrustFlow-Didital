import { useState } from "react";
import { X, Scale, Loader2, AlertTriangle } from "lucide-react";
import useAccounts from "../hooks/useAccounts";
import financeService from "../services/finance.service";

export default function RequestAdjustmentModal({ isOpen, onClose, workspaceId, onRequested }) {
  const { accounts, loading: loadingAccounts } = useAccounts(workspaceId);
  const [form, setForm] = useState({
    debitAccountId: "",
    creditAccountId: "",
    amount: "",
    reason: "",
    reference: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const update = (e) => setForm((current) => ({ ...current, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.debitAccountId || !form.creditAccountId) {
      setError("Choose both a debit account and a credit account.");
      return;
    }
    if (form.debitAccountId === form.creditAccountId) {
      setError("The debit and credit accounts must be different.");
      return;
    }
    const amount = financeService.safeNumber(form.amount);
    if (amount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!form.reason.trim()) {
      setError("A reason is required for every ledger adjustment.");
      return;
    }

    setSaving(true);
    try {
      await financeService.requestAdjustment(workspaceId, {
        debitAccountId: form.debitAccountId,
        creditAccountId: form.creditAccountId,
        amount,
        reason: form.reason.trim(),
        reference: form.reference.trim() || undefined,
      });
      setForm({ debitAccountId: "", creditAccountId: "", amount: "", reason: "", reference: "" });
      onRequested?.();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Could not submit this adjustment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs font-sans">
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
              <Scale size={20} />
            </span>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Ledger Adjustment
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Request Adjustment</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            A DR/CR correction against two of this workspace's accounts. An independent
            chairperson or treasurer must approve it before it posts.
          </p>

          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Debit account
            <select
              name="debitAccountId"
              value={form.debitAccountId}
              onChange={update}
              required
              disabled={loadingAccounts}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">Select account</option>
              {accounts.map((acc) => (
                <option key={acc._id} value={acc._id}>
                  {acc.name} {acc.account_code ? `(${acc.account_code})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Credit account
            <select
              name="creditAccountId"
              value={form.creditAccountId}
              onChange={update}
              required
              disabled={loadingAccounts}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">Select account</option>
              {accounts.map((acc) => (
                <option key={acc._id} value={acc._id}>
                  {acc.name} {acc.account_code ? `(${acc.account_code})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Amount (KES)
            <input
              type="number"
              name="amount"
              step="0.01"
              min="0.01"
              value={form.amount}
              onChange={update}
              required
              placeholder="0.00"
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Reason
            <textarea
              name="reason"
              value={form.reason}
              onChange={update}
              rows={2}
              required
              placeholder="Why this correction is needed"
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Reference (optional)
            <input
              type="text"
              name="reference"
              value={form.reference}
              onChange={update}
              placeholder="e.g. related statement line"
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? "Submitting..." : "Submit for approval"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
