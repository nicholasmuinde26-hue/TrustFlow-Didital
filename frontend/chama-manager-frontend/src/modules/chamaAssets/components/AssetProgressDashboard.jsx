import React, { useCallback, useEffect, useState } from "react";
import { Landmark, TrendingUp } from "lucide-react";
import { useSocket } from "@/app/providers/SocketProvider";
import { Stat, StatStrip } from "@/modules/chama/components/overview/primitives";
import chamaAssetsApi from "../api/chamaAssets.api";

const KES = (value) => `KES ${Number(value || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
const inputClass = "min-h-9 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist";
const actionClass = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-obsidian-border dark:text-mist dark:hover:bg-obsidian-raised";
const primaryClass = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50";

const OPERATIONAL_LABEL = {
  idle: "Idle",
  leased_out: "Leased out",
  occupied: "Occupied",
  under_maintenance: "Under maintenance",
  for_sale: "For sale",
};

function ProgressBar({ pct, tone = "bg-emerald-600" }) {
  const clamped = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-obsidian-raised">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

// A member-facing view of "how is this asset doing" — deliberately NOT
// gated behind canManage the way the income/expense/funding forms in
// ChamaAssetsPanel are. Members are co-owners, not customers; this is
// the transparency that heads off "what happened to our land" disputes.
// Only the "Record valuation" action (a leadership write) stays gated.
export default function AssetProgressDashboard({ chamaId, assetId, canRecordValuation, notify }) {
  const { socket } = useSocket();
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [showValuationForm, setShowValuationForm] = useState(false);
  const [valuationForm, setValuationForm] = useState({ amount: "", note: "", as_of: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await chamaAssetsApi.progress(chamaId, assetId);
      setProgress(data?.data || null);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Could not load this asset's progress.");
    }
  }, [chamaId, assetId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return undefined;
    // Anything that could move these figures — a new income entry, a
    // lease receipt, an operational-status change, a fresh valuation.
    const refresh = (payload) => {
      if (payload?.assetId && String(payload.assetId) !== String(assetId)) return;
      load();
    };
    socket.on("finance:asset_income", refresh);
    socket.on("chama_asset:updated", refresh);
    socket.on("chama_asset:lease_updated", refresh);
    socket.on("chama_asset:valuation_recorded", refresh);
    return () => {
      socket.off("finance:asset_income", refresh);
      socket.off("chama_asset:updated", refresh);
      socket.off("chama_asset:lease_updated", refresh);
      socket.off("chama_asset:valuation_recorded", refresh);
    };
  }, [socket, assetId, load]);

  const submitValuation = (event) => {
    event.preventDefault();
    setBusy(true);
    chamaAssetsApi.recordValuation(chamaId, assetId, {
      amount: Number(valuationForm.amount),
      note: valuationForm.note,
      as_of: valuationForm.as_of || undefined,
    })
      .then(async () => {
        setValuationForm({ amount: "", note: "", as_of: "" });
        setShowValuationForm(false);
        await load();
        notify?.("Valuation recorded.");
      })
      .catch((err) => notify?.(err.response?.data?.message || "Could not record the valuation.", true))
      .finally(() => setBusy(false));
  };

  if (error) return <p role="alert" className="mt-3 text-xs text-rose-700 dark:text-rose-300">{error}</p>;
  if (!progress) return <p className="mt-3 text-xs text-slate-500 dark:text-mist-muted">Loading progress…</p>;

  const { incomeVsTarget, occupancy, roi, valuation, timeline } = progress;

  return (
    <div className="mt-3 rounded-md border border-slate-200 p-3 dark:border-obsidian-border">
      <StatStrip>
        <Stat
          label={`Income vs. target — ${incomeVsTarget.periodLabel}`}
          value={incomeVsTarget.target > 0 ? `${KES(incomeVsTarget.actual)} / ${KES(incomeVsTarget.target)}` : KES(incomeVsTarget.actual)}
          sub={incomeVsTarget.progressPct != null ? `${incomeVsTarget.progressPct}% of target` : "No monthly target set"}
        >
          {incomeVsTarget.target > 0 && <ProgressBar pct={incomeVsTarget.progressPct} tone={incomeVsTarget.progressPct >= 100 ? "bg-emerald-600" : "bg-amber-500"} />}
        </Stat>
        <Stat
          label="Occupancy / lease status"
          value={OPERATIONAL_LABEL[occupancy.operationalStatus] || "Idle"}
          sub={occupancy.activeLeaseCount > 0
            ? `${occupancy.activeLeaseCount} active lease${occupancy.activeLeaseCount === 1 ? "" : "s"}${occupancy.outstandingBalance > 0 ? ` · ${KES(occupancy.outstandingBalance)} outstanding` : ""}`
            : "No active lease"}
          tone={occupancy.outstandingBalance > 0 ? "text-amber-700 dark:text-amber-400" : undefined}
        />
        <Stat
          label="ROI since acquisition"
          value={roi.roiPct != null ? `${roi.roiPct}%` : "—"}
          sub={roi.costBasis > 0 ? `${KES(roi.totalIncomeToDate)} earned on ${KES(roi.costBasis)} cost` : "No acquisition cost on record"}
        />
      </StatStrip>

      {occupancy.leases.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-slate-100 pt-2 dark:border-obsidian-border">
          {occupancy.leases.map((lease) => (
            <li key={lease.leaseId} className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-mist-muted">
              <span>{lease.lesseeName} · {String(lease.arrangementType).replaceAll("_", " ")}</span>
              <span className={lease.outstandingCash > 0 ? "font-semibold text-amber-700 dark:text-amber-400" : ""}>
                {lease.outstandingCash > 0 ? `${KES(lease.outstandingCash)} outstanding${lease.overduePeriods ? ` (${lease.overduePeriods} overdue)` : ""}` : "Up to date"}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 border-t border-slate-100 pt-3 dark:border-obsidian-border">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-mist-muted">
            <TrendingUp size={13} /> Timeline
            {valuation.current != null && (
              <span className="normal-case font-normal text-slate-400 dark:text-mist-muted">
                · currently valued at {KES(valuation.current)}
                {valuation.appreciationPct != null ? ` (${valuation.appreciationPct >= 0 ? "+" : ""}${valuation.appreciationPct}% since acquisition)` : ""}
              </span>
            )}
          </h4>
          {canRecordValuation && (
            <button type="button" className={actionClass} onClick={() => setShowValuationForm((v) => !v)}>
              <Landmark size={13} /> Record valuation
            </button>
          )}
        </div>

        {showValuationForm && (
          <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={submitValuation}>
            <input aria-label="Valuation amount" className={`${inputClass} w-36`} type="number" min="0.01" step="0.01" placeholder="Value (KES)" value={valuationForm.amount} onChange={(e) => setValuationForm((v) => ({ ...v, amount: e.target.value }))} required />
            <label className="text-xs text-slate-500 dark:text-mist-muted">As of
              <input className={`${inputClass} mt-1`} type="date" value={valuationForm.as_of} onChange={(e) => setValuationForm((v) => ({ ...v, as_of: e.target.value }))} />
            </label>
            <input aria-label="Note" className={`${inputClass} min-w-40 flex-1`} placeholder="Basis (e.g. bank appraisal, comparable sales)" value={valuationForm.note} onChange={(e) => setValuationForm((v) => ({ ...v, note: e.target.value }))} />
            <button className={primaryClass} type="submit" disabled={busy}>Save</button>
          </form>
        )}

        <ol className="mt-2 space-y-2">
          {timeline.map((event, index) => (
            <li key={`${event.type}-${index}`} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-slate-500 dark:text-mist-muted">
                {new Date(event.date).toLocaleDateString("en-KE", { year: "numeric", month: "short", day: "numeric" })}
                {" — "}
                <span className={event.type === "acquisition" ? "font-medium text-slate-700 dark:text-mist" : "text-slate-600 dark:text-mist-muted"}>{event.label}</span>
              </span>
              {event.amount != null && <span className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-mist">{KES(event.amount)}</span>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}