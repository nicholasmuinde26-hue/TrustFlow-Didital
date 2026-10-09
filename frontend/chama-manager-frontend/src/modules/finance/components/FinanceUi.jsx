import React from "react";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, ChevronRight } from "lucide-react";

// ============================================================
// SHARED MONEY & COLLECTIONS UI PRIMITIVES
// ============================================================
//
// Every page in this section was previously re-declaring its own
// money() helper, its own stat card markup and its own status pill
// colours, which is how Savings and the Dashboard ended up quietly
// disagreeing about how to render the same number. One definition
// each, imported everywhere.
//
// ============================================================

// Decimal128 arrives as { $numberDecimal: "1500" } when a serializer
// misses it, so unwrap defensively rather than rendering NaN.
export const toAmount = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "object") {
    const raw = value.$numberDecimal ?? value.value ?? 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// Whole-shilling display, the convention across the section. Cents are
// never meaningful for chama contributions and just add visual noise.
export const money = (value) =>
  `KES ${toAmount(value).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

// Precise form, for anything that has to reconcile against the ledger.
export const moneyExact = (value) =>
  `KES ${toAmount(value).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const percent = (value) => `${Math.round(toAmount(value))}%`;

export const timeAgo = (dateValue) => {
  if (!dateValue) return "—";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "—";

  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return date.toLocaleDateString("en-KE");
};

export const formatDate = (dateValue) => {
  if (!dateValue) return "—";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

// ============================================================
// SURFACES
// ============================================================

export function Card({ className = "", children, ...rest }) {
  return (
    <div
      className={`rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-obsidian-border dark:bg-obsidian-card ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function SectionHeading({ title, subtitle, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-mist">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-[11px] font-semibold text-slate-400">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

// A single headline figure. `delta` is an optional { value, isUp, label }.
export function StatCard({ label, value, icon: Icon, delta, footnote, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600 dark:bg-obsidian-raised dark:text-mist-muted",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-mint-deep dark:text-mint",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
    rose: "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
    indigo: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400",
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        {Icon && (
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
              tones[tone] || tones.slate
            }`}
          >
            <Icon size={14} />
          </div>
        )}
      </div>

      <p className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-mist">
        {value}
      </p>

      {delta && (
        <span
          className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold ${
            delta.isUp ? "text-emerald-600 dark:text-mint" : "text-rose-500"
          }`}
        >
          {delta.isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {delta.label}
        </span>
      )}

      {footnote && (
        <p className="mt-1.5 text-[11px] font-semibold text-slate-400">{footnote}</p>
      )}
    </Card>
  );
}

// ============================================================
// STATUS PILLS
// ============================================================
//
// One vocabulary for payment/obligation state across the whole
// section, so "pending" never renders amber on one page and grey on
// the next.

const PILL_STYLES = {
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  settled: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  ahead: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  processing: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  partial: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  overdue: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  failed: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  cancelled: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  reversed: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  refunded: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  no_obligation: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  no_plan: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

const PILL_LABELS = {
  completed: "Completed",
  settled: "Settled",
  paid: "Paid",
  ahead: "Credit balance",
  pending: "Pending",
  processing: "Processing",
  partial: "Part paid",
  overdue: "Overdue",
  failed: "Failed",
  cancelled: "Cancelled",
  reversed: "Reversed",
  refunded: "Refunded",
  no_obligation: "Nothing due",
  no_plan: "No plan",
};

export function StatusPill({ status, children }) {
  const key = String(status || "").toLowerCase();
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
        PILL_STYLES[key] || PILL_STYLES.cancelled
      }`}
    >
      {children || PILL_LABELS[key] || key || "Unknown"}
    </span>
  );
}

// ============================================================
// MISC
// ============================================================

export function Avatar({ name, url, size = 32 }) {
  // Sized with an inline style rather than `h-${size}`: Tailwind only
  // ships classes it can see as complete strings at build time, so an
  // interpolated class name compiles to nothing and the avatar collapses.
  const box = { height: `${size}px`, width: `${size}px` };

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={box}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <div
      style={box}
      className="flex shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-black text-emerald-700 dark:bg-mint-deep dark:text-mint"
    >
      {initials(name)}
    </div>
  );
}

export function ProgressBar({ value, tone = "emerald" }) {
  const tones = {
    emerald: "bg-emerald-500 dark:bg-mint",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    indigo: "bg-indigo-500",
  };

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-obsidian-raised">
      <div
        className={`h-full rounded-full transition-all duration-500 ${tones[tone] || tones.emerald}`}
        style={{ width: `${Math.max(0, Math.min(100, toAmount(value)))}%` }}
      />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {Icon && <Icon size={28} className="text-slate-300 dark:text-slate-600" />}
      <p className="text-sm font-bold text-slate-600 dark:text-mist">{title}</p>
      {description && (
        <p className="max-w-sm text-xs font-medium text-slate-400">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// A compact "go to the page that owns this" row. The Dashboard uses
// these to hand off to Savings / MGR / Payouts instead of restating
// those pages inline, which is what made it look like a duplicate of
// them.
export function LinkRow({ to, icon: Icon, title, description, tone = "emerald" }) {
  const tones = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-mint-deep dark:text-mint",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    slate: "bg-slate-200 text-slate-700 dark:bg-obsidian-raised dark:text-mist-muted",
  };

  return (
    <Link
      to={to}
      className="flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 text-left transition hover:border-emerald-200 hover:bg-emerald-50/40 dark:border-obsidian-border dark:bg-obsidian-raised/40 dark:hover:bg-obsidian-raised"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            tones[tone] || tones.emerald
          }`}
        >
          <Icon size={17} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-slate-900 dark:text-mist">{title}</p>
          <p className="truncate text-[11px] text-slate-400">{description}</p>
        </div>
      </div>
      <ChevronRight size={16} className="shrink-0 text-slate-400" />
    </Link>
  );
}

export default {
  money,
  moneyExact,
  toAmount,
  percent,
  timeAgo,
  formatDate,
  initials,
};