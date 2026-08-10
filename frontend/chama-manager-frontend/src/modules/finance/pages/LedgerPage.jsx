import { useParams } from "react-router-dom";
import { useState, useMemo } from "react";
import Spinner from "@/shared/components/ui/Spinner";
import useLedger from "../hooks/useLedger";
import LedgerTable from "../components/LedgerTable";
import { Download, Calendar, Filter } from "lucide-react";

const formatKES = (value) => {
  const num = Number(value?? 0);
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2
  }).format(num);
};

export default function LedgerPage() {
  const { workspaceId } = useParams();
  const [filters, setFilters] = useState({
    accountId: "",
    dateFrom: "",
    dateTo: ""
  });

  const { entries, totals, loading, error, refetch } = useLedger(workspaceId, filters);

  // FORCE ARRAY: this is the fix
  const entryList = Array.isArray(entries)? entries : [];

  // Use backend totals if available, else calculate safely
  const totalDebits = useMemo(() => {
    if (Number.isFinite(totals?.debits)) return Number(totals.debits);
    return entryList.reduce((sum, e) => sum + Number(e.debit?? 0), 0);
  }, [totals, entryList]);

  const totalCredits = useMemo(() => {
    if (Number.isFinite(totals?.credits)) return Number(totals.credits);
    return entryList.reduce((sum, e) => sum + Number(e.credit?? 0), 0);
  }, [totals, entryList]);

  const updateFilter = (key, value) => setFilters(prev => ({...prev, [key]: value}));

  if (loading) return <Spinner />;

  if (error) {
    return (
      <div className="rounded-xl border-red-200 bg-red-50 p-6">
        <h2 className="font-semibold text-red-700">Unable to load General Ledger</h2>
        <p className="mt-2 text-sm text-red-600">{error.message}</p>
        <button onClick={refetch} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">General Ledger</h1>
          <p className="text-slate-500">Every debit and credit posted by the Finance Engine</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 hover:bg-slate-50">
          <Download size={16} /> Export
        </button>
      </div>

      {/* TOTALS BAR */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-sm text-slate-500">Total Entries</p>
          <p className="text-2xl font-bold">{entryList.length.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-sm text-slate-500">Total Debits</p>
          <p className="text-2xl font-bold text-red-600">{formatKES(totalDebits)}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-sm text-slate-500">Total Credits</p>
          <p className="text-2xl font-bold text-green-600">{formatKES(totalCredits)}</p>
        </div>
      </div>

      {/* FILTERS */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => updateFilter("dateFrom", e.target.value)}
              className="w-full rounded-lg border pl-9 pr-4 py-2"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => updateFilter("dateTo", e.target.value)}
              className="w-full rounded-lg border pl-9 pr-4 py-2"
            />
          </div>
          <select
            value={filters.accountId}
            onChange={(e) => updateFilter("accountId", e.target.value)}
            className="rounded-lg border px-4 py-2"
          >
            <option value="">All Accounts</option>
            <option value="cash">Cash</option>
            <option value="contributions">Contributions</option>
            <option value="loans">Loans</option>
          </select>
          <button
            onClick={() => setFilters({accountId:"",dateFrom:"",dateTo:""})}
            className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 hover:bg-slate-50"
          >
            <Filter size={16} /> Reset
          </button>
        </div>
      </div>

      {/* TABLE */}
      {entryList.length === 0? (
        <div className="rounded-2xl border bg-white p-12 text-center">
          <p className="text-lg font-semibold">No ledger entries yet</p>
          <p className="mt-2 text-slate-500">Post your first transaction to see entries here</p>
        </div>
      ) : (
        <LedgerTable entries={entryList} />
      )}
    </div>
  );
}