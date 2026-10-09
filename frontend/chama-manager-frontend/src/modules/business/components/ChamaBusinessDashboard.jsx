import React from "react";
import {
  AlertTriangle,
  Info,
  OctagonAlert,
  Landmark,
  HandCoins,
  TrendingUp,
  Percent,
  UserCog,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Store,
  UtensilsCrossed,
  Home,
  Wrench,
  Briefcase,
} from "lucide-react";

import { useChamaBusinessDashboard } from "../hooks/useBusiness";

/* ============================================================
   CHAMA BUSINESS DASHBOARD

   Shown on the Business Dashboard of a chama-owned business.
   Two layers, both served by GET /businesses/:id/chama-dashboard:

     1. What the chama cares about: capital in, capital back,
        profit, ROI, who runs it and whether they are reporting.
     2. What the business is: a block chosen by category
        (retail stock, restaurant kitchen, rental rent roll,
        service jobs) so a landlord, a shopkeeper and a cook are
        never shown the same generic "sales" panel.

   All figures are computed server-side; this component only
   formats them.
============================================================ */

const CATEGORY_ICON = {
  retail: Store,
  restaurant: UtensilsCrossed,
  rental: Home,
  service: Wrench,
  other: Briefcase,
};

const TONES = {
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
};

const ALERT_STYLES = {
  danger: { box: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200", Icon: OctagonAlert },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200", Icon: AlertTriangle },
  info: { box: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200", Icon: Info },
};

const card = "rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";
const heading = "text-sm font-bold uppercase tracking-wider text-slate-400";

function formatValue(value, format, currency) {
  const n = Number(value ?? 0);
  if (format === "money") return `${currency} ${n.toLocaleString()}`;
  if (format === "percent") return `${n.toLocaleString()}%`;
  return n.toLocaleString();
}

const pct = (value) => (value === null || value === undefined ? "—" : `${Number(value).toLocaleString()}%`);

export function ChamaBusinessDashboard({ workspaceId, currency: fallbackCurrency = "KES" }) {
  const { data, isLoading, isError } = useChamaBusinessDashboard(workspaceId);

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        <div className="h-48 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={`${card} text-sm text-slate-500 dark:text-slate-400`}>
        The chama performance view could not be loaded right now. The rest of the dashboard is unaffected.
      </div>
    );
  }

  const currency = data.business?.currency || fallbackCurrency;
  const money = (v) => formatValue(v, "money", currency);
  const { performance, capital, manager, goals, categoryInsights: insights, alerts } = data;

  return (
    <div className="space-y-6">
      {alerts?.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => {
            const style = ALERT_STYLES[alert.level] || ALERT_STYLES.info;
            return (
              <div key={`${alert.code}-${i}`} className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-xs font-semibold ${style.box}`}>
                <style.Icon size={15} className="shrink-0" />
                {alert.message}
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Chama stake -------------------------------------------------- */}
      <div className={card}>
        <h2 className={`${heading} mb-4`}>Chama investment{data.chama?.name ? ` · ${data.chama.name}` : ""}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Capital invested" value={money(capital.invested)} hint={capital.topUps > 0 ? `${money(capital.initial)} + ${money(capital.topUps)} top-ups` : "Acquisition cost"} icon={Landmark} tone="violet" />
          <Stat label="Returned to chama" value={money(capital.returned)} hint={`${pct(capital.paybackPct)} of capital paid back`} icon={HandCoins} tone="emerald" />
          <Stat label="Lifetime net profit" value={money(performance.lifetime.net)} hint={`${money(performance.lifetime.income)} in · ${money(performance.lifetime.spend)} out`} icon={TrendingUp} tone={performance.lifetime.net >= 0 ? "cyan" : "amber"} />
          <Stat label="Return on investment" value={pct(capital.roiPct)} hint="Lifetime net ÷ capital invested" icon={Percent} tone="sky" />
        </div>
      </div>

      {/* ---- This month + trend ------------------------------------------ */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className={`${card} lg:col-span-2`}>
          <h2 className={`${heading} mb-4`}>This month</h2>
          <div className="space-y-4">
            <MonthRow label="Income" value={money(performance.thisMonth.income)} change={performance.thisMonth.incomeChangePct} goodWhenUp />
            <MonthRow label="Spending" value={money(performance.thisMonth.spend)} change={performance.thisMonth.spendChangePct} goodWhenUp={false} />
            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Net</p>
              <p className={`mt-1 text-xl font-extrabold tracking-tight ${performance.thisMonth.net >= 0 ? "text-slate-900 dark:text-white" : "text-rose-600 dark:text-rose-400"}`}>
                {money(performance.thisMonth.net)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">Margin {pct(performance.thisMonth.margin)}</p>
            </div>
          </div>
        </div>

        <div className={`${card} lg:col-span-3`}>
          <TrendBars trend={performance.trend} money={money} />
        </div>
      </div>

      {/* ---- Category-aware block ---------------------------------------- */}
      <CategoryPanel insights={insights} currency={currency} />

      {/* ---- Accountability ---------------------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className={card}>
          <h2 className={`${heading} mb-4`}>Who runs it</h2>
          <div className="flex items-start gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONES.violet}`}><UserCog size={18} /></span>
            <div className="min-w-0 text-sm">
              <p className="font-bold text-slate-900 dark:text-white">{manager.name || "No manager assigned"}</p>
              <p className="text-xs capitalize text-slate-500 dark:text-slate-400">
                {manager.type === "member" ? "Chama member" : manager.type === "external" ? "External manager" : manager.type}
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {manager.reportingEnabled
                  ? `Reports ${manager.cadence || "regularly"}. Last report: ${manager.lastReportStatus || "none yet"}${manager.lastReportAt ? ` (${new Date(manager.lastReportAt).toLocaleDateString()})` : ""}.`
                  : "Manager reporting is switched off for this business."}
              </p>
              {manager.overdueReports > 0 && (
                <p className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-400">{manager.overdueReports} overdue or missed</p>
              )}
            </div>
          </div>
        </div>

        <div className={card}>
          <h2 className={`${heading} mb-4`}>Targets</h2>
          {goals.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No active targets are linked to this business.</p>
          ) : (
            <div className="space-y-4">
              {goals.map((goal) => (
                <div key={goal.id}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100"><Target size={13} className="text-violet-500" />{goal.name}</span>
                    <span className="font-mono text-slate-500">{goal.progressPct}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-violet-600" style={{ width: `${goal.progressPct}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">{money(goal.savedAmount)} of {money(goal.targetAmount)}{goal.targetDate ? ` · by ${new Date(goal.targetDate).toLocaleDateString()}` : ""}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, icon: Icon, tone }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${TONES[tone] || TONES.violet}`}><Icon size={18} /></span>
      <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function MonthRow({ label, value, change, goodWhenUp }) {
  const hasChange = change !== null && change !== undefined;
  const up = Number(change) >= 0;
  const good = goodWhenUp ? up : !up;
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-1 text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">{value}</p>
      </div>
      {hasChange ? (
        <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${good ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
          {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {Math.abs(change)}% vs last month
        </span>
      ) : (
        <span className="text-[11px] text-slate-400">No last-month baseline</span>
      )}
    </div>
  );
}

function TrendBars({ trend = [], money }) {
  const max = Math.max(...trend.map((m) => Math.max(m.income, m.spend)), 1);
  const empty = trend.every((m) => m.income === 0 && m.spend === 0);
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className={heading}>Income vs spending · 6 months</h2>
        <div className="flex gap-4 text-xs font-medium text-slate-500">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-600" /> Income</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Spending</span>
        </div>
      </div>
      {empty ? (
        <div className="flex h-44 items-center justify-center rounded-xl border border-dashed text-sm text-slate-500">No completed transactions yet.</div>
      ) : (
        <div className="flex h-44 items-end gap-3 border-b border-slate-100 pb-2 pt-4 dark:border-slate-800">
          {trend.map((m) => (
            <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <div className="flex h-full w-full items-end justify-center gap-1">
                <div style={{ height: `${(m.income / max) * 100}%` }} className="w-1/2 max-w-[16px] rounded-t-sm bg-violet-600" title={`Income: ${money(m.income)}`} />
                <div style={{ height: `${(m.spend / max) * 100}%` }} className="w-1/2 max-w-[16px] rounded-t-sm bg-amber-500" title={`Spending: ${money(m.spend)}`} />
              </div>
              <span className="text-[10px] font-mono text-slate-400">{m.label}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function CategoryPanel({ insights, currency }) {
  if (!insights) return null;
  const Icon = CATEGORY_ICON[insights.kind] || Briefcase;
  return (
    <div className={card}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${TONES.emerald}`}><Icon size={16} /></span>
        <h2 className={heading}>{insights.title}</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {insights.metrics.map((m) => (
          <div key={m.key} className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{m.label}</p>
            <p className={`mt-1.5 text-lg font-extrabold tracking-tight ${m.tone === "warning" ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white"}`}>
              {formatValue(m.value, m.format, currency)}
            </p>
          </div>
        ))}
      </div>

      {insights.lists?.length > 0 && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {insights.lists.map((list) => (
            <div key={list.key} className="rounded-2xl border border-slate-200/80 p-4 dark:border-slate-800">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">{list.title}</p>
              {list.rows.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{list.empty}</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {list.rows.map((row, i) => (
                    <li key={`${row.label}-${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="truncate text-slate-700 dark:text-slate-200">{row.label}</span>
                      <span className="shrink-0 font-mono text-xs font-semibold text-slate-900 dark:text-white">
                        {list.valueFormat ? formatValue(row.value, list.valueFormat, currency) : row.value}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {list.footnote && <p className="mt-2 text-[11px] text-slate-400">{list.footnote}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ChamaBusinessDashboard;
