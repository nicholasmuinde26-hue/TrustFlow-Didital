import { useParams, useSearchParams } from "react-router-dom";
import { useState } from "react";
import Spinner from "@/shared/components/ui/Spinner";
import useTransactions from "../hooks/useTransactions";
import TransactionTable from "../components/TransactionTable";
import { Search, Download, Filter } from "lucide-react";

export default function TransactionsPage() {
  const { workspaceId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState({
    search: searchParams.get("search")?? "",
    type: searchParams.get("type")?? "all",
    status: searchParams.get("status")?? "all",
    dateFrom: searchParams.get("dateFrom")?? "",
    dateTo: searchParams.get("dateTo")?? "",
  });

  const { transactions, loading, error, refetch } = useTransactions(workspaceId, filters);

  const updateFilter = (key, value) => {
    const newFilters = {...filters, [key]: value };
    setFilters(newFilters);
    setSearchParams(newFilters);
  };

  if (loading) return <Spinner />;

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-700">Failed to load transactions</h2>
        <p className="mt-2 text-red-600">{error.message}</p>
        <button
          onClick={refetch}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const txList = transactions?.items?? transactions?? [];

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Financial Transactions</h1>
          <p className="text-slate-500">
            Every financial event recorded by the Finance Engine. {txList.length} total
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 hover:bg-slate-50">
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* FILTERS */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
              placeholder="Search reference, member..."
              className="w-full rounded-lg border pl-10 pr-4 py-2"
            />
          </div>

          <select
            value={filters.type}
            onChange={(e) => updateFilter("type", e.target.value)}
            className="rounded-lg border px-4 py-2"
          >
            <option value="all">All Types</option>
            <option value="contribution">Contributions</option>
            <option value="payout">Payouts</option>
            <option value="expense">Expenses</option>
            <option value="loan">Loans</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="rounded-lg border px-4 py-2"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>

          <button
            onClick={() => setFilters({search:"",type:"all",status:"all",dateFrom:"",dateTo:""})}
            className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 hover:bg-slate-50"
          >
            <Filter size={16} /> Reset
          </button>
        </div>
      </div>

      {/* TABLE */}
      {txList.length === 0? (
        <div className="rounded-2xl border bg-white p-12 text-center">
          <p className="text-lg font-semibold">No transactions found</p>
          <p className="mt-2 text-slate-500">Try adjusting your filters or record your first contribution</p>
        </div>
      ) : (
        <TransactionTable transactions={txList} total={transactions?.total} />
      )}
    </div>
  );
}