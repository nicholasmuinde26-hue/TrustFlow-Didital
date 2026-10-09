import { useEffect, useRef, useState } from "react";
import { AlertCircle, ChevronDown, RefreshCw } from "lucide-react";
import clsx from "clsx";

export function useMediaQuery(query) {
  const supported = typeof window !== "undefined" && typeof window.matchMedia === "function";
  const [matches, setMatches] = useState(() => (supported ? window.matchMedia(query).matches : false));
  useEffect(() => {
    if (!supported) return undefined;
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query, supported]);
  return matches;
}

export function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(Math.round(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export const TONES = {
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
  violet: "bg-violet-50 text-violet-600 dark:bg-mint-deep/60 dark:text-mint",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400",
  sky: "bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400",
  slate: "bg-slate-100 text-slate-500 dark:bg-obsidian-raised dark:text-mist-muted",
};
// Severity colour is used sparingly: only as a thin bar and an icon tint on real alerts.
export const TONE_TEXT = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  violet: "text-violet-600 dark:text-mint",
  amber: "text-amber-600 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
  sky: "text-sky-600 dark:text-sky-400",
};
export const TONE_BAR = { emerald: "bg-emerald-500", violet: "bg-violet-500", amber: "bg-amber-500", rose: "bg-rose-500", sky: "bg-sky-500" };

export const Skeleton = ({ className }) => (
  <div aria-hidden="true" className={clsx("animate-pulse rounded-lg bg-slate-100 dark:bg-obsidian-raised", className)} />
);

export function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-2 py-6 text-center">
      {Icon ? <span className={clsx("mb-1 flex h-10 w-10 items-center justify-center rounded-full", TONES.slate)}><Icon size={18} aria-hidden="true" /></span> : null}
      <p className="text-sm font-semibold text-slate-700 dark:text-mist">{title}</p>
      {hint ? <p className="max-w-xs text-xs text-slate-500 dark:text-mist-muted">{hint}</p> : null}
      {action}
    </div>
  );
}

export function ErrorNote({ onRetry, label = "Couldn't load this section." }) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
      <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
      <span className="flex-1 font-medium">{label}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-rose-500 dark:hover:bg-rose-900/40">
          <RefreshCw size={12} aria-hidden="true" /> Retry
        </button>
      ) : null}
    </div>
  );
}

// A collapsible panel. The whole header is one button, and it always says what
// it will do ("Expand" / "Collapse"). While collapsed it keeps one line of the
// panel's real headline figures visible, so a closed panel is still useful.
// `footer` holds the panel's "see all" links, shown under the body when open.
export function Section({ id, icon: Icon, title, summary, badge, open, onToggle, footer, className, children }) {
  return (
    <section aria-labelledby={`${id}-title`} className={clsx("min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-obsidian-border dark:bg-obsidian-card", className)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${id}-body`}
        className="group flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50/80 focus-visible:-outline-offset-2 focus-visible:outline-violet-500 dark:hover:bg-obsidian-raised/40 dark:focus-visible:outline-mint lg:px-5"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-obsidian-raised dark:text-mist-muted">
          <Icon size={16} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span id={`${id}-title`} className="truncate text-sm font-semibold text-slate-900 dark:text-mist">{title}</span>
            {badge}
          </span>
          {!open && summary ? <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-mist-muted">{summary}</span> : null}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 group-hover:text-slate-900 dark:text-mist-muted dark:group-hover:text-mist">
          <span className="hidden sm:inline">{open ? "Collapse" : "Expand"}</span>
          <ChevronDown size={16} aria-hidden="true" className={clsx("transition-transform motion-reduce:transition-none", open && "rotate-180")} />
        </span>
      </button>
      {open ? (
        <div id={`${id}-body`} role="region" aria-labelledby={`${id}-title`} className="@container animate-in fade-in border-t border-slate-100 px-4 py-4 duration-200 dark:border-obsidian-border lg:px-5 lg:py-5">
          {children}
          {footer ? <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3 dark:border-obsidian-border">{footer}</div> : null}
        </div>
      ) : null}
    </section>
  );
}

// A row of figures separated by hairlines. Three across when the panel is wide
// enough, stacked as label-left / value-right rows when it is narrow, so full
// amounts never truncate. Sizes itself from its container, not the screen.
export function StatStrip({ children, onDark, className }) {
  return (
    <dl className={clsx("grid grid-cols-1 divide-y @md:grid-cols-3 @md:divide-x @md:divide-y-0", onDark ? "divide-white/10" : "divide-slate-100 dark:divide-obsidian-border", className)}>
      {children}
    </dl>
  );
}

export function Stat({ label, value, sub, tone, onDark, children }) {
  return (
    <div className="grid min-w-0 grid-cols-[1fr_auto] items-baseline gap-x-3 py-2.5 @md:block @md:px-5 @md:py-1 @md:first:pl-0 @md:last:pr-0">
      <dt className={clsx("text-xs font-medium", onDark ? "text-white/60" : "text-slate-500 dark:text-mist-muted")}>{label}</dt>
      <dd className={clsx("truncate text-base font-semibold tabular-nums @md:mt-1 @md:text-lg", tone || (onDark ? "text-white" : "text-slate-900 dark:text-mist"))}>{value}</dd>
      {sub ? <dd className={clsx("col-span-2 mt-0.5 truncate text-xs", onDark ? "text-white/50" : "text-slate-500 dark:text-mist-muted")}>{sub}</dd> : null}
      {children ? <dd className="col-span-2 mt-2">{children}</dd> : null}
    </div>
  );
}

// Label / value rows for detail lists (MGR round, ledger totals).
export const DetailRows = ({ rows }) => (
  <dl className="divide-y divide-slate-100 text-xs dark:divide-obsidian-border">
    {rows.filter(Boolean).map(([k, v]) => (
      <div key={k} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
        <dt className="text-slate-500 dark:text-mist-muted">{k}</dt>
        <dd className="min-w-0 truncate text-right font-semibold tabular-nums text-slate-900 dark:text-mist">{v}</dd>
      </div>
    ))}
  </dl>
);
