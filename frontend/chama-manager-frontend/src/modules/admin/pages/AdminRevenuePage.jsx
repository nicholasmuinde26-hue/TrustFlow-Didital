import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Banknote, Loader2, RefreshCw, TrendingDown, TrendingUp, Users } from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";

import Spinner from "@/shared/components/ui/Spinner";
import { billingAdminService } from "@/modules/billing/services/billing.service";

const kes = (n) => `KES ${Math.round(Number(n) || 0).toLocaleString("en-KE")}`;
const pctText = (n) => `${Number(n || 0).toFixed(1)}%`;
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const monthLabel = (ym) =>
  new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-KE", { month: "short", year: "2-digit", timeZone: "UTC" });

const MIN_PRICE = 10;

const STATE_TABS = [
  { key: "grace", label: "In grace" },
  { key: "read_only", label: "Read-only" },
  { key: "trial", label: "On trial" },
  { key: "active", label: "Paying" },
  { key: "free", label: "Free" },
];

function Kpi({ icon: Icon, label, value, sub, tone = "violet" }) {
  const tones = {
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <span className={clsx("flex h-9 w-9 items-center justify-center rounded-xl", tones[tone])}>
        <Icon size={16} />
      </span>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-extrabold tabular-nums text-slate-950 dark:text-white">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

function PlanEditor({ plan, onSaved }) {
  const [price, setPrice] = useState(String(plan.price_monthly));
  const [members, setMembers] = useState(plan.max_members ?? "");
  const [saving, setSaving] = useState(false);
  const isFree = plan.code === "free";

  const dirty =
    Number(price) !== plan.price_monthly || (members === "" ? null : Number(members)) !== (plan.max_members ?? null);

  const save = async () => {
    if (!isFree && (!Number.isInteger(Number(price)) || Number(price) < MIN_PRICE)) {
      toast.error(`A paid plan costs at least KES ${MIN_PRICE} a month`);
      return;
    }
    setSaving(true);
    try {
      await billingAdminService.updatePlan(plan.code, {
        price_monthly: Number(price),
        max_members: members === "" ? null : Number(members),
      });
      toast.success(`${plan.name} updated`);
      onSaved();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not save the plan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
      <div className="min-w-[110px]">
        <p className="text-sm font-extrabold">{plan.name}</p>
        <p className="text-[11px] text-slate-500">{plan.modules.length} features</p>
      </div>
      <label className="text-[11px] font-bold">
        Price / month (KES)
        <input
          type="number" min={isFree ? 0 : MIN_PRICE} step="1" value={price} disabled={isFree}
          onChange={(e) => setPrice(e.target.value)}
          className="mt-1 block h-9 w-32 rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
      </label>
      <label className="text-[11px] font-bold">
        Member limit (blank = unlimited)
        <input
          type="number" min="1" step="1" value={members}
          onChange={(e) => setMembers(e.target.value)}
          className="mt-1 block h-9 w-32 rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
      </label>
      <button
        type="button" disabled={!dirty || saving} onClick={save}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-violet-600 px-3 text-xs font-bold text-white disabled:opacity-40"
      >
        {saving ? <Loader2 size={13} className="animate-spin" /> : null} Save
      </button>
    </div>
  );
}

function GroupPriceCell({ row, plans, onSaved }) {
  const paid = plans.filter((p) => p.code !== "free");
  const [code, setCode] = useState(paid[0]?.code || "");
  const plan = paid.find((p) => p.code === code);
  const current = row.price_overrides?.[code];
  const [price, setPrice] = useState(current ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setPrice(row.price_overrides?.[code] ?? ""); }, [code, row.price_overrides]);

  const run = async (value) => {
    if (value !== null && (!Number.isInteger(Number(value)) || Number(value) < MIN_PRICE)) {
      toast.error(`A price must be a whole number of at least KES ${MIN_PRICE}`);
      return;
    }
    setSaving(true);
    try {
      await billingAdminService.setGroupPrice(row.chama_id, code, value === null ? null : Number(value));
      toast.success(value === null ? "Back to the list price" : "Special price saved");
      onSaved();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not save the price");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select value={code} onChange={(e) => setCode(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-1.5 text-xs capitalize dark:border-slate-700 dark:bg-slate-950" aria-label="Plan">
        {paid.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
      </select>
      <input
        type="number" min={MIN_PRICE} step="1" value={price}
        placeholder={plan ? String(plan.price_monthly) : ""}
        onChange={(e) => setPrice(e.target.value)}
        className="h-8 w-20 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950"
        aria-label="Special monthly price in KES"
      />
      <button type="button" disabled={saving || price === "" || Number(price) === current} onClick={() => run(price)} className="h-8 rounded-lg bg-violet-600 px-2.5 text-[11px] font-bold text-white disabled:opacity-40">Set</button>
      {current !== undefined && (
        <button type="button" disabled={saving} onClick={() => run(null)} className="h-8 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold dark:border-slate-700">Reset</button>
      )}
    </div>
  );
}

export default function AdminRevenuePage() {
  const [months, setMonths] = useState(6);
  const [metrics, setMetrics] = useState(null);
  const [plans, setPlans] = useState([]);
  const [tab, setTab] = useState("active");
  const [payments, setPayments] = useState({ items: [], total: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [subs, setSubs] = useState({ items: [], total: 0 });
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [m, p] = await Promise.all([billingAdminService.getMetrics(months), billingAdminService.listPlans()]);
      setMetrics(m);
      setPlans(p);
    } catch (e) {
      setError(e?.response?.data?.message || "Could not load revenue figures");
    }
  }, [months]);

  useEffect(() => { load(); }, [load]);

  const loadSubs = useCallback(() => {
    billingAdminService.listSubscriptions({ state: tab, limit: 25 }).then(setSubs).catch(() => setSubs({ items: [], total: 0 }));
  }, [tab]);
  useEffect(() => { loadSubs(); }, [loadSubs]);

  // Newest successful M-Pesa payments, so a payment is visible the moment it settles.
  const loadPayments = useCallback(() => (
    billingAdminService.listInvoices({ status: "paid", limit: 15 })
      .then(setPayments)
      .catch(() => setPayments({ items: [], total: 0 }))
  ), []);
  useEffect(() => { loadPayments(); }, [loadPayments]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([load(), loadSubs(), loadPayments()]);
    setRefreshing(false);
  }, [load, loadSubs, loadPayments]);

  // Keep the figures live while the page is open (and when the tab regains focus).
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") { load(); loadSubs(); loadPayments(); } };
    const id = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [load, loadSubs, loadPayments]);

  if (error) {
    return <p className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error}</p>;
  }
  if (!metrics) {
    return <div className="flex min-h-[320px] items-center justify-center"><Spinner /></div>;
  }

  const cur = metrics.current;
  const rows = metrics.months;
  const peak = Math.max(1, ...rows.map((r) => r.mrr));
  const last = rows[rows.length - 1];

  return (
    <div className="space-y-6 pb-16">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Platform revenue</h1>
          <p className="mt-1 text-sm text-slate-500">Subscriptions paid by chamas for the software. Member contributions are not counted here.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button" onClick={refreshAll} disabled={refreshing}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
          <select
            value={months} onChange={(e) => setMonths(Number(e.target.value))}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-900"
            aria-label="Months shown"
          >
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
            <option value={24}>Last 24 months</option>
          </select>
        </div>
      </header>

      {metrics.needs_review_invoices > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {metrics.needs_review_invoices} invoice{metrics.needs_review_invoices === 1 ? "" : "s"} need a manual look (a double payment or an underpayment). Check the M-Pesa statement and refund or credit as needed.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Banknote} label="Monthly recurring revenue" value={kes(cur.mrr)} sub={`${kes(cur.arr)} a year at this rate`} />
        <Kpi icon={Users} label="Paying groups" value={`${cur.paying_groups} of ${cur.total_groups}`} sub={`${pctText(cur.paid_share_pct)} have ever paid`} tone="emerald" />
        <Kpi icon={TrendingUp} label="Average per paying group" value={kes(cur.arpu_paying)} sub={`${kes(cur.arpu_all_groups)} across all groups`} />
        <Kpi
          icon={TrendingDown} label={`Churn · ${last ? monthLabel(last.month) : ""}`}
          value={pctText(last?.churn_rate)} sub={`${last?.churned ?? 0} left, ${last?.new_paying ?? 0} joined`} tone="amber"
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-extrabold">Month by month</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-2 pr-3">Month</th>
                <th className="py-2 pr-3">MRR</th>
                <th className="py-2 pr-3 text-right">Paying</th>
                <th className="py-2 pr-3 text-right">New</th>
                <th className="py-2 pr-3 text-right">Churned</th>
                <th className="py-2 pr-3 text-right">Churn</th>
                <th className="py-2 text-right">Collected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r) => (
                <tr key={r.month}>
                  <td className="py-2 pr-3 font-bold">{monthLabel(r.month)}{r.partial ? <span className="ml-1 font-normal text-slate-400">so far</span> : null}</td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-full rounded-full bg-violet-500" style={{ width: `${(r.mrr / peak) * 100}%` }} />
                      </div>
                      <span className="tabular-nums">{kes(r.mrr)}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.paying_groups}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.new_paying}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.churned}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{pctText(r.churn_rate)}</td>
                  <td className="py-2 text-right font-bold tabular-nums">{kes(r.collected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-slate-400">
          MRR counts each paid invoice at its monthly price, so a 12-month payment is not counted as one big month. Collected is the cash actually received that month.
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-extrabold">Where groups stand</h2>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-xs">
            {[["trial", "On trial"], ["active", "Paying"], ["grace", "In grace"], ["read_only", "Read-only"], ["free", "Free plan"]].map(([k, label]) => (
              <li key={k} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                <span>{label}</span><b className="tabular-nums">{cur.states[k] || 0}</b>
              </li>
            ))}
          </ul>
          <h3 className="mt-5 text-xs font-extrabold uppercase tracking-wider text-slate-400">Revenue by plan</h3>
          {Object.keys(cur.by_plan).length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">No paying groups yet.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-xs">
              {Object.entries(cur.by_plan).map(([code, v]) => (
                <li key={code} className="flex items-center justify-between">
                  <span className="capitalize">{code} · {v.groups} group{v.groups === 1 ? "" : "s"}</span>
                  <b className="tabular-nums">{kes(v.mrr)} / mo</b>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-extrabold">Plans and prices</h2>
          <p className="mt-1 text-[11px] text-slate-500">Set any whole-number price from KES 10 a month. A change applies to new invoices straight away; groups already paid up keep what they paid for.</p>
          <div className="mt-3 space-y-2">
            {plans.map((plan) => <PlanEditor key={`${plan.code}-${plan.updatedAt}`} plan={plan} onSaved={load} />)}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-extrabold">Recent payments</h2>
        <p className="mt-1 text-[11px] text-slate-500">Subscription payments received through M-Pesa, newest first.</p>
        {payments.items.length === 0 ? (
          <p className="mt-4 text-xs text-slate-500">No payments received yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-slate-400">
                <tr><th className="py-2 pr-3">Paid</th><th className="py-2 pr-3">Chama</th><th className="py-2 pr-3">Plan</th><th className="py-2 pr-3">Period</th><th className="py-2 pr-3">M-Pesa receipt</th><th className="py-2 text-right">Amount</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payments.items.map((p) => (
                  <tr key={String(p._id)}>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTime(p.paid_at)}</td>
                    <td className="py-2 pr-3 font-bold">{p.chama_id?.name || "(deleted chama)"}</td>
                    <td className="py-2 pr-3">{p.plan_name} · {p.months} mo</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(p.period_start)} – {fmtDate(p.period_end)}</td>
                    <td className="py-2 pr-3 font-mono">
                      {p.mpesa_receipt || "—"}
                      {p.needs_review && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">Review</span>}
                    </td>
                    <td className="py-2 text-right font-bold tabular-nums">{kes(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {payments.total > payments.items.length && <p className="mt-2 text-[11px] text-slate-400">Showing the latest {payments.items.length} of {payments.total}.</p>}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-extrabold">Groups by status</h2>
          <p className="w-full text-[11px] text-slate-500">Give a single group its own price for a plan, from KES 10. It applies to their next invoice only.</p>
          <div className="flex flex-wrap gap-1">
            {STATE_TABS.map((t) => (
              <button
                key={t.key} type="button" onClick={() => setTab(t.key)}
                className={clsx("rounded-lg px-3 py-1.5 text-xs font-bold", tab === t.key ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300")}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {subs.items.length === 0 ? (
          <p className="mt-4 text-xs text-slate-500">No groups in this status.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-slate-400">
                <tr><th className="py-2 pr-3">Chama</th><th className="py-2 pr-3">Plan</th><th className="py-2 pr-3">Access until</th><th className="py-2 pr-3">Last paid</th><th className="py-2 pr-3">Special price (KES / month)</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {subs.items.map((s) => (
                  <tr key={String(s.chama_id)}>
                    <td className="py-2 pr-3 font-bold">{s.chama_name}</td>
                    <td className="py-2 pr-3 capitalize">{s.plan_code}</td>
                    <td className="py-2 pr-3">{fmtDate(s.access_until)}</td>
                    <td className="py-2 pr-3">{fmtDate(s.last_paid_at)}</td>
                    <td className="py-2 pr-3"><GroupPriceCell row={s} plans={plans} onSaved={loadSubs} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {subs.total > subs.items.length && <p className="mt-2 text-[11px] text-slate-400">Showing {subs.items.length} of {subs.total}.</p>}
          </div>
        )}
      </section>
    </div>
  );
}