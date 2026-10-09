import React from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  BellRing,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Info,
  PauseCircle,
  PiggyBank,
  PlusCircle,
  Receipt,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";

import { Card, ProgressBar, formatDate, money, percent } from "./FinanceUi";

// ============================================================
// MONEY HUB BUILDING BLOCKS
// ============================================================
//
// The pieces the redesigned Money dashboard is assembled from:
//
//   BalanceHero          - the group's (or member's) position at a glance
//   FinanceNotifications - everything that needs attention, in one place
//   NewContributionsCard - contributions that were just added
//   TransactionsCta      - a single door to the Books > Transactions page
//
// Transaction LISTS deliberately do not live here. Recent transactions
// belong to the Books pages, so the dashboard only offers a button to
// go and view them.
// ============================================================

const NEW_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

export const isRecentlyAdded = (isoDate) => {
  if (!isoDate) return false;
  const age = Date.now() - new Date(isoDate).getTime();
  return age >= 0 && age <= NEW_WINDOW_DAYS * DAY_MS;
};

const daysAgoLabel = (isoDate) => {
  if (!isoDate) return "";
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
};

const CADENCE_LABEL = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Yearly",
  yearly: "Yearly",
};

export const cadenceLabel = (plan) =>
  CADENCE_LABEL[plan?.cadence] ||
  (plan?.frequency
    ? String(plan.frequency).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
    : "Flexible");

// ------------------------------------------------------------
// Alerts derived from the contribution engine (manager overview
// OR a member's own calendar). Real data only.
// ------------------------------------------------------------

export function buildContributionAlerts({ overview, calendar, base, isManager }) {
  const alerts = [];

  if (isManager && overview) {
    if (overview.needs_financial_year) {
      alerts.push({
        id: "needs-year",
        tone: "amber",
        icon: AlertTriangle,
        title: "Set the financial year",
        detail: "Contributions need an active financial year before they can be scheduled.",
        action: "Set up",
        to: `${base}/finance/contributions`,
      });
    }

    const paused = (overview.plans || []).filter((p) => p.status === "paused");
    if (paused.length) {
      alerts.push({
        id: "paused",
        tone: "amber",
        icon: PauseCircle,
        title: `${paused.length} contribution${paused.length === 1 ? " is" : "s are"} paused`,
        detail: `${paused.map((p) => p.name).slice(0, 2).join(", ")}${
          paused.length > 2 ? " and more" : ""
        } will not bill members until resumed.`,
        action: "Manage",
        to: `${base}/finance/contributions`,
      });
    }

    (overview.plans || [])
      .filter((p) => isRecentlyAdded(p.created_at) && p.status === "active")
      .slice(-2)
      .forEach((p) =>
        alerts.push({
          id: `new-${p.id}`,
          tone: "sky",
          icon: Sparkles,
          title: `New contribution: ${p.name}`,
          detail: `Added ${daysAgoLabel(p.created_at)}${p.amount ? ` · ${money(p.amount)} ${cadenceLabel(p).toLowerCase()}` : ""}.`,
          action: "Open",
          to: `${base}/finance/contributions`,
        })
      );
  }

  if (!isManager && calendar) {
    (calendar.reminders || []).slice(0, 3).forEach((r, index) =>
      alerts.push({
        id: `rem-${r.plan_id}-${r.period_key}-${index}`,
        tone: r.kind === "overdue" ? "rose" : "amber",
        icon: r.kind === "overdue" ? AlertTriangle : BellRing,
        title:
          r.kind === "overdue"
            ? `${r.plan_name} is overdue`
            : r.kind === "due"
            ? `${r.plan_name} is due now`
            : `${r.plan_name} is coming up`,
        detail: r.message,
        action: "Pay",
        to: `${base}/finance/contributions`,
      })
    );

    (calendar.plans || [])
      .filter((p) => isRecentlyAdded(p.created_at))
      .slice(-2)
      .forEach((p) =>
        alerts.push({
          id: `new-${p.id}`,
          tone: "sky",
          icon: Sparkles,
          title: `New contribution: ${p.name}`,
          detail: `Added ${daysAgoLabel(p.created_at)}${p.amount ? ` · ${money(p.amount)} ${cadenceLabel(p).toLowerCase()}` : ""}.`,
          action: "View",
          to: `${base}/finance/contributions`,
        })
      );
  }

  return alerts;
}

// ------------------------------------------------------------
// BALANCE HERO
// ------------------------------------------------------------

function HeroTile({ icon: Icon, label, value, detail, danger, compact = false }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm transition hover:bg-white/10 ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</span>
        <Icon size={14} className={danger ? "text-rose-400" : "text-emerald-400"} />
      </div>
      <p className={`mt-1.5 font-mono font-black tabular-nums tracking-tight text-white ${compact ? "text-lg" : "text-xl"}`}>{value}</p>
      <p className={`mt-1 truncate font-medium ${compact ? "text-[9px]" : "text-[10px]"} ${danger ? "text-rose-300" : "text-slate-400"}`}>
        {detail}
      </p>
    </div>
  );
}

export function BalanceHero({
  eyebrow,
  title,
  balance,
  balanceHint,
  reconciled,
  tiles = [],
  primaryAction,
  secondaryAction,
  tertiaryAction,
  onRefresh,
  refreshing,
  compact = false,
}) {
  return (
    <section
      className={`relative overflow-hidden border text-white ${compact ? "rounded-[1.75rem] border-white/10 bg-slate-950 shadow-[0_24px_70px_-40px_rgba(2,6,23,0.9)]" : "rounded-3xl border-slate-800 bg-slate-950 shadow-xl"}`}
      style={{
        backgroundImage:
          "radial-gradient(60% 90% at 100% 0%, rgba(16,185,129,0.28), transparent 60%), radial-gradient(50% 70% at 0% 100%, rgba(56,189,248,0.14), transparent 60%)",
      }}
    >
      {/* subtle grid texture */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${compact ? "opacity-[0.025]" : "opacity-[0.07]"}`}
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />

      <div className={`relative ${compact ? "p-4 sm:p-5 lg:p-6" : "p-6 sm:p-8"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-300">{eyebrow}</span>
            {reconciled && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                <ShieldCheck size={10} />
                Reconciled
              </span>
            )}
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-[11px] font-bold text-slate-200 transition hover:bg-white/10"
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          )}
        </div>

        <div className={`${compact ? "mt-4 gap-4" : "mt-6 gap-6"} flex flex-col lg:flex-row lg:items-end lg:justify-between`}>
          <div>
            <p className="text-xs font-semibold text-slate-400">{title}</p>
            <p className={`mt-1 font-mono font-black tabular-nums tracking-tight ${compact ? "text-4xl sm:text-5xl" : "text-4xl sm:mt-2 sm:text-6xl"}`}>{balance}</p>
            {balanceHint && <p className="mt-1.5 max-w-md text-[10px] font-medium text-slate-400">{balanceHint}</p>}
          </div>

          <div className={`flex flex-wrap gap-2 ${compact ? "lg:pb-1" : ""}`}>
            {primaryAction && (
              <Link
                to={primaryAction.to}
                className={`inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 text-xs font-black text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-300 ${compact ? "h-10" : "h-11"}`}
              >
                <PlusCircle size={15} />
                {primaryAction.label}
              </Link>
            )}
            {secondaryAction && (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className={`inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-bold text-white transition hover:bg-white/10 ${compact ? "h-10" : "h-11"}`}
              >
                <Smartphone size={15} />
                {secondaryAction.label}
              </button>
            )}
            {tertiaryAction && (
              <Link
                to={tertiaryAction.to}
                className={`inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-bold text-white transition hover:bg-white/10 ${compact ? "h-10" : "h-11"}`}
              >
                <CircleDollarSign size={15} />
                {tertiaryAction.label}
              </Link>
            )}
          </div>
        </div>

        {tiles.length > 0 && (
          <div className={`${compact ? "mt-4 gap-2" : "mt-7 gap-3"} grid ${compact ? "grid-cols-2 sm:grid-cols-2" : "sm:grid-cols-2"} ${compact ? (tiles.length > 2 ? "lg:grid-cols-4" : "lg:grid-cols-2") : tiles.length > 3 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            {tiles.map((tile) => (
              <HeroTile key={tile.label} {...tile} compact={compact} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ------------------------------------------------------------
// NOTIFICATIONS
// ------------------------------------------------------------

const ALERT_TONE = {
  rose: {
    wrap: "border-rose-200 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/20",
    icon: "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300",
    link: "text-rose-700 dark:text-rose-300",
  },
  amber: {
    wrap: "border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20",
    icon: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300",
    link: "text-amber-700 dark:text-amber-300",
  },
  sky: {
    wrap: "border-sky-200 bg-sky-50/70 dark:border-sky-900/60 dark:bg-sky-950/20",
    icon: "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300",
    link: "text-sky-700 dark:text-sky-300",
  },
  emerald: {
    wrap: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20",
    icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300",
    link: "text-emerald-700 dark:text-emerald-300",
  },
};

export function FinanceNotifications({ alerts = [], limit = 5 }) {
  const shown = alerts.slice(0, limit);
  const urgent = alerts.filter((a) => a.tone === "rose").length;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-obsidian-border">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-obsidian-raised dark:text-mist">
            <Bell size={15} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-950 dark:text-mist">Notifications</h2>
            <p className="text-[10px] font-medium text-slate-400">Only what needs your attention</p>
          </div>
        </div>
        {alerts.length > 0 && (
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
              urgent
                ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                : "bg-slate-100 text-slate-600 dark:bg-obsidian-raised dark:text-mist-muted"
            }`}
          >
            {alerts.length}
          </span>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="flex items-center gap-3 px-5 py-6">
          <CheckCircle2 size={18} className="text-emerald-500" />
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-mist">You&apos;re all caught up</p>
            <p className="text-[10px] font-medium text-slate-400">Nothing needs action right now.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2 p-3">
          {shown.map((alert) => {
            const tone = ALERT_TONE[alert.tone] || ALERT_TONE.sky;
            const Icon = alert.icon || Info;
            return (
              <div
                key={alert.id}
                className={`flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 ${tone.wrap}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone.icon}`}>
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-slate-900 dark:text-mist">{alert.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-[10px] font-medium text-slate-500 dark:text-mist-muted">
                      {alert.detail}
                    </p>
                  </div>
                </div>
                {alert.to && (
                  <Link
                    to={alert.to}
                    className={`inline-flex shrink-0 items-center gap-0.5 text-[11px] font-black ${tone.link}`}
                  >
                    {alert.action}
                    <ChevronRight size={13} />
                  </Link>
                )}
              </div>
            );
          })}
          {alerts.length > shown.length && (
            <p className="px-2 pt-1 text-center text-[10px] font-semibold text-slate-400">
              +{alerts.length - shown.length} more
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

// ------------------------------------------------------------
// NEW / ACTIVE CONTRIBUTIONS
// ------------------------------------------------------------

function currentPeriodOf(plan) {
  if (!plan?.periods?.length) return null;
  return plan.periods.find((p) => p.key === plan.current_period_key) || null;
}

export function NewContributionsCard({ plans = [], base, isManager, emptyHint }) {
  // Newest first. Anything added in the last 30 days is flagged "New".
  const ordered = [...plans]
    .filter((p) => p.status !== "archived")
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 5);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-obsidian-border">
        <div>
          <h2 className="text-sm font-black text-slate-950 dark:text-mist">
            {isManager ? "Contributions" : "My contributions"}
          </h2>
          <p className="mt-0.5 text-[10px] font-medium text-slate-400">
            {isManager ? "Newest first. Open one to manage it." : "What you are expected to contribute"}
          </p>
        </div>
        <Link
          to={`${base}/finance/contributions`}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-mint"
        >
          {isManager ? "Manage all" : "View all"}
          <ChevronRight size={13} />
        </Link>
      </div>

      {ordered.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <Receipt size={22} className="mx-auto text-slate-300" />
          <p className="mt-2 text-xs font-semibold text-slate-400">
            {emptyHint || "No contributions have been added yet."}
          </p>
          {isManager && (
            <Link
              to={`${base}/finance/contributions`}
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-[11px] font-black text-white"
            >
              <PlusCircle size={13} />
              Add a contribution
            </Link>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-obsidian-border">
          {ordered.map((plan) => {
            const period = currentPeriodOf(plan);
            const rate = period && period.expected > 0 ? (period.paid / period.expected) * 100 : null;
            return (
              <Link
                key={plan.id}
                to={`${base}/finance/contributions`}
                className="block px-6 py-4 transition hover:bg-slate-50 dark:hover:bg-obsidian-raised/30"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-xs font-black text-slate-900 dark:text-mist">{plan.name}</p>
                      {isRecentlyAdded(plan.created_at) && (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                          New
                        </span>
                      )}
                      {plan.status === "paused" && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          Paused
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                      {cadenceLabel(plan)}
                      {plan.amount ? ` · ${money(plan.amount)}` : ""}
                      {plan.created_at ? ` · added ${formatDate(plan.created_at)}` : ""}
                    </p>
                  </div>
                  <ArrowUpRight size={14} className="shrink-0 text-slate-300" />
                </div>
                {isManager && rate !== null && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-[10px] font-bold text-slate-400">
                      <span>
                        {money(period.paid)} of {money(period.expected)}
                      </span>
                      <span>{percent(rate)}</span>
                    </div>
                    <ProgressBar value={rate} tone={rate >= 80 ? "emerald" : rate >= 40 ? "amber" : "rose"} />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ------------------------------------------------------------
// TRANSACTIONS CTA (lists live in Books)
// ------------------------------------------------------------

export function TransactionsCta({ base, isManager }) {
  return (
    <Link
      to={`${base}/finance/transactions`}
      className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-obsidian-border dark:bg-obsidian-card"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-mint-deep dark:text-mint">
          <Receipt size={18} />
        </div>
        <div>
          <p className="text-sm font-black text-slate-950 dark:text-mist">View transactions</p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-400">
            {isManager
              ? "Every receipt and payment is kept in the Books."
              : "Your payment history is kept in the Books."}
          </p>
        </div>
      </div>
      <span className="inline-flex h-9 items-center gap-1 rounded-xl bg-slate-950 px-4 text-[11px] font-black text-white transition group-hover:bg-emerald-600 dark:bg-mist dark:text-obsidian">
        Open Books
        <ChevronRight size={13} />
      </span>
    </Link>
  );
}

export const heroTileIcons = { PiggyBank, Send, CircleDollarSign, AlertTriangle };
