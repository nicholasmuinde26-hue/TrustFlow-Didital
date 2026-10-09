import React, { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, History, ShieldCheck } from "lucide-react";
import { useSocket } from "@/app/providers/SocketProvider";
import { Stat, StatStrip } from "@/modules/chama/components/overview/primitives";
import chamaAssetsApi from "../api/chamaAssets.api";

const KES = (value) => `KES ${Number(value || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
const inputClass = "min-h-9 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist";
const actionClass = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-obsidian-border dark:text-mist dark:hover:bg-obsidian-raised";
const primaryClass = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50";

const OPERATIONAL_OPTIONS = [
  ["idle", "Idle"],
  ["leased_out", "Leased out"],
  ["occupied", "Occupied"],
  ["under_maintenance", "Under maintenance"],
  ["for_sale", "For sale"],
];
const CONDITION_LABEL = { 1: "Poor", 2: "Fair", 3: "Adequate", 4: "Good", 5: "Excellent" };
const MAINTENANCE_LABEL = { none: "No maintenance needed", minor: "Minor maintenance", urgent: "Urgent maintenance" };

const fmtDate = (value) => new Date(value).toLocaleDateString("en-KE", { year: "numeric", month: "short", day: "numeric" });
const idOf = (value) => String(value?._id || value || "");

// One row per period, one status vocabulary — so "October" reads the same
// as "November", and the same as what a different caretaker filed months ago.
function describeStatus(report, now = new Date()) {
  const ended = now >= new Date(report.period.period_end);
  switch (report.status) {
    case "acknowledged":
      return { label: report.submission?.was_late ? "Acknowledged (filed late)" : "Acknowledged", tone: "text-emerald-700 dark:text-emerald-400" };
    case "submitted":
      return report.submission?.was_late
        ? { label: "Submitted late", tone: "text-amber-700 dark:text-amber-400" }
        : { label: "Submitted on time", tone: "text-emerald-700 dark:text-emerald-400" };
    case "late":
      return { label: "Overdue", tone: "text-rose-700 dark:text-rose-300" };
    case "missed":
      return { label: "Missed", tone: "text-rose-700 dark:text-rose-300" };
    default:
      return ended
        ? { label: `Due by ${fmtDate(report.period.due_date)}`, tone: "text-slate-600 dark:text-mist" }
        : { label: `Opens ${fmtDate(report.period.period_end)}`, tone: "text-slate-500 dark:text-mist-muted" };
  }
}

function managerNameOf(report) {
  const snap = report.manager_snapshot || {};
  if (snap.manager_type === "member") return snap.manager_id?.name || "Member";
  if (snap.manager_type === "external") return snap.external_name || "External caretaker";
  return "No manager assigned";
}

// The person's record across every asset they've looked after in this chama
// — built from each period's own snapshot, so it survives a rotation.
function TrackRecord({ chamaId, userId, name }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError("");
    chamaAssetsApi.managerPerformance(chamaId, userId)
      .then(({ data: res }) => { if (!cancelled) setData(res?.data || null); })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.message || "Could not load this track record."); });
    return () => { cancelled = true; };
  }, [chamaId, userId]);

  if (error) return <p role="alert" className="mt-2 text-xs text-rose-700 dark:text-rose-300">{error}</p>;
  if (!data) return <p className="mt-2 text-xs text-slate-500 dark:text-mist-muted">Loading track record…</p>;
  if (!data.summary) return <p className="mt-2 text-xs text-slate-500 dark:text-mist-muted">{name || "This member"} hasn't managed an asset for this chama yet.</p>;

  const { summary, tenures } = data;
  return (
    <div className="mt-2">
      <StatStrip>
        <Stat
          label="Reports on time"
          value={summary.onTimeRatePct != null ? `${summary.onTimeRatePct}%` : "—"}
          sub={summary.totalDue > 0 ? `${summary.onTime} of ${summary.totalDue} due · ${summary.late} late · ${summary.missed} missed` : "Nothing due yet"}
          tone={summary.onTimeRatePct != null && summary.onTimeRatePct < 70 ? "text-amber-700 dark:text-amber-400" : undefined}
        />
        <Stat label="Average condition" value={summary.avgConditionRating != null ? `${summary.avgConditionRating} / 5` : "—"} sub="As reported by the manager" />
        <Stat label="Urgent maintenance flags" value={String(summary.urgentFlags)} sub="Across reports filed" />
        <Stat
          label="Confirmed discrepancies"
          value={String(summary.confirmedDiscrepancies)}
          sub="Flagged by members, confirmed by leadership"
          tone={summary.confirmedDiscrepancies > 0 ? "text-rose-700 dark:text-rose-300" : undefined}
        />
      </StatStrip>
      {tenures.length > 0 && (
        <ul className="mt-2 space-y-1">
          {tenures.map((tenure) => (
            <li key={String(tenure.assetId)} className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-mist-muted">
              <span>
                {tenure.assetName}
                {tenure.start ? ` · ${fmtDate(tenure.start)} – ${tenure.current ? "present" : tenure.end ? fmtDate(tenure.end) : "ended"}` : ""}
              </span>
              <span>
                {tenure.due > 0 ? `${tenure.onTime}/${tenure.due} on time` : "No reports due"}
                {tenure.avgConditionRating != null ? ` · ${tenure.avgConditionRating}/5 condition` : ""}
                {tenure.confirmedDiscrepancies > 0 ? ` · ${tenure.confirmedDiscrepancies} confirmed discrepanc${tenure.confirmedDiscrepancies === 1 ? "y" : "ies"}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const emptyForm = { operational_status: "", income_collected: "", expenses_incurred: "", condition_rating: "", maintenance_flag: "none", note: "" };

function ReportForm({ report, onBehalfOf, busy, onSubmit }) {
  const [form, setForm] = useState(emptyForm);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <form
      className="mt-2 space-y-3 rounded-md bg-slate-50 p-3 dark:bg-obsidian-raised"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          operational_status: form.operational_status,
          income_collected: Number(form.income_collected || 0),
          expenses_incurred: Number(form.expenses_incurred || 0),
          condition_rating: Number(form.condition_rating),
          maintenance_flag: form.maintenance_flag,
          note: form.note.trim(),
        });
      }}
    >
      <p className="text-xs text-slate-600 dark:text-mist-muted">
        {onBehalfOf
          ? `Filing the ${report.period.label} report on behalf of ${onBehalfOf}. It will be marked as filed by you.`
          : `Your account of ${report.period.label}. Keep it to the facts — members can compare it with what's posted to the books.`}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-1 text-xs text-slate-500 dark:text-mist-muted">Asset status right now
          <select className={inputClass} value={form.operational_status} onChange={set("operational_status")} required>
            <option value="" disabled>Choose…</option>
            {OPERATIONAL_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-slate-500 dark:text-mist-muted">Income collected (KES)
          <input className={inputClass} type="number" min="0" step="0.01" value={form.income_collected} onChange={set("income_collected")} placeholder="0" required />
        </label>
        <label className="grid gap-1 text-xs text-slate-500 dark:text-mist-muted">Expenses incurred (KES)
          <input className={inputClass} type="number" min="0" step="0.01" value={form.expenses_incurred} onChange={set("expenses_incurred")} placeholder="0" required />
        </label>
        <label className="grid gap-1 text-xs text-slate-500 dark:text-mist-muted">Condition
          <select className={inputClass} value={form.condition_rating} onChange={set("condition_rating")} required>
            <option value="" disabled>Rate 1–5…</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} — {CONDITION_LABEL[n]}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-slate-500 dark:text-mist-muted">Maintenance
          <select className={inputClass} value={form.maintenance_flag} onChange={set("maintenance_flag")}>
            {Object.entries(MAINTENANCE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <label className="grid gap-1 text-xs text-slate-500 dark:text-mist-muted">
        Short note (optional)
        <input className={inputClass} maxLength={300} value={form.note} onChange={set("note")} placeholder="Anything members should know — kept short on purpose" />
        <span className="text-right text-[11px] text-slate-400">{form.note.length}/300</span>
      </label>
      <div className="flex justify-end">
        <button className={primaryClass} type="submit" disabled={busy}><ClipboardCheck size={14} /> Submit report</button>
      </div>
    </form>
  );
}

// Structured, comparable-over-time reporting from the asset's caretaker —
// who isn't necessarily a chama officer. Every member can read it; only the
// manager responsible for a period (or leadership, for an external caretaker
// with no account) can file it; leadership acknowledges it.
export default function AssetManagerReportsSection({ chamaId, assetId, currentUserId, isLeader = false, canConfigure = false, notify }) {
  const { socket } = useSocket();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [trackFor, setTrackFor] = useState(null); // { userId, name } — overrides the current manager
  const [ackFor, setAckFor] = useState(null);
  const [ackComment, setAckComment] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await chamaAssetsApi.reports(chamaId, assetId);
      setOverview(data?.data || null);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Could not load manager reports.");
    }
  }, [chamaId, assetId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = (payload) => {
      if (payload?.assetId && String(payload.assetId) !== String(assetId)) return;
      load();
    };
    const events = ["chama_asset:report_period_opened", "chama_asset:manager_report_submitted", "chama_asset:manager_report_acknowledged", "chama_asset:updated", "chama_asset:discrepancy_updated"];
    events.forEach((event) => socket.on(event, refresh));
    return () => events.forEach((event) => socket.off(event, refresh));
  }, [socket, assetId, load]);

  const act = (action, message) => {
    setBusy(true);
    return action()
      .then(async () => { await load(); if (message) notify?.(message); return true; })
      .catch((err) => { notify?.(err.response?.data?.message || "That didn't go through.", true); return false; })
      .finally(() => setBusy(false));
  };

  if (error) return <p role="alert" className="mt-3 text-xs text-rose-700 dark:text-rose-300">{error}</p>;
  if (!overview) return null;

  const { reports, reporting, manager } = overview;

  // Nothing to show members until a manager has been assigned and reporting is on.
  if (!reporting.enabled && reports.length === 0) {
    if (!canConfigure) return null;
    return (
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-obsidian-border dark:text-mist-muted">
        <span>Periodic manager reports are off for this asset{manager.type === "unassigned" ? " (no manager assigned)" : ""}.</span>
        <button type="button" className={actionClass} disabled={busy} onClick={() => act(() => chamaAssetsApi.setReporting(chamaId, assetId, { enabled: true }), "Manager reports switched on.")}>Turn on reports</button>
      </div>
    );
  }

  const now = new Date();
  const openReport = reports.find((r) => ["pending", "late"].includes(r.status) && !r.submission?.submitted_at && now >= new Date(r.period.period_end));
  const waitingReport = reports.find((r) => r.status === "pending" && now < new Date(r.period.period_end));
  const isPeriodManager = (report) => report.manager_snapshot?.manager_type === "member" && idOf(report.manager_snapshot.manager_id) === String(currentUserId);

  const tracked = trackFor || (manager.userId ? { userId: manager.userId, name: manager.name } : null);

  return (
    <div className="mt-4 border-t border-slate-100 pt-3 dark:border-obsidian-border">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-mist-muted">
          <ClipboardCheck size={13} /> Manager reports
          <span className="normal-case font-normal text-slate-400 dark:text-mist-muted">
            · {manager.type === "unassigned" ? "no manager assigned" : `${manager.name}${manager.type === "external" ? " (external caretaker)" : ""}`}
          </span>
        </h4>
        {canConfigure && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-mist-muted">
              Cadence
              <select className={`${inputClass} min-h-8 py-1`} value={reporting.cadence} disabled={busy} onChange={(event) => act(() => chamaAssetsApi.setReporting(chamaId, assetId, { cadence: event.target.value }), "Reporting cadence updated for upcoming periods.")}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </label>
            <button type="button" className={actionClass} disabled={busy} onClick={() => act(() => chamaAssetsApi.setReporting(chamaId, assetId, { enabled: !reporting.enabled }), reporting.enabled ? "Manager reports switched off." : "Manager reports switched on.")}>
              {reporting.enabled ? "Turn off" : "Turn on"}
            </button>
          </div>
        )}
      </div>

      {tracked && (
        <div className="mt-2">
          <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-mist-muted">
            <ShieldCheck size={13} /> Track record — {tracked.name}
            {trackFor && <button type="button" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400" onClick={() => setTrackFor(null)}>Back to current manager</button>}
          </p>
          <TrackRecord chamaId={chamaId} userId={tracked.userId} name={tracked.name} />
        </div>
      )}
      {!tracked && manager.type === "external" && (
        <p className="mt-2 text-xs text-slate-500 dark:text-mist-muted">External caretakers have no account, so their record is the list of periods below. Leadership files their reports on their behalf.</p>
      )}

      {openReport && (
        <div className="mt-3 rounded-md border border-amber-200 p-3 dark:border-amber-500/30">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-mist">{openReport.period.label} report</p>
            <p className={`text-xs font-semibold ${describeStatus(openReport, now).tone}`}>{describeStatus(openReport, now).label}</p>
          </div>
          {isPeriodManager(openReport) || isLeader ? (
            <ReportForm
              report={openReport}
              busy={busy}
              onBehalfOf={isPeriodManager(openReport) ? null : managerNameOf(openReport)}
              onSubmit={(payload) => act(() => chamaAssetsApi.submitReport(chamaId, assetId, openReport._id, payload), "Report submitted.")}
            />
          ) : (
            <p className="mt-1 text-xs text-slate-500 dark:text-mist-muted">Waiting on {managerNameOf(openReport)} to file this report.</p>
          )}
        </div>
      )}
      {!openReport && waitingReport && (
        <p className="mt-3 text-xs text-slate-500 dark:text-mist-muted">Next report ({waitingReport.period.label}) can be filed from {fmtDate(waitingReport.period.period_end)}.</p>
      )}

      {reports.filter((r) => r._id !== openReport?._id && r._id !== waitingReport?._id).length > 0 && (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-mist-muted"><History size={13} /> Report history</p>
          <ul className="mt-1 divide-y divide-slate-100 dark:divide-obsidian-border">
            {reports.filter((r) => r._id !== openReport?._id && r._id !== waitingReport?._id).map((report) => {
              const status = describeStatus(report, now);
              const sub = report.submission;
              const snap = report.manager_snapshot || {};
              const filed = Boolean(sub?.submitted_at);
              const mismatch = filed && report.booked
                ? { income: Number(sub.income_collected || 0) - report.booked.income, expenses: Number(sub.expenses_incurred || 0) - report.booked.expenses }
                : null;
              const hasMismatch = mismatch && (Math.abs(mismatch.income) > 0.5 || Math.abs(mismatch.expenses) > 0.5);
              return (
                <li key={report._id} className="py-2 text-xs">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-slate-800 dark:text-mist">
                      {report.period.label}
                      <span className="font-normal text-slate-500 dark:text-mist-muted"> · {managerNameOf(report)}</span>
                    </span>
                    <span className={`font-semibold ${status.tone}`}>{status.label}</span>
                  </div>
                  {filed && (
                    <div className="mt-1 space-y-0.5 text-slate-600 dark:text-mist-muted">
                      <p>
                        Reported: {KES(sub.income_collected)} income · {KES(sub.expenses_incurred)} expenses · condition {sub.condition_rating}/5 ({CONDITION_LABEL[sub.condition_rating]}) · {String(sub.operational_status).replaceAll("_", " ")}
                        {sub.maintenance_flag !== "none" && <span className={sub.maintenance_flag === "urgent" ? " font-semibold text-rose-700 dark:text-rose-300" : " text-amber-700 dark:text-amber-400"}> · {MAINTENANCE_LABEL[sub.maintenance_flag].toLowerCase()}</span>}
                      </p>
                      {report.booked && (
                        <p className={hasMismatch ? "font-medium text-amber-700 dark:text-amber-400" : ""}>
                          Books show: {KES(report.booked.income)} income · {KES(report.booked.expenses)} expenses
                          {hasMismatch ? " — doesn't match the report. Flag any entry in the statement that looks wrong." : ""}
                        </p>
                      )}
                      {sub.note && <p className="italic">“{sub.note}”</p>}
                      {sub.submitted_on_behalf && <p>Filed on their behalf by {sub.submitted_by?.name || "a leader"}.</p>}
                      {report.acknowledgement?.acknowledged_at && <p>Acknowledged by {report.acknowledgement.acknowledged_by?.name || "a leader"} on {fmtDate(report.acknowledgement.acknowledged_at)}{report.acknowledgement.comment ? ` — ${report.acknowledgement.comment}` : ""}</p>}
                    </div>
                  )}
                  <div className="mt-1 flex flex-wrap gap-2">
                    {snap.manager_type === "member" && snap.manager_id && idOf(snap.manager_id) !== manager.userId && (
                      <button type="button" className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400" onClick={() => setTrackFor({ userId: idOf(snap.manager_id), name: snap.manager_id?.name || "Member" })}>View {snap.manager_id?.name || "their"} track record</button>
                    )}
                    {isLeader && report.status === "submitted" && idOf(sub?.submitted_by) !== String(currentUserId) && (
                      ackFor === report._id ? (
                        <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); act(() => chamaAssetsApi.acknowledgeReport(chamaId, assetId, report._id, ackComment), "Report acknowledged.").then((ok) => { if (ok) { setAckFor(null); setAckComment(""); } }); }}>
                          <input aria-label="Acknowledgement comment" className={`${inputClass} min-h-8 py-1`} maxLength={300} placeholder="Comment (optional)" value={ackComment} onChange={(event) => setAckComment(event.target.value)} />
                          <button className={primaryClass} type="submit" disabled={busy}>Acknowledge</button>
                          <button className={actionClass} type="button" onClick={() => setAckFor(null)}>Cancel</button>
                        </form>
                      ) : (
                        <button type="button" className={actionClass} onClick={() => { setAckFor(report._id); setAckComment(""); }}>Acknowledge</button>
                      )
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
