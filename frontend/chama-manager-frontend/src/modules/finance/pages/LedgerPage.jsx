import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import Spinner from "@/shared/components/ui/Spinner";
import useLedger from "../hooks/useLedger";
import { Download, Calendar, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import financeService from "../services/finance.service";

const { safeNumber, formatCurrency } = financeService;
const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

export default function LedgerPage() {
  const { workspaceId } = useParams();
  const [filters, setFilters] = useState({
    accountId: "",
    dateFrom: "",
    dateTo: "",
  });

  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    let mounted = true;
    if (workspaceId) {
      financeService.getAccounts(workspaceId).then((data) => {
        if (mounted && Array.isArray(data)) {
          setAccounts(data);
        }
      }).catch(console.error);
    }
    return () => { mounted = false; };
  }, [workspaceId]);

  const { entries, totals, loading, error, refetch } = useLedger(workspaceId, filters);

  // Coerce and calculate dynamic ledger entries strictly from API
  const entryList = useMemo(() => {
    if (!Array.isArray(entries)) return [];
    let runningBalance = 0;
    return entries.map((e, idx) => {
      const d = safeNumber(e.debit);
      const c = safeNumber(e.credit);
      runningBalance += c - d;
      return {
        id: e._id || e.id || idx,
        date: e.posted_at ? new Date(e.posted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recent",
        journalRef: e.journal_ref || e.reference || `JE-2026-${String(idx + 1).padStart(3, "0")}`,
        description: e.description || e.account_name || "General Ledger Entry",
        member: e.member_name || e.payee || "Group Ledger",
        debit: d,
        credit: c,
        balance: runningBalance,
      };
    });
  }, [entries]);

  const totalDebits = useMemo(() => {
    if (Number.isFinite(totals?.debits)) return safeNumber(totals.debits);
    return entryList.reduce((sum, e) => sum + e.debit, 0);
  }, [totals, entryList]);

  const totalCredits = useMemo(() => {
    if (Number.isFinite(totals?.credits)) return safeNumber(totals.credits);
    return entryList.reduce((sum, e) => sum + e.credit, 0);
  }, [totals, entryList]);

  const closingBalance = totalCredits - totalDebits;

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const handleExport = () => {
    const csv = [
      ["Date", "Journal Ref", "Description", "Member/Payee", "Debit", "Credit", "Balance"],
      ...entryList.map((e) => [e.date, e.journalRef, e.description, e.member, e.debit, e.credit, e.balance]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `general-ledger-${workspaceId}.csv`;
    a.click();
  };

  if (loading) return <Spinner fullscreen />;

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            General Ledger
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Browse all ledger entries in chronological order
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExport}
            disabled={entryList.length === 0}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition"
          >
            <Download size={16} className="text-slate-400" /> Export CSV
          </button>
        </div>
      </div>

      {/* Account Details Banner Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">ACCOUNT DETAILS</span>
            <h2 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {filters.accountId ? "Selected Account Ledger" : "All General Ledger Accounts"}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={filters.accountId}
              onChange={(e) => updateFilter("accountId", e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 focus:outline-none"
            >
              <option value="">All Accounts</option>
              {accounts.map((acc) => (
                <option key={acc._id || acc.id} value={acc._id || acc.id}>
                  {acc.name} ({acc.account_code || acc.type || 'Acc'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 4 Stat Highlights */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-2">
          <div>
            <span className="text-[11px] text-slate-400 font-bold">Total Ledger Entries</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{entryList.length.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-bold">Total Debits</span>
            <p className="text-2xl font-black text-rose-500 font-mono mt-1">{money(totalDebits)}</p>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-bold">Total Credits</span>
            <p className="text-2xl font-black text-emerald-600 font-mono mt-1">{money(totalCredits)}</p>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-bold">Closing Balance</span>
            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono mt-1">{money(closingBalance)}</p>
          </div>
        </div>
      </div>

      {/* Detailed General Ledger Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/50 uppercase text-[11px] font-extrabold text-slate-400 dark:border-slate-800 dark:bg-slate-800/40">
              <tr>
                <th className="px-6 py-4">DATE</th>
                <th className="px-6 py-4">JOURNAL REF</th>
                <th className="px-6 py-4">DESCRIPTION</th>
                <th className="px-6 py-4">MEMBER / PAYEE</th>
                <th className="px-6 py-4">DEBIT (KES)</th>
                <th className="px-6 py-4">CREDIT (KES)</th>
                <th className="px-6 py-4">BALANCE (KES)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold">
              {entryList.length > 0 ? (
                entryList.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4 text-slate-500 font-mono">{row.date}</td>
                    <td className="px-6 py-4 text-slate-900 dark:text-white font-mono font-bold">{row.journalRef}</td>
                    <td className="px-6 py-4 text-slate-900 dark:text-white font-bold">{row.description}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{row.member}</td>
                    <td className="px-6 py-4 text-rose-600 font-mono font-bold">{row.debit > 0 ? money(row.debit) : "-"}</td>
                    <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-mono font-bold">{row.credit > 0 ? money(row.credit) : "-"}</td>
                    <td className="px-6 py-4 text-indigo-600 dark:text-indigo-400 font-mono font-bold">{money(row.balance)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-slate-400 font-medium">
                    No ledger entries posted yet for this workspace.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-white px-6 py-4 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <span>Showing 1 to {entryList.length} entries</span>
          <div className="flex items-center gap-1.5">
            <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"><ChevronLeft size={14} /></button>
            <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold">1</button>
            <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}