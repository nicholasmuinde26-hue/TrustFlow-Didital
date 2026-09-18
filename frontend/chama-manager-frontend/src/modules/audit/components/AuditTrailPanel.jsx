import { useState } from "react";
import { ShieldCheck, ChevronLeft, ChevronRight, FileText, Loader2, AlertCircle } from "lucide-react";

import { useAuditLog } from "../hooks/useAuditLog";

const humanizeAction = (action) => {
  if (!action) return "Action";
  return String(action)
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

const humanizeResourceType = (type) => {
  if (!type) return "";
  // ResourceType is stored as a Mongoose model name (e.g. "ChamaLoan"),
  // so split on capital letters rather than underscores.
  return String(type).replace(/([a-z])([A-Z])/g, "$1 $2");
};

export default function AuditTrailPanel({ chamaId, canView }) {
  const [page, setPage] = useState(1);
  const [resourceType, setResourceType] = useState("");
  const limit = 20;

  const { data, isLoading, isError, isFetching } = useAuditLog(
    chamaId,
    { page, limit, resourceType: resourceType || undefined },
    canView
  );

  if (!canView) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-obsidian-border dark:bg-obsidian-card">
        <ShieldCheck className="mx-auto h-8 w-8 text-slate-400 mb-2" />
        <p className="font-bold text-slate-800 dark:text-mist text-sm">Restricted to the treasurer or auditor</p>
        <p className="text-xs text-slate-500 mt-1">
          The audit trail carries the group's full action history, so only the treasurer or an appointed auditor can view it.
        </p>
      </div>
    );
  }

  const logs = data?.logs || [];
  const pagination = data?.pagination || { total: 0, totalPages: 1 };
  const resourceTypes = Array.from(new Set(logs.map((l) => l.resourceType).filter(Boolean)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-mist">Audit trail</h3>
          <p className="text-xs text-slate-500 dark:text-mist-muted">
            Immutable record of member, financial and governance actions{pagination.total ? ` · ${pagination.total} total` : ""}.
          </p>
        </div>

        {resourceTypes.length > 0 && (
          <select
            value={resourceType}
            onChange={(e) => {
              setResourceType(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist"
          >
            <option value="">All resource types</option>
            {resourceTypes.map((rt) => (
              <option key={rt} value={rt}>
                {humanizeResourceType(rt)}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-white p-10 text-slate-500 dark:border-obsidian-border dark:bg-obsidian-card">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading audit trail…
        </div>
      ) : isError ? (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle size={16} /> Couldn't load the audit trail. Try again shortly.
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center dark:border-obsidian-border dark:bg-obsidian-card">
          <FileText className="mx-auto h-8 w-8 text-slate-400 mb-2" />
          <p className="font-bold text-slate-800 dark:text-mist text-sm">No audit entries yet</p>
          <p className="text-xs text-slate-500 mt-1">Actions taken in this chama will appear here as they happen.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-obsidian-border dark:bg-obsidian-card divide-y divide-slate-100 dark:divide-obsidian-border">
          {logs.map((log) => (
            <div key={log._id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-mist">{humanizeAction(log.action)}</p>
                  <p className="text-xs text-slate-500 dark:text-mist-muted">
                    {log.actorUserId?.name || (log.isSystemGenerated ? "System" : "Unknown actor")}
                    {log.resourceType ? ` · ${humanizeResourceType(log.resourceType)}` : ""}
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                {log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs font-bold text-slate-500">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isFetching}
            className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 disabled:opacity-40 dark:border-obsidian-border dark:bg-obsidian-card"
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages || isFetching}
            className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 disabled:opacity-40 dark:border-obsidian-border dark:bg-obsidian-card"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}