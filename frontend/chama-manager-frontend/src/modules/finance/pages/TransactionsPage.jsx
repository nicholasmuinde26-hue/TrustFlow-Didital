import React, { useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import {
  Plus,
  Download,
  Search,
  Filter,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
} from "lucide-react";
import useTransactions from "../hooks/useTransactions";
import useFinanceSummary from "../hooks/useFinanceSummary";
import Spinner from "@/shared/components/ui/Spinner";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

export default function TransactionsPage() {
  const { workspaceId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState({
    search: searchParams.get("search") || "",
    type: searchParams.get("type") || "all",
    status: searchParams.get("status") || "all",
    dateFrom: searchParams.get("dateFrom") || "",
    dateTo: searchParams.get("dateTo") || "",
  });

  const [activeTab, setActiveTab] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const { transactions, loading, error } = useTransactions(workspaceId, filters);
  const { summary: financeSummary } = useFinanceSummary(workspaceId);

  const txList = (transactions?.items || transactions || []).map((tx, idx) => {
    const amt = Number(tx.amount || 0);
    const type = String(tx.type || tx.category || "").toLowerCase();
    const isCredit = type.includes("contribution") || type.includes("deposit") || type.includes("income") || type.includes("repayment");
    return {
      id: tx._id || tx.id || idx,
      reference: tx.reference || tx.mpesa_reference || `TRX-2026-${String(idx + 1).padStart(4, "0")}`,
      date: tx.createdAt ? new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recent",
      description: tx.description || tx.type || "Transaction Entry",
      account: tx.account_name || tx.category || (isCredit ? "Contributions A/c" : "Expenses A/c"),
      member: tx.member_name || tx.user_id?.name || tx.payee || "Member",
      debit: !isCredit ? amt : 0,
      credit: isCredit ? amt : 0,
      status: tx.status || "completed",
    };
  });

  // Calculate dynamic metrics strictly from backend API objects
  const totalInflows = financeSummary?.cash_in ?? txList.reduce((acc, t) => acc + t.credit, 0);
  const totalOutflows = financeSummary?.cash_out ?? txList.reduce((acc, t) => acc + t.debit, 0);
  const netCashFlow = totalInflows - totalOutflows;
  const totalTxCount = transactions?.total ?? txList.length;

  const filteredTxList = txList.filter((tx) => {
    const matchesTab = activeTab === "all" || tx.account.toLowerCase().includes(activeTab.toLowerCase());
    const matchesSearch = tx.reference.toLowerCase().includes(filters.search.toLowerCase()) || tx.member.toLowerCase().includes(filters.search.toLowerCase()) || tx.description.toLowerCase().includes(filters.search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const updateFilter = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    setSearchParams(newFilters);
  };

  if (loading) return <Spinner fullscreen />;

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Transactions
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            View and track all financial transactions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition">
            <Download size={16} className="text-slate-400" /> Export
          </button>
          <Link
            to={`/workspace/${workspaceId}/finance/record-contribution`}
            className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition"
          >
            <Plus size={16} /> New Transaction
          </Link>
        </div>
      </div>

      {/* Top 4 Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            TOTAL TRANSACTIONS
          </span>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {totalTxCount.toLocaleString()}
          </p>
          <span className="mt-1 text-xs font-bold text-slate-400 block">This Month</span>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            TOTAL INFLOWS
          </span>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {money(totalInflows)}
          </p>
          <span className="mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 block">Total Income & Deposits</span>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            TOTAL OUTFLOWS
          </span>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {money(totalOutflows)}
          </p>
          <span className="mt-1 text-xs font-bold text-rose-500 block">Total Payouts & Expenses</span>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            NET CASH FLOW
          </span>
          <p className="mt-2 text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {money(netCashFlow)}
          </p>
          <span className="mt-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 block">Current Net Movement</span>
        </div>
      </div>

      {/* Category Pills & Search Filter Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-100 dark:border-slate-800">
          {[
            { id: "all", label: "All" },
            { id: "contribution", label: "Contributions" },
            { id: "disbursement", label: "Loan Disbursements" },
            { id: "repayment", label: "Loan Repayments" },
            { id: "expense", label: "Expenses" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter Inputs */}
        <div className="grid gap-3 sm:grid-cols-12 items-center">
          <div className="relative sm:col-span-6">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search transactions, members..."
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="sm:col-span-5">
            <select
              value={filters.status}
              onChange={(e) => updateFilter("status", e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 px-3 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="sm:col-span-1 flex justify-end">
            <button className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
              <Filter size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Detailed Transactions Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/50 uppercase text-[11px] font-extrabold text-slate-400 dark:border-slate-800 dark:bg-slate-800/40">
              <tr>
                <th className="px-6 py-4">DATE</th>
                <th className="px-6 py-4">REFERENCE</th>
                <th className="px-6 py-4">DESCRIPTION</th>
                <th className="px-6 py-4">ACCOUNT</th>
                <th className="px-6 py-4">MEMBER / PAYEE</th>
                <th className="px-6 py-4">DEBIT (KES)</th>
                <th className="px-6 py-4">CREDIT (KES)</th>
                <th className="px-6 py-4">STATUS</th>
                <th className="px-6 py-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold">
              {filteredTxList.length > 0 ? (
                filteredTxList.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4 text-slate-500 font-mono">{row.date}</td>
                    <td className="px-6 py-4 text-slate-900 dark:text-white font-mono font-bold">{row.reference}</td>
                    <td className="px-6 py-4 text-slate-900 dark:text-white font-bold">{row.description}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{row.account}</td>
                    <td className="px-6 py-4 text-slate-900 dark:text-white font-bold">{row.member}</td>
                    <td className="px-6 py-4 text-rose-600 font-mono font-bold">{row.debit > 0 ? money(row.debit) : "-"}</td>
                    <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-mono font-bold">{row.credit > 0 ? money(row.credit) : "-"}</td>
                    <td className="px-6 py-4">
                      {row.status === "completed" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <CheckCircle2 size={12} /> Completed
                        </span>
                      )}
                      {row.status === "pending" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          <Clock size={12} /> Pending
                        </span>
                      )}
                      {row.status === "failed" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-[11px] font-black text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                          <XCircle size={12} /> Failed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1">
                        <MoreVertical size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="px-6 py-8 text-center text-slate-400 font-medium">
                    No transactions match the selected criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-white px-6 py-4 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <span>Showing 1 to {filteredTxList.length} of {totalTxCount} transactions</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
              <ChevronLeft size={14} />
            </button>
            <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold">1</button>
            <button onClick={() => setCurrentPage((p) => p + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}