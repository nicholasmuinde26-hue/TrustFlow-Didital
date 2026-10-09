import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Clock, XCircle, CheckCircle2 } from "lucide-react";
import clsx from "clsx";
import { formatWhen, money, pct } from "../../utils/overview";
import { ProgressBar } from "./charts";

const PILL = {
  paid: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  Success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  partial: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  Pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  unpaid: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  Failed: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
};
const LABEL = { paid: "Paid", partial: "Partial", unpaid: "Unpaid" };
const BAR_TONE = { paid: "emerald", partial: "amber", unpaid: "rose" };

// Status tag: a small squared chip with a dot, the way banking apps mark settled / pending / failed.
export const Pill = ({ kind, children }) => (
  <span className={clsx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium", PILL[kind])}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
    {children ?? LABEL[kind] ?? kind}
  </span>
);

const TH = "px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-mist-muted";
const ROW = "transition-colors hover:bg-slate-50/70 dark:hover:bg-obsidian-raised/30";

// Every member's contribution position. Table where there is room, stacked
// rows where there isn't - same data, same order (largest balance first).
export function MemberPaymentsTable({ members, counts, initial = 6 }) {
  const [filter, setFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const rows = useMemo(() => {
    const list = members.filter((m) => filter === "all" || m.status === filter);
    return [...list].sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
  }, [members, filter]);
  const visible = showAll ? rows : rows.slice(0, initial);
  const chips = [["all", "All", members.length], ["unpaid", "Unpaid", counts.unpaid], ["partial", "Partial", counts.partial], ["paid", "Paid", counts.paid]];

  return (
    <div>
      <div className="mb-3 inline-flex max-w-full overflow-x-auto rounded-lg bg-slate-100 p-0.5 dark:bg-obsidian-raised" role="tablist" aria-label="Filter members by payment status">
        {chips.map(([key, label, n]) => (
          <button key={key} type="button" role="tab" aria-selected={filter === key} onClick={() => { setFilter(key); setShowAll(false); }}
            className={clsx("shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-violet-500 dark:focus-visible:outline-mint",
              filter === key ? "bg-white text-slate-900 shadow-xs dark:bg-obsidian-card dark:text-mist" : "text-slate-500 hover:text-slate-800 dark:text-mist-muted dark:hover:text-mist")}>
            {label} <span className="tabular-nums opacity-70">{n}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-500">No members in this view.</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto @xl:block">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-b border-slate-200 dark:border-obsidian-border">
                <tr><th className={TH}>Member</th><th className={clsx(TH, "text-right")}>Expected</th><th className={clsx(TH, "text-right")}>Paid</th><th className={clsx(TH, "text-right")}>Balance</th><th className={clsx(TH, "w-32")}>Progress</th><th className={TH}>Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-obsidian-border">
                {visible.map((m) => (
                  <tr key={m.id} className={ROW}>
                    <td className="max-w-[14rem] truncate px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-mist">{m.name}</td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-500 dark:text-mist-muted">{money(m.expected)}</td>
                    <td className="px-3 py-2.5 text-right text-xs font-medium tabular-nums text-slate-900 dark:text-mist">{money(m.paid)}</td>
                    <td className={clsx("px-3 py-2.5 text-right text-xs font-semibold tabular-nums", m.balance > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-300 dark:text-mist-muted/50")}>{m.balance > 0 ? money(m.balance) : "—"}</td>
                    <td className="px-3 py-2.5"><ProgressBar value={pct(m.paid, m.expected)} tone={BAR_TONE[m.status]} label={`${m.name} progress`} /></td>
                    <td className="px-3 py-2.5"><Pill kind={m.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-slate-100 @xl:hidden dark:divide-obsidian-border">
            {visible.map((m) => (
              <li key={m.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2"><p className="truncate text-xs font-semibold text-slate-900 dark:text-mist">{m.name}</p><Pill kind={m.status} /></div>
                <ProgressBar value={pct(m.paid, m.expected)} tone={BAR_TONE[m.status]} label={`${m.name} progress`} className="my-2" />
                <div className="flex justify-between text-xs tabular-nums text-slate-500 dark:text-mist-muted">
                  <span>{money(m.paid)} of {money(m.expected)}</span>
                  <span className={m.balance > 0 ? "font-semibold text-rose-600 dark:text-rose-400" : ""}>{m.balance > 0 ? `Owes ${money(m.balance)}` : "Settled"}</span>
                </div>
              </li>
            ))}
          </ul>
          {rows.length > initial && (
            <button type="button" onClick={() => setShowAll((s) => !s)} className="mt-3 w-full rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-violet-500 dark:border-obsidian-border dark:text-mist dark:hover:bg-obsidian-raised">
              {showAll ? "Show fewer" : `Show all ${rows.length} members`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

const STATUS_ICON = { Success: CheckCircle2, Pending: Clock, Failed: XCircle };
const Amount = ({ a }) => (
  <span className={clsx("inline-flex items-center gap-1 font-semibold tabular-nums", a.direction === "in" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-mist")}>
    {a.direction === "in" ? <ArrowDownLeft size={12} aria-label="In" /> : a.direction === "out" ? <ArrowUpRight size={12} aria-label="Out" /> : null}
    {money(a.amount)}
  </span>
);

// One activity list for the whole page: the chama's transactions for
// officials, the member's own payments for everyone else.
export function ActivityList({ items }) {
  return (
    <>
      <div className="hidden overflow-x-auto @xl:block">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="border-b border-slate-200 dark:border-obsidian-border">
            <tr><th className={TH}>Reference</th><th className={TH}>Type</th><th className={clsx(TH, "text-right")}>Amount</th><th className={TH}>Status</th><th className={clsx(TH, "text-right")}>When</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-obsidian-border">
            {items.map((a) => (
              <tr key={a.id} className={ROW}>
                <td className="max-w-[16rem] truncate px-3 py-2.5 font-mono text-xs text-slate-700 dark:text-mist">{a.title}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500 dark:text-mist-muted">{a.categoryLabel}</td>
                <td className="px-3 py-2.5 text-right text-xs"><Amount a={a} /></td>
                <td className="px-3 py-2.5"><Pill kind={a.status} /></td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs text-slate-500 dark:text-mist-muted">{formatWhen(a.at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-slate-100 @xl:hidden dark:divide-obsidian-border">
        {items.map((a) => {
          const Icon = STATUS_ICON[a.status];
          return (
            <li key={a.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", PILL[a.status])}><Icon size={15} aria-hidden="true" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs font-medium text-slate-900 dark:text-mist">{a.title}</p>
                <p className="mt-0.5 flex gap-2 text-xs text-slate-500 dark:text-mist-muted"><span className="truncate">{a.categoryLabel}</span><span className="shrink-0">{formatWhen(a.at)}</span></p>
              </div>
              <div className="text-right text-xs"><Amount a={a} /><p className="mt-1"><Pill kind={a.status} /></p></div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
