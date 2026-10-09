import { useState } from "react";
import { X, Landmark, Loader2, AlertTriangle } from "lucide-react";
import useBankAccounts from "../hooks/useBankAccounts";
import financeService from "../services/finance.service";

export default function CreateReconciliationSessionModal({ isOpen, onClose, workspaceId, onCreated }) {
  const { bankAccounts, loading: loadingBankAccounts } = useBankAccounts(workspaceId);
  const [form, setForm] = useState({
    bankAccountId: "",
    periodStart: "",
    periodEnd: "",
    openingBalance: "",
    closingBalance: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const update = (e) => setForm((current) => ({ ...current, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.bankAccountId) {
      setError("Choose the bank account this statement belongs to.");
      return;
    }
    if (!form.periodStart || !form.periodEnd) {
      setError("Enter the statement period's start and end dates.");
      return;
    }
    if (new Date(form.periodStart) > new Date(form.periodEnd)) {
      setError("The period start must be before the period end.");
      return;
    }
    const opening = financeService.safeNumber(form.openingBalance);
    const closing = financeService.safeNumber(form.closingBalance);

    setSaving(true);
    try {
      const session = await financeService.createReconciliationSession(workspaceId, {
        bankAccountId: form.bankAccountId,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        openingBalance: opening,
        closingBalance: closing,
        notes: form.notes.trim() || undefined,
      });
      setForm({ bankAccountId: "", periodStart: "", periodEnd: "", openingBalance: "", closingBalance: "", notes: "" });
      onCreated?.(session);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Could not start this reconciliation session.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs font-sans">
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
              <Landmark size={20} />
            </span>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                Bank Reconciliation
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Start Session</h3>
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
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Bank account
            <select
              name="bankAccountId"
              value={form.bankAccountId}
              onChange={update}
              required
              disabled={loadingBankAccounts}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">Select bank account</option>
              {bankAccounts.map((acc) => (
                <option key={acc._id} value={acc._id}>
                  {acc.bank_name} — {acc.account_name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Period start
              <input
                type="date"
                name="periodStart"
                value={form.periodStart}
                onChange={update}
                required
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Period end
              <input
                type="date"
                name="periodEnd"
                value={form.periodEnd}
                onChange={update}
                required
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Opening balance
              <input
                type="number"
                name="openingBalance"
                step="0.01"
                value={form.openingBalance}
                onChange={update}
                required
                placeholder="0.00"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Closing balance
              <input
                type="number"
                name="closingBalance"
                step="0.01"
                value={form.closingBalance}
                onChange={update}
                required
                placeholder="0.00"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </label>
          </div>

          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
            Notes (optional)
            <textarea
              name="notes"
              value={form.notes}
              onChange={update}
              rows={2}
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
              {saving ? "Starting..." : "Start session"}
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
