import { useState } from "react";
import { useParams } from "react-router-dom";
import Spinner from "@/shared/components/ui/Spinner";
import useAccounts from "../hooks/useAccounts";
import { Plus, Download, Upload, Search, MoreVertical } from "lucide-react";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

export default function AccountsPage() {
  const { workspaceId } = useParams();
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { accounts = [], loading, error } = useAccounts(workspaceId);

  const accountList = accounts.map((acc, idx) => ({
    id: acc._id || acc.id || idx,
    code: acc.account_code || acc.code || `100${idx + 1}`,
    name: acc.name || acc.account_name || "Account",
    type: acc.type || acc.account_type || "Asset",
    category: acc.category || acc.type || "Asset",
    balance: Number(acc.balance || acc.current_balance || 0),
    status: acc.status || "Active",
  }));

  // Dynamic metric calculations
  const totalAccounts = accountList.length;
  const assetsCount = accountList.filter(a => a.type.toLowerCase().includes("asset")).length;
  const liabilitiesCount = accountList.filter(a => a.type.toLowerCase().includes("liab")).length;
  const equityCount = accountList.filter(a => a.type.toLowerCase().includes("equity")).length;
  const revenueCount = accountList.filter(a => a.type.toLowerCase().includes("rev") || a.type.toLowerCase().includes("income")).length;
  const expensesCount = accountList.filter(a => a.type.toLowerCase().includes("exp")).length;

  const filteredAccounts = accountList.filter((a) => {
    const matchesCategory = activeCategory === "all" || a.type.toLowerCase().includes(activeCategory.toLowerCase());
    const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading) return <Spinner fullscreen />;

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Chart of Accounts
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Manage all your accounts and account hierarchy
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition">
            <Upload size={16} className="text-slate-400" /> Import
          </button>
          <button className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition">
            <Download size={16} className="text-slate-400" /> Export
          </button>
          <button className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition">
            <Plus size={16} /> Add Account
          </button>
        </div>
      </div>

      {/* Top 6 Metrics Row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Accounts</span>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{totalAccounts}</p>
        </div>
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Asset Accounts</span>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{assetsCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Liability Accounts</span>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{liabilitiesCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Equity Accounts</span>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{equityCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Income Accounts</span>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{revenueCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Expense Accounts</span>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{expensesCount}</p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-100 dark:border-slate-800">
          {[
            { id: "all", label: "All Accounts" },
            { id: "asset", label: "Assets" },
            { id: "liab", label: "Liabilities" },
            { id: "equity", label: "Equity" },
            { id: "revenue", label: "Revenue" },
            { id: "exp", label: "Expenses" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
                activeCategory === tab.id
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search account code, name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
          />
        </div>
      </div>

      {/* Accounts Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/50 uppercase text-[11px] font-extrabold text-slate-400 dark:border-slate-800 dark:bg-slate-800/40">
              <tr>
                <th className="px-6 py-4">ACCOUNT CODE</th>
                <th className="px-6 py-4">ACCOUNT NAME</th>
                <th className="px-6 py-4">TYPE</th>
                <th className="px-6 py-4">BALANCE (KES)</th>
                <th className="px-6 py-4">STATUS</th>
                <th className="px-6 py-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold">
              {filteredAccounts.length > 0 ? (
                filteredAccounts.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4 text-slate-900 dark:text-white font-mono font-bold">{row.code}</td>
                    <td className="px-6 py-4 text-slate-900 dark:text-white font-bold">{row.name}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{row.type}</td>
                    <td className="px-6 py-4 text-indigo-600 dark:text-indigo-400 font-mono font-bold">{money(row.balance)}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {row.status}
                      </span>
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
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-400 font-medium">
                    No chart of accounts defined yet for this workspace.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}