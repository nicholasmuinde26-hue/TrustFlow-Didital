import { useEffect, useState } from "react";
import { X, Building2, Loader2, AlertTriangle } from "lucide-react";
import financeService from "../services/finance.service";

const EMPTY_FORM = {
  bankName: "",
  accountName: "",
  accountNumber: "",
  branch: "",
  swiftCode: "",
  paybillOrTill: "",
  isPrimary: false,
  notes: "",
};

export default function BankAccountModal({ isOpen, onClose, workspaceId, bankAccount = null, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isEditing = Boolean(bankAccount);

  useEffect(() => {
    if (bankAccount) {
      setForm({
        bankName: bankAccount.bank_name || "",
        accountName: bankAccount.account_name || "",
        accountNumber: bankAccount.account_number || "",
        branch: bankAccount.branch || "",
        swiftCode: bankAccount.swift_code || "",
        paybillOrTill: bankAccount.paybill_or_till || "",
        isPrimary: Boolean(bankAccount.is_primary),
        notes: bankAccount.notes || "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError(null);
  }, [bankAccount, isOpen]);

  if (!isOpen) return null;

  const update = (e) => {
    const { name, type, checked, value } = e.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.bankName.trim() || !form.accountName.trim() || !form.accountNumber.trim()) {
      setError("Bank name, account name, and account number are required.");
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await financeService.updateBankAccount(workspaceId, bankAccount._id, form);
      } else {
        await financeService.createBankAccount(workspaceId, form);
      }
      onSaved?.();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Could not save this bank account.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs font-sans">
      <div className="relative my-8 w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
              <Building2 size={20} />
            </span>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                Bank Account
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {isEditing ? "Edit Bank Account" : "Add Bank Account"}
              </h3>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bank name" name="bankName" value={form.bankName} onChange={update} required />
            <Field label="Account name" name="accountName" value={form.accountName} onChange={update} required />
            <Field label="Account number" name="accountNumber" value={form.accountNumber} onChange={update} required />
            <Field label="Branch (optional)" name="branch" value={form.branch} onChange={update} />
            <Field label="SWIFT code (optional)" name="swiftCode" value={form.swiftCode} onChange={update} />
            <Field label="Paybill / Till (optional)" name="paybillOrTill" value={form.paybillOrTill} onChange={update} />
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

          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <input type="checkbox" name="isPrimary" checked={form.isPrimary} onChange={update} className="h-4 w-4 rounded" />
            Set as primary deposit account
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
              {saving ? "Saving..." : isEditing ? "Save Changes" : "Add Bank Account"}
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

function Field({ label, ...props }) {
  return (
    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
      {label}
      <input
        {...props}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
      />
    </label>
  );
}
