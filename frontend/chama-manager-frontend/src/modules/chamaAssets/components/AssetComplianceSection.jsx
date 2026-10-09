import React, { useCallback, useEffect, useState } from "react";
import chamaAssetsApi from "../api/chamaAssets.api";

const inputClass = "min-h-9 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist";
const actionClass = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-obsidian-border dark:text-mist dark:hover:bg-obsidian-raised";
const primaryClass = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50";
const KES = (value) => `KES ${Number(value || 0).toLocaleString("en-KE")}`;

const STATUS_TONE = {
  paid: "text-emerald-700 dark:text-emerald-400",
  pending: "text-slate-500 dark:text-mist-muted",
  overdue: "text-rose-700 dark:text-rose-300",
  waived: "text-slate-400 dark:text-mist-muted",
};

const OBLIGATION_LABEL = {
  land_rates: "Land rates",
  business_permit: "Business permit",
  other_tax: "Other tax",
  other: "Other",
};

const newObligationForm = { obligationType: "land_rates", jurisdiction: "", authorityName: "", description: "", cycleLabel: "", dueDate: "", amountExpected: "" };
const newCycleForm = { label: "", dueDate: "", amountExpected: "" };

// Nudge state — the same "reminder sent" hint AssetLeaseSection shows on
// a lease period, so leadership can see at a glance whether the system
// has already flagged this cycle rather than it just sitting silent.
function NudgeHint({ cycle }) {
  if (!cycle.due_soon_reminder_sent_at && !(cycle.overdue_reminder_count > 0)) return null;
  return (
    <p className="mt-0.5 text-[11px] text-slate-400 dark:text-mist-muted">
      {cycle.status === "overdue"
        ? `Nudged ${cycle.overdue_reminder_count || 1}× while overdue (last ${new Date(cycle.last_overdue_reminder_sent_at).toLocaleDateString()})`
        : `Due-soon reminder sent ${new Date(cycle.due_soon_reminder_sent_at).toLocaleDateString()}`}
    </p>
  );
}

function PayForm({ onSubmit, busy }) {
  const [form, setForm] = useState({ amount: "", collectionMethod: "mpesa", description: "" });
  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-dashed border-slate-300 p-2 dark:border-obsidian-border"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(form).then((ok) => ok && setForm({ amount: "", collectionMethod: "mpesa", description: "" }));
      }}
    >
      <input aria-label="Amount" className={`${inputClass} w-28`} type="number" min="0.01" step="0.01" placeholder="Amount" value={form.amount} onChange={(e) => setForm((v) => ({ ...v, amount: e.target.value }))} required />
      <select aria-label="Method" className={inputClass} value={form.collectionMethod} onChange={(e) => setForm((v) => ({ ...v, collectionMethod: e.target.value }))}>
        <option value="mpesa">M-Pesa</option>
        <option value="cash">Cash</option>
        <option value="bank">Bank</option>
      </select>
      <input aria-label="Note" className={`${inputClass} min-w-32 flex-1`} placeholder="Note (optional)" value={form.description} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} />
      <button className={primaryClass} type="submit" disabled={busy}>Post payment</button>
    </form>
  );
}

export default function AssetComplianceSection({ chamaId, assetId, canManage, notify }) {
  const [obligations, setObligations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(newObligationForm);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [addingCycleFor, setAddingCycleFor] = useState(null);
  const [cycleForm, setCycleForm] = useState(newCycleForm);
  const [payOpenFor, setPayOpenFor] = useState(null);

  const load = useCallback(async () => {
    const { data } = await chamaAssetsApi.listComplianceObligations(chamaId, assetId);
    setObligations(data?.data?.obligations || []);
  }, [chamaId, assetId]);

  useEffect(() => { load(); }, [load]);

  const submitObligation = (event) => {
    event.preventDefault();
    setBusy(true);
    chamaAssetsApi.createComplianceObligation(chamaId, assetId, form)
      .then(async () => { setForm(newObligationForm); setShowForm(false); await load(); notify("Compliance obligation added."); })
      .catch((err) => notify(err.response?.data?.message || "Could not add the obligation.", true))
      .finally(() => setBusy(false));
  };

  const submitCycle = (obligationId) => (event) => {
    event.preventDefault();
    setBusy(true);
    chamaAssetsApi.addComplianceCycle(chamaId, obligationId, cycleForm)
      .then(async () => { setCycleForm(newCycleForm); setAddingCycleFor(null); await load(); notify("Next cycle added."); })
      .catch((err) => notify(err.response?.data?.message || "Could not add the cycle.", true))
      .finally(() => setBusy(false));
  };

  const runPay = (obligationId, cycleId) => async (payload) => {
    setBusy(true);
    try {
      await chamaAssetsApi.payComplianceCycle(chamaId, obligationId, cycleId, payload);
      await load();
      setPayOpenFor(null);
      notify("Payment posted to the ledger.");
      return true;
    } catch (err) {
      notify(err.response?.data?.message || "Could not record the payment.", true);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const waiveCycle = (obligationId, cycleId) => {
    const reason = window.prompt("Reason for waiving this cycle (optional):") || "";
    chamaAssetsApi.waiveComplianceCycle(chamaId, obligationId, cycleId, reason)
      .then(async () => { await load(); notify("Cycle waived."); })
      .catch((err) => notify(err.response?.data?.message || "Could not waive the cycle.", true));
  };

  const toggleActive = (obligation) => {
    chamaAssetsApi.setComplianceObligationActive(chamaId, obligation._id, !obligation.active)
      .then(async () => { await load(); notify(obligation.active ? "Obligation turned off — no more nudges for it." : "Obligation turned back on."); })
      .catch((err) => notify(err.response?.data?.message || "Could not update the obligation.", true));
  };

  return (
    <div className="mt-3 border-t border-dashed border-slate-200 pt-3 dark:border-obsidian-border">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-mist-muted">Land rates &amp; compliance</h4>
        {canManage && <button type="button" className={actionClass} onClick={() => setShowForm((v) => !v)}>+ New obligation</button>}
      </div>

      {obligations.length === 0 && !showForm && <p className="mt-1 text-xs text-slate-500 dark:text-mist-muted">No recurring dues (land rates, permits) tracked for this asset yet.</p>}

      {obligations.map((obligation) => (
        <div key={obligation._id} className="mt-2">
          <div className="flex items-center justify-between gap-2">
            <button type="button" className="text-left text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400" onClick={() => setOpenId(openId === obligation._id ? null : obligation._id)}>
              {OBLIGATION_LABEL[obligation.obligation_type] || obligation.obligation_type} · {obligation.jurisdiction}
              {!obligation.active ? " (off)" : ""}
              {openId === obligation._id ? " (hide)" : " (view cycles)"}
            </button>
            {canManage && (
              <button type="button" className="text-[11px] font-medium text-slate-400 hover:text-rose-600 dark:text-mist-muted dark:hover:text-rose-400" onClick={() => toggleActive(obligation)}>
                {obligation.active ? "Turn off" : "Turn back on"}
              </button>
            )}
          </div>

          {openId === obligation._id && (
            <div className="mt-2 rounded-md border border-slate-200 p-3 dark:border-obsidian-border">
              {obligation.authority_name && <p className="text-xs text-slate-500 dark:text-mist-muted">{obligation.authority_name}</p>}
              {obligation.description && <p className="text-xs text-slate-500 dark:text-mist-muted">{obligation.description}</p>}

              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500 dark:text-mist-muted">Cycles</p>
                {canManage && <button type="button" className={actionClass} onClick={() => setAddingCycleFor(addingCycleFor === obligation._id ? null : obligation._id)}>+ Next cycle</button>}
              </div>

              {addingCycleFor === obligation._id && (
                <form className="mt-2 grid gap-2 rounded-md border border-dashed border-slate-300 p-2 sm:grid-cols-2 dark:border-obsidian-border" onSubmit={submitCycle(obligation._id)}>
                  <input className={inputClass} placeholder="Label (e.g. 2027 land rates)" value={cycleForm.label} onChange={(e) => setCycleForm((v) => ({ ...v, label: e.target.value }))} />
                  <label className="text-xs text-slate-500 dark:text-mist-muted">Due date<input className={`${inputClass} mt-1 w-full`} type="date" value={cycleForm.dueDate} onChange={(e) => setCycleForm((v) => ({ ...v, dueDate: e.target.value }))} required /></label>
                  <input className={inputClass} type="number" min="0" step="0.01" placeholder="Amount expected (KES, optional)" value={cycleForm.amountExpected} onChange={(e) => setCycleForm((v) => ({ ...v, amountExpected: e.target.value }))} />
                  <button className={`${primaryClass} sm:col-span-2 sm:justify-self-start`} type="submit" disabled={busy}>Add cycle</button>
                </form>
              )}

              <div className="mt-2 space-y-2">
                {obligation.cycles.length === 0 && <p className="text-xs text-slate-500 dark:text-mist-muted">No cycles yet.</p>}
                {obligation.cycles.map((cycle) => (
                  <div key={cycle._id} className="rounded-md border border-slate-100 p-2 dark:border-obsidian-border">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900 dark:text-mist">
                        {cycle.label} <span className={`ml-2 font-normal ${STATUS_TONE[cycle.status] || ""}`}>{String(cycle.status)}</span>
                      </p>
                      {canManage && cycle.status !== "paid" && cycle.status !== "waived" && (
                        <div className="flex gap-1.5">
                          <button type="button" className={actionClass} onClick={() => setPayOpenFor(payOpenFor === cycle._id ? null : cycle._id)}>Record payment</button>
                          <button type="button" className="text-[11px] font-medium text-slate-400 hover:text-rose-600 dark:text-mist-muted dark:hover:text-rose-400" onClick={() => waiveCycle(obligation._id, cycle._id)}>Waive</button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-mist-muted">
                      Due {new Date(cycle.due_date).toLocaleDateString()}
                      {cycle.amount_expected ? ` · ${KES(cycle.amount_expected)} expected` : ""}
                      {cycle.paid_amount > 0 ? ` · ${KES(cycle.paid_amount)} paid` : ""}
                    </p>
                    {cycle.status === "waived" && cycle.waived_reason && <p className="text-[11px] text-slate-400 dark:text-mist-muted">Waived: {cycle.waived_reason}</p>}
                    <NudgeHint cycle={cycle} />
                    {payOpenFor === cycle._id && <PayForm busy={busy} onSubmit={runPay(obligation._id, cycle._id)} />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {showForm && (
        <form className="mt-2 grid gap-2 rounded-md border border-dashed border-slate-300 p-2 sm:grid-cols-2 dark:border-obsidian-border" onSubmit={submitObligation}>
          <select className={inputClass} aria-label="Obligation type" value={form.obligationType} onChange={(e) => setForm((v) => ({ ...v, obligationType: e.target.value }))}>
            <option value="land_rates">Land rates</option>
            <option value="business_permit">Business permit</option>
            <option value="other_tax">Other tax</option>
            <option value="other">Other</option>
          </select>
          <input className={inputClass} placeholder="Jurisdiction (e.g. Kiambu County)" value={form.jurisdiction} onChange={(e) => setForm((v) => ({ ...v, jurisdiction: e.target.value }))} required />
          <input className={inputClass} placeholder="Authority name (optional)" value={form.authorityName} onChange={(e) => setForm((v) => ({ ...v, authorityName: e.target.value }))} />
          <input className={inputClass} placeholder="Description (optional)" value={form.description} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} />
          <input className={inputClass} placeholder="First cycle label (optional)" value={form.cycleLabel} onChange={(e) => setForm((v) => ({ ...v, cycleLabel: e.target.value }))} />
          <label className="text-xs text-slate-500 dark:text-mist-muted">First cycle due date<input className={`${inputClass} mt-1 w-full`} type="date" value={form.dueDate} onChange={(e) => setForm((v) => ({ ...v, dueDate: e.target.value }))} required /></label>
          <input className={inputClass} type="number" min="0" step="0.01" placeholder="Amount expected (KES, optional)" value={form.amountExpected} onChange={(e) => setForm((v) => ({ ...v, amountExpected: e.target.value }))} />
          <button className={`${primaryClass} sm:col-span-2 sm:justify-self-start`} type="submit" disabled={busy}>Add obligation</button>
        </form>
      )}
    </div>
  );
}