import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  AlertTriangle, CircleDollarSign, Copy, Download, Loader2, PiggyBank, Printer, Smartphone, Sparkles, Wallet,
} from "lucide-react";

import contributionPlanApi from "@/modules/contribution-group/api/contributionPlan.api";
import MpesaStkModal from "../MpesaStkModal";
import { Card, EmptyState, ProgressBar, formatDate, money } from "../FinanceUi";
import { TransactionsCta, cadenceLabel, isRecentlyAdded } from "../MoneyHub";
import useWorkspace from "@/app/hooks/useWorkspace";
import useAuth from "@/app/hooks/useAuth";
import { DAY_MS, Ring, Tabs, SampleTag, btnGhost, btnPrimary, downloadCsv, fmt, printDocument, useTicker } from "../../lib/proKit";
import { PENALTY_RULES, SAMPLE_PAYBILL, SHOW_SAMPLE } from "../../lib/financeSample";

// ============================================================
// MY CONTRIBUTIONS  (every member, incl. officials acting as members)
// ============================================================
//
// The member's own side of the money: what each contribution asks of
// them, what is due, what is overdue, what they have already paid and
// a one-tap way to pay. Reads the member calendar read model, which is
// scoped to the signed-in member on the server, so nobody can see
// anybody else's figures here.
// ============================================================

const STATE_STYLE = {
  paid: { label: "Paid", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  prepaid: { label: "Prepaid", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  waived: { label: "Waived", cls: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300" },
  open: { label: "Open", cls: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300" },
  due: { label: "Due now", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  overdue: { label: "Overdue", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
  upcoming: { label: "Upcoming", cls: "bg-slate-100 text-slate-500 dark:bg-obsidian-raised dark:text-mist-muted" },
};

function StatePill({ state }) {
  const s = STATE_STYLE[state] || STATE_STYLE.upcoming;
  return <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${s.cls}`}>{s.label}</span>;
}

function Stat({ label, value, detail, danger }) {
  return (
    <div className="p-4 sm:p-5">
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

export default function MyContributions({ chamaId, base }) {
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payTarget, setPayTarget] = useState(null);
  const [tab, setTab] = useState("pay");
  const now = useTicker(60_000);
  const ws = useWorkspace();
  const groupName = ws?.currentWorkspace?.name || ws?.activeWorkspace?.name || "Your group";
  const { user } = useAuth();
  const memberName = user?.name || "Member";
  const rule = PENALTY_RULES[0];

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await contributionPlanApi.getMemberCalendar(chamaId);
      setCalendar(res.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load your contributions.");
    } finally {
      setLoading(false);
    }
  }, [chamaId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("finance:updated", handler);
    return () => window.removeEventListener("finance:updated", handler);
  }, [load]);

  const months = calendar?.months || [];
  const plans = calendar?.plans || [];
  const summary = calendar?.summary;

  // Everything I can actually pay right now.
  const payable = useMemo(
    () =>
      months
        .flatMap((m) => m.items.map((item) => ({ ...item, month_label: m.label })))
        .filter((i) => ["overdue", "due", "open"].includes(i.state) && i.outstanding > 0)
        .sort((a, b) => {
          const order = { overdue: 0, due: 1, open: 2 };
          return order[a.state] - order[b.state] || new Date(a.due_date) - new Date(b.due_date);
        }),
    [months]
  );


  // ---------- derived: cycle (this month) ----------
  const cycle = useMemo(() => {
    const d = new Date(now);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const total = Math.round((end - start) / DAY_MS) + 1;
    const elapsed = Math.min(total, Math.max(0, Math.ceil((now - start) / DAY_MS)));
    const dues = payable
      .map((i) => new Date(i.due_date))
      .filter((x) => !Number.isNaN(x.getTime()) && x >= start && x <= end);
    const due = dues.length ? new Date(Math.min(...dues)) : end;
    return {
      name: start.toLocaleDateString("en-KE", { month: "long", year: "numeric" }),
      start, end, due, total, elapsed,
      dueIn: Math.ceil((due - now) / DAY_MS),
    };
  }, [now, payable]);

  // ---------- derived: arrears age + estimated penalty ----------
  const daysLate = (item) => Math.max(0, Math.floor((now - new Date(item.due_date)) / DAY_MS));
  const overdueItems = payable.filter((i) => i.state === "overdue");
  const oldestLate = overdueItems.reduce((m, i) => Math.max(m, daysLate(i)), 0);
  const penaltyItems = overdueItems.filter((i) => daysLate(i) > rule.graceDays);
  const estPenalty = penaltyItems.length * rule.fee;

  const standing = (() => {
    if (Number(summary?.overdue) > 0) return { label: "Behind", cls: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300", tone: "rose" };
    if (Number(summary?.outstanding) <= 0) return { label: "Paid up", cls: "bg-emerald-100 text-emerald-800 dark:bg-mint-deep dark:text-mint", tone: "emerald" };
    if (cycle.dueIn <= 5) return { label: "At risk", cls: "bg-amber-100 text-amber-800 dark:bg-amber-deep-bg dark:text-amber-deep-text", tone: "amber" };
    return { label: "On track", cls: "bg-emerald-100 text-emerald-800 dark:bg-mint-deep dark:text-mint", tone: "emerald" };
  })();

  // ---------- derived: statement (every opened month up to now) ----------
  const statementRows = useMemo(
    () =>
      months.flatMap((m) =>
        m.items.map((i) => ({
          month: m.label, plan: i.plan_name, expected: Number(i.expected) || 0,
          paid: Number(i.paid) || 0, balance: Number(i.outstanding) || 0, state: i.state, due: i.due_date,
        }))
      ).filter((r) => r.state !== "upcoming"),
    [months]
  );
  const stmt = useMemo(() => {
    const settled = statementRows.filter((r) => ["paid", "prepaid", "waived"].includes(r.state)).length;
    return {
      periods: statementRows.length,
      settled,
      paid: statementRows.reduce((s2, r) => s2 + r.paid, 0),
      owing: statementRows.reduce((s2, r) => s2 + r.balance, 0),
    };
  }, [statementRows]);

  const exportStatementCsv = () =>
    downloadCsv(`statement-${new Date().getFullYear()}.csv`, [
      ["Month", "Contribution", "Expected", "Paid", "Balance", "Status"],
      ...statementRows.map((r) => [r.month, r.plan, r.expected, r.paid, r.balance, r.state]),
    ]);
  const printStatement = () => {
    const ok = printDocument({
      title: `Statement ${new Date().getFullYear()}`, group: groupName, kind: "Member statement",
      meta: [["Member", memberName], ["Financial year", calendar?.financial_year?.label || String(new Date().getFullYear())],
             ["Periods settled", `${stmt.settled} of ${stmt.periods}`], ["Outstanding", `KES ${fmt(stmt.owing)}`]],
      rows: [["Month", "Contribution", "Status", "Paid (KES)"], ...statementRows.map((r) => [r.month, r.plan, r.state, fmt(r.paid)])],
      total: ["Total paid", `KES ${fmt(stmt.paid)}`],
    });
    if (!ok) toast.error("Allow pop-ups to print your statement.");
  };

  const accountRef = String(groupName).toUpperCase().replace(/\s+/g, "");
  const copyPaybill = async () => {
    try {
      await navigator.clipboard.writeText(`Paybill ${SAMPLE_PAYBILL.paybill}, Account ${accountRef}`);
      toast.success("Payment details copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  if (loading && !calendar) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <p className="flex items-center gap-2 text-xs font-bold text-rose-600">
          <AlertTriangle size={14} />
          {error}
        </p>
      </Card>
    );
  }

  if (calendar?.needs_financial_year || plans.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="p-2">
          <EmptyState
            icon={CircleDollarSign}
            title="No contributions to pay yet"
            description={
              calendar?.needs_financial_year
                ? "Your group's leadership has not opened the financial year yet. You will see your contributions here as soon as they do."
                : "When your group adds a contribution it will appear here with how much you owe and when."
            }
          />
        </Card>
        <TransactionsCta base={base} />
      </div>
    );
  }

  return (
    <div className="space-y-5 tabular-nums">
      {/* ================= cycle + KPIs ================= */}
      <Card className="overflow-hidden p-0">
        <div className="grid xl:grid-cols-[minmax(0,420px)_1fr]">
          <div className="flex items-center gap-5 border-b border-slate-100 p-5 dark:border-obsidian-border xl:border-b-0 xl:border-r">
            <Ring value={cycle.total ? (cycle.elapsed / cycle.total) * 100 : 0} tone={standing.tone === "rose" ? "rose" : standing.tone === "amber" ? "amber" : "emerald"}>
              <span className="text-2xl font-black leading-none">{cycle.elapsed}</span>
              <span className="mt-1 text-[10px] font-semibold text-slate-400">of {cycle.total} days</span>
            </Ring>
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-950 dark:text-mist">{cycle.name}</p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-mist-muted">
                {cycle.start.toLocaleDateString("en-KE", { day: "2-digit", month: "short" })} to {cycle.end.toLocaleDateString("en-KE", { day: "2-digit", month: "short" })}
              </p>
              <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${standing.cls}`}>{standing.label}</span>
              <p className="mt-2 text-[11px] font-semibold text-slate-600 dark:text-mist-muted">
                {Number(summary?.outstanding) <= 0
                  ? "Nothing due this cycle"
                  : cycle.dueIn < 0
                    ? `Overdue by ${Math.abs(cycle.dueIn)} day${Math.abs(cycle.dueIn) === 1 ? "" : "s"}`
                    : `Due in ${cycle.dueIn} day${cycle.dueIn === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 dark:divide-obsidian-border lg:grid-cols-4 lg:divide-y-0">
            <Stat label="You owe" value={money(summary?.outstanding)} detail={summary?.outstanding > 0 ? "Across open contributions" : "You are all paid up"} />
            <Stat
              label="Overdue"
              value={money(summary?.overdue)}
              detail={summary?.overdue > 0 ? `Oldest is ${oldestLate} day${oldestLate === 1 ? "" : "s"} late` : "Nothing overdue"}
              danger={Number(summary?.overdue) > 0}
            />
            <Stat label="Paid this year" value={money(summary?.paid_this_year)} detail={`${stmt.settled} of ${stmt.periods} periods settled`} />
            <Stat label="Paid in advance" value={money(summary?.advance_held)} detail={summary?.advance_held > 0 ? "Covers upcoming months" : "No advance held"} />
          </div>
        </div>
        {estPenalty > 0 && (
          <div className="flex items-start gap-2 border-t border-rose-100 bg-rose-50 px-5 py-3 text-[11px] font-semibold text-rose-800 dark:border-rose-950 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              {penaltyItems.length} contribution{penaltyItems.length === 1 ? " is" : "s are"} more than {rule.graceDays} days late. A late fee of {money(rule.fee)} each (about {money(estPenalty)}) may be added under your group's rules. Paying now keeps it from growing.
            </span>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <Card className="overflow-hidden p-0">
            <div className="px-5 pt-2">
              <Tabs
                value={tab}
                onChange={setTab}
                tabs={[
                  { key: "pay", label: "To pay", count: payable.length, alert: overdueItems.length > 0 },
                  { key: "plans", label: "My contributions", count: plans.length },
                  { key: "statement", label: "Statement" },
                ]}
              />
            </div>

            {tab === "pay" && (
              payable.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <Sparkles size={20} className="mx-auto text-emerald-500" />
                  <p className="mt-2 text-xs font-bold text-slate-900 dark:text-mist">Nothing to pay right now</p>
                  <p className="text-[10px] font-medium text-slate-400">Every opened contribution is covered.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-obsidian-border">
                  {payable.map((item) => {
                    const late = item.state === "overdue" ? daysLate(item) : 0;
                    const until = Math.ceil((new Date(item.due_date) - now) / DAY_MS);
                    return (
                      <div key={`${item.plan_id}-${item.period_key}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-xs font-black text-slate-900 dark:text-mist">{item.plan_name}</p>
                            <StatePill state={item.state} />
                            {late > rule.graceDays && (
                              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                                Late fee risk
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                            {item.month_label} · due {formatDate(item.due_date)}
                            {late > 0 ? ` · ${late} day${late === 1 ? "" : "s"} late` : until >= 0 ? ` · in ${until} day${until === 1 ? "" : "s"}` : ""}
                            {item.paid > 0 ? ` · ${money(item.paid)} paid so far` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="font-mono text-sm font-black text-slate-950 dark:text-mist">{money(item.outstanding)}</p>
                          {item.obligation_id ? (
                            <button type="button" onClick={() => setPayTarget(item)} className={btnPrimary}>
                              <Smartphone size={13} /> Pay
                            </button>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-400">Opening soon</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {tab === "plans" && (
              <div className="grid gap-4 p-5 xl:grid-cols-2">
        {plans.map((plan) => {
          const items = months
            .map((m) => ({ month: m, item: m.items.find((i) => String(i.plan_id) === String(plan.id)) }))
            .filter((x) => x.item);
          const current = items.find((x) => x.month.is_current)?.item || null;
          const rate = current && current.expected > 0 ? (current.paid / current.expected) * 100 : null;
          return (
            <Card key={plan.id} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-black text-slate-950 dark:text-mist">{plan.name}</h3>
                {isRecentlyAdded(plan.created_at) && (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                    New
                  </span>
                )}
                {current && <StatePill state={current.state} />}
                {items.length > 0 && (
                  <span className="ml-auto text-[10px] font-bold text-slate-400">
                    {items.filter((x) => ["paid", "prepaid", "waived"].includes(x.item.state)).length} of {items.length} months settled
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-mist-muted">
                {plan.amount && plan.amount_mode === "fixed" ? `${money(plan.amount)} · ` : ""}
                {cadenceLabel(plan)}
              </p>
              {plan.timing_note && <p className="mt-0.5 text-[10px] font-medium text-slate-400">{plan.timing_note}</p>}

              {current && (
                <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-obsidian-raised/40">
                  <div className="flex items-end justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      This month
                    </p>
                    <p className="font-mono text-sm font-black text-slate-950 dark:text-mist">
                      {money(current.paid)}{" "}
                      <span className="text-[11px] font-bold text-slate-400">of {money(current.expected)}</span>
                    </p>
                  </div>
                  {rate !== null && (
                    <div className="mt-2">
                      <ProgressBar value={rate} tone={rate >= 100 ? "emerald" : rate > 0 ? "amber" : "rose"} />
                    </div>
                  )}
                  <p className="mt-2 text-[10px] font-medium text-slate-500 dark:text-mist-muted">{current.message}</p>
                </div>
              )}

              {/* Month-by-month for this contribution */}
              {items.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {items.map(({ month, item }) => {
                    const style = STATE_STYLE[item.state] || STATE_STYLE.upcoming;
                    return (
                      <span
                        key={month.key}
                        title={`${month.label}: ${item.message}`}
                        className={`rounded-lg px-2 py-1 text-[10px] font-black ${style.cls} ${
                          month.is_current ? "ring-2 ring-slate-900/20 dark:ring-white/30" : ""
                        }`}
                      >
                        {month.label.split(" ")[0].slice(0, 3)}
                      </span>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
              </div>
            )}

            {tab === "statement" && (
              <div className="p-5">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-obsidian-raised/40">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Settled</p>
                    <p className="mt-1 text-sm font-black">{stmt.settled} of {stmt.periods}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-obsidian-raised/40">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total paid</p>
                    <p className="mt-1 text-sm font-black">KES {fmt(stmt.paid)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-obsidian-raised/40">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Outstanding</p>
                    <p className={`mt-1 text-sm font-black ${stmt.owing > 0 ? "text-rose-600" : ""}`}>KES {fmt(stmt.owing)}</p>
                  </div>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      <tr><th className="py-2 pr-3">Month</th><th className="px-3 py-2">Contribution</th><th className="px-3 py-2 text-right">Expected</th><th className="px-3 py-2 text-right">Paid</th><th className="py-2 pl-3 text-right">Status</th></tr>
                    </thead>
                    <tbody>
                      {statementRows.length === 0 && (
                        <tr><td colSpan={5} className="py-8 text-center text-slate-400">Nothing on your statement yet.</td></tr>
                      )}
                      {statementRows.map((r, i) => (
                        <tr key={`${r.month}-${r.plan}-${i}`} className="border-t border-slate-100 dark:border-obsidian-border">
                          <td className="py-2.5 pr-3 font-semibold">{r.month}</td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-mist-muted">{r.plan}</td>
                          <td className="px-3 py-2.5 text-right">{fmt(r.expected)}</td>
                          <td className="px-3 py-2.5 text-right font-bold">{fmt(r.paid)}</td>
                          <td className="py-2.5 pl-3 text-right"><StatePill state={r.state} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={printStatement} disabled={!statementRows.length} className={btnPrimary}><Printer size={13} /> Print or save PDF</button>
                  <button onClick={exportStatementCsv} disabled={!statementRows.length} className={btnGhost}><Download size={13} /> CSV</button>
                </div>
              </div>
            )}
          </Card>

      {(calendar?.advance || []).length > 0 && (
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <PiggyBank size={18} className="mt-0.5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-black text-slate-950 dark:text-mist">Paid in advance</h3>
              <ul className="mt-2 space-y-1 text-[11px] font-medium text-slate-600 dark:text-mist-muted">
                {calendar.advance.map((a) => (
                  <li key={`${a.plan_name}-${a.period_key}`}>
                    {money(a.amount)} already covers {a.plan_name} for {a.period_label}.
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

        </div>

        {/* ================= right rail ================= */}
        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-950 dark:text-mist">Pay by M-Pesa</h3>
              {SHOW_SAMPLE && <SampleTag />}
            </div>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-mist-muted">Paybill</dt><dd className="font-mono font-bold">{SAMPLE_PAYBILL.paybill}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-mist-muted">Account</dt><dd className="break-all text-right font-mono font-bold">{accountRef}</dd></div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {payable[0]?.obligation_id && (
                <button onClick={() => setPayTarget(payable[0])} className={btnPrimary}><Smartphone size={13} /> Pay {money(payable[0].outstanding)}</button>
              )}
              <button onClick={copyPaybill} className={btnGhost}><Copy size={13} /> Copy details</button>
            </div>
            <p className="mt-3 text-[10px] text-slate-400">Payments made by Paybill are matched to you automatically.</p>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-black text-slate-950 dark:text-mist">Late payment rule</h3>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-600 dark:text-mist-muted">
              {rule.label}: {money(rule.fee)}. You have {rule.graceDays} days after the due date before a fee applies.
            </p>
            {SHOW_SAMPLE && <div className="mt-2"><SampleTag title="Rule shown from the default constitution until your group's own rules are connected." /></div>}
          </Card>

          <div className="grid gap-4">
            <TransactionsCta base={base} />
            <Link
              to={`${base}/finance/wallet`}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-obsidian-border dark:bg-obsidian-card"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-obsidian-raised dark:text-mist">
                <Wallet size={18} />
              </div>
              <div>
                <p className="text-sm font-black text-slate-950 dark:text-mist">My wallet</p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-400">Your whole money position</p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      <MpesaStkModal
        isOpen={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
        chamaId={chamaId}
        obligationId={payTarget?.obligation_id}
        title={payTarget ? `Pay ${payTarget.plan_name} (${payTarget.month_label})` : "Pay contribution"}
        onSuccess={load}
      />
    </div>
  );
}
