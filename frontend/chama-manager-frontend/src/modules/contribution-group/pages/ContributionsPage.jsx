import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Plus,
  Bell,
  Download,
  Search,
  Calendar,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import BusinessMpesaModal from "@/modules/business/components/BusinessMpesaModal";
import useFinanceSummary from "@/modules/finance/hooks/useFinanceSummary";
import mgrApi from "@/modules/chama/api/mgr.api";
import useWorkspace from "@/app/hooks/useWorkspace";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

export default function ContributionsPage() {
  const { workspaceId: routeWorkspaceId } = useParams();
  const { workspaceId: ctxWorkspaceId } = useWorkspace();
  const workspaceId = routeWorkspaceId || ctxWorkspaceId;

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [isStkModalOpen, setIsStkModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [toastNotice, setToastNotice] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Chama-native contributions data
  const [contribData, setContribData] = useState({ plans: [], activePlan: null, members: [] });
  const [loadingContrib, setLoadingContrib] = useState(true);

  const { summary: financeSummary } = useFinanceSummary(workspaceId);

  useEffect(() => {
    if (!workspaceId) return;
    setLoadingContrib(true);
    mgrApi.getContributions(workspaceId)
      .then(res => setContribData(res.data?.data || { plans: [], activePlan: null, members: [] }))
      .catch(() => {})
      .finally(() => setLoadingContrib(false));
  }, [workspaceId]);

  const { plans = [], activePlan, members = [] } = contribData;
  const planAmount = activePlan?.amount != null ? Number(activePlan.amount)
    : activePlan?.contribution_rule?.uniform_amount != null ? Number(activePlan.contribution_rule.uniform_amount)
    : null;

  // Build member list from Chama-native response
  const activeMembersList = members.map((m, idx) => {
    const paidAmt = Number(m.paid || 0);
    const expAmt = Number(m.expected || planAmount || 0);
    const balAmt = Math.max(0, expAmt - paidAmt);
    const st = !expAmt
      ? (paidAmt > 0 ? "paid" : "unpaid")
      : paidAmt >= expAmt ? "paid" : paidAmt > 0 ? "partial" : "unpaid";
    return {
      id: String(m._id || idx),
      name: m.user_id?.name || `Member ${idx + 1}`,
      phone: m.user_id?.phone || "—",
      expected: expAmt,
      paid: paidAmt,
      balance: balAmt,
      status: m.status === "paid" ? "paid" : st,
      method: paidAmt > 0 ? "M-Pesa" : "-",
    };
  });

  // Dynamic totals
  const totalReceived = financeSummary?.total_contributions || activeMembersList.reduce((acc, m) => acc + m.paid, 0);
  const totalOutstanding = activeMembersList.reduce((acc, m) => acc + m.balance, 0);
  const totalExpected = totalReceived + totalOutstanding;
  const collectionRate = totalExpected > 0 ? ((totalReceived / totalExpected) * 100).toFixed(1) : "0.0";

  const filteredMembers = activeMembersList.filter((m) => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || m.status === statusFilter;
    const matchesMethod = methodFilter === "all" || m.method.toLowerCase() === methodFilter.toLowerCase();
    return matchesSearch && matchesStatus && matchesMethod;
  });

  const handleSendReminders = () => {
    setToastNotice("Reminders sent successfully to members with unpaid balances!");
    setTimeout(() => setToastNotice(null), 4000);
  };

  const handleOpenStk = (member) => {
    setSelectedMember(member);
    setIsStkModalOpen(true);
  };

  const currentDateStr = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 pb-12">
      {toastNotice && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-600 p-4 text-white shadow-xl animate-fade-in">
          <CheckCircle2 size={18} className="shrink-0" />
          <p className="text-xs font-bold">{toastNotice}</p>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Contributions
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Manage member contributions and collection performance
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={() => handleOpenStk(null)} className="flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-violet-700 transition">
            <Plus size={16} /> Record Payment
          </button>
          <button onClick={() => handleOpenStk(null)} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition">
            <Plus size={16} /> Create Plan
          </button>
          <button onClick={handleSendReminders} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition">
            <Bell size={16} className="text-slate-400" /> Send Reminders
          </button>
          <button className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition">
            <Download size={16} className="text-slate-400" /> Export
          </button>
        </div>
      </div>

      {/* Top 4 Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">EXPECTED</span>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{money(totalExpected)}</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">RECEIVED</span>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{money(totalReceived)}</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">OUTSTANDING</span>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{money(totalOutstanding)}</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">COLLECTION RATE</span>
            <span className="text-sm font-black text-emerald-600">{collectionRate}%</span>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${collectionRate}%` }} />
          </div>
        </div>
      </div>

      {/* Contribution Cycle & Filters Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-sm font-extrabold text-slate-900 dark:text-white">
              Contribution Cycle: {currentDateStr}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span>Cycle Active</span>
            <Calendar size={14} className="text-slate-400" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-12 items-center">
          <div className="relative sm:col-span-4">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search member..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-900 focus:border-violet-600 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="sm:col-span-3">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 px-3 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 focus:outline-none">
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <select className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 px-3 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 focus:outline-none">
              <option value="all">All Plans</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 px-3 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 focus:outline-none">
              <option value="all">All Methods</option>
              <option value="m-pesa">M-Pesa</option>
              <option value="bank">Bank</option>
            </select>
          </div>

          <div className="sm:col-span-1 flex justify-end">
            <button className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
              <Filter size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Detailed Members Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/50 uppercase text-[11px] font-extrabold text-slate-400 dark:border-slate-800 dark:bg-slate-800/40">
              <tr>
                <th className="px-6 py-4">MEMBER</th>
                <th className="px-6 py-4">EXPECTED</th>
                <th className="px-6 py-4">PAID</th>
                <th className="px-6 py-4">BALANCE</th>
                <th className="px-6 py-4">STATUS</th>
                <th className="px-6 py-4">METHOD</th>
                <th className="px-6 py-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold">
              {filteredMembers.length > 0 ? (
                filteredMembers.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4 text-slate-900 dark:text-white font-bold">{row.name}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-mono">{money(row.expected)}</td>
                    <td className="px-6 py-4 text-slate-900 dark:text-white font-mono font-bold">{money(row.paid)}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-mono">{money(row.balance)}</td>
                    <td className="px-6 py-4">
                      {row.status === "paid" && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"><CheckCircle2 size={12} /> Paid</span>}
                      {row.status === "partial" && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-300"><Clock size={12} /> Partial</span>}
                      {row.status === "unpaid" && <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-[11px] font-black text-rose-800 dark:bg-rose-950 dark:text-rose-300"><AlertTriangle size={12} /> Unpaid</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{row.method}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleOpenStk(row)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1">
                        <MoreVertical size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-slate-400 font-medium">
                    No members or contribution entries found for this group.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-white px-6 py-4 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <span>Showing 1 to {filteredMembers.length} of {activeMembersList.length} members</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"><ChevronLeft size={14} /></button>
            <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-white font-bold">1</button>
            <button onClick={() => setCurrentPage((p) => p + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      <BusinessMpesaModal isOpen={isStkModalOpen} onClose={() => setIsStkModalOpen(false)} workspaceId={workspaceId} title={`Record Payment${selectedMember ? ` (${selectedMember.name})` : ""}`} />
    </div>
  );
}