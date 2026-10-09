import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Search, Download, Upload, Plus, Bell, Layers, Smartphone, Receipt, MessageCircle,
  MoreHorizontal, FileText, Printer, WifiOff, Radio, ChevronLeft, ChevronRight, Copy,
  Clock, CheckCircle2, AlertTriangle, Mail,
} from "lucide-react";

import MyContributions from "@/modules/finance/components/contributions/MyContributions";
import MpesaStkModal from "@/modules/finance/components/MpesaStkModal";
import useWorkspacePermissions from "@/modules/finance/hooks/useworkspacepermissions";
import financeService from "@/modules/finance/services/finance.service";
import { cadenceLabel } from "@/modules/finance/components/MoneyHub";
import { Card, Avatar } from "@/modules/finance/components/FinanceUi";
import Spinner from "@/shared/components/ui/Spinner";
import useWorkspace from "@/app/hooks/useWorkspace";
import { useSocket } from "@/app/providers/SocketProvider";
import {
  DAY_MS, fmt, shortDate, longDate, clock, StatusChip, SampleTag, Ring, Tabs, Drawer, Modal, Toggle,
  inputCls, btnPrimary, btnGhost, useOnline, useTicker, usePersisted, downloadCsv, parseCsv,
  printDocument, waLink, smsLink,
} from "@/modules/finance/lib/proKit";
import {
  SHOW_SAMPLE, PENALTY_RULES, SAMPLE_PAYBILL, SAMPLE_FEED, SAMPLE_UNMATCHED,
} from "@/modules/finance/lib/financeSample";

// ============================================================
// CONTRIBUTIONS: the collection engine (management view)
//
// Members get MyContributions (unchanged). This view is for people
// who hold contributions.view at "all" scope. Rules kept from the
// permission model:
//  - Only holders of contributions.record at "all" scope (treasurer)
//    see anything that collects for another member.
//  - Plan create / edit / pause / archive stays in the Leadership Desk.
// ============================================================

const PAGE_SIZE = 15;
const FAILED = ["failed", "cancelled", "reversed", "pending", "initiated"];
const isOk = (p) => !FAILED.includes(String(p.status || "").toLowerCase());

const last9 = (p) => String(p || "").replace(/\D/g, "").slice(-9);
const firstName = (n = "") => n.split(" ")[0] || "there";
const planId = (p) => String(p?.id ?? p?._id ?? "");

export default function ContributionsPage() {
  const { workspaceId: routeId } = useParams();
  const navigate = useNavigate();
  const ws = useWorkspace();
  const workspaceId = routeId || ws?.workspaceId;
  const base = `/workspace/${workspaceId}`;
  const groupName = ws?.currentWorkspace?.name || "Your group";

  const { role, isLoading: permsLoading, canForOthers } = useWorkspacePermissions(workspaceId);
  const canSeeAll = canForOthers("contributions.view");
  const canRecordForOthers = canForOthers("contributions.record");
  const canOpenDesk = ["treasurer", "chairperson"].includes(role);

  const online = useOnline();
  const now = useTicker(30_000);
  const { socket } = useSocket();

  const [register, setRegister] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncedAt, setSyncedAt] = useState(null);

  const load = useCallback(async () => {
    if (!workspaceId || !canSeeAll) return;
    const data = await financeService.getContributionsRegister(workspaceId);
    setRegister(data);
    setSyncedAt(Date.now());
    setLoading(false);
  }, [workspaceId, canSeeAll]);

  useEffect(() => {
    if (permsLoading) return undefined;
    if (!canSeeAll) { setLoading(false); return undefined; }
    load();
    const timer = setInterval(load, 15_000);
    window.addEventListener("finance:updated", load);
    return () => { clearInterval(timer); window.removeEventListener("finance:updated", load); };
  }, [load, permsLoading, canSeeAll]);

  // ---- local, per-device state ----
  const key = (k) => `chama:${workspaceId}:${k}`;
  const [waivers, setWaivers] = usePersisted(key("waivers"), {});
  const [offlineQueue, setOfflineQueue] = usePersisted(key("offlineQueue"), []);
  const [auto, setAuto] = usePersisted(key("autoNotify"), { receipt: true, arrears: true, recorded: false });
  const [resolved, setResolved] = usePersisted(key("unmatchedResolved"), []);

  // ---- ui state ----
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState(["members", "payments", "arrears"].includes(initialTab) ? initialTab : "members");
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [roleF, setRoleF] = useState("all");
  const [sort, setSort] = useState("name");
  const [typeF, setTypeF] = useState("all");
  const [monthF, setMonthF] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [drawer, setDrawer] = useState(null);       // member row for statement
  const [waive, setWaive] = useState(null);         // member row for waiver
  const [bulk, setBulk] = useState(null);           // "remind" | "record"
  const [importOpen, setImportOpen] = useState(false);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [stkOpen, setStkOpen] = useState(false);

  // ---------- derived: cycle ----------
  const plans = useMemo(() => register?.plans || [], [register]);
  const totals = register?.totals || {};
  const activePlans = useMemo(() => plans.filter((p) => !p.status || p.status === "active"), [plans]);

  const cycle = useMemo(() => {
    const d = new Date(now);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const deadlines = activePlans
      .map((p) => p.deadline || p.due_date || p.next_due_at)
      .filter(Boolean).map((x) => new Date(x)).filter((x) => x >= start && x <= end);
    const due = deadlines.length ? new Date(Math.min(...deadlines)) : end;
    const total = Math.round((end - start) / DAY_MS) + 1;
    const elapsed = Math.min(total, Math.max(0, Math.ceil((now - start) / DAY_MS)));
    const dueIn = Math.ceil((due - now) / DAY_MS);
    return {
      name: start.toLocaleDateString("en-KE", { month: "long", year: "numeric" }),
      start, end, due, total, elapsed, dueIn,
      pctElapsed: (elapsed / total) * 100,
      overdue: now > due,
    };
  }, [now, activePlans]);

  // ---------- derived: members ----------
  const payments = useMemo(() => register?.payments || [], [register]);
  const rule = PENALTY_RULES[0];

  const rows = useMemo(() => {
    const latest = new Map();
    [...payments].sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at)).forEach((p) => {
      const id = String(p.member?.membership_id);
      if (isOk(p) && !latest.has(id)) latest.set(id, p);
    });
    return (register?.members || []).map((m) => {
      const id = String(m.membership_id);
      const expected = Number(m.expected || 0);
      const paid = Number(m.paid || 0);
      const outstanding = Math.max(0, Number(m.outstanding ?? expected - paid));
      const arrearsDays = Number(m.overdue_days ?? (outstanding > 0 && cycle.overdue ? Math.floor((now - cycle.due) / DAY_MS) : 0));
      const cyclesLate = Number(m.overdue_cycles ?? (arrearsDays > 0 ? 1 : 0));
      let status = "pending";
      if (m.excused || m.status === "excused") status = "excused";
      else if (outstanding <= 0 && (expected > 0 || paid > 0)) status = "paid";
      else if (arrearsDays > 0) status = "arrears";
      else if (paid > 0) status = "partial";
      const accrued = m.penalty_amount != null
        ? Number(m.penalty_amount)
        : status === "arrears" && arrearsDays > rule.graceDays ? rule.fee * Math.max(1, cyclesLate) : 0;
      const waiver = waivers[id];
      const lp = latest.get(id);
      return {
        id, name: m.name || "Member", avatar: m.avatar_url, role: m.role || "member", phone: m.phone || m.user?.phone || "",
        expected, paid, outstanding, status, arrearsDays, cyclesLate,
        penalty: waiver ? 0 : accrued, waived: waiver ? accrued || rule.fee : 0, waiver,
        lastPaidAt: m.last_payment_at || lp?.paid_at, code: lp?.external_reference || lp?.reference || "",
      };
    });
  }, [register, payments, cycle, now, waivers, rule]);

  const counts = useMemo(() => {
    const c = { all: rows.length, paid: 0, pending: 0, arrears: 0, partial: 0, excused: 0 };
    rows.forEach((r) => { c[r.status] += 1; });
    return c;
  }, [rows]);

  const roles = useMemo(() => [...new Set(rows.map((r) => r.role))], [rows]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = rows.filter((r) =>
      (statusF === "all" || r.status === statusF) &&
      (roleF === "all" || r.role === roleF) &&
      (!s || r.name.toLowerCase().includes(s) || r.code.toLowerCase().includes(s) || last9(r.phone).includes(last9(s) || "x"))
    );
    const by = {
      name: (a, b) => a.name.localeCompare(b.name),
      balance: (a, b) => b.outstanding - a.outstanding,
      overdue: (a, b) => b.arrearsDays - a.arrearsDays,
    }[sort];
    return list.sort(by);
  }, [rows, q, statusF, roleF, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [q, statusF, roleF, sort]);

  // ---------- derived: headline numbers ----------
  const collected = Number(totals.collected || 0);
  const expected = Number(totals.expected || 0);
  const remaining = Math.max(0, expected - collected);
  const rate = expected > 0 ? Math.min(100, (collected / expected) * 100) : 0;
  const defaulters = rows.filter((r) => r.status === "arrears");
  const arrearsTotal = defaulters.reduce((s, r) => s + r.outstanding, 0);
  const penaltyTotal = rows.reduce((s, r) => s + r.penalty, 0);
  const activeCount = rows.filter((r) => r.status !== "excused").length;
  const paidCount = counts.paid;

  const mom = useMemo(() => {
    const d = new Date(now);
    const sum = (y, m) => payments.filter(isOk)
      .filter((p) => { const t = new Date(p.paid_at); return t.getFullYear() === y && t.getMonth() === m; })
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const cur = sum(d.getFullYear(), d.getMonth());
    const prev = sum(d.getMonth() ? d.getFullYear() : d.getFullYear() - 1, (d.getMonth() + 11) % 12);
    return { cur, pct: prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null };
  }, [payments, now]);

  const pace = rate - cycle.pctElapsed;
  const health = rate >= 100 || pace >= -10 ? ["On track", "emerald"] : pace >= -30 ? ["At risk", "amber"] : ["Behind", "rose"];

  // ---------- derived: M-Pesa ----------
  const account = (groupName.split(" ").slice(0, 2).join("-") || "GROUP").toUpperCase();
  const paybill = ws?.currentWorkspace?.paybill || ws?.currentWorkspace?.mpesa_paybill || SAMPLE_PAYBILL.paybill;
  const paybillIsSample = !(ws?.currentWorkspace?.paybill || ws?.currentWorkspace?.mpesa_paybill);

  const realFeed = useMemo(
    () => [...payments].sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at)).slice(0, 6).map((p) => ({
      id: p.id, name: p.member?.name || "Member", amount: Number(p.amount || 0),
      code: p.external_reference || p.reference || "—", at: p.paid_at, status: isOk(p) ? "completed" : String(p.status || "pending"),
    })),
    [payments]
  );
  const sampleFeed = realFeed.length === 0 && SHOW_SAMPLE;
  const feed = sampleFeed ? SAMPLE_FEED() : realFeed;
  const unmatched = SHOW_SAMPLE ? SAMPLE_UNMATCHED().filter((u) => !resolved.includes(u.id)) : [];

  const synced = syncedAt ? Math.max(0, Math.round((now - syncedAt) / 1000)) : null;

  // ---------- actions ----------
  const reminderText = (r) =>
    `Hello ${firstName(r.name)}, your ${groupName} contribution for ${cycle.name} has KES ${fmt(r.outstanding)} outstanding` +
    `${r.penalty ? ` plus KES ${fmt(r.penalty)} in penalties` : ""}. Due ${shortDate(cycle.due)}. ` +
    `Pay via M-Pesa Paybill ${paybill}, account ${account}. Thank you.`;

  const recordUrl = (r, extra = {}) => {
    const qs = new URLSearchParams({ ...(activePlans[0] ? { plan: planId(activePlans[0]) } : {}), member: r.id, ...extra });
    return `${base}/finance/record-contribution?${qs.toString()}`;
  };

  const receipt = (p, mode = "print") => {
    const member = rows.find((r) => r.id === String(p.member?.membership_id));
    const ref = p.external_reference || p.reference || "—";
    if (mode === "wa") {
      if (!member?.phone) return toast.error("No phone number on file for this member.");
      const text = `${groupName} receipt ${ref}: KES ${fmt(p.amount)} received from ${p.member?.name} on ${longDate(p.paid_at)}. Thank you.`;
      return window.open(waLink(member.phone, text), "_blank", "noopener");
    }
    const ok = printDocument({
      title: `Receipt ${ref}`, group: groupName, kind: "Payment receipt",
      meta: [["Received from", p.member?.name || "—"], ["Date", `${longDate(p.paid_at)} ${clock(p.paid_at)}`],
             ["Receipt no.", `RCPT-${String(ref).slice(-6).toUpperCase()}`], ["M-Pesa / bank reference", ref]],
      rows: [["Contribution", "Method", "Amount (KES)"], [p.plan?.name || "Contribution", p.method || "M-Pesa", fmt(p.amount)]],
      total: ["Total received", `KES ${fmt(p.amount)}`], signer: "Treasurer",
    });
    if (!ok) toast.error("Allow pop-ups to print the receipt.");
    return null;
  };

  const exportMembers = (list = filtered) =>
    downloadCsv(`contributions-${cycle.name.replace(" ", "-")}.csv`, [
      ["Member", "Role", "Expected", "Paid", "Balance", "Status", "Days overdue", "Penalty", "Last paid", "M-Pesa code"],
      ...list.map((r) => [r.name, r.role, r.expected, r.paid, r.outstanding, r.status, r.arrearsDays, r.penalty, r.lastPaidAt ? longDate(r.lastPaidAt) : "", r.code]),
    ]);

  const toggleSel = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.includes(r.id));
  const selectedRows = rows.filter((r) => selected.includes(r.id));

  // payments tab data
  const months = useMemo(() => {
    const set = new Map();
    payments.forEach((p) => {
      const d = new Date(p.paid_at);
      if (!Number.isNaN(d.getTime())) set.set(`${d.getFullYear()}-${d.getMonth()}`, d.toLocaleDateString("en-KE", { month: "long", year: "numeric" }));
    });
    return [...set.entries()];
  }, [payments]);
  const planTypes = useMemo(() => [...new Set(plans.map((p) => cadenceLabel(p)))], [plans]);
  const planIdsOfType = plans.filter((p) => typeF === "all" || cadenceLabel(p) === typeF).map(planId);
  const shownPayments = payments.filter((p) => {
    const d = new Date(p.paid_at);
    return (typeF === "all" || planIdsOfType.includes(String(p.plan?.id ?? p.plan?._id ?? ""))) &&
      (monthF === "all" || `${d.getFullYear()}-${d.getMonth()}` === monthF);
  }).sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at));

  // ---------- guards ----------
  if (permsLoading) return <div className="flex min-h-[420px] items-center justify-center"><Spinner /></div>;

  if (!canSeeAll) {
    return (
      <div className="space-y-6 pb-12">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-mist sm:text-3xl">My contributions</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-mist-muted">
            What you owe, what you have paid, and a Pay button for your own contributions.
          </p>
        </div>
        <MyContributions chamaId={workspaceId} base={base} />
      </div>
    );
  }

  if (loading && !register) return <div className="flex min-h-[420px] items-center justify-center"><Spinner /></div>;

  return (
    <div className="space-y-5 pb-14 tabular-nums text-slate-900 dark:text-mist">
      {/* ================= header ================= */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Contributions</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500 dark:text-mist-muted">
            <span>{cycle.name} cycle</span>
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${socket?.connected ? "bg-emerald-500" : "bg-amber-500"}`} />
              {socket?.connected ? "Live" : "Refreshing every 15s"}{synced != null && ` · synced ${synced}s ago`}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canOpenDesk && (
            <Link to={`${base}/leadership?tab=contributions`} className={btnGhost}><Layers size={14} /> Contribution plans</Link>
          )}
          <button onClick={() => exportMembers()} className={btnGhost}><Download size={14} /> Export</button>
          {canRecordForOthers && (
            <>
              <button onClick={() => setImportOpen(true)} className={btnGhost}><Upload size={14} /> Import CSV</button>
              <button onClick={() => setStkOpen(true)} className={btnGhost}><Smartphone size={14} /> STK push</button>
              <Link to={`${base}/finance/record-contribution${activePlans[0] ? `?plan=${planId(activePlans[0])}` : ""}`} className={btnPrimary}>
                <Plus size={14} /> Record payment
              </Link>
            </>
          )}
        </div>
      </div>

      {!online && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900 dark:border-amber-deep-text/40 dark:bg-amber-deep-bg dark:text-amber-deep-text">
          <span className="flex items-center gap-2"><WifiOff size={14} /> You are offline. Figures may be out of date. You can note payments and post them when you are back online.</span>
          {canRecordForOthers && <button onClick={() => setOfflineOpen(true)} className="shrink-0 underline">Note a payment</button>}
        </div>
      )}

      {/* ================= cycle + kpis ================= */}
      <Card className="overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="flex items-center gap-5 border-b border-slate-100 p-5 dark:border-obsidian-border lg:border-b-0 lg:border-r">
            <Ring value={cycle.pctElapsed} tone={health[1]} size={116}>
              <span className="text-2xl font-black leading-none">{cycle.elapsed}</span>
              <span className="mt-0.5 text-[11px] font-semibold text-slate-400">of {cycle.total} days</span>
            </Ring>
            <div className="min-w-0">
              <p className="text-sm font-bold">{cycle.name}</p>
              <p className="text-[11px] text-slate-500 dark:text-mist-muted">{shortDate(cycle.start)} to {shortDate(cycle.end)}</p>
              <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                health[1] === "emerald" ? "bg-emerald-100 text-emerald-800 dark:bg-mint-deep dark:text-mint"
                : health[1] === "amber" ? "bg-amber-100 text-amber-800 dark:bg-amber-deep-bg dark:text-amber-deep-text"
                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"}`}>{health[0]}</span>
              <p className={`mt-2 text-xs font-bold ${cycle.overdue ? "text-rose-600 dark:text-rose-300" : ""}`}>
                {cycle.overdue ? `Overdue by ${Math.abs(cycle.dueIn)} day${Math.abs(cycle.dueIn) === 1 ? "" : "s"}` : cycle.dueIn === 0 ? "Due today" : `Due in ${cycle.dueIn} day${cycle.dueIn === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 dark:divide-obsidian-border sm:grid-cols-4 sm:divide-y-0">
            <Kpi label="Total collected" value={`KES ${fmt(collected)}`}
              foot={mom.pct == null ? "No earlier month to compare" : `${mom.pct >= 0 ? "+" : ""}${mom.pct}% vs last month`} tone={mom.pct != null && mom.pct < 0 ? "rose" : "emerald"} />
            <Kpi label="Monthly goal" value={`KES ${fmt(expected)}`} foot={`KES ${fmt(remaining)} to go`}>
              <div className="relative mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-obsidian-raised">
                <div className="h-full rounded-full bg-emerald-500 dark:bg-mint" style={{ width: `${rate}%` }} />
                <div className="absolute -top-1 h-3.5 w-0.5 bg-slate-500" style={{ left: `${cycle.pctElapsed}%` }} title="Where the cycle should be by today" />
              </div>
            </Kpi>
            <Kpi label="Collection rate" value={`${Math.round(rate)}%`} foot={`${paidCount} of ${activeCount} members paid`} tone={health[1]} />
            <Kpi label="Arrears" value={`KES ${fmt(arrearsTotal)}`} foot={`${defaulters.length} defaulter${defaulters.length === 1 ? "" : "s"}`} tone={defaulters.length ? "rose" : "emerald"} />
          </div>
        </div>
      </Card>

      {/* ================= main grid ================= */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Tabs value={tab} onChange={setTab} tabs={[
            { key: "members", label: "Members", count: rows.length },
            { key: "payments", label: "Payments", count: payments.length },
            { key: "arrears", label: "Arrears and penalties", count: defaulters.length, alert: defaulters.length > 0 },
          ]} />

          {tab === "members" && (
            <>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
                {[["all", "All"], ["paid", "Paid"], ["pending", "Pending"], ["arrears", "Arrears"], ["partial", "Partial"], ["excused", "Excused"]].map(([k, l]) => (
                  <button key={k} onClick={() => setStatusF(k)} aria-pressed={statusF === k}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${statusF === k
                      ? "border-emerald-600 bg-emerald-600 text-white dark:border-mint dark:bg-mint dark:text-mint-strong"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist-muted"}`}>
                    {l} <span className="opacity-70">{counts[k]}</span>
                  </button>
                ))}
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_150px_170px]">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-3 text-slate-400" aria-hidden />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone or M-Pesa code" aria-label="Search members" className={`${inputCls} pl-9`} />
                </div>
                <select value={roleF} onChange={(e) => setRoleF(e.target.value)} aria-label="Filter by role" className={inputCls}>
                  <option value="all">All roles</option>
                  {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" className={inputCls}>
                  <option value="name">Sort by name</option>
                  <option value="balance">Highest balance first</option>
                  <option value="overdue">Longest overdue first</option>
                </select>
              </div>

              {selected.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white dark:bg-obsidian-raised">
                  <span>{selected.length} selected</span>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setBulk("remind")} className="rounded-lg bg-white/15 px-3 py-1.5 hover:bg-white/25"><Bell size={12} className="mr-1 inline" /> Send reminders</button>
                    {canRecordForOthers && <button onClick={() => setBulk("record")} className="rounded-lg bg-white/15 px-3 py-1.5 hover:bg-white/25"><Plus size={12} className="mr-1 inline" /> Record for each</button>}
                    <button onClick={() => exportMembers(selectedRows)} className="rounded-lg bg-white/15 px-3 py-1.5 hover:bg-white/25"><Download size={12} className="mr-1 inline" /> Export</button>
                    <button onClick={() => setSelected([])} className="px-2 py-1.5 opacity-80 hover:opacity-100">Clear</button>
                  </div>
                </div>
              )}

              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-bold text-slate-500 dark:border-obsidian-border dark:bg-obsidian-raised/40 dark:text-mist-muted">
                      <tr>
                        <th className="w-10 px-4 py-3"><input type="checkbox" aria-label="Select page" checked={allOnPage}
                          onChange={() => setSelected((s) => allOnPage ? s.filter((id) => !pageRows.some((r) => r.id === id)) : [...new Set([...s, ...pageRows.map((r) => r.id)])])} /></th>
                        <th className="px-3 py-3">Member</th>
                        <th className="px-3 py-3 text-right">Expected</th>
                        <th className="px-3 py-3 text-right">Paid</th>
                        <th className="px-3 py-3 text-right">Balance</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="px-3 py-3">Last payment</th>
                        <th className="px-3 py-3 text-right"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-obsidian-border">
                      {pageRows.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-obsidian-raised/30">
                          <td className="px-4 py-3"><input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.includes(r.id)} onChange={() => toggleSel(r.id)} /></td>
                          <td className="px-3 py-3">
                            <button onClick={() => setDrawer(r)} className="flex items-center gap-2.5 text-left">
                              <Avatar name={r.name} url={r.avatar} size={30} />
                              <span>
                                <span className="block font-bold">{r.name}</span>
                                <span className="block text-[11px] capitalize text-slate-400">{r.role}</span>
                              </span>
                            </button>
                          </td>
                          <td className="px-3 py-3 text-right text-slate-500 dark:text-mist-muted">{fmt(r.expected)}</td>
                          <td className="px-3 py-3 text-right font-bold">{fmt(r.paid)}</td>
                          <td className={`px-3 py-3 text-right font-bold ${r.outstanding > 0 ? "text-rose-600 dark:text-rose-300" : "text-slate-400"}`}>{fmt(r.outstanding)}</td>
                          <td className="px-3 py-3">
                            <StatusChip status={r.status} />
                            {r.status === "arrears" && (
                              <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-300">
                                {r.cyclesLate > 1 ? `${r.cyclesLate} cycles late · ` : ""}{r.arrearsDays} days overdue
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-3 text-slate-500 dark:text-mist-muted">
                            {r.lastPaidAt ? shortDate(r.lastPaidAt) : "—"}
                            {r.code && <span className="block font-mono text-[10px] text-slate-400">{r.code}</span>}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {canRecordForOthers && r.status !== "paid" && r.status !== "excused" && (
                                <Link to={recordUrl(r)} className="rounded-lg px-2 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 dark:text-mint dark:hover:bg-mint-deep">Collect</Link>
                              )}
                              <RowMenu row={r} canRecord={canRecordForOthers} onStatement={() => setDrawer(r)} onWaive={() => setWaive(r)}
                                wa={r.phone ? waLink(r.phone, reminderText(r)) : null} sms={r.phone ? smsLink(r.phone, reminderText(r)) : null} />
                            </div>
                          </td>
                        </tr>
                      ))}
                      {pageRows.length === 0 && (
                        <tr><td colSpan={8} className="px-6 py-10 text-center text-slate-400">
                          {rows.length === 0 ? "No members yet. Contributions appear here once a plan has raised obligations." : "No members match these filters."}
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[11px] font-semibold text-slate-500 dark:border-obsidian-border dark:text-mist-muted">
                  <span>{filtered.length === 0 ? "0 members" : `${(page - 1) * PAGE_SIZE + 1} to ${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length}`}</span>
                  <div className="flex items-center gap-1">
                    <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page" className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40 dark:border-obsidian-border"><ChevronLeft size={14} /></button>
                    <span className="px-2">{page} / {pages}</span>
                    <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page" className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40 dark:border-obsidian-border"><ChevronRight size={14} /></button>
                  </div>
                </div>
              </Card>
            </>
          )}

          {tab === "payments" && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {["all", ...planTypes].map((t) => (
                  <button key={t} onClick={() => setTypeF(t)} aria-pressed={typeF === t}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${typeF === t ? "border-emerald-600 bg-emerald-600 text-white dark:border-mint dark:bg-mint dark:text-mint-strong" : "border-slate-200 bg-white text-slate-600 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist-muted"}`}>
                    {t === "all" ? "All plans" : t}
                  </button>
                ))}
                <select value={monthF} onChange={(e) => setMonthF(e.target.value)} aria-label="Filter by month" className={`${inputCls} ml-auto max-w-[190px]`}>
                  <option value="all">All months</option>
                  {months.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-bold text-slate-500 dark:border-obsidian-border dark:bg-obsidian-raised/40 dark:text-mist-muted">
                      <tr><th className="px-4 py-3">Date</th><th className="px-3 py-3">Member</th><th className="px-3 py-3">Plan</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3">Method</th><th className="px-3 py-3">Reference</th><th className="px-3 py-3 text-right"><span className="sr-only">Receipt</span></th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-obsidian-border">
                      {shownPayments.slice(0, 60).map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-obsidian-raised/30">
                          <td className="px-4 py-3">{shortDate(p.paid_at)}<span className="block text-[11px] text-slate-400">{clock(p.paid_at)}</span></td>
                          <td className="px-3 py-3 font-bold">{p.member?.name || "—"}</td>
                          <td className="px-3 py-3 text-slate-500 dark:text-mist-muted">{p.plan?.name || "—"}</td>
                          <td className="px-3 py-3 text-right font-bold">{fmt(p.amount)}</td>
                          <td className="px-3 py-3 capitalize">{String(p.method || "—").replace(/_/g, " ")}</td>
                          <td className="px-3 py-3 font-mono text-[11px]">{p.external_reference || p.reference || "—"}</td>
                          <td className="px-3 py-3 text-right">
                            {isOk(p) ? (
                              <div className="flex justify-end gap-1">
                                <button onClick={() => receipt(p)} title="Print receipt as PDF" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-obsidian-raised"><Printer size={14} /></button>
                                <button onClick={() => receipt(p, "wa")} title="Send receipt on WhatsApp" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-obsidian-raised"><MessageCircle size={14} /></button>
                              </div>
                            ) : <StatusChip status="pending" label={String(p.status)} />}
                          </td>
                        </tr>
                      ))}
                      {shownPayments.length === 0 && <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-400">No payments match these filters.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Card>
              <p className="text-[11px] text-slate-400">Showing the latest 60. The full register with CSV export is in the <Link className="font-bold text-emerald-700 dark:text-mint" to={`${base}/finance/contributions/register`}>payment register</Link>.</p>
            </>
          )}

          {tab === "arrears" && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="p-4"><p className="text-[11px] font-semibold text-slate-500 dark:text-mist-muted">Defaulters</p><p className="mt-1 text-xl font-black">{defaulters.length}</p></Card>
                <Card className="p-4"><p className="text-[11px] font-semibold text-slate-500 dark:text-mist-muted">Contributions outstanding</p><p className="mt-1 text-xl font-black text-rose-600 dark:text-rose-300">KES {fmt(arrearsTotal)}</p></Card>
                <Card className="p-4"><p className="text-[11px] font-semibold text-slate-500 dark:text-mist-muted">Penalties accrued</p><p className="mt-1 text-xl font-black">KES {fmt(penaltyTotal)}</p></Card>
              </div>

              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-obsidian-border">
                  <h2 className="text-sm font-bold">Arrears ledger</h2>
                  {defaulters.length > 0 && <button onClick={() => { setSelected(defaulters.map((d) => d.id)); setBulk("remind"); }} className={btnGhost}><Bell size={13} /> Remind all</button>}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-xs">
                    <thead className="bg-slate-50/60 text-[11px] font-bold text-slate-500 dark:bg-obsidian-raised/40 dark:text-mist-muted">
                      <tr><th className="px-4 py-3">Member</th><th className="px-3 py-3">Age</th><th className="px-3 py-3 text-right">Contribution</th><th className="px-3 py-3 text-right">Penalty</th><th className="px-3 py-3 text-right">Total owed</th><th className="px-3 py-3 text-right"><span className="sr-only">Actions</span></th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-obsidian-border">
                      {defaulters.map((r) => (
                        <tr key={r.id}>
                          <td className="px-4 py-3 font-bold">{r.name}<span className="block text-[11px] font-medium text-slate-400">{cycle.name}</span></td>
                          <td className="px-3 py-3 text-rose-600 dark:text-rose-300">{r.cyclesLate > 1 ? `${r.cyclesLate} cycles · ` : ""}{r.arrearsDays} days</td>
                          <td className="px-3 py-3 text-right">{fmt(r.outstanding)}</td>
                          <td className="px-3 py-3 text-right">
                            {r.waiver ? <span className="text-[11px] text-slate-400 line-through">{fmt(r.waived)}</span> : fmt(r.penalty)}
                            {r.waiver && <span className="block text-[10px] font-semibold text-emerald-700 dark:text-mint">Waived</span>}
                          </td>
                          <td className="px-3 py-3 text-right font-black">{fmt(r.outstanding + r.penalty)}</td>
                          <td className="px-3 py-3 text-right">
                            {canRecordForOthers && r.penalty > 0 && <button onClick={() => setWaive(r)} className="rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100 dark:text-mist-muted dark:hover:bg-obsidian-raised">Waive penalty</button>}
                          </td>
                        </tr>
                      ))}
                      {defaulters.length === 0 && <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400"><CheckCircle2 size={18} className="mx-auto mb-2 text-emerald-500" />Nobody is in arrears for this cycle.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Card>

              {SHOW_SAMPLE && (
                <Card className="p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-bold">Penalty rules from the constitution</h2>
                    <div className="flex items-center gap-2"><SampleTag title="Illustrative rules. The late fee is applied to real arrears above." />
                      {canOpenDesk && <Link to={`${base}/leadership?tab=contributions`} className="text-[11px] font-bold text-emerald-700 dark:text-mint">Edit in Leadership Desk</Link>}</div>
                  </div>
                  <ul className="divide-y divide-slate-100 dark:divide-obsidian-border">
                    {PENALTY_RULES.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                        <span><span className="font-bold">{p.type}</span><span className="block text-[11px] text-slate-500 dark:text-mist-muted">{p.label}</span></span>
                        <span className="font-black">KES {fmt(p.fee)}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* ================= right rail: M-Pesa ================= */}
        <aside className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">M-Pesa collections</h2>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-bold ${socket?.connected ? "bg-emerald-100 text-emerald-800 dark:bg-mint-deep dark:text-mint" : "bg-amber-100 text-amber-800 dark:bg-amber-deep-bg dark:text-amber-deep-text"}`}>
                <Radio size={11} /> {socket?.connected ? "Auto-reconciling" : "Polling"}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div><dt className="text-[11px] text-slate-500 dark:text-mist-muted">Paybill</dt><dd className="mt-0.5 font-mono text-base font-black">{paybill}</dd></div>
              <div><dt className="text-[11px] text-slate-500 dark:text-mist-muted">Account</dt><dd className="mt-0.5 font-mono text-base font-black break-all">{account}</dd></div>
            </dl>
            {paybillIsSample && SHOW_SAMPLE && <div className="mt-2"><SampleTag title="Paybill number is a placeholder until it is saved on the workspace." /></div>}
            <button onClick={() => { navigator.clipboard?.writeText(`Paybill ${paybill}, account ${account}`); toast.success("Payment details copied"); }}
              className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-mint"><Copy size={12} /> Copy payment details</button>
          </Card>

          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold">Live feed</h2>
              {sampleFeed && <SampleTag />}
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-obsidian-border">
              {feed.map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-3 py-2.5 text-xs">
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{f.name}</span>
                    <span className="block font-mono text-[10px] text-slate-400">{f.code} · {f.at ? clock(f.at) : ""}</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-black text-emerald-700 dark:text-mint">+ {fmt(f.amount)}</span>
                    <span className="block text-[10px] font-semibold capitalize text-slate-400">{f.status}</span>
                  </span>
                </li>
              ))}
              {feed.length === 0 && <li className="py-6 text-center text-xs text-slate-400">Payments appear here the moment M-Pesa confirms them.</li>}
            </ul>
          </Card>

          {unmatched.length > 0 && (
            <Card className="border-amber-200 p-4 dark:border-amber-deep-text/30">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-sm font-bold"><AlertTriangle size={14} className="text-amber-600" /> Unmatched payments</h2>
                <SampleTag />
              </div>
              <p className="mb-2 text-[11px] text-slate-500 dark:text-mist-muted">Money arrived but no member matched the account number.</p>
              <ul className="space-y-3">
                {unmatched.map((u) => (
                  <li key={u.id} className="text-xs">
                    <div className="flex justify-between"><span className="font-bold">{u.payer}</span><span className="font-black">KES {fmt(u.amount)}</span></div>
                    <p className="font-mono text-[10px] text-slate-400">{u.code} · {u.phone}</p>
                    {canRecordForOthers ? (
                      <select defaultValue="" aria-label={`Assign ${u.code} to a member`} className={`${inputCls} mt-1.5`}
                        onChange={(e) => { if (e.target.value) { setResolved((r) => [...r, u.id]); navigate(recordUrl({ id: e.target.value }, { amount: String(u.amount), ref: u.code })); } }}>
                        <option value="">Assign to member…</option>
                        {rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    ) : <p className="mt-1 text-[11px] text-slate-400">The treasurer reviews these.</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {canRecordForOthers && (
            <Card className="p-4">
              <h2 className="text-sm font-bold">Notifications</h2>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-mist-muted">Saved on this device until the notification service is connected.</p>
              <ul className="mt-3 space-y-3 text-xs">
                {[["receipt", "Send a WhatsApp receipt after each payment"], ["recorded", "SMS the member when a payment is recorded"], ["arrears", "Alert members when they fall into arrears"]].map(([k, l]) => (
                  <li key={k} className="flex items-center justify-between gap-3"><span>{l}</span><Toggle label={l} checked={!!auto[k]} onChange={(v) => setAuto((a) => ({ ...a, [k]: v }))} /></li>
                ))}
              </ul>
              {offlineQueue.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3 dark:border-obsidian-border">
                  <p className="text-[11px] font-bold">Waiting to post ({offlineQueue.length})</p>
                  <ul className="mt-2 space-y-1.5">
                    {offlineQueue.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-2 text-[11px]">
                        <span>{o.name} · KES {fmt(o.amount)}</span>
                        <span className="flex gap-2">
                          {online && <Link to={recordUrl({ id: o.memberId }, { amount: String(o.amount), ref: o.code || "" })} onClick={() => setOfflineQueue((x) => x.filter((i) => i.id !== o.id))} className="font-bold text-emerald-700 dark:text-mint">Post</Link>}
                          <button onClick={() => setOfflineQueue((x) => x.filter((i) => i.id !== o.id))} className="text-slate-400">Remove</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <button onClick={() => setOfflineOpen(true)} className="mt-3 text-[11px] font-bold text-emerald-700 dark:text-mint">Note a payment offline</button>
            </Card>
          )}
        </aside>
      </div>

      {/* ================= overlays ================= */}
      <StatementDrawer row={drawer} onClose={() => setDrawer(null)} payments={payments} groupName={groupName} cycle={cycle}
        onReceipt={receipt} />
      <WaiveModal row={waive} onClose={() => setWaive(null)} rule={rule}
        onConfirm={(reason, approver) => {
          setWaivers((w) => ({ ...w, [waive.id]: { reason, approver, at: new Date().toISOString() } }));
          toast.success(`Penalty waived for ${waive.name}`);
          setWaive(null);
        }} />
      <BulkModal mode={bulk} onClose={() => setBulk(null)} rows={selectedRows} reminderText={reminderText} recordUrl={recordUrl} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} rows={rows} recordUrl={recordUrl} />
      <OfflineModal open={offlineOpen} onClose={() => setOfflineOpen(false)} rows={rows}
        onSave={(item) => { setOfflineQueue((x) => [...x, { ...item, id: String(Date.now()) }]); toast.success("Saved on this device"); setOfflineOpen(false); }} />
      <MpesaStkModal isOpen={stkOpen} onClose={() => setStkOpen(false)} chamaId={workspaceId} title="Request a contribution via M-Pesa" onSuccess={load} />
    </div>
  );
}

// ============================================================
// small pieces
// ============================================================

function Kpi({ label, value, foot, tone = "emerald", children }) {
  const c = { emerald: "text-emerald-700 dark:text-mint", rose: "text-rose-600 dark:text-rose-300", amber: "text-amber-700 dark:text-amber-deep-text" }[tone];
  return (
    <div className="p-4">
      <p className="text-[11px] font-semibold text-slate-500 dark:text-mist-muted">{label}</p>
      <p className="mt-1 text-lg font-black leading-tight">{value}</p>
      {children}
      <p className={`mt-1.5 text-[11px] font-bold ${c}`}>{foot}</p>
    </div>
  );
}

function RowMenu({ row, canRecord, onStatement, onWaive, wa, sms }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const item = "flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold hover:bg-slate-50 dark:hover:bg-obsidian-raised";
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={`Actions for ${row.name}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-obsidian-raised"><MoreHorizontal size={15} /></button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-obsidian-border dark:bg-obsidian-card">
          <button role="menuitem" className={item} onClick={() => { setOpen(false); onStatement(); }}><FileText size={13} /> Statement and history</button>
          {row.status !== "paid" && wa && <a role="menuitem" className={item} href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={13} /> Remind on WhatsApp</a>}
          {row.status !== "paid" && sms && <a role="menuitem" className={item} href={sms}><Mail size={13} /> Remind by SMS</a>}
          {row.status !== "paid" && !row.phone && <p className="px-3 py-2 text-[11px] text-slate-400">No phone number on file</p>}
          {canRecord && row.penalty > 0 && <button role="menuitem" className={item} onClick={() => { setOpen(false); onWaive(); }}><Clock size={13} /> Waive penalty</button>}
        </div>
      )}
    </div>
  );
}

function StatementDrawer({ row, onClose, payments, groupName, cycle, onReceipt }) {
  const mine = useMemo(() => (row ? payments.filter((p) => String(p.member?.membership_id) === row.id && !FAILED.includes(String(p.status || "").toLowerCase())) : []), [row, payments]);
  const year = new Date().getFullYear();
  const thisYear = mine.filter((p) => new Date(p.paid_at).getFullYear() === year);
  const total = thisYear.reduce((s, p) => s + Number(p.amount || 0), 0);
  if (!row) return null;
  const print = () => printDocument({
    title: `Statement ${row.name}`, group: groupName, kind: `Member statement ${year}`,
    meta: [["Member", row.name], ["Period", `1 Jan to ${longDate(new Date())}`], ["Paid this year", `KES ${fmt(total)}`], ["Outstanding", `KES ${fmt(row.outstanding)}`]],
    rows: [["Date", "Plan", "Reference", "Amount (KES)"], ...thisYear.map((p) => [longDate(p.paid_at), p.plan?.name || "Contribution", p.external_reference || p.reference || "—", fmt(p.amount)])],
    total: ["Total paid", `KES ${fmt(total)}`],
  });
  return (
    <Drawer open onClose={onClose} title={row.name} subtitle={`Statement for ${year}`}
      footer={<div className="flex gap-2"><button onClick={print} className={btnPrimary}><Printer size={13} /> Print or save PDF</button>
        {row.phone && <a className={btnGhost} target="_blank" rel="noopener noreferrer" href={waLink(row.phone, `${groupName} statement: you have paid KES ${fmt(total)} in ${year}${row.outstanding ? ` and KES ${fmt(row.outstanding)} is outstanding for ${cycle.name}` : ", with nothing outstanding"}.`)}><MessageCircle size={13} /> WhatsApp</a>}</div>}>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[["Paid this year", `KES ${fmt(total)}`], ["Payments", thisYear.length], ["Outstanding", `KES ${fmt(row.outstanding)}`]].map(([l, v]) => (
          <div key={l} className="rounded-2xl bg-slate-50 p-3 dark:bg-obsidian-raised"><p className="text-[10px] font-semibold text-slate-500 dark:text-mist-muted">{l}</p><p className="mt-1 text-sm font-black">{v}</p></div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2"><StatusChip status={row.status} />{row.waiver && <span className="text-[11px] text-slate-500">Penalty waived by {row.waiver.approver}: {row.waiver.reason}</span>}</div>
      <h3 className="mt-5 text-xs font-bold">Payment history</h3>
      <ul className="mt-2 divide-y divide-slate-100 dark:divide-obsidian-border">
        {mine.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
            <span><span className="block font-bold">{p.plan?.name || "Contribution"}</span><span className="block font-mono text-[10px] text-slate-400">{longDate(p.paid_at)} · {p.external_reference || p.reference || "—"}</span></span>
            <span className="flex items-center gap-2"><span className="font-black">{fmt(p.amount)}</span><button onClick={() => onReceipt(p)} aria-label="Print receipt" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-obsidian-raised"><Receipt size={14} /></button></span>
          </li>
        ))}
        {mine.length === 0 && <li className="py-6 text-center text-xs text-slate-400">No payments recorded yet.</li>}
      </ul>
    </Drawer>
  );
}

function WaiveModal({ row, onClose, onConfirm, rule }) {
  const [reason, setReason] = useState("");
  const [approver, setApprover] = useState("Chairperson");
  useEffect(() => { setReason(""); setApprover("Chairperson"); }, [row]);
  if (!row) return null;
  return (
    <Modal open onClose={onClose} title={`Waive penalty for ${row.name}`} subtitle={`KES ${fmt(row.penalty)} ${rule.type.toLowerCase()}`}>
      <label className="block text-xs font-bold">Reason<textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={`${inputCls} mt-1`} placeholder="For example: hospital stay, agreed with the committee" /></label>
      <label className="mt-3 block text-xs font-bold">Approved by
        <select value={approver} onChange={(e) => setApprover(e.target.value)} className={`${inputCls} mt-1`}>{["Chairperson", "Committee resolution", "Treasurer and Chairperson"].map((a) => <option key={a}>{a}</option>)}</select>
      </label>
      <p className="mt-3 text-[11px] text-slate-500 dark:text-mist-muted">The reason and approver are stored with the waiver on this device and shown on the member's statement.</p>
      <div className="mt-4 flex justify-end gap-2"><button onClick={onClose} className={btnGhost}>Cancel</button>
        <button disabled={reason.trim().length < 5} onClick={() => onConfirm(reason.trim(), approver)} className={btnPrimary}>Waive penalty</button></div>
    </Modal>
  );
}

function BulkModal({ mode, onClose, rows, reminderText, recordUrl }) {
  if (!mode) return null;
  const remind = mode === "remind";
  const todo = rows.filter((r) => !remind || r.status !== "paid");
  return (
    <Modal open onClose={onClose} wide title={remind ? "Send reminders" : "Record for each member"}
      subtitle={remind ? "Each button opens the message ready to send. Nothing is sent until you confirm in WhatsApp or your SMS app." : "Open the record form for each member in turn."}>
      <ul className="divide-y divide-slate-100 dark:divide-obsidian-border">
        {todo.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
            <span><span className="font-bold">{r.name}</span><span className="block text-[11px] text-slate-500">Balance KES {fmt(r.outstanding)}{r.penalty ? ` + ${fmt(r.penalty)} penalty` : ""}</span></span>
            {remind ? (
              r.phone ? <span className="flex gap-2"><a className={btnGhost} target="_blank" rel="noopener noreferrer" href={waLink(r.phone, reminderText(r))}><MessageCircle size={13} /> WhatsApp</a><a className={btnGhost} href={smsLink(r.phone, reminderText(r))}>SMS</a></span>
                : <span className="text-[11px] text-slate-400">No phone on file</span>
            ) : <Link className={btnGhost} to={recordUrl(r)}>Record</Link>}
          </li>
        ))}
        {todo.length === 0 && <li className="py-6 text-center text-xs text-slate-400">Everyone selected has already paid.</li>}
      </ul>
      {remind && todo.length > 0 && (
        <button className={`${btnGhost} mt-3`} onClick={() => { navigator.clipboard?.writeText(todo.map((r) => `${r.name} (${r.phone || "no phone"}): ${reminderText(r)}`).join("\n\n")); toast.success("Messages copied"); }}><Copy size={13} /> Copy all messages</button>
      )}
    </Modal>
  );
}

function ImportModal({ open, onClose, rows, recordUrl }) {
  const [parsed, setParsed] = useState(null);
  useEffect(() => { if (!open) setParsed(null); }, [open]);
  if (!open) return null;

  const onFile = async (file) => {
    if (!file) return;
    const table = parseCsv(await file.text());
    if (table.length < 2) return toast.error("The file needs a header row and at least one payment.");
    const head = table[0].map((h) => h.trim().toLowerCase());
    const col = (names) => head.findIndex((h) => names.some((n) => h.includes(n)));
    const iN = col(["name", "member"]), iP = col(["phone", "msisdn", "mobile"]), iA = col(["amount", "paid"]), iC = col(["code", "ref", "receipt", "transaction"]);
    if (iA < 0 || (iN < 0 && iP < 0)) return toast.error("Include an amount column and either a name or phone column.");
    setParsed(table.slice(1).map((r, i) => {
      const name = iN >= 0 ? r[iN]?.trim() : ""; const phone = iP >= 0 ? r[iP] : "";
      const match = rows.find((m) => (phone && last9(m.phone) && last9(m.phone) === last9(phone)) || (name && m.name.toLowerCase() === name.toLowerCase()));
      return { i, name: name || phone, amount: Number(String(r[iA]).replace(/[^\d.]/g, "")) || 0, code: iC >= 0 ? r[iC]?.trim() : "", match };
    }));
  };

  const matched = parsed?.filter((p) => p.match) || [];
  return (
    <Modal open onClose={onClose} wide title="Import payments from CSV" subtitle="Columns: name or phone, amount, and optionally the M-Pesa code. Rows are matched to members before anything is recorded.">
      <div className="flex flex-wrap items-center gap-3">
        <input type="file" accept=".csv,text/csv" aria-label="Choose a CSV file" onChange={(e) => onFile(e.target.files?.[0])} className="text-xs" />
        <button className="text-[11px] font-bold text-emerald-700 dark:text-mint" onClick={() => downloadCsv("payments-template.csv", [["name", "phone", "amount", "mpesa_code"], ["Mary Wambui", "0712345678", "5000", "QKJ4T7M2XA"]])}>Download template</button>
      </div>
      {parsed && (
        <>
          <p className="mt-4 text-xs font-bold">{matched.length} of {parsed.length} rows matched a member</p>
          <ul className="mt-2 max-h-72 divide-y divide-slate-100 overflow-y-auto dark:divide-obsidian-border">
            {parsed.map((p) => (
              <li key={p.i} className="flex items-center justify-between gap-3 py-2 text-xs">
                <span><span className="font-bold">{p.name}</span><span className="block font-mono text-[10px] text-slate-400">{p.code || "no code"} · KES {fmt(p.amount)}</span></span>
                {p.match ? <Link className={btnGhost} to={recordUrl(p.match, { amount: String(p.amount), ref: p.code })}>Record for {firstName(p.match.name)}</Link>
                  : <StatusChip status="pending" label="No member found" />}
              </li>
            ))}
          </ul>
          {parsed.length > matched.length && (
            <button className={`${btnGhost} mt-3`} onClick={() => downloadCsv("unmatched-rows.csv", [["name", "amount", "code"], ...parsed.filter((p) => !p.match).map((p) => [p.name, p.amount, p.code])])}><Download size={13} /> Download unmatched rows</button>
          )}
        </>
      )}
    </Modal>
  );
}

function OfflineModal({ open, onClose, rows, onSave }) {
  const [f, setF] = useState({ memberId: "", amount: "", code: "" });
  useEffect(() => { if (open) setF({ memberId: "", amount: "", code: "" }); }, [open]);
  if (!open) return null;
  const m = rows.find((r) => r.id === f.memberId);
  return (
    <Modal open onClose={onClose} title="Note a payment" subtitle="Saved on this device. Post it from here once you are online, so it goes through the normal record flow and the ledger.">
      <select value={f.memberId} onChange={(e) => setF({ ...f, memberId: e.target.value })} aria-label="Member" className={inputCls}><option value="">Choose member…</option>{rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
      <input value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d]/g, "") })} inputMode="numeric" placeholder="Amount in KES" aria-label="Amount" className={`${inputCls} mt-2`} />
      <input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="M-Pesa code (optional)" aria-label="M-Pesa code" className={`${inputCls} mt-2 font-mono`} />
      <div className="mt-4 flex justify-end gap-2"><button onClick={onClose} className={btnGhost}>Cancel</button>
        <button disabled={!m || !Number(f.amount)} onClick={() => onSave({ memberId: m.id, name: m.name, amount: Number(f.amount), code: f.code })} className={btnPrimary}>Save</button></div>
    </Modal>
  );
}