import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import clsx from "clsx";

/* ==========================================================================
 * Shared parts for the pro overview.
 *
 * Rules these enforce so the page reads as pro rather than amateur:
 *   - one colour logic everywhere (emerald healthy / amber attention / rose risk)
 *   - every number carries context (target, change, or what it is out of)
 *   - no dead empty states: a gap always comes with a call to action
 * ========================================================================== */

export const TONE = {
  emerald: {
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-400/20",
    text: "text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
    soft: "border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20",
    dot: "bg-emerald-500",
    hex: "#10b981",
  },
  amber: {
    chip: "bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-400/20",
    text: "text-amber-600 dark:text-amber-400",
    bar: "bg-amber-500",
    soft: "border-amber-200/80 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20",
    dot: "bg-amber-500",
    hex: "#f59e0b",
  },
  rose: {
    chip: "bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-400/20",
    text: "text-rose-600 dark:text-rose-400",
    bar: "bg-rose-500",
    soft: "border-rose-200/80 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20",
    dot: "bg-rose-500",
    hex: "#ef4444",
  },
  violet: {
    chip: "bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-400/20",
    text: "text-violet-600 dark:text-violet-300",
    bar: "bg-violet-500",
    soft: "border-violet-200/80 bg-violet-50/50 dark:border-violet-900/50 dark:bg-violet-950/20",
    dot: "bg-violet-500",
    hex: "#8b5cf6",
  },
  sky: {
    chip: "bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-400/20",
    text: "text-sky-600 dark:text-sky-400",
    bar: "bg-sky-500",
    soft: "border-sky-200/80 bg-sky-50/50 dark:border-sky-900/50 dark:bg-sky-950/20",
    dot: "bg-sky-500",
    hex: "#0ea5e9",
  },
  slate: {
    chip: "bg-slate-100 text-slate-600 ring-slate-500/10 dark:bg-obsidian-raised dark:text-mist-muted dark:ring-white/5",
    text: "text-slate-500 dark:text-mist-muted",
    bar: "bg-slate-300 dark:bg-slate-600",
    soft: "border-slate-200 bg-slate-50/60 dark:border-obsidian-border dark:bg-obsidian-raised/40",
    dot: "bg-slate-400",
    hex: "#94a3b8",
  },
};

export const tone = (t) => TONE[t] || TONE.slate;

export const cardCls =
  "min-w-0 rounded-2xl border border-slate-200/80 bg-white dark:border-obsidian-border dark:bg-obsidian-card";

export const ghostBtn =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-violet-500 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist dark:hover:bg-obsidian-raised";

export const primaryBtn =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3.5 text-xs font-bold text-white transition hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 dark:bg-mint dark:text-mint-strong dark:hover:bg-mint-hover";

/** Status chip. `dot` adds the coloured dot used for health/compliance. */
export function Chip({ tone: t = "slate", dot, children, className }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset", tone(t).chip, className)}>
      {dot ? <span className={clsx("h-1.5 w-1.5 rounded-full", tone(t).dot)} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/** "+12.5% vs last month". `goodWhenUp=false` flips colouring (expenses, arrears). */
export function Delta({ value, suffix = "%", label = "vs previous", goodWhenUp = true, className }) {
  if (value == null) {
    return <span className={clsx("text-[11px] text-slate-400 dark:text-mist-muted", className)}>No earlier period to compare</span>;
  }
  const up = value >= 0;
  const good = value === 0 ? null : up === goodWhenUp;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={clsx("inline-flex items-center gap-1 text-[11px] font-bold", good === null ? "text-slate-500" : good ? TONE.emerald.text : TONE.rose.text, className)}>
      <Icon size={12} aria-hidden="true" />
      {up ? "+" : ""}{value}{suffix}
      <span className="font-medium text-slate-400 dark:text-mist-muted">{label}</span>
    </span>
  );
}

/** A figure that always explains itself: label, value, and a context line. */
export function Metric({ label, value, context, tone: t, children, className }) {
  return (
    <div className={clsx("min-w-0", className)}>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-mist-muted">{label}</p>
      <p className={clsx("mt-1 truncate text-xl font-extrabold tabular-nums tracking-tight", t ? tone(t).text : "text-slate-950 dark:text-mist")}>{value}</p>
      {context ? <div className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-mist-muted">{context}</div> : null}
      {children}
    </div>
  );
}

/** Thin tone-aware progress bar. */
export function Meter({ value, tone: t = "emerald", label, className, height = "h-1.5" }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div
      role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label}
      className={clsx("w-full overflow-hidden rounded-full bg-slate-100 dark:bg-obsidian-raised", height, className)}
    >
      <div className={clsx("h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none", tone(t).bar)} style={{ width: `${v}%` }} />
    </div>
  );
}

/** Always-open card. The optional `eyebrow` renders as a quiet subtitle, not a loud label. */
export function Panel({ icon: Icon, title, eyebrow, action, children, className, bodyClassName }) {
  return (
    <section className={clsx(cardCls, "overflow-hidden", className)}>
      <header className="flex items-center justify-between gap-3 px-5 pb-1 pt-5">
        <div className="flex min-w-0 items-center gap-3">
          {Icon ? (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-obsidian-raised dark:text-mist-muted">
              <Icon size={16} aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-slate-900 dark:text-mist">{title}</h3>
            {eyebrow ? <p className="truncate text-xs text-slate-500 dark:text-mist-muted">{eyebrow}</p> : null}
          </div>
        </div>
        {action}
      </header>
      <div className={clsx("px-5 pb-5 pt-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Heading for a block of panels. One style everywhere, no uppercase eyebrow. */
export function SectionHead({ title, description, action }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-mist">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-slate-500 dark:text-mist-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Segmented tab bar. Scrolls sideways on phones; badges show what needs a look. */
export function OverviewTabs({ tabs, value, onChange }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div
        role="tablist" aria-label="Overview sections"
        className="inline-flex min-w-full gap-1 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-1 dark:border-obsidian-border dark:bg-obsidian-raised/50 sm:min-w-0"
      >
        {tabs.map((t) => {
          const active = t.id === value;
          return (
            <button
              key={t.id} type="button" role="tab" id={`ov-tab-${t.id}`} aria-selected={active} aria-controls={`ov-panel-${t.id}`}
              onClick={() => onChange(t.id)}
              className={clsx(
                "inline-flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-violet-500 sm:flex-none",
                active
                  ? "bg-white text-slate-950 shadow-sm dark:bg-obsidian-card dark:text-mist"
                  : "text-slate-500 hover:text-slate-900 dark:text-mist-muted dark:hover:text-mist",
              )}
            >
              {t.label}
              {t.badge ? (
                <span className={clsx("rounded-full px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums", tone(t.badgeTone || "amber").chip)}>{t.badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Row that sends the user somewhere. */
export function LinkRow({ to, onClick, tone: t, title, detail, trailing, icon: Icon }) {
  const body = (
    <>
      <span className={clsx("h-9 w-1 shrink-0 rounded-full", tone(t).bar)} aria-hidden="true" />
      {Icon ? (
        <span className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 dark:bg-obsidian-raised", tone(t).text)}>
          <Icon size={15} aria-hidden="true" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[13px] font-bold text-slate-900 dark:text-mist">{title}</span>
        {detail ? <span className="mt-0.5 block truncate text-[11px] text-slate-500 dark:text-mist-muted">{detail}</span> : null}
      </span>
      {trailing}
      <ChevronRight size={15} className="shrink-0 text-slate-300 dark:text-mist-muted/50" aria-hidden="true" />
    </>
  );
  const cls =
    "group flex min-h-[56px] w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 transition hover:border-violet-200 hover:bg-violet-50/30 focus-visible:outline-2 focus-visible:outline-violet-500 dark:border-obsidian-border dark:bg-obsidian-card dark:hover:bg-obsidian-raised";
  return to ? (
    <Link to={to} className={cls}>{body}</Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>{body}</button>
  );
}

/** "Nothing here" is never a dead end: it says what it means and offers the next step. */
export function Nudge({ icon: Icon, title, hint, to, cta, tone: t = "slate" }) {
  return (
    <div className={clsx("flex items-center gap-3 rounded-xl border px-3.5 py-3", tone(t).soft)}>
      {Icon ? <Icon size={16} className={clsx("shrink-0", tone(t).text)} aria-hidden="true" /> : null}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-slate-800 dark:text-mist">{title}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-slate-500 dark:text-mist-muted">{hint}</p> : null}
      </div>
      {to && cta ? (
        <Link to={to} className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-violet-700 hover:underline dark:text-mint">
          {cta}
          <ChevronRight size={13} aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

export const initialsOf = (name = "") =>
  String(name).split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "C";
