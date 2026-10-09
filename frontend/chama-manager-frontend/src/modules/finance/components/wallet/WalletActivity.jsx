import React, { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Clock, History, XCircle } from "lucide-react";

import { Card, EmptyState, SectionHeading } from "../FinanceUi";
import Sheet from "./Sheet";
import { STATUS_LABEL, describeEntry, fullDateTime, groupByDay, kes, maskPhone, timeLabel } from "./walletFormat";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "in", label: "Money in" },
  { id: "out", label: "Money out" },
];

function EntryIcon({ direction, status }) {
  if (status === "failed") return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-950/30"><XCircle size={18} /></span>;
  if (status === "pending") return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/30"><Clock size={18} /></span>;
  return direction === "in"
    ? <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30"><ArrowDownLeft size={18} /></span>
    : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-obsidian-raised"><ArrowUpRight size={18} /></span>;
}

export default function WalletActivity({ entries = [] }) {
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const groups = useMemo(() => {
    const filtered = entries.filter((entry) => filter === "all" || describeEntry(entry).direction === filter);
    return groupByDay(filtered);
  }, [entries, filter]);

  return (
    <Card className="p-5">
      <SectionHeading title="Transactions" subtitle="Everything that moved in or out of your wallet" />
      <div className="mb-4 flex gap-2">
        {FILTERS.map((item) => (
          <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${filter === item.id ? "bg-slate-900 text-white dark:bg-emerald-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-obsidian-raised dark:text-mist-muted"}`}>
            {item.label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={History} title="No transactions yet" description="Add money or receive a chama disbursement and it will show up here." />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-1 text-[11px] font-black uppercase tracking-widest text-slate-400">{group.label}</p>
              <div className="divide-y divide-slate-100 dark:divide-obsidian-border">
                {group.items.map((entry) => {
                  const meta = describeEntry(entry);
                  const failed = entry.status === "failed";
                  return (
                    <button key={entry._id} type="button" onClick={() => setSelected(entry)} className="flex w-full items-center gap-3 py-3 text-left transition hover:opacity-80">
                      <EntryIcon direction={meta.direction} status={entry.status} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-900 dark:text-mist">{meta.title}</span>
                        <span className="block text-[11px] text-slate-400">
                          {timeLabel(entry.createdAt)}
                          {entry.status !== "completed" ? ` · ${STATUS_LABEL[entry.status] || entry.status}` : ""}
                        </span>
                      </span>
                      <span className={`text-sm font-black tabular-nums ${failed ? "text-slate-400 line-through" : meta.direction === "in" ? "text-emerald-700 dark:text-mint" : "text-slate-800 dark:text-mist"}`}>
                        {meta.direction === "in" ? "+" : "−"}{kes(entry.amount)}
                      </span>
                      <ChevronRight size={14} className="text-slate-300" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && <EntryDetail entry={selected} onClose={() => setSelected(null)} />}
    </Card>
  );
}

function EntryDetail({ entry, onClose }) {
  const meta = describeEntry(entry);
  const rows = [
    ["Status", STATUS_LABEL[entry.status] || entry.status],
    ["Date", fullDateTime(entry.createdAt)],
    entry.completed_at ? ["Completed", fullDateTime(entry.completed_at)] : null,
    entry.phone_number ? ["M-Pesa number", maskPhone(entry.phone_number)] : null,
    entry.external_reference ? ["Reference", entry.external_reference] : null,
    entry.status === "failed" && entry.failure_reason ? ["Reason", entry.failure_reason] : null,
  ].filter(Boolean);

  return (
    <Sheet title="Transaction details" onClose={onClose}>
      <div className="mb-5 flex flex-col items-center gap-2 text-center">
        <EntryIcon direction={meta.direction} status={entry.status} />
        <p className="text-sm font-bold text-slate-700 dark:text-mist">{meta.title}</p>
        <p className="text-3xl font-black tabular-nums text-slate-900 dark:text-mist">{meta.direction === "in" ? "+" : "−"}{kes(entry.amount)}</p>
        <p className="text-xs text-slate-400">{meta.subtitle}</p>
      </div>
      <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-100 dark:divide-obsidian-border dark:border-obsidian-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 px-4 py-3 text-xs">
            <dt className="font-semibold text-slate-400">{label}</dt>
            <dd className="text-right font-bold text-slate-800 dark:text-mist">{value}</dd>
          </div>
        ))}
      </dl>
    </Sheet>
  );
}
