import React, { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Activity,
  CheckCircle2,
  Bell,
  TrendingUp,
  Receipt,
  ShieldCheck,
  UserPlus,
  Filter,
} from "lucide-react";

import { useContributionGroupAuditLogs } from "../hooks/useContributionGroupData";

export default function ActivityPage() {
  const { workspaceId } = useParams();
  const [filterType, setFilterType] = useState("all");

  const { data: logs = [], isLoading } = useContributionGroupAuditLogs(workspaceId);

  // Map real backend audit logs. No fabricated fallback feed — when
  // there are no logs yet, the empty state below says so honestly
  // instead of inventing "Mercy Wambui paid KES 5,000" etc.
  const auditEvents = logs.map((log) => {
    const actorName = log.actorUserId ? `${log.actorUserId.first_name || ''} ${log.actorUserId.last_name || ''}`.trim() || log.actorUserId.email : "System";
    const act = (log.action || "").toLowerCase();
    let type = "contribution";
    let icon = CheckCircle2;
    let color = "emerald";

    if (act.includes("member") || act.includes("invite")) {
      type = "member";
      icon = UserPlus;
      color = "blue";
    } else if (act.includes("payout") || act.includes("withdraw")) {
      type = "payout";
      icon = TrendingUp;
      color = "indigo";
    } else if (act.includes("expense") || act.includes("payment")) {
      type = "expense";
      icon = Receipt;
      color = "rose";
    } else if (act.includes("reminder") || act.includes("notice")) {
      type = "reminder";
      icon = Bell;
      color = "amber";
    }

    return {
      id: String(log._id),
      timestamp: new Date(log.createdAt).toLocaleString(),
      title: `${actorName} - ${log.action}`,
      details: log.metadata ? JSON.stringify(log.metadata) : `Resource: ${log.resourceType || "ContributionGroup"} (${log.resourceId || log._id})`,
      type,
      icon,
      color,
    };
  });

  const filteredEvents = auditEvents.filter((ev) =>

    filterType === "all" ? true : ev.type === filterType
  );

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
            IMMUTABLE AUDIT TRAIL
          </span>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            Group Audit Trail & Activity Logs
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Accountability first. Zero deleted logs, 100% transparent audit history.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300 shrink-0">
          <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
          <span>Accountability First • Immutable Ledger</span>
        </div>
      </div>

      {/* Filter Options */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: "all", label: "All Logs" },
          { id: "contribution", label: "Contributions" },
          { id: "payout", label: "Payouts" },
          { id: "expense", label: "Expenses" },
          { id: "reminder", label: "Reminders" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap ${
              filterType === tab.id
                ? "bg-violet-700 text-white shadow"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Audit Stream Timeline */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
        {isLoading ? (
          <p className="text-center text-xs font-medium text-slate-400 py-6">Loading activity…</p>
        ) : filteredEvents.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 p-8 text-center text-slate-500 dark:bg-slate-800/40">
            <p className="text-xs font-medium">
              {logs.length === 0
                ? "No activity logged for this group yet."
                : "No activity matches this filter."}
            </p>
          </div>
        ) : (
        <div className="relative border-l-2 border-slate-100 dark:border-slate-800 ml-4 space-y-6 pl-6">
          {filteredEvents.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="relative group">
                {/* Timeline Dot */}
                <div
                  className={`absolute -left-[37px] top-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-md border dark:bg-slate-900 ${
                    item.color === "emerald"
                      ? "border-emerald-300 text-emerald-600"
                      : item.color === "amber"
                      ? "border-amber-300 text-amber-600"
                      : item.color === "indigo"
                      ? "border-indigo-300 text-indigo-600"
                      : item.color === "rose"
                      ? "border-rose-300 text-rose-600"
                      : "border-blue-300 text-blue-600"
                  }`}
                >
                  <Icon size={16} />
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <p className="text-xs font-black text-slate-900 dark:text-white">{item.title}</p>
                    <span className="text-[11px] font-mono text-slate-400">{item.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">{item.details}</p>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}