import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import clsx from "clsx";

/**
 * Shared building blocks for the admin console. Compact, data-dense and
 * deliberately different from the member app's rounded "mint" cards.
 */

export const TONES = {
  violet: {
    chip: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    bar: "bg-violet-500",
    text: "text-violet-600 dark:text-violet-300",
    edge: "bg-violet-500",
  },
  emerald: {
    chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    bar: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-300",
    edge: "bg-emerald-500",
  },
  amber: {
    chip: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    bar: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-300",
    edge: "bg-amber-500",
  },
  rose: {
    chip: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
    bar: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-300",
    edge: "bg-rose-500",
  },
  sky: {
    chip: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
    bar: "bg-sky-500",
    text: "text-sky-600 dark:text-sky-300",
    edge: "bg-sky-500",
  },
  slate: {
    chip: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
    bar: "bg-slate-400",
    text: "text-slate-600 dark:text-slate-300",
    edge: "bg-slate-300 dark:bg-slate-600",
  },
};

export const adminBtn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
};

export const panelSurface =
  "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900/60";

export function PageHeader({ eyebrow, title, description, actions, className }) {
  return (
    <div className={clsx("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-[28px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, description, action, children, className, bodyClassName, flush = false }) {
  return (
    <section className={clsx(panelSurface, className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={clsx(!flush && "p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function PanelLink({ to, children }) {
  return (
    <Link
      to={to}
      className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-200"
    >
      {children}
      <ArrowUpRight size={13} />
    </Link>
  );
}

export function StatTile({ label, value, icon: Icon, tone = "slate", to, hint }) {
  const t = TONES[tone] || TONES.slate;
  const body = (
    <div
      className={clsx(
        panelSurface,
        "h-full p-4 transition",
        to && "hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md dark:hover:border-violet-500/40"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
        {Icon && (
          <span className={clsx("flex h-8 w-8 items-center justify-center rounded-lg", t.chip)}>
            <Icon size={16} />
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-slate-950 dark:text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );

  return to ? (
    <Link
      to={to}
      className="block h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
    >
      {body}
    </Link>
  ) : (
    body
  );
}

export function Pill({ tone = "slate", children, className }) {
  const t = TONES[tone] || TONES.slate;
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        t.chip,
        className
      )}
    >
      {children}
    </span>
  );
}

export function Skeleton({ className }) {
  return <div className={clsx("animate-pulse rounded-lg bg-slate-200/70 dark:bg-slate-800", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}
