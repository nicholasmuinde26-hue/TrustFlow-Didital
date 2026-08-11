import { useParams } from "react-router-dom";
import { useState, useMemo } from "react";
import Spinner from "@/shared/components/ui/Spinner";
import useLedger from "../hooks/useLedger";
import LedgerTable from "../components/LedgerTable";
import { Download, Calendar, Filter } from "lucide-react";
import financeService from "../services/finance.service"; // <- import helpers

const { safeNumber, formatCurrency } = financeService;

export default function LedgerPage() {
  const { workspaceId } = useParams();
  const [filters, setFilters] = useState({
    accountId: "",
    dateFrom: "",
    dateTo: ""
  });

  const { entries, totals, loading, error, refetch } = useLedger(workspaceId, filters);

  // FORCE ARRAY + NORMALIZE: Convert Decimal128/strings to numbers safely
  const entryList = useMemo(() => {
    if (!Array.isArray(entries)) return [];
    return entries.map(e => ({
      ...e,
      debit: safeNumber(e.debit),
      credit: safeNumber(e.credit),
      amount: safeNumber(e.amount), // in case table uses this
      formatted_debit: formatCurrency(e.debit),
      formatted_credit: formatCurrency(e.credit),
    }));
  }, [entries]);

  // Use backend totals if available, else calculate safely
  const totalDebits = useMemo(() => {
    if (Number.isFinite(totals?.debits)) return safeNumber(totals.debits);
    return entryList.reduce((sum, e) => sum + e.debit, 0);
  }, [totals, entryList]);

  const totalCredits = useMemo(() => {
    if (Number.isFinite(totals?.credits)) return safeNumber(totals.credits);
    return entryList.reduce((sum, e) => sum + e.credit, 0);
  }, [totals, entryList]);

  const updateFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

  const handleExport = () => {
    // Basic CSV export
    const csv = [
      ['Date', 'Description', 'Account', 'Debit', 'Credit'],
      ...entryList.map(e => [
        new Date(e.posted_at).toLocaleDateString(),
        e.description,
        e.account_name,
        e.debit,
        e.credit
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-${workspaceId}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) return <Spinner />;

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
        <h2 className="font-semibold text-red-700 dark:text-red-400">Unable to load General Ledger</h2>
        <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error.message}</p>
        <button onClick={refetch} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700">
          Retry
        </button>
      </div>
    );
  }

  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01; // floating point safe

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">General Ledger</h1>
          <p className="text-slate-500">Every debit and credit posted by the Finance Engine</p>
        </div>
        <button 
          onClick={handleExport}
          disabled={entryList.length === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* TOTALS BAR */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Total Entries</p>
          <p className="text-2xl font-bold">{entryList.length.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Total Debits</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalDebits)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Total Credits</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalCredits)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500">Status</p>
          <p className={`text-2xl font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
            {isBalanced ? 'Balanced' : 'Imbalanced'}
          </p>
        </div>
      </div>

      {/* FILTERS */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => updateFilter("dateFrom", e.target.value)}
              className="w-full rounded-lg border border-slate-300 pl-9 pr-4 py-2 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => updateFilter("dateTo", e.target.value)}
              className="w-full rounded-lg border-slate-300 pl-9 pr-4 py-2 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <select
            value={filters.accountId}
            onChange={(e) => updateFilter("accountId", e.target.value)}
            className="rounded-lg border-slate-300 px-4 py-2 dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="">All Accounts</option>
            {/* TODO: Replace with real accounts from API */}
          </select>
          <button
            onClick={() => setFilters({ accountId: "", dateFrom: "", dateTo: "" })}
            className="inline-flex items-center justify-center gap-2 rounded-lg border-slate-300 px-4 py-2 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <Filter size={16} /> Reset
          </button>
        </div>
      </div>

      {/* TABLE */}
      {entryList.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-lg font-semibold">No ledger entries yet</p>
          <p className="mt-2 text-slate-500">Post your first transaction to see entries here</p>
        </div>
      ) : (
        <LedgerTable entries={entryList} />
      )}
    </div>
  );
}