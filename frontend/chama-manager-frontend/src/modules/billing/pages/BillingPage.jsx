import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gem,
  Loader2,
  Lock,
  Receipt,
  Smartphone,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";

import useWorkspace from "@/app/hooks/useWorkspace";
import Spinner from "@/shared/components/ui/Spinner";
import billingService from "../services/billing.service";
import useBillingSummary from "../hooks/useBilling";
import { cheapestPlanWith, moduleLabel } from "../utils/planLocks";

const BILLING_ROLES = ["treasurer", "chairperson"];
const MONTH_OPTIONS = [
  { months: 1, label: "1 month" },
  { months: 3, label: "3 months" },
  { months: 12, label: "12 months", note: "Pay for 10, get 12" },
];
const POLL_MS = 4000;
const POLL_LIMIT_MS = 120_000;

const kes = (n) => `KES ${Math.round(Number(n) || 0).toLocaleString("en-KE")}`;
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "—";
const normalizeRole = (role) => String(role || "").toLowerCase().replaceAll(" ", "_");
const apiMessage = (error, fallback) => error?.response?.data?.message || fallback;

const STATE_LABEL = {
  trial: { text: "Free trial", cls: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300" },
  active: { text: "Active", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  free: { text: "Free plan", cls: "bg-slate-100 text-slate-700 dark:bg-obsidian-raised dark:text-mist" },
  grace: { text: "Expired · grace period", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  read_only: { text: "Read-only", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" },
};

const priceFor = (plan, months) => (plan?.price_monthly || 0) * (months === 12 ? 10 : months);

export default function BillingPage() {
  const { workspaceId } = useParams();
  const [searchParams] = useSearchParams();
  // Arrived here because a locked feature was clicked: ?unlock=loans&from=loans
  const unlockKey = searchParams.get("unlock");
  const unlockFrom = searchParams.get("from");
  const { workspaces, activeWorkspace } = useWorkspace();
  const workspace =
    workspaces?.find((w) => (w?.id ?? w?._id) === workspaceId) || activeWorkspace || {};
  const role = normalizeRole(workspace.role);
  const canManage = BILLING_ROLES.includes(role);
  const isTreasurer = role === "treasurer";

  const { summary, isLoading, refresh } = useBillingSummary(workspaceId);
  const [plans, setPlans] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selected, setSelected] = useState({ plan: null, months: 1 });
  const [invoice, setInvoice] = useState(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    setWaiting(false);
  }, []);
  useEffect(() => stopPolling, [stopPolling]);

  const loadInvoices = useCallback(async () => {
    if (!canManage) return;
    try {
      setInvoices(await billingService.listInvoices(workspaceId));
    } catch {
      /* the list is a convenience; the page still works without it */
    }
  }, [workspaceId, canManage]);

  useEffect(() => {
    billingService.getPlans(workspaceId).then(setPlans).catch(() => {});
    loadInvoices();
  }, [workspaceId, loadInvoices]);

  // Coming from a locked feature: preselect the cheapest plan that unlocks it.
  const unlockPlan = unlockKey ? cheapestPlanWith(plans, unlockKey) : null;
  const preselectedRef = useRef(false);
  useEffect(() => {
    if (preselectedRef.current || !unlockPlan) return;
    preselectedRef.current = true;
    setSelected({ plan: unlockPlan.code, months: 1 });
  }, [unlockPlan]);

  // Resume an invoice that was created but not paid yet. Only once, on first
  // load: afterwards the treasurer's own plan and length choices win.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current || !summary) return;
    resumedRef.current = true;
    if (summary.open_invoice) {
      setInvoice(summary.open_invoice);
      setSelected({ plan: summary.open_invoice.plan_code, months: summary.open_invoice.months });
    }
  }, [summary]);

  const chosenPlan = plans.find((p) => p.code === selected.plan) || null;

  const createInvoice = async () => {
    if (!chosenPlan) return;
    setBusy(true);
    try {
      setInvoice(await billingService.createInvoice(workspaceId, { planCode: chosenPlan.code, months: selected.months }));
    } catch (error) {
      toast.error(apiMessage(error, "Could not create the invoice"));
    } finally {
      setBusy(false);
    }
  };

  const startPolling = (invoiceId) => {
    stopPolling();
    setWaiting(true);
    const startedAt = Date.now();
    pollRef.current = setInterval(async () => {
      try {
        const { invoice: fresh } = await billingService.getInvoice(workspaceId, invoiceId);
        if (fresh.status === "paid") {
          stopPolling();
          setInvoice(null);
          toast.success("Payment received. Your plan is active.");
          refresh();
          loadInvoices();
          return;
        }
        const attempt = fresh.last_attempt;
        if (attempt && ["failed", "cancelled"].includes(attempt.status)) {
          stopPolling();
          setInvoice(fresh);
          toast.error(attempt.reason || "The payment was not completed. You can try again.");
          return;
        }
      } catch {
        /* keep waiting; a single failed poll is not a failed payment */
      }
      if (Date.now() - startedAt > POLL_LIMIT_MS) {
        stopPolling();
        toast("Still waiting for M-Pesa. If you approved it, refresh in a minute.");
      }
    }, POLL_MS);
  };

  const pay = async () => {
    if (!invoice) return;
    if (phone.replace(/\D/g, "").length < 9) return toast.error("Enter the M-Pesa number to charge");
    setBusy(true);
    try {
      const res = await billingService.payInvoice(workspaceId, invoice._id, phone);
      toast.success(res.message || "Check your phone to approve the payment");
      startPolling(invoice._id);
    } catch (error) {
      toast.error(apiMessage(error, "Could not start the M-Pesa payment"));
    } finally {
      setBusy(false);
    }
  };

  const switchToFree = async () => {
    if (!window.confirm("Switch this chama to the Free plan? Paid features will stop accepting new records. Existing records stay available.")) return;
    setBusy(true);
    try {
      await billingService.switchToFree(workspaceId);
      toast.success("Switched to the Free plan");
      setInvoice(null);
      refresh();
    } catch (error) {
      toast.error(apiMessage(error, "Could not switch plans"));
    } finally {
      setBusy(false);
    }
  };

  if (isLoading && !summary) {
    return <div className="flex min-h-[320px] items-center justify-center"><Spinner /></div>;
  }

  const state = STATE_LABEL[summary?.state] || STATE_LABEL.active;
  const endDate = summary?.state === "trial" ? summary?.trial_ends_at : summary?.current_period_end;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Plan &amp; billing</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-mist-muted">
          What this chama pays for the platform. It is separate from member contributions and never touches the chama&apos;s books.
        </p>
      </header>

      {unlockKey && (
        <section className="flex flex-wrap items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
            <Lock size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-amber-950 dark:text-amber-100">
              {moduleLabel(unlockKey)} is not part of the {summary?.plan?.name || "current"} plan
            </p>
            <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-200/80">
              {unlockPlan
                ? `It is included from the ${unlockPlan.name} plan at ${kes(unlockPlan.price_monthly)} a month.`
                : "Upgrade the plan to use it."}
              {!canManage ? " Ask your treasurer or chairperson to upgrade." : ""}
            </p>
          </div>
          {unlockFrom ? (
            <Link
              to={`/workspace/${workspaceId}/${unlockFrom}${unlockFrom.includes("?") ? "&" : "?"}readonly=1`}
              className="shrink-0 rounded-xl bg-white/80 px-3 py-1.5 text-xs font-bold text-amber-900 shadow-sm transition hover:bg-white dark:bg-black/20 dark:text-amber-200"
            >
              View existing records
            </Link>
          ) : null}
        </section>
      )}

      {/* Current plan */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-obsidian-border dark:bg-obsidian-card">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-mint">
            <Gem size={18} />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Current plan</p>
            <p className="text-lg font-extrabold">{summary?.plan?.name || "—"}</p>
          </div>
          <span className={clsx("ml-auto rounded-full px-3 py-1 text-xs font-bold", state.cls)}>{state.text}</span>
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500 dark:text-mist-muted">Price</dt>
            <dd className="font-bold">{summary?.plan?.price_monthly ? `${kes(summary.plan.price_monthly)} / month` : "Free"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-mist-muted">{summary?.state === "trial" ? "Trial ends" : "Paid until"}</dt>
            <dd className="font-bold">{summary?.state === "free" ? "No expiry" : fmtDate(endDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-mist-muted">Member limit</dt>
            <dd className="font-bold">{summary?.plan?.max_members ? `${summary.plan.max_members} members` : "Unlimited"}</dd>
          </div>
        </dl>

        {summary?.state === "read_only" && (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
            <Lock size={14} className="mt-0.5 shrink-0" />
            The plan has lapsed, so new records cannot be added. All records stay available, and withdrawals and payouts still work.
          </p>
        )}
        {summary?.state === "grace" && (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            The plan expired. The chama works normally for {summary.grace_days_left} more day{summary.grace_days_left === 1 ? "" : "s"}, then becomes read-only.
          </p>
        )}
      </section>

      {summary?.enforced === false && (
        <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-obsidian-border dark:bg-obsidian-raised/40 dark:text-mist-muted">
          <Clock size={14} className="mt-0.5 shrink-0" />
          Billing is not switched on yet. Nothing is locked and no plan limits apply, so there is nothing to pay for now.
        </p>
      )}

      {!canManage ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist-muted">
          Only the treasurer and chairperson can change the plan or pay. Ask them if it needs renewing.
        </p>
      ) : (
        <>
          {/* Plan picker */}
          <section className="space-y-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-500 dark:text-mist-muted">Choose a plan</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {plans.map((plan) => {
                const current = summary?.plan?.code === plan.code;
                const free = plan.price_monthly === 0;
                const active = selected.plan === plan.code;
                return (
                  <div
                    key={plan.code}
                    className={clsx(
                      "flex flex-col rounded-2xl border p-4 transition",
                      active ? "border-violet-500 ring-2 ring-violet-200 dark:ring-violet-900/60" : "border-slate-200 dark:border-obsidian-border",
                      "bg-white dark:bg-obsidian-card"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-extrabold">{plan.name}</p>
                      {current ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">Current</span> : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-mist-muted">{plan.tagline}</p>
                    <p className="mt-3 text-2xl font-extrabold tabular-nums">
                      {free ? "Free" : kes(plan.price_monthly)}
                      {!free && <span className="text-xs font-semibold text-slate-400"> / month</span>}
                    </p>
                    {plan.list_price_monthly ? (
                      <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">
                        Special price for your group <span className="text-slate-400 line-through">{kes(plan.list_price_monthly)}</span>
                      </p>
                    ) : null}
                    <ul className="mt-3 space-y-1 text-xs text-slate-600 dark:text-mist-muted">
                      <li>{plan.max_members ? `Up to ${plan.max_members} members` : "Unlimited members"}</li>
                      <li>{plan.modules.length} features included</li>
                    </ul>
                    <div className="mt-4 flex-1" />
                    {free ? (
                      <button
                        type="button"
                        disabled={busy || current}
                        onClick={switchToFree}
                        className="min-h-10 rounded-xl border border-slate-200 text-xs font-bold hover:bg-slate-50 disabled:opacity-50 dark:border-obsidian-border dark:hover:bg-obsidian-raised"
                      >
                        {current ? "You are on Free" : "Switch to Free"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => { setSelected((s) => ({ ...s, plan: plan.code })); setInvoice(null); }}
                        className={clsx(
                          "min-h-10 rounded-xl text-xs font-bold transition disabled:opacity-50",
                          active ? "bg-violet-600 text-white" : "border border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-900 dark:text-mint dark:hover:bg-violet-950/30"
                        )}
                      >
                        {active ? "Selected" : current ? "Renew this plan" : "Select"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Length + invoice + pay */}
          {chosenPlan && chosenPlan.price_monthly > 0 && (
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-obsidian-border dark:bg-obsidian-card">
              <h2 className="text-sm font-extrabold">Pay for {chosenPlan.name}</h2>

              <div className="flex flex-wrap gap-2">
                {MONTH_OPTIONS.map((opt) => (
                  <button
                    key={opt.months}
                    type="button"
                    disabled={busy || waiting}
                    onClick={() => { setSelected((s) => ({ ...s, months: opt.months })); setInvoice(null); }}
                    className={clsx(
                      "rounded-xl border px-3.5 py-2 text-left text-xs font-bold transition disabled:opacity-50",
                      selected.months === opt.months ? "border-violet-500 bg-violet-50 text-violet-800 dark:bg-violet-950/30 dark:text-mint" : "border-slate-200 dark:border-obsidian-border"
                    )}
                  >
                    {opt.label}
                    <span className="block text-[11px] font-semibold text-slate-500 dark:text-mist-muted">
                      {kes(priceFor(chosenPlan, opt.months))}{opt.note ? ` · ${opt.note}` : ""}
                    </span>
                  </button>
                ))}
              </div>

              {!invoice ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={createInvoice}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-extrabold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />}
                  Create invoice
                </button>
              ) : (
                <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-obsidian-border dark:bg-obsidian-raised/30">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-xs font-bold text-slate-500">Invoice {invoice.number}</p>
                    <p className="text-xl font-extrabold tabular-nums">{kes(invoice.amount)}</p>
                  </div>
                  {invoice.credit > 0 && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">Includes a credit of {kes(invoice.credit)} for unused time on your current plan.</p>
                  )}

                  {isTreasurer ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="min-w-[200px] flex-1 text-xs font-bold">
                        M-Pesa number to charge
                        <input
                          type="tel"
                          inputMode="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="07XX XXX XXX"
                          disabled={waiting}
                          className="mt-1 block min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium dark:border-obsidian-border dark:bg-obsidian-card"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={busy || waiting}
                        onClick={pay}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {busy || waiting ? <Loader2 size={14} className="animate-spin" /> : <Smartphone size={14} />}
                        {waiting ? "Waiting for approval…" : "Pay with M-Pesa"}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 dark:text-mist-muted">Only the treasurer can pay. They will get the M-Pesa prompt on their phone.</p>
                  )}
                  {waiting && (
                    <p className="flex items-center gap-2 text-xs text-slate-500"><Clock size={13} /> Approve the prompt on your phone. This page updates by itself.</p>
                  )}
                  {invoice.last_attempt && ["failed", "cancelled"].includes(invoice.last_attempt.status) && !waiting && (
                    <p className="text-xs text-rose-600">Last attempt did not go through{invoice.last_attempt.reason ? `: ${invoice.last_attempt.reason}` : "."} You can try again.</p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* History */}
          <section className="space-y-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-500 dark:text-mist-muted">Payment history</h2>
            {invoices.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-500 dark:border-obsidian-border">No invoices yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-obsidian-border dark:bg-obsidian-card">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="text-[10px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Period</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-obsidian-border">
                    {invoices.map((inv) => (
                      <tr key={inv._id}>
                        <td className="px-4 py-3 font-bold">{inv.number}{inv.mpesa_receipt ? <span className="block font-normal text-slate-400">{inv.mpesa_receipt}</span> : null}</td>
                        <td className="px-4 py-3">{inv.plan_name} · {inv.months} mo</td>
                        <td className="px-4 py-3">{inv.status === "paid" ? `${fmtDate(inv.period_start)} – ${fmtDate(inv.period_end)}` : "—"}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums">{kes(inv.amount)}</td>
                        <td className="px-4 py-3">
                          {inv.status === "paid" ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 size={13} /> Paid</span>
                          ) : (
                            <span className="text-slate-500 capitalize">{inv.status}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="flex items-center gap-2 text-[11px] text-slate-400"><Sparkles size={12} /> Prices include a 12-month discount: pay for 10 months, get 12.</p>
        </>
      )}
    </div>
  );
}