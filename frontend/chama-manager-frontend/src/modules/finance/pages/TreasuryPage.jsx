import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Landmark, Smartphone, Banknote, TrendingUp, ShieldCheck, ShieldAlert,
  Download, Plus, ChevronRight, FileText, Scale, Users, Upload,
  CheckCircle2, XCircle, History, RefreshCw, WifiOff,
} from "lucide-react";
import toast from "react-hot-toast";

import useWorkspace from "@/app/hooks/useWorkspace";
import useFinanceSummary from "../hooks/useFinanceSummary";
import useCashDepositStatus from "../hooks/useCashDepositStatus";
import usePaymentWatcher from "../hooks/usePaymentWatcher";
import useWorkspacePermissions from "../hooks/useworkspacepermissions";
import useLedger from "../hooks/useLedger";
import useBankAccounts from "../hooks/useBankAccounts";
import useReconciliationSessions from "../hooks/useReconciliationSessions";
import financeService from "../services/finance.service";
import { FinanceNotifications } from "../components/MoneyHub";
import { buildFinanceAlerts } from "./FinanceDashboard";
import { Card, money } from "../components/FinanceUi";
import Spinner from "@/shared/components/ui/Spinner";
import {
  fmt, longDate, shortDate, clock, SampleTag, SegBar, DualLineChart, Tabs, btnPrimary, btnGhost,
  usePersisted, useOnline, downloadCsv,
} from "../lib/proKit";
import {
  SHOW_SAMPLE, SAMPLE_MONTHS, SAMPLE_INCOME, SAMPLE_EXPENSE, SAMPLE_EXPENSE_CATS, SAMPLE_WALLETS,
  SAMPLE_PETTY, SAMPLE_BANK, SAMPLE_APPROVALS, SAMPLE_UNCLEARED, SAMPLE_RECON_HISTORY, SAMPLE_AUDIT,
} from "../lib/financeSample";

// ============================================================
// TREASURY: the group's bank (management view)
//
// This is the "Money" page. It answers one question: where is the
// group's money, did it move correctly, and do the books agree?
//
// What moved OUT of this page, on purpose, because it already lives
// on Contributions and was duplicated here:
//   - Collection progress / goal / arrears      -> Contributions
//   - "Collect with M-Pesa" + STK push          -> Contributions
//   - Contribution register shortcut            -> Contributions > Payments
//   - The grid of "Financial products" links    -> the top tab bar
//
// Real data: balances, weekly income/expense trend, ledger,
// reconciliation sessions, bank accounts, GL balance, cash deposit
// status. Everything without a backend source yet is tagged
// "Sample data" (flip SHOW_SAMPLE in financeSample.jsx to hide it).
// ============================================================

const APPROVAL_LIMIT = 10_000;

const last4 = (v) => {
  const s = String(v || "").replace(/\s/g, "");
  return s ? `**${s.slice(-4)}` : "";
};

export default function TreasuryPage() {
  const { workspaceId: routeId } = useParams();
  const ws = useWorkspace();
  const workspaceId = routeId || ws?.workspaceId;
  const base = `/workspace/${workspaceId}`;
  const groupName = ws?.currentWorkspace?.name || ws?.activeWorkspace?.name || "Your group";

  usePaymentWatcher(workspaceId);
  const online = useOnline();

  const { can, scopeOf, role } = useWorkspacePermissions(workspaceId);
  const canFullBooks = can("finance.accounts.view");
  const canSeeLedger = Boolean(scopeOf("finance.transactions.view"));
  const isChair = role === "chairperson";
  const isTreasurer = role === "treasurer";

  const { summary, isLoading: loadingSummary, refetch } = useFinanceSummary(workspaceId);
  const { status: cashStatus } = useCashDepositStatus(canFullBooks ? workspaceId : null);
  const { entries: ledgerEntries, loading: loadingLedger } = useLedger(workspaceId, {});
  const { bankAccounts } = useBankAccounts(workspaceId);
  const { sessions } = useReconciliationSessions(workspaceId);

  const [glStatus, setGlStatus] = useState(null);
  const [trend, setTrend] = useState([]);
  const [tab, setTab] = useState("ledger");

  useEffect(() => {
    if (!workspaceId) return undefined;
    let alive = true;
    const load = async () => {
      const [gl, tr] = await Promise.allSettled([
        financeService.getGlBalance(workspaceId),
        financeService.getTrend(workspaceId),
      ]);
      if (!alive) return;
      if (gl.status === "fulfilled") setGlStatus(gl.value);
      if (tr.status === "fulfilled") setTrend(tr.value?.weeks || []);
    };
    load();
    window.addEventListener("finance:updated", load);
    return () => { alive = false; window.removeEventListener("finance:updated", load); };
  }, [workspaceId]);

  // ---- local, per-device state (approvals + audit have no backend yet) ----
  const key = (k) => `chama:${workspaceId}:${k}`;
  const [approvals, setApprovals] = usePersisted(key("treasuryApprovals"), null);
  const [auditExtra, setAuditExtra] = usePersisted(key("treasuryAudit"), []);
  const pending = useMemo(() => {
    const list = approvals ?? (SHOW_SAMPLE ? SAMPLE_APPROVALS() : []);
    return list.filter((a) => !a.decision);
  }, [approvals]);

  const decide = (item, decision) => {
    const list = approvals ?? SAMPLE_APPROVALS();
    setApprovals(list.map((a) => (a.id === item.id ? { ...a, decision } : a)));
    setAuditExtra([
      { id: `d-${Date.now()}`, action: `${item.title} ${decision}`, by: isChair ? "Chairperson" : "You", at: new Date().toISOString() },
      ...auditExtra,
    ].slice(0, 20));
    toast.success(decision === "approved" ? "Approved" : "Rejected");
  };

  // ---- derived: balances ----
  const cash = summary?.cash_balance ?? 0;
  const bank = bankAccounts?.[0];
  const bankName = bank?.bank_name || (SHOW_SAMPLE ? SAMPLE_BANK.name : "");
  const bankMask = bank?.account_number ? last4(bank.account_number) : SAMPLE_BANK.masked;
  const bankIsSample = !bank;

  // ---- derived: trend (real) with sample fallback ----
  const hasTrend = trend.length > 1;
  const chart = useMemo(() => {
    if (hasTrend) {
      return {
        labels: trend.map((w, i) => w.label || w.week || `W${i + 1}`),
        income: trend.map((w) => Number(w.income) || 0),
        expense: trend.map((w) => Number(w.expense) || 0),
        sample: false,
      };
    }
    return { labels: SAMPLE_MONTHS(), income: SAMPLE_INCOME, expense: SAMPLE_EXPENSE, sample: true };
  }, [trend, hasTrend]);

  const totalIn = chart.income.reduce((s, v) => s + v, 0);
  const totalOut = chart.expense.reduce((s, v) => s + v, 0);
  const net = totalIn - totalOut;
  const margin = totalIn ? Math.round((net / totalIn) * 100) : 0;
  const half = Math.floor(chart.income.length / 2);
  const recentNet = chart.income.slice(half).reduce((s, v) => s + v, 0) - chart.expense.slice(half).reduce((s, v) => s + v, 0);
  const priorNet = chart.income.slice(0, half).reduce((s, v) => s + v, 0) - chart.expense.slice(0, half).reduce((s, v) => s + v, 0);
  const netChange = priorNet > 0 ? Math.round(((recentNet - priorNet) / priorNet) * 100) : null;

  const cats = SAMPLE_EXPENSE_CATS;
  const topCats = [...cats].sort((a, b) => b.value - a.value).slice(0, 3);

  // ---- derived: reconciliation ----
  const completed = useMemo(
    () => (sessions || []).filter((s) => s.status === "completed")
      .sort((a, b) => new Date(b.completed_at || b.updatedAt || 0) - new Date(a.completed_at || a.updatedAt || 0)),
    [sessions]
  );
  const lastRecon = completed[0];
  const lastReconAt = lastRecon ? (lastRecon.completed_at || lastRecon.updatedAt || lastRecon.createdAt) : null;
  const reconHistory = completed.length
    ? completed.slice(0, 4).map((s) => ({
        id: s._id || s.id,
        period: `${shortDate(s.period_start)} – ${shortDate(s.period_end)}`,
        bank: s.bank_account_id?.bank_name,
        at: s.completed_at || s.updatedAt || s.createdAt,
        difference: Number(s.difference ?? s.variance ?? 0),
        real: true,
      }))
    : SHOW_SAMPLE ? SAMPLE_RECON_HISTORY().map((r) => ({ ...r, real: false })) : [];
  const openSessions = (sessions || []).filter((s) => s.status !== "completed").length;
  const balanced = glStatus ? glStatus.balanced !== false : true;
  const uncleared = SHOW_SAMPLE ? SAMPLE_UNCLEARED() : [];

  // ---- derived: alerts (real) ----
  const alerts = useMemo(
    () => buildFinanceAlerts({ glStatus, cashStatus, totals: {}, base }),
    [glStatus, cashStatus, base]
  );

  const exportLedger = () => {
    if (!ledgerEntries.length) return toast.error("No ledger entries to export");
    downloadCsv(`ledger-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Date", "Reference", "Type", "Account", "Description", "Debit", "Credit"],
      ...ledgerEntries.map((e) => [
        e.posted_at || e.createdAt || "", e.reference || e.transaction_id || "", e.category_label || e.category || "",
        e.account_name || e.account || "", e.description || "", e.debit || 0, e.credit || 0,
      ]),
    ]);
  };

  if (loadingSummary && !summary) {
    return <div className="grid place-items-center py-24"><Spinner /></div>;
  }

  const auditTrail = [
    ...auditExtra,
    ...(SHOW_SAMPLE ? SAMPLE_AUDIT() : []),
  ].slice(0, 6);

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 text-slate-900 dark:text-mist">
      {/* ---------- header ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Treasury</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-mist-muted">
            {groupName}
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-amber-500"}`} />
              {online ? "Live" : <><WifiOff size={11} /> Offline</>}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold ${
              balanced
                ? "bg-emerald-100 text-emerald-800 dark:bg-mint-deep dark:text-mint"
                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
            }`}
            title={lastReconAt ? `Last reconciled ${longDate(lastReconAt)} ${clock(lastReconAt)}` : undefined}
          >
            {balanced ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
            {balanced ? "Reconciled" : "Needs reconciliation"}
            {lastReconAt && balanced && <span className="font-semibold opacity-80">· {longDate(lastReconAt)}</span>}
          </span>
          <button onClick={() => { refetch?.(); window.dispatchEvent(new Event("finance:updated")); }} className={btnGhost}>
            <RefreshCw size={14} /> Refresh
          </button>
          {canSeeLedger && <button onClick={exportLedger} className={btnGhost}><Download size={14} /> Export</button>}
          {(isTreasurer || isChair) && (
            <Link to={`${base}/finance/payouts/new`} className={btnPrimary}><Plus size={14} /> New transaction</Link>
          )}
        </div>
      </div>

      {/* ---------- A: balances ---------- */}
      <Card className="p-0">
        <div className="grid divide-y divide-slate-100 dark:divide-obsidian-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          <Kpi label="Total cash position" value={money(cash)} foot={`${money(summary?.cash_in)} in · ${money(summary?.cash_out)} out`} />
          <Kpi
            label={`Net cashflow · last ${chart.labels.length} ${chart.sample ? "months" : "weeks"}`}
            value={`${net < 0 ? "−" : ""}KES ${fmt(Math.abs(net))}`}
            tone={net < 0 ? "rose" : "emerald"}
            foot={`${margin}% margin${netChange != null ? ` · ${netChange >= 0 ? "+" : ""}${netChange}% vs earlier` : ""}`}
            sample={chart.sample}
          />
          <Kpi label="Outstanding loans" value={money(summary?.outstanding_loans)} foot="Owed back by members" />
          <Kpi label="Pending payouts" value={money(summary?.pending_payouts)} foot={`${summary?.pending_transactions ?? 0} transactions pending`} tone={summary?.pending_payouts > 0 ? "amber" : "emerald"} />
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-5">
          {/* ---------- A: accounts + wallet split ---------- */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Where the money sits</h2>
              <Link to={`${base}/finance/accounts`} className="text-[11px] font-bold text-emerald-700 dark:text-mint">All accounts <ChevronRight size={11} className="inline" /></Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Account icon={Smartphone} label="M-Pesa float" value="—" note="Per-account balance not tracked yet" sample />
              <Account
                icon={Landmark}
                label={`${bankName || "Bank"} ${bankMask}`.trim()}
                value={bank ? money(bank.current_balance ?? bank.balance) : "—"}
                note={balanced ? "Reconciled" : "Unreconciled"}
                sample={bankIsSample}
              />
              <Account icon={Banknote} label="Petty cash" value={`KES ${fmt(SAMPLE_PETTY.onHand)}`} note={`${SAMPLE_PETTY.custodian} · ${SAMPLE_PETTY.location}`} sample />
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-mist-muted">
                <span>Wallet split</span><SampleTag />
              </div>
              <SegBar parts={SAMPLE_WALLETS.map((w) => ({ label: w.label, value: w.pct, color: w.color }))} />
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {SAMPLE_WALLETS.map((w) => (
                  <span key={w.label} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-mist-muted">
                    <span className="h-2 w-2 rounded-full" style={{ background: w.color }} /> {w.label} {w.pct}%
                  </span>
                ))}
              </div>
            </div>
          </Card>

          {/* ---------- B: income vs expenses ---------- */}
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold">Income vs expenses</h2>
              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-mint"><span className="h-0.5 w-4 bg-emerald-500" /> Income</span>
                <span className="inline-flex items-center gap-1.5 text-rose-600"><span className="h-0.5 w-4 border-t-2 border-dashed border-rose-500" /> Expenses</span>
                {chart.sample && <SampleTag />}
              </div>
            </div>
            <div className="mt-3"><DualLineChart labels={chart.labels} income={chart.income} expense={chart.expense} /></div>
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs dark:border-obsidian-border">
              <div><p className="text-slate-500 dark:text-mist-muted">Avg income / {chart.sample ? "month" : "week"}</p><p className="mt-0.5 text-sm font-black">KES {fmt(totalIn / Math.max(1, chart.income.length))}</p></div>
              <div><p className="text-slate-500 dark:text-mist-muted">Avg expense / {chart.sample ? "month" : "week"}</p><p className="mt-0.5 text-sm font-black">KES {fmt(totalOut / Math.max(1, chart.expense.length))}</p></div>
            </div>
          </Card>

          {/* ---------- C/E/F: ledger, approvals, history ---------- */}
          <Card className="p-0">
            <div className="px-5 pt-3">
              <Tabs
                value={tab}
                onChange={setTab}
                tabs={[
                  { key: "ledger", label: "Ledger", count: ledgerEntries.length || undefined },
                  { key: "approvals", label: "Approvals", count: pending.length, alert: pending.length > 0 },
                  { key: "recon", label: "Reconciliation" },
                  { key: "audit", label: "Audit trail" },
                ]}
              />
            </div>

            {tab === "ledger" && (
              <div>
                {loadingLedger ? (
                  <div className="grid place-items-center py-12"><Spinner /></div>
                ) : ledgerEntries.length === 0 ? (
                  <p className="px-5 py-10 text-center text-xs text-slate-500">No ledger entries yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead className="text-left text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-mist-muted">
                        <tr>
                          <th className="px-5 py-3">Date</th><th className="px-3 py-3">Ref</th><th className="px-3 py-3">Description</th>
                          <th className="px-3 py-3 text-right">Debit</th><th className="px-5 py-3 text-right">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerEntries.slice(0, 8).map((e, i) => {
                          const d = Number(e.debit) || 0;
                          const c = Number(e.credit) || 0;
                          return (
                            <tr key={e._id ?? e.id ?? i} className="border-t border-slate-100 dark:border-obsidian-border">
                              <td className="whitespace-nowrap px-5 py-3 text-slate-500">{shortDate(e.posted_at || e.createdAt)}</td>
                              <td className="px-3 py-3 font-mono text-[10px] text-slate-500">{e.reference || e.transaction_id || "—"}</td>
                              <td className="max-w-[260px] truncate px-3 py-3 font-semibold">
                                {e.description || e.category_label || "—"}
                                <span className="ml-2 font-normal text-slate-400">{e.account_name || ""}</span>
                              </td>
                              <td className="px-3 py-3 text-right font-bold text-rose-600">{d ? fmt(d) : "—"}</td>
                              <td className="px-5 py-3 text-right font-bold text-emerald-700 dark:text-mint">{c ? fmt(c) : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {canSeeLedger && (
                  <div className="border-t border-slate-100 px-5 py-3 text-right dark:border-obsidian-border">
                    <Link to={`${base}/finance/ledger`} className="text-[11px] font-bold text-emerald-700 dark:text-mint">Open full ledger <ChevronRight size={11} className="inline" /></Link>
                  </div>
                )}
              </div>
            )}

            {tab === "approvals" && (
              <div className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs text-slate-500 dark:text-mist-muted">Expenses above KES {fmt(APPROVAL_LIMIT)} need the Chairperson.</p>
                  <SampleTag />
                </div>
                {pending.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-500">Nothing waiting for approval.</p>
                ) : (
                  <ul className="space-y-2">
                    {pending.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3 dark:border-obsidian-border">
                        <div>
                          <p className="text-xs font-bold">{a.title}</p>
                          <p className="text-[11px] text-slate-500">{a.category} · {a.channel} · by {a.by} · {longDate(a.at)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black">KES {fmt(a.amount)}</span>
                          {isChair ? (
                            <>
                              <button onClick={() => decide(a, "approved")} className={btnPrimary}><CheckCircle2 size={13} /> Approve</button>
                              <button onClick={() => decide(a, "rejected")} className={btnGhost}><XCircle size={13} /> Reject</button>
                            </>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800 dark:bg-amber-deep-bg dark:text-amber-deep-text">Awaiting Chairperson</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tab === "recon" && (
              <div className="grid gap-5 p-5 md:grid-cols-2">
                <div>
                  <h3 className="text-xs font-bold">Bank vs ledger</h3>
                  <div className={`mt-2 rounded-2xl p-4 ${balanced ? "bg-emerald-50 dark:bg-mint-deep/40" : "bg-rose-50 dark:bg-rose-950/40"}`}>
                    <p className="flex items-center gap-2 text-sm font-black">
                      {balanced ? <ShieldCheck size={16} className="text-emerald-600" /> : <ShieldAlert size={16} className="text-rose-600" />}
                      {balanced ? "Debits equal credits" : `Out by ${money(glStatus?.difference)}`}
                    </p>
                    {glStatus && !glStatus.checkFailed && (
                      <p className="mt-1 text-[11px] text-slate-600 dark:text-mist-muted">
                        Debits {money(glStatus.totalDebits)} · Credits {money(glStatus.totalCredits)}
                      </p>
                    )}
                  </div>
                  <h3 className="mt-4 flex items-center gap-2 text-xs font-bold">Uncleared items {uncleared.length > 0 && <SampleTag />}</h3>
                  {uncleared.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-500">KES 0, fully reconciled.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {uncleared.map((u) => (
                        <li key={u.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-obsidian-raised">
                          <span><span className="font-mono text-[10px] text-slate-500">{u.ref}</span> {u.description}</span>
                          <span className="font-bold">{u.amount < 0 ? "−" : ""}KES {fmt(Math.abs(u.amount))}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to={`${base}/finance/reconciliation`} className={btnPrimary}><Upload size={13} /> Import statement</Link>
                    {openSessions > 0 && <span className="self-center text-[11px] text-slate-500">{openSessions} in progress</span>}
                  </div>
                </div>
                <div>
                  <h3 className="flex items-center gap-2 text-xs font-bold"><History size={13} /> History {!reconHistory[0]?.real && reconHistory.length > 0 && <SampleTag />}</h3>
                  {reconHistory.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">No reconciliations yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {reconHistory.map((r) => (
                        <li key={r.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-obsidian-border">
                          <span className="font-semibold">{r.period}{r.bank ? ` · ${r.bank}` : ""}</span>
                          <span className={r.difference ? "font-bold text-amber-600" : "font-bold text-emerald-700 dark:text-mint"}>
                            {r.difference ? `Diff KES ${fmt(r.difference)}` : "Matched"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {tab === "audit" && (
              <div className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs text-slate-500 dark:text-mist-muted">Every approval and reconciliation, with who and when.</p>
                  <SampleTag />
                </div>
                <ul className="space-y-2">
                  {auditTrail.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 text-xs last:border-0 dark:border-obsidian-border">
                      <span><span className="font-semibold">{a.action}</span> <span className="text-slate-500">by {a.by}</span></span>
                      <span className="shrink-0 text-[10px] text-slate-400">{longDate(a.at)} {clock(a.at)}{a.hash ? ` · ${a.hash}` : ""}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>

        {/* ---------- right rail ---------- */}
        <div className="min-w-0 space-y-5">
          <FinanceNotifications alerts={alerts} limit={4} />

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Where it went</h2><SampleTag />
            </div>
            <div className="mt-3"><SegBar parts={cats} /></div>
            <ul className="mt-3 space-y-1.5">
              {cats.map((c) => (
                <li key={c.label} className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-2 font-semibold"><span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.label}</span>
                  <span className="font-bold">KES {fmt(c.value)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-obsidian-border dark:text-mist-muted">
              Top 3: {topCats.map((c) => c.label).join(", ")}
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-bold">Reports and compliance</h2>
            <ul className="mt-3 space-y-1">
              <ReportLink to={`${base}/finance/cash-flow`} icon={TrendingUp} label="Cash flow" />
              {canFullBooks && <ReportLink to={`${base}/finance/trial-balance`} icon={Scale} label="Trial balance" />}
              <ReportLink to={`${base}/finance/contributions?tab=members`} icon={Users} label="Member balances" />
              <ReportLink to={`${base}/finance/income-statement`} icon={FileText} label="Income statement" />
              <ReportLink to={`${base}/finance/receipts-payments`} icon={FileText} label="Receipts and payments" />
            </ul>
            {canSeeLedger && (
              <button onClick={exportLedger} className={`${btnGhost} mt-3 w-full`}><Download size={13} /> Export ledger CSV</button>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, foot, tone = "emerald", sample }) {
  const color = { emerald: "text-slate-900 dark:text-mist", rose: "text-rose-600", amber: "text-amber-600" }[tone];
  return (
    <div className="px-5 py-4">
      <p className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-mist-muted">{label}{sample && <SampleTag />}</p>
      <p className={`mt-1 text-xl font-black ${color}`}>{value}</p>
      {foot && <p className="mt-1 text-[11px] text-slate-500 dark:text-mist-muted">{foot}</p>}
    </div>
  );
}

function Account({ icon: Icon, label, value, note, sample }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-obsidian-border">
      <div className="flex items-center justify-between">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-obsidian-raised dark:text-mist"><Icon size={15} /></span>
        {sample && <SampleTag />}
      </div>
      <p className="mt-3 text-[11px] font-semibold text-slate-500 dark:text-mist-muted">{label}</p>
      <p className="mt-0.5 text-lg font-black">{value}</p>
      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-mist-muted">{note}</p>
    </div>
  );
}

function ReportLink({ to, icon: Icon, label }) {
  return (
    <li>
      <Link to={to} className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-mist dark:hover:bg-obsidian-raised">
        <span className="inline-flex items-center gap-2"><Icon size={14} className="text-slate-400" />{label}</span>
        <ChevronRight size={13} className="text-slate-400" />
      </Link>
    </li>
  );
}
