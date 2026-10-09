import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Landmark,
  Plus,
  Wand2,
  Check,
  Undo2,
  EyeOff,
  Scale,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import useWorkspace from "../../../app/hooks/useWorkspace";
import useReconciliationSession from "../hooks/useReconciliationSession";
import useWorkspacePermissions from "../hooks/useworkspacepermissions";
import useBankAccounts from "../hooks/useBankAccounts";
import useAccounts from "../hooks/useAccounts";
import useLedger from "../hooks/useLedger";
import { Card, SectionHeading, StatusPill, EmptyState, formatDate, money } from "../components/FinanceUi";
import Spinner from "../../../shared/components/ui/Spinner";
import financeService from "../services/finance.service";

const LINE_STATUS_PILL = { unmatched: "pending", matched: "completed", ignored: "cancelled" };

function AddLineRow({ workspaceId, sessionId, onAdded }) {
  const [form, setForm] = useState({ date: "", description: "", amount: "", direction: "inflow", external_ref: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const update = (e) => setForm((current) => ({ ...current, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const amount = financeService.safeNumber(form.amount);
    if (!form.date || amount <= 0) {
      setError("Enter a date and an amount greater than zero.");
      return;
    }
    setSaving(true);
    try {
      await financeService.addReconciliationLines(workspaceId, sessionId, [
        {
          date: form.date,
          description: form.description.trim(),
          amount,
          direction: form.direction,
          external_ref: form.external_ref.trim(),
        },
      ]);
      setForm({ date: "", description: "", amount: "", direction: "inflow", external_ref: "" });
      onAdded?.();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Could not add this line.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <input
          type="date"
          name="date"
          value={form.date}
          onChange={update}
          required
          className="rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        <input
          type="text"
          name="description"
          value={form.description}
          onChange={update}
          placeholder="Description"
          className="col-span-2 rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        <input
          type="number"
          name="amount"
          step="0.01"
          min="0.01"
          value={form.amount}
          onChange={update}
          required
          placeholder="Amount"
          className="rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        <select
          name="direction"
          value={form.direction}
          onChange={update}
          className="rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="inflow">Inflow</option>
          <option value="outflow">Outflow</option>
        </select>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <input
          type="text"
          name="external_ref"
          value={form.external_ref}
          onChange={update}
          placeholder="Statement reference (optional)"
          className="flex-1 rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Add line
        </button>
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}
    </form>
  );
}

function LineRow({ line, workspaceId, sessionId, candidateEntries, contraAccounts, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [contraAccountId, setContraAccountId] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "That action failed.");
    } finally {
      setBusy(false);
    }
  };

  const matchNow = () =>
    run(async () => {
      if (!selectedEntryId) throw new Error("Pick a ledger entry to match this line to.");
      await financeService.matchReconciliationLine(workspaceId, sessionId, line._id, selectedEntryId);
      setPickerOpen(false);
    });

  const unmatchNow = () => run(() => financeService.unmatchReconciliationLine(workspaceId, sessionId, line._id));

  const ignoreNow = () =>
    run(() => financeService.ignoreReconciliationLine(workspaceId, sessionId, line._id, "Ignored by treasurer"));

  const raiseAdjustmentNow = () =>
    run(async () => {
      if (!contraAccountId) throw new Error("Pick the contra account for this adjustment.");
      await financeService.raiseAdjustmentForLine(workspaceId, sessionId, line._id, {
        contraAccountId,
        reason: adjustmentReason.trim() || undefined,
      });
      setAdjustmentOpen(false);
    });

  return (
    <tr className="border-b border-slate-50 align-top dark:border-obsidian-border/60">
      <td className="py-3 pr-3 text-slate-500 dark:text-slate-400">{formatDate(line.date)}</td>
      <td className="py-3 pr-3 max-w-xs truncate text-slate-700 dark:text-slate-200">
        {line.description || "—"}
        {line.external_ref && (
          <span className="block text-[11px] font-semibold text-slate-400">Ref: {line.external_ref}</span>
        )}
      </td>
      <td className="py-3 pr-3 font-bold text-slate-900 dark:text-white">
        {line.direction === "inflow" ? "+" : "-"}
        {money(line.amount)}
      </td>
      <td className="py-3 pr-3">
        <StatusPill status={LINE_STATUS_PILL[line.status] || "pending"}>
          {line.status === "matched"
            ? line.match_type === "adjustment"
              ? "Resolved by adjustment"
              : "Matched"
            : line.status === "ignored"
              ? "Ignored"
              : "Unmatched"}
        </StatusPill>
      </td>
      <td className="py-3 pr-3">
        {line.status === "unmatched" && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setPickerOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <Check size={13} />
              Match
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={ignoreNow}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <EyeOff size={13} />
              Ignore
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setAdjustmentOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 px-2.5 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
            >
              <Scale size={13} />
              Raise adjustment
            </button>
          </div>
        )}
        {line.status === "matched" && line.match_type !== "adjustment" && (
          <button
            type="button"
            disabled={busy}
            onClick={unmatchNow}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
            Unmatch
          </button>
        )}

        {pickerOpen && (
          <div className="mt-2 flex items-center gap-2">
            <select
              value={selectedEntryId}
              onChange={(e) => setSelectedEntryId(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">Select ledger entry</option>
              {candidateEntries
                .filter((e) => e.entry_type === (line.direction === "inflow" ? "debit" : "credit"))
                .map((e) => (
                  <option key={e._id} value={e._id}>
                    {formatDate(e.posted_at)} · {money(e.amount)} · {e.category_label || e.entry_type}
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={busy}
              onClick={matchNow}
              className="rounded-xl bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-60 dark:bg-white dark:text-slate-900"
            >
              Confirm
            </button>
          </div>
        )}

        {adjustmentOpen && (
          <div className="mt-2 space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
            <select
              value={contraAccountId}
              onChange={(e) => setContraAccountId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">Select contra account</option>
              {contraAccounts.map((acc) => (
                <option key={acc._id} value={acc._id}>
                  {acc.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
              placeholder="Reason (optional)"
              className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <button
              type="button"
              disabled={busy}
              onClick={raiseAdjustmentNow}
              className="rounded-xl bg-indigo-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-60"
            >
              Submit for approval
            </button>
          </div>
        )}

        {error && <p className="mt-1 text-[11px] font-semibold text-rose-600">{error}</p>}
      </td>
    </tr>
  );
}

export default function ReconciliationSessionPage() {
  const { sessionId } = useParams();
  const workspace = useWorkspace();
  const { workspaceId } = workspace;
  const { session, summary, loading, refetch } = useReconciliationSession(workspaceId, sessionId);
  const { role } = useWorkspacePermissions(workspaceId);
  const { bankAccounts } = useBankAccounts(workspaceId);
  const { accounts } = useAccounts(workspaceId);
  const { entries } = useLedger(workspaceId);

  const [autoMatching, setAutoMatching] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const isTreasurer = role === "treasurer";

  const bankAccount = useMemo(
    () => bankAccounts.find((b) => String(b._id) === String(session?.bank_account_id?._id || session?.bank_account_id)),
    [bankAccounts, session]
  );

  // Only posted entries on this session's own financial account, not
  // already consumed by another matched line, are real candidates.
  const candidateEntries = useMemo(() => {
    if (!session) return [];
    const usedIds = new Set(
      (session.lines || []).filter((l) => l.matched_ledger_entry_id).map((l) => String(l.matched_ledger_entry_id))
    );
    return entries.filter((e) => {
      const acctId = e.account_id?._id || e.account_id;
      return (
        String(acctId) === String(session.financial_account_id) &&
        e.status === "posted" &&
        !usedIds.has(String(e._id))
      );
    });
  }, [entries, session]);

  const contraAccounts = useMemo(
    () => accounts.filter((a) => String(a._id) !== String(session?.financial_account_id)),
    [accounts, session]
  );

  if (loading || !session) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const autoMatch = async () => {
    setAutoMatching(true);
    setActionError(null);
    try {
      await financeService.autoMatchReconciliation(workspaceId, sessionId);
      await refetch();
    } catch (err) {
      setActionError(err?.response?.data?.message || err?.message || "Auto-match failed.");
    } finally {
      setAutoMatching(false);
    }
  };

  const complete = async (force = false) => {
    setCompleting(true);
    setActionError(null);
    try {
      await financeService.completeReconciliationSession(workspaceId, sessionId, force);
      await refetch();
    } catch (err) {
      setActionError(err?.response?.data?.message || err?.message || "Could not complete this session.");
    } finally {
      setCompleting(false);
    }
  };

  const lines = session.lines || [];
  const isInProgress = session.status === "in_progress";

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Landmark size={20} className="text-slate-400" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-mist">
              {bankAccount ? `${bankAccount.bank_name} — ${bankAccount.account_name}` : "Reconciliation session"}
            </h1>
          </div>
          <p className="text-slate-500 dark:text-mist-muted">
            {formatDate(session.period_start)} – {formatDate(session.period_end)}
          </p>
        </div>
        <StatusPill status={session.status === "completed" ? "completed" : "pending"}>
          {session.status === "completed" ? "Completed" : "In progress"}
        </StatusPill>
      </div>

      {actionError && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Opening</p>
          <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{money(session.opening_balance)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Closing (statement)</p>
          <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{money(session.closing_balance)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Expected closing</p>
          <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">
            {money(summary?.expected_closing_balance || 0)}
          </p>
        </Card>
        <Card className={`p-4 ${summary?.variance ? "border-rose-200 dark:border-rose-900/50" : ""}`}>
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Variance</p>
          <p
            className={`mt-1 text-lg font-black ${
              summary?.variance ? "text-rose-600" : "text-emerald-600 dark:text-mint"
            }`}
          >
            {money(summary?.variance || 0)}
          </p>
        </Card>
      </div>

      <Card className="p-5">
        <SectionHeading
          title="Statement lines"
          subtitle={`${summary?.matched || 0} matched · ${summary?.unmatched || 0} unmatched · ${summary?.ignored || 0} ignored`}
          action={
            isTreasurer &&
            isInProgress && (
              <button
                type="button"
                onClick={autoMatch}
                disabled={autoMatching}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                {autoMatching ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                Auto-match
              </button>
            )
          }
        />

        {lines.length === 0 ? (
          <EmptyState icon={Landmark} title="No statement lines yet" description="Add the statement's lines below." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:border-obsidian-border">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <LineRow
                    key={line._id}
                    line={line}
                    workspaceId={workspaceId}
                    sessionId={sessionId}
                    candidateEntries={candidateEntries}
                    contraAccounts={contraAccounts}
                    onChanged={refetch}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isTreasurer && isInProgress && (
          <div className="mt-4">
            <AddLineRow workspaceId={workspaceId} sessionId={sessionId} onAdded={refetch} />
          </div>
        )}
      </Card>

      {isTreasurer && isInProgress && (
        <Card className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-slate-900 dark:text-mist">Ready to close this session?</p>
            <p className="text-xs text-slate-400">
              {summary?.unmatched
                ? `${summary.unmatched} line(s) are still unmatched — you can force-close, but they'll stay unresolved.`
                : "Every line has been matched, ignored, or resolved by an adjustment."}
            </p>
          </div>
          <button
            type="button"
            disabled={completing}
            onClick={() => complete(Boolean(summary?.unmatched))}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {completing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {summary?.unmatched ? "Force complete" : "Complete session"}
          </button>
        </Card>
      )}
    </div>
  );
}
