import { Users, CalendarClock, HandCoins } from "lucide-react";
import {
  purposeOf,
  statusOf,
  getCollected,
  getTarget,
  getPct,
  deadlineLabel,
  beneficiaryName,
  money,
  compactMoney,
} from "./helpers";

export function StatusPill({ status }) {
  const s = statusOf(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function ProgressBar({ pct, tone = "bg-emerald-500" }) {
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-obsidian-raised"
      role="progressbar"
      aria-valuenow={pct ?? 0}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`h-full rounded-full transition-[width] duration-500 ${tone}`} style={{ width: `${pct ?? 0}%` }} />
    </div>
  );
}

export default function ContributionCard({ contribution: c, nextStep, onOpen, onQuickAction }) {
  const purpose = purposeOf(c.purpose);
  const Icon = purpose.icon;
  const collected = getCollected(c);
  const target = getTarget(c);
  const pct = getPct(c);
  const deadline = deadlineLabel(c);
  const forName = beneficiaryName(c);
  const live = c.status === "active";

  return (
    <article
      onClick={() => onOpen(c)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(c))}
      tabIndex={0}
      role="button"
      aria-label={`Open ${c.title}`}
      className="group flex cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-obsidian-border dark:bg-obsidian-card dark:hover:border-mint-strong"
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${purpose.tone}`}>
          <Icon size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-bold text-slate-900 dark:text-mist">{c.title}</h3>
          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-mist-muted">
            {purpose.label}
            {forName ? ` for ${forName}` : ""}
          </p>
        </div>
        <StatusPill status={c.status} />
      </div>

      <div className="mt-5 flex items-baseline gap-2">
        <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-mist">{money(collected)}</span>
        {target ? (
          <span className="text-xs text-slate-400 dark:text-mist-muted">
            of {compactMoney(target)} · {pct}%
          </span>
        ) : (
          <span className="text-xs text-slate-400 dark:text-mist-muted">no target</span>
        )}
      </div>

      <div className="mt-2.5">
        <ProgressBar pct={target ? pct : collected > 0 ? 100 : 0} tone={target ? (pct >= 100 ? "bg-emerald-600" : "bg-emerald-500") : "bg-slate-300 dark:bg-mint-strong"} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-mist-muted">
        <span className="inline-flex items-center gap-1.5">
          <Users size={13} />
          {c.contributors_count || 0} {c.contributors_count === 1 ? "member" : "members"} chipped in
        </span>
        {deadline && (
          <span className={`inline-flex items-center gap-1.5 ${deadline.urgent ? "font-semibold text-amber-600 dark:text-amber-400" : ""}`}>
            <CalendarClock size={13} />
            {deadline.text}
          </span>
        )}
        {c.my_contributed > 0 && (
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-mint">
            <HandCoins size={13} />
            You gave {money(c.my_contributed)}
          </span>
        )}
      </div>

      {nextStep && (
        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-obsidian-border">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuickAction(nextStep.key, c);
            }}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
              live
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-slate-900 text-white hover:bg-slate-700 dark:bg-mint dark:text-obsidian dark:hover:bg-mint-hover"
            }`}
          >
            {nextStep.label}
          </button>
        </div>
      )}
    </article>
  );
}
