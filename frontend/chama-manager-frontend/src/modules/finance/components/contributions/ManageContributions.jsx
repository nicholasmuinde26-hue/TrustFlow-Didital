import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  PlusCircle,
  RefreshCw,
  Settings2,
  Table2,
  Users,
} from "lucide-react";

import contributionPlanApi from "@/modules/contribution-group/api/contributionPlan.api";
import { Card, EmptyState, ProgressBar, formatDate, money, percent } from "../FinanceUi";
import { cadenceLabel, isRecentlyAdded } from "../MoneyHub";

// ============================================================
// MANAGE CONTRIBUTIONS  (treasurer / chairperson)
// ============================================================
//
// One place to run every contribution the group collects, from the
// first one to the tenth:
//
//   - create (templates for welfare, shares, registration, ...)
//   - edit amount / audience / timings
//   - pause and resume (nothing bills while paused)
//   - archive and restore (history is always kept)
//   - see, per contribution, who has paid which month
//   - jump straight to recording a payment against it
//
// Everything calls the live contribution-calendar API. Members never
// see this view; they get MyContributions instead.
// ============================================================


const FILTERS = [
  { key: "active", label: "Active" },
  { key: "paused", label: "Paused" },
  { key: "archived", label: "Archived" },
];

const CELL_TONE = {
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  partially_paid: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  overdue: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  pending: "bg-slate-100 text-slate-500 dark:bg-obsidian-raised dark:text-mist-muted",
  waived: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
};

function Stat({ label, value, detail, danger }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-obsidian-border dark:bg-obsidian-card">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p
        className={`mt-2 font-mono text-xl font-black tabular-nums tracking-tight ${
          danger ? "text-rose-600" : "text-slate-950 dark:text-mist"
        }`}
      >
        {value}
      </p>
      {detail && <p className="mt-1 truncate text-[10px] font-medium text-slate-400">{detail}</p>}
    </div>
  );
}

function Badge({ tone = "slate", children }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600 dark:bg-obsidian-raised dark:text-mist-muted",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

function ActionButton({ icon: Icon, children, onClick, to, tone = "default", disabled }) {
  const cls = `inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[11px] font-bold transition disabled:opacity-50 ${
    tone === "primary"
      ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
      : tone === "danger"
      ? "border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/30"
      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist dark:hover:bg-obsidian-raised"
  }`;
  const content = (
    <>
      <Icon size={13} />
      {children}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={cls}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {content}
    </button>
  );
}

// ------------------------------------------------------------
// Member standing grid (members x months) for ONE contribution
// ------------------------------------------------------------

function StandingGrid({ chamaId, plan }) {
  const [grid, setGrid] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    contributionPlanApi
      .getPlanGrid(chamaId, plan.id)
      .then((res) => !cancelled && setGrid(res.data?.data || null))
      .catch((err) => !cancelled && setError(err.response?.data?.message || "Could not load member standing."));
    return () => {
      cancelled = true;
    };
  }, [chamaId, plan.id]);

  if (error) {
    return <p className="px-6 py-5 text-xs font-semibold text-rose-600">{error}</p>;
  }
  if (!grid) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
      </div>
    );
  }
  if (!grid.rows.length) {
    return <p className="px-6 py-5 text-xs font-medium text-slate-400">No active members yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-[11px]">
        <thead>
          <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-wide text-slate-400 dark:border-obsidian-border">
            <th className="sticky left-0 bg-white px-4 py-2.5 dark:bg-obsidian-card">Member</th>
            {grid.periods.map((p) => (
              <th key={p.key} className="px-2 py-2.5 text-center">
                {p.label}
              </th>
            ))}
            <th className="px-4 py-2.5 text-right">Owes</th>
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row) => (
            <tr key={row.membership_id} className="border-b border-slate-50 dark:border-obsidian-border/50">
              <td className="sticky left-0 bg-white px-4 py-2 font-bold text-slate-900 dark:bg-obsidian-card dark:text-mist">
                {row.name}
              </td>
              {grid.periods.map((p) => {
                const cell = row.cells[p.key];
                return (
                  <td key={p.key} className="px-1.5 py-1.5 text-center">
                    {cell ? (
                      <span
                        title={`${money(cell.paid)} of ${money(cell.expected)}`}
                        className={`inline-block min-w-[44px] rounded-md px-1.5 py-1 font-mono font-bold ${
                          CELL_TONE[cell.status] || CELL_TONE.pending
                        }`}
                      >
                        {cell.status === "paid" ? "Paid" : money(cell.paid).replace("KES ", "")}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                );
              })}
              <td
                className={`px-4 py-2 text-right font-mono font-black ${
                  row.outstanding_total > 0 ? "text-rose-600" : "text-slate-400"
                }`}
              >
                {money(row.outstanding_total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------
// One contribution
// ------------------------------------------------------------

function PlanCard({ plan, chamaId, base, canRecord }) {
  const [showGrid, setShowGrid] = useState(false);

  const period = plan.periods?.find((p) => p.key === plan.current_period_key) || null;
  const rate = period && period.expected > 0 ? (period.paid / period.expected) * 100 : null;
  const paused = plan.status === "paused";
  const managedElsewhere = !plan.can_pause_or_archive;
  const amountLabel =
    plan.amount_mode && plan.amount_mode !== "fixed"
      ? "Amount varies by member"
      : plan.amount
      ? `${money(plan.amount)} each`
      : "No amount set";

  return (
    <Card className={`overflow-hidden p-0 ${paused ? "opacity-90" : ""}`}>
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-black text-slate-950 dark:text-mist">{plan.name}</h3>
              {isRecentlyAdded(plan.created_at) && <Badge tone="sky">New</Badge>}
              <Badge tone={paused ? "amber" : "emerald"}>{paused ? "Paused" : "Active"}</Badge>
              {plan.behavior === "rotation" && <Badge tone="violet">Merry-go-round</Badge>}
            </div>
            <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-mist-muted">
              {amountLabel} · {cadenceLabel(plan)} · due day {plan.schedule?.due_day ?? "-"}
              {plan.schedule?.grace_days ? ` · ${plan.schedule.grace_days}-day grace` : ""}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-slate-400">
              <Users size={11} />
              {plan.applies_to?.mode === "selected"
                ? `${plan.applies_to.count} selected member${plan.applies_to.count === 1 ? "" : "s"}`
                : "All members"}
              {plan.created_at ? ` · added ${formatDate(plan.created_at)}` : ""}
            </p>
          </div>
        </div>

        {paused && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            Paused{plan.pause_reason ? `: ${plan.pause_reason}` : ""}. Nothing opens, turns overdue or accrues penalties
            until you resume it.
          </p>
        )}

        {/* Current period */}
        {plan.aligned && period && !paused && (
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-obsidian-raised/40">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{period.label}</p>
                <p className="mt-1 font-mono text-base font-black text-slate-950 dark:text-mist">
                  {money(period.paid)} <span className="text-xs font-bold text-slate-400">of {money(period.expected)}</span>
                </p>
              </div>
              <div className="text-right text-[10px] font-semibold text-slate-400">
                <p>
                  {period.paid_count} of {period.members} paid
                </p>
                {period.overdue_count > 0 ? (
                  <p className="font-black text-rose-600">{period.overdue_count} overdue</p>
                ) : (
                  <p>Due {formatDate(period.due_date)}</p>
                )}
              </div>
            </div>
            {rate !== null && (
              <div className="mt-3">
                <ProgressBar value={rate} tone={rate >= 80 ? "emerald" : rate >= 40 ? "amber" : "rose"} />
                <p className="mt-1 text-right text-[10px] font-bold text-slate-400">{percent(rate)} collected</p>
              </div>
            )}
          </div>
        )}

        {!plan.aligned && (
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-[11px] font-medium text-slate-600 dark:bg-obsidian-raised/40 dark:text-mist-muted">
            <p className="font-black text-slate-900 dark:text-mist">Rolling contribution</p>
            {plan.legacy ? (
              <p className="mt-1">
                {plan.legacy.open_count} open due{plan.legacy.open_count === 1 ? "" : "s"} ·{" "}
                {money(plan.legacy.outstanding)} outstanding
                {plan.legacy.overdue_count ? ` · ${plan.legacy.overdue_count} overdue` : ""}
              </p>
            ) : (
              <p className="mt-1">Nothing is currently owed against this contribution.</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {canRecord && !paused && (
            <ActionButton
              icon={PlusCircle}
              tone="primary"
              to={`${base}/finance/record-contribution?plan=${plan.id}`}
            >
              Record payment
            </ActionButton>
          )}
          {plan.aligned && (
            <ActionButton icon={Table2} onClick={() => setShowGrid((v) => !v)}>
              {showGrid ? "Hide member standing" : "Member standing"}
            </ActionButton>
          )}
          {/* Create / edit / pause / archive are leadership settings and live
              in the Leadership Desk, not on this page. */}
          <ActionButton icon={Settings2} to={`${base}/leadership?tab=contributions`}>
            Settings
          </ActionButton>
          {managedElsewhere && plan.behavior === "rotation" && (
            <ActionButton icon={RefreshCw} to={`${base}/mgr`}>
              Run from MGR
            </ActionButton>
          )}
        </div>
      </div>

      {showGrid && (
        <div className="border-t border-slate-100 dark:border-obsidian-border">
          <StandingGrid chamaId={chamaId} plan={plan} />
        </div>
      )}
    </Card>
  );
}

// ------------------------------------------------------------
// Main view
// ------------------------------------------------------------

export default function ManageContributions({ chamaId, base, canRecord }) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [filter, setFilter] = useState("active");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await contributionPlanApi.getLeadershipOverview(chamaId);
      setOverview(res.data?.data || null);
    } catch (err) {
      setNotice({ type: "error", text: err.response?.data?.message || "Failed to load contributions." });
    } finally {
      setLoading(false);
    }
  }, [chamaId]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn, successText) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      if (successText) setNotice({ type: "success", text: successText });
      window.dispatchEvent(new Event("finance:updated"));
      await load();
    } catch (err) {
      setNotice({ type: "error", text: err.response?.data?.message || "That action failed." });
    } finally {
      setBusy(false);
    }
  };

  const plans = overview?.plans || [];
  const archived = overview?.archived_plans || [];
  const activePlans = plans.filter((p) => p.status === "active");
  const pausedPlans = plans.filter((p) => p.status === "paused");
  const summary = overview?.summary;

  const visible = useMemo(() => {
    if (filter === "paused") return pausedPlans;
    if (filter === "archived") return [];
    return activePlans;
  }, [filter, activePlans, pausedPlans]);

  const counts = { active: activePlans.length, paused: pausedPlans.length, archived: archived.length };

  if (loading && !overview) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs font-semibold ${
            notice.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
          }`}
        >
          <span className="flex items-center gap-2">
            {notice.type === "error" ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
            {notice.text}
          </span>
        </div>
      )}

      {/* Financial year must exist before anything can be scheduled */}
      {overview?.needs_financial_year ? (
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <CalendarRange size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-slate-950 dark:text-mist">A financial year has not been set up yet</h2>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-mist-muted">
                Every contribution&apos;s monthly calendar is drawn inside the financial year. A leader sets it up in the Leadership Desk.
              </p>
              <div className="mt-4">
                <ActionButton icon={Settings2} to={`${base}/leadership?tab=contributions`}>
                  Open Leadership Desk
                </ActionButton>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Active contributions"
              value={activePlans.length}
              detail={pausedPlans.length ? `${pausedPlans.length} paused` : overview?.financial_year?.label}
            />
            <Stat
              label="Collected this period"
              value={money(summary?.collected_this_period)}
              detail="Across all contributions"
            />
            <Stat
              label="Outstanding now"
              value={money(summary?.outstanding_now)}
              detail="Opened and unpaid"
            />
            <Stat
              label="Overdue members"
              value={summary?.overdue_members ?? 0}
              detail={summary?.overdue_members ? "Need a reminder" : "Everyone is on time"}
              danger={Number(summary?.overdue_members) > 0}
            />
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-obsidian-raised">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`rounded-lg px-3.5 py-1.5 text-[11px] font-black transition ${
                    filter === f.key
                      ? "bg-white text-slate-950 shadow-sm dark:bg-obsidian-card dark:text-mist"
                      : "text-slate-500 hover:text-slate-800 dark:text-mist-muted"
                  }`}
                >
                  {f.label} <span className="ml-0.5 text-slate-400">{counts[f.key]}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <ActionButton
                icon={RefreshCw}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const res = await contributionPlanApi.runCalendarNow(chamaId);
                    const s = res.data?.data;
                    if (s) {
                      setNotice({
                        type: "success",
                        text: `Refreshed: ${s.created} due(s) opened, ${s.overdue} marked overdue, ${s.reminders} reminder(s) sent.`,
                      });
                    }
                  })
                }
              >
                Refresh now
              </ActionButton>
              <ActionButton icon={CircleDollarSign} to={`${base}/finance/contributions/register`}>
                Payment register
              </ActionButton>
              <ActionButton icon={Settings2} to={`${base}/leadership?tab=contributions`}>
                Contribution settings
              </ActionButton>
            </div>
          </div>

          {/* Contribution cards */}
          {filter !== "archived" &&
            (visible.length === 0 ? (
              <Card className="p-2">
                <EmptyState
                  icon={CircleDollarSign}
                  title={filter === "paused" ? "Nothing is paused" : "No contributions yet"}
                  description={
                    filter === "paused"
                      ? "Paused contributions will show up here."
                      : "Create your first contribution (welfare, shares, registration or your own) and members will see it straight away."
                  }
                  action={
                    filter === "active" ? (
                      <ActionButton icon={Settings2} to={`${base}/leadership?tab=contributions`}>
                        Set up in Leadership Desk
                      </ActionButton>
                    ) : null
                  }
                />
              </Card>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {visible.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    chamaId={chamaId}
                    base={base}
                    canRecord={canRecord}
                  />
                ))}
              </div>
            ))}

          {/* Archived */}
          {filter === "archived" && (
            <Card className="overflow-hidden p-0">
              {archived.length === 0 ? (
                <p className="px-6 py-10 text-center text-xs font-semibold text-slate-400">No archived contributions.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-obsidian-border">
                  {archived.map((plan) => (
                    <div key={plan.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900 dark:text-mist">{plan.name}</p>
                        <p className="text-[10px] font-medium text-slate-400">
                          Archived {formatDate(plan.archived_at)}
                          {plan.archive_reason ? ` · ${plan.archive_reason}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}