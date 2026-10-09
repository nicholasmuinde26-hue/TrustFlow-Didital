import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Info, XCircle } from "lucide-react";

import Spinner from "@/shared/components/ui/Spinner";
import { useModuleCatalog } from "@/modules/workspaces/hooks/useWorkspaceModules";
import AdminWorkspaceFeatureManager from "./AdminWorkspaceFeatureManager";
import adminService from "../services/admin.service";

/**
 * Admin console -> Workspace Requests -> "Feature changes".
 *
 * A chama's chairperson or treasurer can request a feature change. Only a
 * platform admin can decide it here. Approving applies the change at once;
 * the server blocks removal while a module still has active records.
 */

const STATUS_STYLE = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  cancelled: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export default function AdminModuleChangesPanel({ onChanged }) {
  const { data: catalog } = useModuleCatalog();
  const [status, setStatus] = useState("pending");
  const [view, setView] = useState("requests");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [notes, setNotes] = useState({});
  const [alert, setAlert] = useState({ text: "", type: "" });

  const labelOf = useMemo(() => {
    const index = Object.fromEntries((catalog?.modules || []).map((m) => [m.key, m.label]));
    return (key) => index[key] || key;
  }, [catalog]);

  async function load() {
    setLoading(true);
    try {
      setItems(await adminService.getModuleChangeRequests(status));
    } catch (err) {
      setAlert({ text: err?.response?.data?.message || "Couldn't load feature change requests.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function decide(item, decision) {
    setBusyId(item.id);
    setAlert({ text: "", type: "" });
    try {
      await adminService.decideModuleChange(item.id, decision, notes[item.id] || "");
      setAlert({
        text:
          decision === "approved"
            ? `Approved. ${item.chama.name} now has the new feature set.`
            : `Rejected. ${item.chama.name} keeps its current features.`,
        type: "success",
      });
      await load();
      onChanged?.();
    } catch (err) {
      setAlert({ text: err?.response?.data?.message || "Couldn't record the decision.", type: "error" });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Feature Change Requests</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Review Chama feature requests or directly configure any existing workspace.
          </p>
        </div>

        {view === "requests" && <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          {["pending", "approved", "rejected", "all"].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition ${
                status === s
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>}
      </div>

      <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900" role="tablist" aria-label="Workspace feature administration">
        {[["requests", "Feature requests"], ["manage", "Manage workspaces"]].map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => setView(key)} className={`rounded-xl px-3 py-2 text-xs font-bold transition ${view === key ? "bg-slate-900 text-white dark:bg-violet-600" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}>
            {label}
          </button>
        ))}
      </div>

      {view === "manage" ? <AdminWorkspaceFeatureManager onChanged={onChanged} /> : <>

      {alert.text && (
        <div
          role="status"
          className={`rounded-2xl border p-4 text-xs font-semibold ${
            alert.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300"
          }`}
        >
          {alert.text}
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Clock className="mx-auto mb-3 text-slate-400" size={32} />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            No {status !== "all" ? status : ""} feature change requests
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            When a chairperson or treasurer asks to switch a feature on or off, it appears here.
          </p>
        </div>
      ) : (
        items.map((item) => {
          const isPending = item.status === "pending";
          const blockedKeys = Object.keys(item.blocked_now || {}).filter((k) => item.disable.includes(k));
          return (
            <div
              key={item.id}
              className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-black text-slate-900 dark:text-white">{item.chama.name}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">{item.chama.chama_type === "burial" ? "Burial & welfare" : "Standard"}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    STATUS_STYLE[item.status] || STATUS_STYLE.cancelled
                  }`}
                >
                  {item.status}
                </span>
                {item.decided_by_admin && (
                  <span className="text-[11px] font-semibold text-slate-400">decided by platform admin</span>
                )}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Requested by{" "}
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {item.requested_by?.name || "Unknown"}
                </span>
                {item.requested_by?.role && <span className="capitalize"> ({item.requested_by.role})</span>}
                {item.requested_by?.phone && <> · {item.requested_by.phone}</>}
                {" · "}
                {new Date(item.created_at).toLocaleDateString()}
                {isPending && " · Awaiting platform admin decision"}
              </p>

              <div className="grid gap-3 text-xs sm:grid-cols-2">
                <div className="rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-950/30">
                  <p className="font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Switch on</p>
                  <p className="mt-1 text-slate-700 dark:text-slate-300">
                    {item.enable.length ? item.enable.map(labelOf).join(", ") : "Nothing"}
                  </p>
                </div>
                <div className="rounded-2xl bg-rose-50 p-3 dark:bg-rose-950/30">
                  <p className="font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">Switch off</p>
                  <p className="mt-1 text-slate-700 dark:text-slate-300">
                    {item.disable.length ? item.disable.map(labelOf).join(", ") : "Nothing"}
                  </p>
                </div>
              </div>

              {item.note && (
                <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
                  <span className="font-bold">Reason given: </span>
                  {item.note}
                </p>
              )}

              {item.cancel_reason && (
                <p className="rounded-xl bg-red-50 p-3 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-300">
                  {item.cancel_reason}
                </p>
              )}

              {isPending && blockedKeys.length > 0 && (
                <div className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  <Info size={14} className="mt-0.5 shrink-0" />
                  <div>
                    <p>This can&apos;t be approved right now:</p>
                    <ul className="mt-1 list-disc pl-4 font-medium">
                      {blockedKeys.map((k) => (
                        <li key={k}>{item.blocked_now[k].reason}</li>
                      ))}
                    </ul>
                    <p className="mt-1 font-medium">Reject it, or wait until the chama has settled this.</p>
                  </div>
                </div>
              )}

              {isPending && (
                <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="Note to the chama (optional)"
                    maxLength={300}
                    value={notes[item.id] || ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [item.id]: e.target.value }))}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => decide(item, "rejected")}
                      disabled={busyId === item.id}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                    >
                      <XCircle size={16} /> Reject
                    </button>
                    <button
                      onClick={() => decide(item, "approved")}
                      disabled={busyId === item.id || blockedKeys.length > 0}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle2 size={16} /> Approve &amp; apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
      </>}
    </div>
  );
}
