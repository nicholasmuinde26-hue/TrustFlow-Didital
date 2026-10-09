import React, { useCallback, useEffect, useState } from "react";
import chamaAssetsApi from "../api/chamaAssets.api";

const inputClass = "min-h-9 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist";
const actionClass = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-obsidian-border dark:text-mist dark:hover:bg-obsidian-raised";
const primaryClass = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50";
const KES = (value) => `KES ${Number(value || 0).toLocaleString("en-KE")}`;

const STATUS_TONE = {
  fulfilled: "text-emerald-700 dark:text-emerald-400",
  partially_received: "text-amber-700 dark:text-amber-400",
  pending: "text-slate-500 dark:text-mist-muted",
  overdue: "text-rose-700 dark:text-rose-300",
  waived: "text-slate-400 dark:text-mist-muted",
};

const newLeaseForm = { lessee_type: "external", member_id: "", external_name: "", external_contact: "", arrangement_type: "cash", cash_amount: "", cash_frequency: "monthly", in_kind_description: "", in_kind_unit: "", start_date: "" };
const newPeriodForm = { label: "", period_start: "", period_end: "", due_date: "", expected_cash_amount: "", expected_in_kind_quantity: "", expected_in_kind_unit: "", expected_in_kind_description: "" };

// A lease can be settled two ways per period — cash (goes through the
// same posting + M-Pesa reconciliation as any other asset income) or
// in-kind (a logged quantity, no ledger entry). Kept as one small form
// that switches shape rather than two separate dialogs, since a hybrid
// lease's period can receive both.
function ReceiptForm({ onSubmitCash, onSubmitInKind, busy, defaultUnit }) {
  const [mode, setMode] = useState("cash");
  const [cash, setCash] = useState({ amount: "", collectionMethod: "mpesa", mpesaReceiptNumber: "", description: "" });
  const [inKind, setInKind] = useState({ quantity: "", unit: defaultUnit || "", estimatedValue: "", valuationNote: "", description: "" });

  return (
    <div className="mt-2 rounded-md border border-dashed border-slate-300 p-2 dark:border-obsidian-border">
      <div className="mb-2 flex gap-1 text-xs">
        <button type="button" className={`rounded px-2 py-1 ${mode === "cash" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600 dark:bg-obsidian-raised dark:text-mist-muted"}`} onClick={() => setMode("cash")}>Cash received</button>
        <button type="button" className={`rounded px-2 py-1 ${mode === "in_kind" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600 dark:bg-obsidian-raised dark:text-mist-muted"}`} onClick={() => setMode("in_kind")}>Harvest / in-kind received</button>
      </div>
      {mode === "cash" ? (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); onSubmitCash(cash).then((ok) => ok && setCash({ amount: "", collectionMethod: "mpesa", mpesaReceiptNumber: "", description: "" })); }}>
          <input aria-label="Amount" className={`${inputClass} w-28`} type="number" min="0.01" step="0.01" placeholder="Amount" value={cash.amount} onChange={(e) => setCash((v) => ({ ...v, amount: e.target.value }))} required />
          <select aria-label="Method" className={inputClass} value={cash.collectionMethod} onChange={(e) => setCash((v) => ({ ...v, collectionMethod: e.target.value }))}>
            <option value="mpesa">M-Pesa</option>
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
          </select>
          {cash.collectionMethod === "mpesa" && (
            <input aria-label="M-Pesa receipt no." className={`${inputClass} w-36`} placeholder="M-Pesa receipt no." value={cash.mpesaReceiptNumber} onChange={(e) => setCash((v) => ({ ...v, mpesaReceiptNumber: e.target.value }))} />
          )}
          <input aria-label="Note" className={`${inputClass} min-w-32 flex-1`} placeholder="Note (optional)" value={cash.description} onChange={(e) => setCash((v) => ({ ...v, description: e.target.value }))} />
          <button className={primaryClass} type="submit" disabled={busy}>Post</button>
        </form>
      ) : (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); onSubmitInKind(inKind).then((ok) => ok && setInKind({ quantity: "", unit: defaultUnit || "", estimatedValue: "", valuationNote: "", description: "" })); }}>
          <input aria-label="Quantity" className={`${inputClass} w-24`} type="number" min="0.01" step="0.01" placeholder="Qty" value={inKind.quantity} onChange={(e) => setInKind((v) => ({ ...v, quantity: e.target.value }))} required />
          <input aria-label="Unit" className={`${inputClass} w-28`} placeholder="Unit (90kg bags)" value={inKind.unit} onChange={(e) => setInKind((v) => ({ ...v, unit: e.target.value }))} required />
          <input aria-label="Estimated value" className={`${inputClass} w-32`} type="number" min="0" step="0.01" placeholder="Est. value KES (optional)" value={inKind.estimatedValue} onChange={(e) => setInKind((v) => ({ ...v, estimatedValue: e.target.value }))} />
          <input aria-label="Note" className={`${inputClass} min-w-32 flex-1`} placeholder="Note (optional)" value={inKind.description} onChange={(e) => setInKind((v) => ({ ...v, description: e.target.value }))} />
          <button className={primaryClass} type="submit" disabled={busy}>Log receipt</button>
        </form>
      )}
    </div>
  );
}

function LeaseTracker({ chamaId, leaseId, canManage, notify }) {
  const [tracker, setTracker] = useState(null);
  const [busy, setBusy] = useState(false);
  const [addingPeriod, setAddingPeriod] = useState(false);
  const [periodForm, setPeriodForm] = useState(newPeriodForm);
  const [receiptOpenFor, setReceiptOpenFor] = useState(null);

  const load = useCallback(async () => {
    const { data } = await chamaAssetsApi.getLeaseTracker(chamaId, leaseId);
    setTracker(data?.data || null);
  }, [chamaId, leaseId]);

  useEffect(() => { load(); }, [load]);

  if (!tracker) return <p className="mt-2 text-xs text-slate-500 dark:text-mist-muted">Loading season tracker…</p>;

  const { lease, periods, totals } = tracker;

  const runReceipt = async (fn, successMessage) => {
    setBusy(true);
    try {
      await fn();
      await load();
      notify(successMessage);
      return true;
    } catch (err) {
      notify(err.response?.data?.message || "Could not record the receipt.", true);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitPeriod = (event) => {
    event.preventDefault();
    setBusy(true);
    chamaAssetsApi.addLeasePeriod(chamaId, leaseId, periodForm)
      .then(async () => { setPeriodForm(newPeriodForm); setAddingPeriod(false); await load(); notify("Season/period added."); })
      .catch((err) => notify(err.response?.data?.message || "Could not add the period.", true))
      .finally(() => setBusy(false));
  };

  return (
    <div className="mt-3 rounded-md border border-slate-200 p-3 dark:border-obsidian-border">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-mist-muted">
          {lease.arrangement_type === "cash" ? "Cash lease" : lease.arrangement_type === "in_kind" ? "In-kind (harvest share) lease" : "Cash + in-kind lease"} ·{" "}
          {lease.lessee?.lessee_type === "member" ? "Member" : lease.lessee?.external_name || "External party"}
        </p>
        {canManage && <button type="button" className={actionClass} onClick={() => setAddingPeriod((v) => !v)}>+ New season/month</button>}
      </div>

      {(totals.expectedCash > 0 || totals.receivedCash > 0) && (
        <p className="mt-1 text-xs text-slate-500 dark:text-mist-muted">Cash — expected {KES(totals.expectedCash)}, received {KES(totals.receivedCash)}</p>
      )}
      {(totals.expectedInKindQuantity > 0 || totals.receivedInKindQuantity > 0) && (
        <p className="text-xs text-slate-500 dark:text-mist-muted">
          In-kind — expected {totals.expectedInKindQuantity}, received {totals.receivedInKindQuantity}
          {totals.estimatedInKindValue > 0 ? ` (est. ${KES(totals.estimatedInKindValue)})` : ""}
        </p>
      )}

      {addingPeriod && (
        <form className="mt-2 grid gap-2 rounded-md border border-dashed border-slate-300 p-2 sm:grid-cols-2 dark:border-obsidian-border" onSubmit={submitPeriod}>
          <input className={inputClass} placeholder="Label (e.g. October 2026, 2026 Long Rains)" value={periodForm.label} onChange={(e) => setPeriodForm((v) => ({ ...v, label: e.target.value }))} required />
          <input className={inputClass} type="number" min="0" step="0.01" placeholder="Expected cash (KES)" value={periodForm.expected_cash_amount} onChange={(e) => setPeriodForm((v) => ({ ...v, expected_cash_amount: e.target.value }))} />
          <label className="text-xs text-slate-500 dark:text-mist-muted">Period start<input className={`${inputClass} mt-1 w-full`} type="date" value={periodForm.period_start} onChange={(e) => setPeriodForm((v) => ({ ...v, period_start: e.target.value }))} required /></label>
          <label className="text-xs text-slate-500 dark:text-mist-muted">Period end<input className={`${inputClass} mt-1 w-full`} type="date" value={periodForm.period_end} onChange={(e) => setPeriodForm((v) => ({ ...v, period_end: e.target.value }))} required /></label>
          <input className={inputClass} type="number" min="0" step="0.01" placeholder="Expected in-kind qty" value={periodForm.expected_in_kind_quantity} onChange={(e) => setPeriodForm((v) => ({ ...v, expected_in_kind_quantity: e.target.value }))} />
          <input className={inputClass} placeholder="Unit (e.g. 90kg bags)" value={periodForm.expected_in_kind_unit} onChange={(e) => setPeriodForm((v) => ({ ...v, expected_in_kind_unit: e.target.value }))} />
          <input className={`${inputClass} sm:col-span-2`} placeholder="What's expected in-kind (e.g. 30% of maize harvest)" value={periodForm.expected_in_kind_description} onChange={(e) => setPeriodForm((v) => ({ ...v, expected_in_kind_description: e.target.value }))} />
          <button className={`${primaryClass} sm:col-span-2 sm:justify-self-start`} type="submit" disabled={busy}>Add period</button>
        </form>
      )}

      <div className="mt-3 space-y-2">
        {periods.length === 0 && <p className="text-xs text-slate-500 dark:text-mist-muted">No seasons/months recorded yet.</p>}
        {periods.map((period) => (
          <div key={period._id} className="rounded-md border border-slate-100 p-2 dark:border-obsidian-border">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-900 dark:text-mist">
                {period.label} <span className={`ml-2 font-normal ${STATUS_TONE[period.status] || ""}`}>{String(period.status).replaceAll("_", " ")}</span>
              </p>
              {canManage && lease.status === "active" && period.status !== "fulfilled" && period.status !== "waived" && (
                <button type="button" className={actionClass} onClick={() => setReceiptOpenFor(receiptOpenFor === period._id ? null : period._id)}>Record receipt</button>
              )}
            </div>
            {(period.due_soon_reminder_sent_at || period.overdue_reminder_count > 0) && (
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-mist-muted">
                {period.status === "overdue"
                  ? `Nudged ${period.overdue_reminder_count || 1}× while overdue (last ${new Date(period.last_overdue_reminder_sent_at).toLocaleDateString()})`
                  : `Due-soon reminder sent ${new Date(period.due_soon_reminder_sent_at).toLocaleDateString()}`}
              </p>
            )}
            {period.expected_cash_amount > 0 && <p className="text-xs text-slate-500 dark:text-mist-muted">Cash — expected {KES(period.expected_cash_amount)}, received {KES(period.received_cash_amount)}</p>}
            {period.expected_in_kind?.quantity > 0 && (
              <p className="text-xs text-slate-500 dark:text-mist-muted">
                In-kind ({period.expected_in_kind.description || period.expected_in_kind.unit}) — expected {period.expected_in_kind.quantity} {period.expected_in_kind.unit}, received {period.received_in_kind_quantity} {period.expected_in_kind.unit}
              </p>
            )}
            {period.in_kind_receipts?.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-[11px] text-slate-400 dark:text-mist-muted">
                {period.in_kind_receipts.map((r) => (
                  <li key={r._id}>{r.quantity} {r.unit}{r.estimated_value ? ` · est. ${KES(r.estimated_value)}` : ""} — {new Date(r.recorded_at).toLocaleDateString()}</li>
                ))}
              </ul>
            )}
            {receiptOpenFor === period._id && (
              <ReceiptForm
                busy={busy}
                defaultUnit={period.expected_in_kind?.unit}
                onSubmitCash={(payload) => runReceipt(() => chamaAssetsApi.recordLeaseCashReceipt(chamaId, leaseId, period._id, payload), "Cash receipt posted to the ledger.")}
                onSubmitInKind={(payload) => runReceipt(() => chamaAssetsApi.recordLeaseInKindReceipt(chamaId, leaseId, period._id, payload), "In-kind receipt recorded.")}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AssetLeaseSection({ chamaId, assetId, canManage, notify }) {
  const [leases, setLeases] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(newLeaseForm);
  const [busy, setBusy] = useState(false);
  const [openLeaseId, setOpenLeaseId] = useState(null);

  const load = useCallback(async () => {
    const { data } = await chamaAssetsApi.listLeases(chamaId, assetId);
    setLeases(data?.data?.leases || []);
  }, [chamaId, assetId]);

  useEffect(() => { load(); }, [load]);

  const submit = (event) => {
    event.preventDefault();
    setBusy(true);
    const payload = {
      lessee_type: form.lessee_type,
      member_id: form.lessee_type === "member" ? form.member_id : undefined,
      external_name: form.lessee_type === "external" ? form.external_name : undefined,
      external_contact: form.lessee_type === "external" ? form.external_contact : undefined,
      arrangement_type: form.arrangement_type,
      cash_amount: form.cash_amount || undefined,
      cash_frequency: form.cash_frequency,
      in_kind_description: form.in_kind_description || undefined,
      in_kind_unit: form.in_kind_unit || undefined,
      start_date: form.start_date,
    };
    chamaAssetsApi.createLease(chamaId, assetId, payload)
      .then(async () => { setForm(newLeaseForm); setShowForm(false); await load(); notify("Lease created."); })
      .catch((err) => notify(err.response?.data?.message || "Could not create the lease.", true))
      .finally(() => setBusy(false));
  };

  return (
    <div className="mt-3 border-t border-dashed border-slate-200 pt-3 dark:border-obsidian-border">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-mist-muted">Leases &amp; lease-outs</h4>
        {canManage && <button type="button" className={actionClass} onClick={() => setShowForm((v) => !v)}>+ New lease</button>}
      </div>

      {leases.length === 0 && !showForm && <p className="mt-1 text-xs text-slate-500 dark:text-mist-muted">Not leased out to anyone right now.</p>}

      {leases.map((lease) => (
        <div key={lease._id} className="mt-2">
          <div className="flex items-center justify-between gap-2">
            <button type="button" className="text-left text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400" onClick={() => setOpenLeaseId(openLeaseId === lease._id ? null : lease._id)}>
              {lease.lessee?.lessee_type === "member" ? "Member lessee" : lease.lessee?.external_name} · {lease.arrangement_type.replaceAll("_", " ")} · {String(lease.status)}
              {lease.end_date ? ` · ends ${new Date(lease.end_date).toLocaleDateString()}${lease.renewal_reminder_sent_at ? " (renewal reminder sent)" : ""}` : ""}
              {openLeaseId === lease._id ? " (hide)" : " (view tracker)"}
            </button>
            {canManage && lease.status === "active" && (
              <button
                type="button"
                className="text-[11px] font-medium text-slate-400 hover:text-rose-600 dark:text-mist-muted dark:hover:text-rose-400"
                onClick={() => {
                  if (!window.confirm("End this lease? Past seasons/receipts stay on record.")) return;
                  chamaAssetsApi.endLease(chamaId, lease._id, { reason: "Ended by treasurer/chairperson" })
                    .then(async () => { await load(); notify("Lease ended."); })
                    .catch((err) => notify(err.response?.data?.message || "Could not end the lease.", true));
                }}
              >
                End lease
              </button>
            )}
          </div>
          {openLeaseId === lease._id && <LeaseTracker chamaId={chamaId} leaseId={lease._id} canManage={canManage} notify={notify} />}
        </div>
      ))}

      {showForm && (
        <form className="mt-2 grid gap-2 rounded-md border border-dashed border-slate-300 p-2 sm:grid-cols-2 dark:border-obsidian-border" onSubmit={submit}>
          <select className={inputClass} aria-label="Lessee type" value={form.lessee_type} onChange={(e) => setForm((v) => ({ ...v, lessee_type: e.target.value }))}>
            <option value="external">External party (e.g. a farmer, no account)</option>
            <option value="member">Chama member</option>
          </select>
          {form.lessee_type === "member" ? (
            <input className={inputClass} placeholder="Member user ID" value={form.member_id} onChange={(e) => setForm((v) => ({ ...v, member_id: e.target.value }))} required />
          ) : (
            <>
              <input className={inputClass} placeholder="Name" value={form.external_name} onChange={(e) => setForm((v) => ({ ...v, external_name: e.target.value }))} required />
              <input className={inputClass} placeholder="Contact (phone, optional)" value={form.external_contact} onChange={(e) => setForm((v) => ({ ...v, external_contact: e.target.value }))} />
            </>
          )}
          <select className={inputClass} aria-label="Arrangement type" value={form.arrangement_type} onChange={(e) => setForm((v) => ({ ...v, arrangement_type: e.target.value }))}>
            <option value="cash">Cash lease (e.g. monthly rent)</option>
            <option value="in_kind">In-kind (e.g. share of harvest)</option>
            <option value="hybrid">Cash + in-kind</option>
          </select>
          <label className="text-xs text-slate-500 dark:text-mist-muted">Start date<input className={`${inputClass} mt-1 w-full`} type="date" value={form.start_date} onChange={(e) => setForm((v) => ({ ...v, start_date: e.target.value }))} required /></label>
          {form.arrangement_type !== "in_kind" && (
            <>
              <input className={inputClass} type="number" min="0" step="0.01" placeholder="Cash amount per period (KES)" value={form.cash_amount} onChange={(e) => setForm((v) => ({ ...v, cash_amount: e.target.value }))} />
              <select className={inputClass} aria-label="Cash frequency" value={form.cash_frequency} onChange={(e) => setForm((v) => ({ ...v, cash_frequency: e.target.value }))}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="per_season">Per season</option>
                <option value="one_off">One-off</option>
              </select>
            </>
          )}
          {form.arrangement_type !== "cash" && (
            <>
              <input className={inputClass} placeholder="What's owed in-kind (e.g. 30% of maize harvest)" value={form.in_kind_description} onChange={(e) => setForm((v) => ({ ...v, in_kind_description: e.target.value }))} />
              <input className={inputClass} placeholder="Unit (e.g. 90kg bags)" value={form.in_kind_unit} onChange={(e) => setForm((v) => ({ ...v, in_kind_unit: e.target.value }))} />
            </>
          )}
          <button className={`${primaryClass} sm:col-span-2 sm:justify-self-start`} type="submit" disabled={busy}>Create lease</button>
        </form>
      )}
    </div>
  );
}