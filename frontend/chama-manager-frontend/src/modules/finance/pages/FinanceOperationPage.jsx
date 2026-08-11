import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import financeService from "../services/finance.service";
import Button from "@/shared/components/ui/Button";

const labels = { deposit: "Record Deposit", withdrawal: "Record Withdrawal", transfer: "Record Transfer" };

export default function FinanceOperationPage({ operation }) {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ sourceAccountId: "", destinationAccountId: "", amount: "", description: "" });
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    financeService.getAccounts(workspaceId)
     .then(setAccounts)
     .catch((error) => setNotice({ type: "error", text: error?.message || "Could not load accounts." }));
  }, [workspaceId]);

  // FIX 1: Correct account filtering rules
  const sourceAccounts = useMemo(() => {
    if (operation === "deposit") return accounts.filter((a) => a.normal_balance === "credit"); // Cash/Bank
    if (operation === "withdrawal") return accounts.filter((a) => a.normal_balance === "debit"); // Expense
    return accounts.filter((a) => a.normal_balance === "debit" || a.normal_balance === "credit"); // Transfer: from any
  }, [accounts, operation]);

  const destinationAccounts = useMemo(() => {
    if (operation === "deposit") return accounts.filter((a) => a.normal_balance === "debit"); // Asset/Expense
    if (operation === "withdrawal") return accounts.filter((a) => a.normal_balance === "credit"); // Cash/Bank
    return accounts.filter((a) => a.normal_balance === "debit" || a.normal_balance === "credit"); // Transfer: to any
  }, [accounts, operation]);

  const update = (event) => setForm((current) => ({...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);

    // FIX 2: Validate amount properly
    const amount = financeService.safeNumber(form.amount);
    if (amount <= 0) {
      setNotice({ type: "error", text: "Amount must be greater than 0" });
      setSaving(false);
      return;
    }
    if (form.sourceAccountId === form.destinationAccountId) {
      setNotice({ type: "error", text: "Source and Destination accounts cannot be the same" });
      setSaving(false);
      return;
    }

    try {
      await financeService.createOperation(workspaceId, {
        operation,
       ...form,
        amount // already safe number
      });
      setNotice({ type: "success", text: `${labels[operation]} completed and posted to the ledger.` });
      setForm({ sourceAccountId: "", destinationAccountId: "", amount: "", description: "" });
    } catch (error) {
      setNotice({ type: "error", text: error?.response?.data?.message || error?.message || "Could not record this operation." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 rounded-2xl border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">{labels[operation]}</h1>
        <p className="mt-1 text-sm text-slate-500">Creates a balanced journal entry and updates account balances immediately.</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <AccountSelect
          label={operation === "deposit"? "Funding account" : "From account"}
          name="sourceAccountId"
          value={form.sourceAccountId}
          onChange={update}
          accounts={sourceAccounts}
        />
        <AccountSelect
          label={operation === "withdrawal"? "Receiving account" : "To account"}
          name="destinationAccountId"
          value={form.destinationAccountId}
          onChange={update}
          accounts={destinationAccounts}
        />
        <Field
          label="Amount (KES)"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          value={form.amount}
          onChange={update}
          required
          placeholder="0.00"
        />
        <Field label="Description (optional)" name="description" value={form.description} onChange={update} />

        {notice && <div className={`rounded-xl border p-3 text-sm ${notice.type === "success"? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{notice.text}</div>}

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>{saving? "Posting..." : labels[operation]}</Button>
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}

function AccountSelect({ label, name, value, onChange, accounts }) {
  return (
    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
      {label}
      <select required name={name} value={value} onChange={onChange} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
        <option value="">Select account</option>
        {accounts.map((account) => (
          <option key={account._id} value={account._id}>
            {account.name} ({account.account_code}) - {financeService.formatCurrency(account.balance)}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({ label,...props }) {
  return (
    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
      {label}
      <input {...props} className="mt-2 w-full rounded-xl border-slate-300 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
    </label>
  );
}