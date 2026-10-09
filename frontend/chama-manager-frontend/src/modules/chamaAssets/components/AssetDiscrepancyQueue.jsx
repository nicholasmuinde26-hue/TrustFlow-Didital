import React, { useCallback, useEffect, useRef, useState } from "react";
import { Flag } from "lucide-react";
import { useSocket } from "@/app/providers/SocketProvider";
import chamaAssetsApi from "../api/chamaAssets.api";

const KES = (value) => `KES ${Number(value || 0).toLocaleString("en-KE")}`;
const inputClass = "min-h-9 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist";
const actionClass = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-obsidian-border dark:text-mist dark:hover:bg-obsidian-raised";
const primaryClass = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50";
const dangerClass = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-rose-700 px-3 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-50";

const idOf = (value) => String(value?._id || value || "");
const fmtDate = (value) => new Date(value).toLocaleDateString("en-KE", { year: "numeric", month: "short", day: "numeric" });

const RESOLVED_LABEL = { confirmed: "Discrepancy confirmed", dismissed: "Reviewed — no issue found" };

// Members flag an income/expense entry they think is wrong; the flag goes to
// leadership through the same multi-signatory approval engine as any other
// risky action, so the person who raised it can never be the one who clears
// it, and neither can the person who recorded the entry. Members only ever
// see the flags they raised themselves; leadership sees them all.
export default function AssetDiscrepancyQueue({ chamaId, canReview = false, currentUserId, refreshKey = 0, onChanged, notify }) {
  const { socket } = useSocket();
  const [entries, setEntries] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [comments, setComments] = useState({});
  // The parent passes a fresh inline `notify` every render; keep it out of
  // load()'s dependencies so the queue doesn't refetch on every parent render.
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const load = useCallback(async () => {
    if (!chamaId) return;
    try {
      const { data } = await chamaAssetsApi.discrepancies(chamaId);
      setEntries(data?.data?.entries || []);
    } catch (err) {
      notifyRef.current?.(err.response?.data?.message || "Could not load flagged entries.", true);
    }
  }, [chamaId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => load();
    socket.on("chama_asset:discrepancy_flagged", refresh);
    socket.on("chama_asset:discrepancy_updated", refresh);
    return () => {
      socket.off("chama_asset:discrepancy_flagged", refresh);
      socket.off("chama_asset:discrepancy_updated", refresh);
    };
  }, [socket, load]);

  const decide = async (entry, decision) => {
    setBusyId(entry._id);
    try {
      await chamaAssetsApi.decideFlag(chamaId, idOf(entry.asset_id), entry._id, decision, comments[entry._id] || "");
      notify?.(decision === "approved" ? "Discrepancy confirmed." : "Flag dismissed.");
      setComments((current) => ({ ...current, [entry._id]: "" }));
      await load();
      onChanged?.();
    } catch (err) {
      notify?.(err.response?.data?.message || "Could not record your decision.", true);
    } finally {
      setBusyId(null);
    }
  };

  const open = entries.filter((entry) => entry.flag_status === "flagged");
  const resolved = entries.filter((entry) => entry.flag_status !== "flagged").slice(0, 5);
  if (open.length === 0 && resolved.length === 0) return null;

  return (
    <section aria-label="Flagged asset entries" className="rounded-md border border-amber-200 p-3 dark:border-amber-500/30">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-mist">
        <Flag size={14} /> {canReview ? "Entries flagged by members" : "Entries you flagged"}
        {open.length > 0 && <span className="text-xs font-normal text-amber-700 dark:text-amber-400">· {open.length} under review</span>}
      </h3>

      {open.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100 dark:divide-obsidian-border">
          {open.map((entry) => {
            const request = entry.flag_request_id || {};
            const raisedBy = request.initiated_by?.user_id?.name || "A member";
            const iRaised = idOf(request.initiated_by?.user_id) === String(currentUserId);
            const iRecorded = idOf(entry.performed_by) === String(currentUserId);
            const signed = (request.approvals || []).filter((a) => a.status === "approved").length;
            const iSigned = (request.approvals || []).some((a) => idOf(a.approver_id?.user_id) === String(currentUserId));
            return (
              <li key={entry._id} className="py-3 text-xs">
                <p className="font-semibold text-slate-800 dark:text-mist">
                  {entry.asset_id?.name || "Asset"} · {entry.type} of {KES(entry.amount)} · {fmtDate(entry.occurred_at)}
                </p>
                {entry.description && <p className="mt-0.5 text-slate-500 dark:text-mist-muted">Entry: {entry.description}</p>}
                <p className="mt-1 text-slate-700 dark:text-mist">
                  {iRaised ? "You" : raisedBy} flagged this: <span className="italic">“{request.description || "No reason given"}”</span>
                </p>
                {canReview && request.required_approvals > 1 && (
                  <p className="mt-0.5 text-slate-500 dark:text-mist-muted">{signed} of {request.required_approvals} leaders have confirmed</p>
                )}
                {canReview && (
                  iRaised ? (
                    <p className="mt-1 text-slate-500 dark:text-mist-muted">You raised this flag, so another leader needs to review it.</p>
                  ) : iRecorded ? (
                    <p className="mt-1 text-slate-500 dark:text-mist-muted">You recorded this entry, so another leader needs to review the flag against it.</p>
                  ) : iSigned ? (
                    <p className="mt-1 text-slate-500 dark:text-mist-muted">You've recorded your decision — waiting on the other signatories.</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input aria-label="Review comment" className={`${inputClass} min-h-8 min-w-48 flex-1 py-1`} placeholder="Comment (optional)" value={comments[entry._id] || ""} onChange={(event) => setComments((current) => ({ ...current, [entry._id]: event.target.value }))} />
                      <button type="button" className={dangerClass} disabled={busyId === entry._id} onClick={() => decide(entry, "approved")}>Confirm discrepancy</button>
                      <button type="button" className={actionClass} disabled={busyId === entry._id} onClick={() => decide(entry, "rejected")}>Dismiss</button>
                    </div>
                  )
                )}
                {!canReview && <p className="mt-1 text-slate-500 dark:text-mist-muted">With leadership for review.</p>}
              </li>
            );
          })}
        </ul>
      )}

      {resolved.length > 0 && (
        <div className={open.length > 0 ? "mt-3 border-t border-slate-100 pt-2 dark:border-obsidian-border" : "mt-2"}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-mist-muted">Recently reviewed</p>
          <ul className="mt-1 space-y-1">
            {resolved.map((entry) => (
              <li key={entry._id} className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-slate-600 dark:text-mist-muted">
                <span>{entry.asset_id?.name || "Asset"} · {entry.type} of {KES(entry.amount)} · {fmtDate(entry.occurred_at)}</span>
                <span className={entry.flag_status === "confirmed" ? "font-semibold text-rose-700 dark:text-rose-300" : ""}>{RESOLVED_LABEL[entry.flag_status]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
