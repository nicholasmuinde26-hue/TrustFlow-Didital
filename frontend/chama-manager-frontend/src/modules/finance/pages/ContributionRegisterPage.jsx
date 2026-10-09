import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CircleDollarSign,
  Download,
  PlusCircle,
  Search,
  Users,
  AlertTriangle,
  Wallet,
  RefreshCw,
  Receipt,
  Filter,
} from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";
import financeService from "../services/finance.service";
import useWorkspacePermissions from "../hooks/useworkspacepermissions";
import Spinner from "@/shared/components/ui/Spinner";
import {
  Card,
  SectionHeading,
  StatCard,
  StatusPill,
  Avatar,
  ProgressBar,
  EmptyState,
  money,
  percent,
  formatDate,
  timeAgo,
} from "../components/FinanceUi";

// ============================================================
// CONTRIBUTIONS
// ============================================================
//
// The register: what has been contributed, by whom, against which
// plan, and what is still owed.
//
// This page used to route to the very same component as Record
// Contribution, so both tabs showed one payment form and there was
// nowhere in the product to actually SEE the contribution book. The
// two are now properly separated:
//
//   Contributions       - the record (read)
//   Record Contribution - the act of taking a payment (write)
//
// Every figure comes from GET /finance/contributions, which computes
// them live off ContributionPayment + ContributionObligation. Nothing
// here is derived in the browser from a partial page of rows, so the
// headline totals stay true even while a filter is applied.
//
// ============================================================

const METHOD_LABELS = {
  MPESA: "M-Pesa",
  MANUAL: "Cash / Manual",
  CASH: "Cash",
  BANK: "Bank transfer",
  BANK_TRANSFER: "Bank transfer",
};

const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "completed", label: "Completed" },
  { value: "pending,processing", label: "In flight" },
  { value: "failed,cancelled,reversed", label: "Failed / reversed" },
];

const TABS = [
  { key: "activity", label: "Payment activity", icon: Receipt },
  { key: "members", label: "By member", icon: Users },
  { key: "plans", label: "By plan", icon: Wallet },
];

export default function ContributionRegisterPage() {
  const { workspaceId: routeWorkspaceId } = useParams();
  const { workspaceId: ctxWorkspaceId, isBurialChama, membership } = useWorkspace();
  const workspaceId = routeWorkspaceId || ctxWorkspaceId;
  const base = `/workspace/${workspaceId}`;

  const { canForOthers } = useWorkspacePermissions(workspaceId);
  const canRecordForOthers = canForOthers("contributions.record");

  const [register, setRegister] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("activity");
  const [search, setSearch] = useState("");
  // Officials get the whole chama's book by default from the API
  // (scope 'all'); this only controls whether it's shown or tucked
  // behind their own figures first. A plain member's register is
  // already scoped to 'own', so this toggle never appears for them.
  const [showChamaBook, setShowChamaBook] = useState(false);

  const [filters, setFilters] = useState({
    planId: "",
    status: "",
    method: "",
    from: "",
    to: "",
  });

  const load = useCallback(async () => {
    if (!workspaceId) return;

    setIsLoading(true);

    try {
      const data = await financeService.getContributionsRegister(workspaceId, {
        planId: filters.planId || undefined,
        status: filters.status || undefined,
        method: filters.method || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      });
      setRegister(data);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, filters]);

  useEffect(() => {
    load();
  }, [load]);

  // A completed STK push posts on the backend without this tab knowing,
  // so listen for the same signal MpesaStkModal already dispatches and
  // pull the register again rather than showing a stale book.
  useEffect(() => {
    window.addEventListener("finance:updated", load);
    return () => window.removeEventListener("finance:updated", load);
  }, [load]);

  const totals = register?.totals || {};
  const plans = register?.plans || [];
  const payments = register?.payments || [];
  const members = register?.members || [];
  const isOwnScope = register?.scope !== "all";

  // Derived from the same "all"-scope register already fetched above —
  // no second request. Picks the caller's own row/payments out of the
  // full chama book rather than asking the API to scope it twice.
  const myMembershipId = membership?._id ? String(membership._id) : null;
  const myTotals = useMemo(() => {
    if (isOwnScope || !myMembershipId) return { paid: 0, expected: 0, outstanding: 0, paymentCount: 0, lastPaymentAt: null };
    const row = members.find((m) => String(m.membership_id) === myMembershipId);
    return {
      paid: row?.paid || 0,
      expected: row?.expected || 0,
      outstanding: row?.outstanding || 0,
      paymentCount: row?.payment_count || 0,
      lastPaymentAt: row?.last_payment_at || null,
    };
  }, [isOwnScope, myMembershipId, members]);

  const myRecentPayments = useMemo(() => {
    if (isOwnScope || !myMembershipId) return [];
    return payments
      .filter((p) => String(p.member?.membership_id) === myMembershipId)
      .slice(0, 5);
  }, [isOwnScope, myMembershipId, payments]);

  const query = search.trim().toLowerCase();

  const filteredPayments = useMemo(() => {
    if (!query) return payments;
    return payments.filter(
      (p) =>
        p.member?.name?.toLowerCase().includes(query) ||
        p.reference?.toLowerCase().includes(query) ||
        p.external_reference?.toLowerCase().includes(query) ||
        p.plan?.name?.toLowerCase().includes(query)
    );
  }, [payments, query]);

  const filteredMembers = useMemo(() => {
    if (!query) return members;
    return members.filter((m) => m.name?.toLowerCase().includes(query));
  }, [members, query]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // Export what is actually on screen, so a treasurer reconciling a
  // filtered view gets that view rather than the whole book.
  const exportCsv = () => {
    const header = [
      "Date",
      "Member",
      "Plan",
      "Amount (KES)",
      "Method",
      "Status",
      "Reference",
      "M-Pesa receipt",
    ];

    const rows = filteredPayments.map((p) => [
      formatDate(p.paid_at),
      p.member?.name || "",
      p.plan?.name || "",
      p.amount,
      METHOD_LABELS[p.method] || p.method || "",
      p.status,
      p.reference || "",
      p.external_reference || "",
    ]);

    const csv = [header, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `contributions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading && !register) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-mist sm:text-3xl">
            Contributions
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-mist-muted">
            {isOwnScope
              ? "Your contribution record — every payment you've made and anything still outstanding"
              : "The full contribution register — every payment received, who still owes, and against which plan"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>

          {filteredPayments.length > 0 && (
            <button
              type="button"
              onClick={exportCsv}
              className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist"
            >
              <Download size={14} />
              Export CSV
            </button>
          )}

          <Link
            to={`${base}/finance/record-contribution`}
            className="flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 dark:bg-mint dark:text-obsidian-rail"
          >
            <PlusCircle size={15} />
            {canRecordForOthers ? "Record a contribution" : "Pay my contribution"}
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------------------
          MY CONTRIBUTIONS — always visible first, computed from the
          same register response rather than a second fetch: when the
          caller is an official (scope 'all'), register.members and
          register.payments already carry every member's row, so their
          own is picked out of it here; a plain member's register is
          already scoped to 'own' by the backend, so this simply mirrors
          the headline figures below it without a duplicate card.
          ------------------------------------------------------------ */}
      {!isOwnScope && (
        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-mist">My contributions</h2>
            <button
              type="button"
              onClick={() => setShowChamaBook((v) => !v)}
              className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist"
            >
              {showChamaBook ? "Hide chama-wide book" : "View chama-wide book"}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                I have contributed
              </p>
              <p className="mt-1 text-xl font-black text-emerald-600 dark:text-mint">
                {money(myTotals.paid)}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                {myTotals.paymentCount} payment{myTotals.paymentCount === 1 ? "" : "s"}
                {myTotals.lastPaymentAt ? ` · last ${timeAgo(myTotals.lastPaymentAt)}` : ""}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Outstanding
              </p>
              <p className="mt-1 text-xl font-black text-rose-500">{money(myTotals.outstanding)}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                {money(myTotals.expected)} expected of me
              </p>
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                My recent activity
              </p>
              {myRecentPayments.length > 0 ? (
                <ul className="mt-1.5 space-y-1">
                  {myRecentPayments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-mist-muted">
                      <span>{p.plan?.name || "Contribution"} · {formatDate(p.paid_at)}</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-mist">{money(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[11px] font-semibold text-slate-400">No payments yet</p>
              )}
            </div>
          </div>
        </Card>
      )}

      {(isOwnScope || showChamaBook) && (
        <>
      {/* Headline figures — always the whole book, never just the
          filtered page, so the totals can't quietly contradict the
          rows underneath them. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={isOwnScope ? "You have contributed" : "Total collected"}
          value={money(totals.collected)}
          icon={CircleDollarSign}
          tone="emerald"
          footnote={`${totals.payment_count || 0} settled payment${
            totals.payment_count === 1 ? "" : "s"
          }${totals.collected_this_month ? ` · ${money(totals.collected_this_month)} this month` : ""}`}
        />

        <StatCard
          label="Expected"
          value={money(totals.expected)}
          icon={Wallet}
          tone="indigo"
          footnote={
            totals.expected > 0
              ? `${percent(totals.collection_rate)} of expected collected`
              : "No obligations raised yet"
          }
        />

        <StatCard
          label="Outstanding"
          value={money(totals.outstanding)}
          icon={AlertTriangle}
          tone={totals.overdue_amount > 0 ? "rose" : "amber"}
          footnote={
            totals.overdue_amount > 0
              ? `${money(totals.overdue_amount)} of it overdue`
              : "Nothing past its due date"
          }
        />

        <StatCard
          label={isOwnScope ? "In flight" : "Contributors"}
          value={
            isOwnScope
              ? money(totals.in_flight)
              : `${totals.contributor_count || 0} / ${totals.member_count || 0}`
          }
          icon={Users}
          tone="slate"
          footnote={
            isOwnScope
              ? "Payments awaiting confirmation"
              : `${totals.overdue_member_count || 0} member${
                  totals.overdue_member_count === 1 ? "" : "s"
                } overdue`
          }
        />
      </div>

      {/* Collection progress — one honest bar for the whole book. */}
      {totals.expected > 0 && (
        <Card className="p-5">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-mist">
                Collection progress
              </h2>
              <p className="text-[11px] font-semibold text-slate-400">
                {money(totals.collected)} of {money(totals.expected)} expected
                {totals.in_flight > 0 && ` · ${money(totals.in_flight)} still in flight`}
              </p>
            </div>
            <span className="text-lg font-black text-emerald-600 dark:text-mint">
              {percent(totals.collection_rate)}
            </span>
          </div>
          <ProgressBar
            value={totals.collection_rate}
            tone={
              totals.collection_rate >= 80
                ? "emerald"
                : totals.collection_rate >= 40
                ? "amber"
                : "rose"
            }
          />
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search member, reference or plan..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-100 dark:border-obsidian-border dark:bg-obsidian-raised/40 dark:text-mist"
            />
          </div>

          <select
            value={filters.planId}
            onChange={(event) =>
              setFilters((previous) => ({ ...previous, planId: event.target.value }))
            }
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist"
          >
            <option value="">All plans</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(event) =>
              setFilters((previous) => ({ ...previous, status: event.target.value }))
            }
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist"
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={filters.method}
            onChange={(event) =>
              setFilters((previous) => ({ ...previous, method: event.target.value }))
            }
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist"
          >
            <option value="">All methods</option>
            <option value="MPESA">M-Pesa</option>
            <option value="MANUAL">Cash / Manual</option>
            <option value="BANK">Bank transfer</option>
          </select>

          <input
            type="date"
            value={filters.from}
            onChange={(event) =>
              setFilters((previous) => ({ ...previous, from: event.target.value }))
            }
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist"
          />
          <input
            type="date"
            value={filters.to}
            onChange={(event) =>
              setFilters((previous) => ({ ...previous, to: event.target.value }))
            }
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist"
          />

          {(activeFilterCount > 0 || search) && (
            <button
              type="button"
              onClick={() => {
                setFilters({ planId: "", status: "", method: "", from: "", to: "" });
                setSearch("");
              }}
              className="flex items-center gap-1.5 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-50 dark:border-obsidian-border dark:text-mist-muted"
            >
              <Filter size={13} />
              Clear
            </button>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 pb-2 dark:border-obsidian-border">
        {TABS.filter((tab) => !(isOwnScope && tab.key === "members")).map(
          ({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === key
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-mist"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          )
        )}
      </div>

      {/* Payment activity */}
      {activeTab === "activity" && (
        <Card className="p-6">
          <SectionHeading
            title="Payment activity"
            subtitle={`${filteredPayments.length} payment${
              filteredPayments.length === 1 ? "" : "s"
            } shown${activeFilterCount ? " · filtered" : ""}`}
          />

          {filteredPayments.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No payments match this view"
              description={
                activeFilterCount || search
                  ? "Try clearing the filters — the register may still hold payments outside this range."
                  : "Contributions appear here the moment the first payment is recorded or an M-Pesa push settles."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-extrabold uppercase text-slate-400 dark:border-obsidian-border dark:bg-obsidian-raised/40">
                  <tr>
                    <th className="px-4 py-3.5">Date</th>
                    {!isOwnScope && <th className="px-4 py-3.5">Member</th>}
                    <th className="px-4 py-3.5">Plan</th>
                    <th className="px-4 py-3.5 text-right">Amount</th>
                    <th className="px-4 py-3.5">Method</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold dark:divide-obsidian-border">
                  {filteredPayments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="transition hover:bg-slate-50/60 dark:hover:bg-obsidian-raised/30"
                    >
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <p className="font-bold text-slate-900 dark:text-mist">
                          {formatDate(payment.paid_at)}
                        </p>
                        <span className="text-[10px] text-slate-400">
                          {timeAgo(payment.paid_at)}
                        </span>
                      </td>

                      {!isOwnScope && (
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar
                              name={payment.member?.name}
                              url={payment.member?.avatar_url}
                              size={32}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-bold text-slate-900 dark:text-mist">
                                {payment.member?.name}
                              </p>
                              {payment.member?.role && (
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  {payment.member.role}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                      )}

                      <td className="px-4 py-3.5 text-slate-600 dark:text-mist-muted">
                        {payment.plan?.name || "—"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono font-black text-slate-900 dark:text-mist">
                        {money(payment.amount)}
                      </td>

                      <td className="px-4 py-3.5 text-slate-500 dark:text-mist-muted">
                        {METHOD_LABELS[payment.method] || payment.method || "—"}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <StatusPill status={payment.status} />
                        {payment.failure_message && (
                          <p className="mt-1 text-[10px] font-medium text-rose-500">
                            {payment.failure_message}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400">
                        {payment.external_reference || payment.reference || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Per-member standing — the view a treasurer actually chases from */}
      {activeTab === "members" && !isOwnScope && (
        <Card className="p-6">
          <SectionHeading
            title="Member standing"
            subtitle="Sorted by what's outstanding, so whoever needs chasing is at the top"
          />

          {filteredMembers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No members match this search"
              description="Clear the search box to see the full roll."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-extrabold uppercase text-slate-400 dark:border-obsidian-border dark:bg-obsidian-raised/40">
                  <tr>
                    <th className="px-4 py-3.5">Member</th>
                    <th className="px-4 py-3.5 text-right">Expected</th>
                    <th className="px-4 py-3.5 text-right">Paid</th>
                    <th className="px-4 py-3.5 text-right">Outstanding</th>
                    <th className="px-4 py-3.5">Progress</th>
                    <th className="px-4 py-3.5">Last payment</th>
                    <th className="px-4 py-3.5 text-center">Standing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold dark:divide-obsidian-border">
                  {filteredMembers.map((member) => (
                    <tr
                      key={member.membership_id}
                      className="transition hover:bg-slate-50/60 dark:hover:bg-obsidian-raised/30"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={member.name} url={member.avatar_url} size={32} />
                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-900 dark:text-mist">
                              {member.name}
                            </p>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              {member.role}
                              {!member.is_active && " · inactive"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-slate-600 dark:text-mist-muted">
                        {money(member.expected)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-600 dark:text-mint">
                        {money(member.paid)}
                      </td>
                      <td
                        className={`px-4 py-3.5 text-right font-mono font-bold ${
                          member.outstanding > 0
                            ? "text-rose-500"
                            : "text-slate-400"
                        }`}
                      >
                        {money(member.outstanding)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="w-28">
                          <ProgressBar
                            value={member.collection_rate}
                            tone={
                              member.standing === "overdue"
                                ? "rose"
                                : member.collection_rate >= 100
                                ? "emerald"
                                : "amber"
                            }
                          />
                          <span className="mt-1 block text-[10px] font-bold text-slate-400">
                            {percent(member.collection_rate)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-500">
                        {timeAgo(member.last_payment_at)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <StatusPill status={member.standing} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Per-plan breakdown */}
      {activeTab === "plans" && (
        <Card className="p-6">
          <SectionHeading
            title="Plans"
            subtitle={
              isBurialChama
                ? "Each levy and welfare stream this chama runs, kept separate"
                : "Each collection stream this workspace runs, kept separate rather than pooled into one total"
            }
          />

          {plans.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No contribution plans yet"
              description="A plan defines what members owe, how often, and by when. Nothing can be collected until one exists."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-2xl border border-slate-100 p-4 dark:border-obsidian-border"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900 dark:text-mist">
                        {plan.name}
                      </p>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {String(plan.contribution_type || "").replace(/_/g, " ")}
                        {plan.frequency && ` · ${plan.frequency}`}
                      </p>
                    </div>
                    <StatusPill status={plan.status === "active" ? "completed" : plan.status}>
                      {plan.status}
                    </StatusPill>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase text-slate-400">
                        Expected
                      </p>
                      <p className="font-mono text-xs font-bold text-slate-900 dark:text-mist">
                        {money(plan.expected)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold uppercase text-slate-400">
                        Collected
                      </p>
                      <p className="font-mono text-xs font-bold text-emerald-600 dark:text-mint">
                        {money(plan.collected)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold uppercase text-slate-400">
                        Outstanding
                      </p>
                      <p className="font-mono text-xs font-bold text-rose-500">
                        {money(plan.outstanding)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <ProgressBar
                      value={plan.collection_rate}
                      tone={plan.collection_rate >= 80 ? "emerald" : "amber"}
                    />
                    <p className="mt-1.5 text-[10px] font-bold text-slate-400">
                      {percent(plan.collection_rate)} collected ·{" "}
                      {plan.payment_count} payment
                      {plan.payment_count === 1 ? "" : "s"}
                      {plan.overdue_count > 0 && ` · ${plan.overdue_count} overdue`}
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