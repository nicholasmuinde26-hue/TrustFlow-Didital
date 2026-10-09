import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import Spinner from "@/shared/components/ui/Spinner";
import useLedger from "../hooks/useLedger";
import { Download, ChevronLeft, ChevronRight, Users, Coins, X } from "lucide-react";
import financeService from "../services/finance.service";

const { safeNumber } = financeService;

const PAGE_SIZE = 25;
// Backend caps the ledger feed at 200 rows (finance.service.js#getLedger).
const BACKEND_ROW_CAP = 200;

const money = (val) => {
  const n = safeNumber(val);
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};

// ------------------------------------------------------------
// FUND CLASSIFICATION
// ------------------------------------------------------------
// Mirrors backend isBusinessFundAccount (businessFunds.constants.js):
// the explicit fund_scope marker wins, otherwise fall back to the
// account code so older accounts are still classified correctly.
const isIncomeFundAccount = (account) => {
  if (!account || typeof account !== "object") return false;
  if (account.fund_scope === "business") return true;
  if (account.fund_scope === "chama") return false;
  const code = String(account.account_code || "");
  return /^(BIZ_|ASI_|ASE_)/.test(code) || code === "PROFIT_WALLET_PAYABLE";
};

const fundOf = (account) => (isIncomeFundAccount(account) ? "income" : "chama");

const FUNDS = {
  chama: {
    key: "chama",
    label: "Chama Contributions",
    blurb: "Members' pooled money: contributions, savings, loans and payouts",
    icon: Users,
    badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    border: "border-emerald-200/80 dark:border-emerald-500/30",
    bar: "bg-emerald-500",
    tabOn: "bg-emerald-600 text-white shadow-xs",
    mainStat: "text-emerald-600 dark:text-emerald-400",
    mainLabel: "Contribution Balance",
  },
  income: {
    key: "income",
    label: "Income",
    blurb: "Business, rental and asset income, kept separate from member money",
    icon: Coins,
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
    border: "border-amber-200/80 dark:border-amber-500/30",
    bar: "bg-amber-500",
    tabOn: "bg-amber-500 text-white shadow-xs",
    mainStat: "text-amber-600 dark:text-amber-400",
    mainLabel: "Income Balance",
  },
};

const TABS = [
  { key: "all", label: "All" },
  { key: "chama", label: FUNDS.chama.label },
  { key: "income", label: FUNDS.income.label },
];

const formatDate = (value) => {
  if (!value) return "Recent";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Recent";
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
};

const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const sumBalances = (accounts, predicate) =>
  accounts.filter(predicate).reduce((sum, a) => sum + safeNumber(a.balance), 0);

// ------------------------------------------------------------
// One fund's section: stat strip, account balances, paged table
// ------------------------------------------------------------
function FundSection({ fund, data, selectedAccountId, onPickAccount, fetching }) {
  const cfg = FUNDS[fund];
  const Icon = cfg.icon;
  const [page, setPage] = useState(1);

  const { entries, debits, credits, accounts } = data;

  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const rows = entries.slice(start, start + PAGE_SIZE);

  // Authoritative balances come from the accounts themselves, not from
  // summing the (date-filtered, 200-row-capped) ledger feed.
  const held = sumBalances(accounts, (a) => a.account_type === "asset");
  let mainBalance;
  let subline;
  if (fund === "chama") {
    mainBalance = sumBalances(accounts, (a) => a.account_type === "equity");
    subline = `Held as cash, bank and M-Pesa: ${money(held)}`;
  } else {
    const incomeEarned = sumBalances(accounts, (a) => a.account_type === "income");
    const expenses = sumBalances(accounts, (a) => a.account_type === "expense");
    mainBalance = incomeEarned;
    subline = `Expenses ${money(expenses)} · Held in business funds ${money(held)}`;
  }

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const balanceAccounts = accounts.filter((a) => safeNumber(a.balance) !== 0);

  return (
    <section
      className={`overflow-hidden rounded-3xl border bg-white shadow-xs dark:bg-obsidian-card ${cfg.border}`}
    >
      <div className={`h-1.5 w-full ${cfg.bar}`} />

      <div className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${cfg.badge}`}>
              <Icon size={18} />
            </span>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-mist">{cfg.label}</h2>
              <p className="text-xs font-medium text-slate-500 dark:text-mist-muted">{cfg.blurb}</p>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider ${cfg.badge}`}>
            {entries.length.toLocaleString()} {entries.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <span className="text-[11px] font-bold text-slate-400">Total Debits</span>
            <p className="mt-1 font-mono text-xl font-black text-rose-500">{money(debits)}</p>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400">Total Credits</span>
            <p className="mt-1 font-mono text-xl font-black text-emerald-600">{money(credits)}</p>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400">
              {selectedAccount ? `${selectedAccount.name} Balance` : cfg.mainLabel}
            </span>
            <p className={`mt-1 font-mono text-xl font-black ${cfg.mainStat}`}>
              {money(selectedAccount ? selectedAccount.balance : mainBalance)}
            </p>
          </div>
        </div>
        <p className="mt-2 text-[11px] font-semibold text-slate-400">{subline}</p>

        {balanceAccounts.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {balanceAccounts.map((a) => {
              const active = a.id === selectedAccountId;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onPickAccount(active ? "" : a.id)}
                  title={active ? "Show all accounts" : `Show only ${a.name}`}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                    active
                      ? `${cfg.badge} border-transparent`
                      : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-obsidian-border dark:text-mist-muted dark:hover:bg-obsidian-raised"
                  }`}
                >
                  <span>{a.name}</span>
                  <span className="font-mono">{money(a.balance)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className={`border-t border-slate-100 dark:border-obsidian-border ${fetching ? "opacity-60" : ""}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-extrabold uppercase text-slate-400 dark:border-obsidian-border dark:bg-obsidian-raised/40">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Journal Ref</th>
                <th className="px-6 py-4">Account</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Debit (KES)</th>
                <th className="px-6 py-4">Credit (KES)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold dark:divide-obsidian-border/60">
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr key={row.id} className="transition hover:bg-slate-50/60 dark:hover:bg-obsidian-raised/30">
                    <td className="whitespace-nowrap px-6 py-4 font-mono text-slate-500">{row.date}</td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-mist">{row.journalRef}</td>
                    <td className="px-6 py-4 text-slate-700 dark:text-mist-muted">
                      {row.accountName}
                      {row.accountCode && (
                        <span className="ml-1.5 font-mono text-[10px] text-slate-400">{row.accountCode}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-900 dark:text-mist">
                      <span className="font-bold">{row.description}</span>
                      {row.categoryLabel && (
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${cfg.badge}`}>
                          {row.categoryLabel}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-rose-600">
                      {row.debit > 0 ? money(row.debit) : "-"}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {row.credit > 0 ? money(row.credit) : "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center font-medium text-slate-400">
                    No {cfg.label.toLowerCase()} entries for this selection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-xs font-semibold text-slate-500 dark:border-obsidian-border">
          <span>
            {entries.length === 0
              ? "Showing 0 entries"
              : `Showing ${start + 1} to ${start + rows.length} of ${entries.length} entries`}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              aria-label="Previous page"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 dark:border-obsidian-border dark:hover:bg-obsidian-raised"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-1 font-bold">
              {safePage} / {pageCount}
            </span>
            <button
              type="button"
              disabled={safePage >= pageCount}
              onClick={() => setPage(safePage + 1)}
              aria-label="Next page"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 dark:border-obsidian-border dark:hover:bg-obsidian-raised"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------
// PAGE
// ------------------------------------------------------------
export default function LedgerPage() {
  const { workspaceId } = useParams();
  const [tab, setTab] = useState("all"); // all | chama | income
  const [filters, setFilters] = useState({ accountId: "", dateFrom: "", dateTo: "" });
  const [accounts, setAccounts] = useState([]);

  // scope=all so the dropdown also lists the income fund's accounts
  // (the endpoint defaults to the pooled chama accounts only).
  useEffect(() => {
    let mounted = true;
    if (workspaceId) {
      financeService
        .getAccounts(workspaceId, { scope: "all" })
        .then((data) => {
          if (mounted && Array.isArray(data)) {
            setAccounts(
              data.map((a) => ({
                ...a,
                id: String(a._id || a.id),
                fund: fundOf(a),
              }))
            );
          }
        })
        .catch(console.error);
    }
    return () => {
      mounted = false;
    };
  }, [workspaceId]);

  // Only send filters that are actually set.
  const queryFilters = useMemo(() => {
    const f = {};
    if (filters.accountId) f.accountId = filters.accountId;
    if (filters.dateFrom) f.dateFrom = filters.dateFrom;
    if (filters.dateTo) f.dateTo = filters.dateTo;
    return f;
  }, [filters]);

  const { entries, loading, isFetching, error } = useLedger(workspaceId, queryFilters);

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const switchTab = (next) => {
    setTab(next);
    // Drop an account selection that doesn't belong to the chosen fund.
    setFilters((prev) => {
      if (!prev.accountId || next === "all") return prev;
      const acc = accounts.find((a) => a.id === prev.accountId);
      return acc && acc.fund === next ? prev : { ...prev, accountId: "" };
    });
  };

  const pickAccount = (accountId) => {
    updateFilter("accountId", accountId);
    if (accountId) {
      const acc = accounts.find((a) => a.id === accountId);
      if (acc && tab !== "all" && acc.fund !== tab) setTab(acc.fund);
    }
  };

  const normalized = useMemo(() => {
    if (!Array.isArray(entries)) return [];
    return entries
      .map((e, idx) => {
        const account = e.account_id && typeof e.account_id === "object" ? e.account_id : null;
        const when = e.posted_at || e.createdAt;
        const ts = when ? new Date(when).getTime() : 0;
        return {
          id: e._id || e.id || idx,
          ts: Number.isFinite(ts) ? ts : 0,
          date: formatDate(when),
          journalRef: e.journal_ref || e.reference || "-",
          accountName: e.account_name || account?.name || "Unknown Account",
          accountCode: account?.account_code || "",
          description: e.description || e.account_name || "General Ledger Entry",
          categoryLabel: e.category && e.category_label !== "Other" ? e.category_label : "",
          debit: safeNumber(e.debit),
          credit: safeNumber(e.credit),
          fund: fundOf(account),
        };
      })
      .sort((a, b) => b.ts - a.ts);
  }, [entries]);

  const sections = useMemo(() => {
    const build = (fund) => {
      const fundEntries = normalized.filter((e) => e.fund === fund);
      return {
        entries: fundEntries,
        debits: fundEntries.reduce((s, e) => s + e.debit, 0),
        credits: fundEntries.reduce((s, e) => s + e.credit, 0),
        accounts: accounts.filter((a) => a.fund === fund),
      };
    };
    return { chama: build("chama"), income: build("income") };
  }, [normalized, accounts]);

  const visibleFunds = useMemo(() => {
    const funds = tab === "all" ? ["chama", "income"] : [tab];
    // With a specific account picked, hide a fund that has nothing to show.
    return filters.accountId ? funds.filter((f) => sections[f].entries.length > 0) : funds;
  }, [tab, filters.accountId, sections]);

  const visibleEntries = useMemo(
    () => visibleFunds.flatMap((f) => sections[f].entries).sort((a, b) => b.ts - a.ts),
    [visibleFunds, sections]
  );
  const totalDebits = visibleEntries.reduce((s, e) => s + e.debit, 0);
  const totalCredits = visibleEntries.reduce((s, e) => s + e.credit, 0);
  const difference = totalDebits - totalCredits;
  const inBalance = Math.abs(difference) < 0.005;

  const dropdownAccounts = useMemo(
    () => accounts.filter((a) => tab === "all" || a.fund === tab),
    [accounts, tab]
  );

  const optionLabel = (a) => `${a.name} (${a.account_code || a.account_type || "Acc"})`;
  const hasFilters = Boolean(filters.accountId || filters.dateFrom || filters.dateTo);
  const selectedAccount = accounts.find((a) => a.id === filters.accountId);

  const handleExport = () => {
    const header = ["Fund", "Date", "Journal Ref", "Account", "Description", "Debit", "Credit"];
    const lines = visibleEntries.map((e) => [
      FUNDS[e.fund].label,
      e.date,
      e.journalRef,
      e.accountName,
      e.description,
      e.debit,
      e.credit,
    ]);
    const csv = [header, ...lines].map((row) => row.map(csvCell).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `general-ledger-${tab}-${workspaceId}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Full-screen spinner on the very first load only; later filter changes
  // keep the page on screen (keepPreviousData) and just dim the tables.
  if (loading) return <Spinner fullscreen />;

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-900 dark:text-mist">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-mist sm:text-3xl">
            General Ledger
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-mist-muted">
            Browse all ledger entries in chronological order
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExport}
            disabled={visibleEntries.length === 0}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist"
          >
            <Download size={16} className="text-slate-400" /> Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          Could not load the ledger. Please try again.
        </div>
      )}

      {/* Account Details Banner Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
        {/* Fund switch */}
        <div
          role="tablist"
          aria-label="Ledger fund"
          className="mb-5 inline-flex flex-wrap gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-obsidian"
        >
          {TABS.map((t) => {
            const active = tab === t.key;
            const onClass =
              t.key === "all"
                ? "bg-slate-900 text-white shadow-xs dark:bg-mist dark:text-obsidian"
                : FUNDS[t.key].tabOn;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => switchTab(t.key)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                  active ? onClass : "text-slate-500 hover:text-slate-900 dark:text-mist-muted dark:hover:text-mist"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="mb-4 flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 pb-4 dark:border-obsidian-border">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              ACCOUNT DETAILS
            </span>
            <h2 className="mt-0.5 text-lg font-black text-slate-900 dark:text-mist">
              {selectedAccount
                ? `${selectedAccount.name} Ledger`
                : tab === "all"
                  ? "All General Ledger Accounts"
                  : `${FUNDS[tab].label} Accounts`}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
              From
              <input
                type="date"
                value={filters.dateFrom}
                max={filters.dateTo || undefined}
                onChange={(e) => updateFilter("dateFrom", e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none dark:border-obsidian-border dark:bg-obsidian dark:text-mist-muted"
              />
            </label>
            <label className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
              To
              <input
                type="date"
                value={filters.dateTo}
                min={filters.dateFrom || undefined}
                onChange={(e) => updateFilter("dateTo", e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none dark:border-obsidian-border dark:bg-obsidian dark:text-mist-muted"
              />
            </label>

            <select
              aria-label="Filter by account"
              value={filters.accountId}
              onChange={(e) => pickAccount(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 focus:outline-none dark:border-obsidian-border dark:bg-obsidian dark:text-mist-muted"
            >
              <option value="">{tab === "all" ? "All Accounts" : `All ${FUNDS[tab].label} Accounts`}</option>
              {tab === "all"
                ? ["chama", "income"].map((fund) => {
                    const group = dropdownAccounts.filter((a) => a.fund === fund);
                    if (group.length === 0) return null;
                    return (
                      <optgroup key={fund} label={FUNDS[fund].label}>
                        {group.map((a) => (
                          <option key={a.id} value={a.id}>
                            {optionLabel(a)}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })
                : dropdownAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {optionLabel(a)}
                    </option>
                  ))}
            </select>

            {hasFilters && (
              <button
                type="button"
                onClick={() => setFilters({ accountId: "", dateFrom: "", dateTo: "" })}
                className="flex items-center gap-1 rounded-2xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:text-mist-muted dark:hover:bg-obsidian-raised"
              >
                <X size={14} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* 4 Stat Highlights */}
        <div className="grid gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-[11px] font-bold text-slate-400">Total Ledger Entries</span>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-mist">
              {visibleEntries.length.toLocaleString()}
            </p>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400">Total Debits</span>
            <p className="mt-1 font-mono text-2xl font-black text-rose-500">{money(totalDebits)}</p>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400">Total Credits</span>
            <p className="mt-1 font-mono text-2xl font-black text-emerald-600">{money(totalCredits)}</p>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400">
              {filters.accountId || tab !== "all" ? "Net Movement (Dr - Cr)" : "Ledger Check"}
            </span>
            <p className="mt-1 font-mono text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {filters.accountId || tab !== "all" ? money(difference) : inBalance ? "Balanced" : money(difference)}
            </p>
          </div>
        </div>

        {visibleEntries.length >= BACKEND_ROW_CAP && (
          <p className="mt-4 text-[11px] font-semibold text-amber-600">
            Showing the latest {BACKEND_ROW_CAP} entries. Narrow by account or date to see older ones.
          </p>
        )}
      </div>

      {/* Fund sections: each fund keeps its own totals, balances and table */}
      {visibleFunds.length === 0 ? (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-8 text-center text-xs font-medium text-slate-400 dark:border-obsidian-border dark:bg-obsidian-card">
          No ledger entries match this selection.
        </div>
      ) : (
        visibleFunds.map((fund) => (
          <FundSection
            // Reset paging whenever the selection changes.
            key={`${fund}-${filters.accountId}-${filters.dateFrom}-${filters.dateTo}`}
            fund={fund}
            data={sections[fund]}
            selectedAccountId={filters.accountId}
            onPickAccount={pickAccount}
            fetching={isFetching}
          />
        ))
      )}
    </div>
  );
}