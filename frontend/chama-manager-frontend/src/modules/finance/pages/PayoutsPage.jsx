import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import payoutService from "../services/payout.service";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

export default function PayoutsPage() {
  const { workspaceId } = useParams();
  const [payouts, setPayouts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  async function loadPayouts() {
    if (!workspaceId) return;
    try {
      setLoading(true);
      const response = await payoutService.getAll(workspaceId);
      if (response?.payouts) {
        setPayouts(response.payouts.map(p => ({
          id: p._id ? `PY-${String(p._id).slice(-4).toUpperCase()}` : p.id || "PY-REQ",
          recipient: p.member_id?.user_id?.name || p.member_id?.name || p.recipient || "Member",
          purpose: p.purpose || "Payout",
          amount: Number(p.amount || 0),
          status: p.status || "pending",
          requestedOn: p.createdAt ? new Date(p.createdAt).toLocaleString() : "Recent",
        })));
      }
    } catch {
      setPayouts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPayouts();
  }, [workspaceId]);

  // Pure dynamic summary metrics from actual fetched payouts
  const pendingRequests = payouts.filter(p => p.status === "pending");
  const approvedRequests = payouts.filter(p => p.status === "approved");
  const paidRequests = payouts.filter(p => p.status === "paid");
  const failedRequests = payouts.filter(p => p.status === "failed");

  const pendingTotal = pendingRequests.reduce((a, b) => a + b.amount, 0);
  const approvedTotal = approvedRequests.reduce((a, b) => a + b.amount, 0);
  const paidTotal = paidRequests.reduce((a, b) => a + b.amount, 0);
  const failedTotal = failedRequests.reduce((a, b) => a + b.amount, 0);

  const filteredPayouts = payouts.filter((p) => {
    const matchesSearch = p.recipient.toLowerCase().includes(searchQuery.toLowerCase()) || p.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Payouts
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Control and approve money leaving the chama
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to={`/workspace/${workspaceId}/finance/payouts/new`}
            className="flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-rose-700 transition"
          >
            <Plus size={16} /> Request Payout
          </Link>
        </div>
      </div>

      {/* Top 4 Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">PENDING</span>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{money(pendingTotal)}</p>
          <span className="mt-1 text-xs font-bold text-slate-400 block">{pendingRequests.length} Requests</span>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">APPROVED</span>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{money(approvedTotal)}</p>
          <span className="mt-1 text-xs font-bold text-slate-400 block">{approvedRequests.length} Requests</span>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">PAID</span>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{money(paidTotal)}</p>
          <span className="mt-1 text-xs font-bold text-slate-400 block">{paidRequests.length} Requests</span>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">FAILED</span>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{money(failedTotal)}</p>
          <span className="mt-1 text-xs font-bold text-slate-400 block">{failedRequests.length} Requests</span>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 sm:grid-cols-12 items-center">
          <div className="relative sm:col-span-4">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search payout..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-900 focus:border-rose-600 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="sm:col-span-3">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 px-3 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 focus:outline-none">
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <select className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 px-3 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 focus:outline-none">
              <option value="all">All Types</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <select className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 px-3 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 focus:outline-none">
              <option value="all">All Methods</option>
            </select>
          </div>

          <div className="sm:col-span-1 flex justify-end">
            <button className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
              <Filter size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Payouts Detailed Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/50 uppercase text-[11px] font-extrabold text-slate-400 dark:border-slate-800 dark:bg-slate-800/40">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">RECIPIENT</th>
                <th className="px-6 py-4">PURPOSE</th>
                <th className="px-6 py-4">AMOUNT</th>
                <th className="px-6 py-4">STATUS</th>
                <th className="px-6 py-4">REQUESTED ON</th>
                <th className="px-6 py-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold">
              {filteredPayouts.length > 0 ? (
                filteredPayouts.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4 text-slate-900 dark:text-white font-mono font-bold">{row.id}</td>
                    <td className="px-6 py-4 text-slate-900 dark:text-white font-bold">{row.recipient}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{row.purpose}</td>
                    <td className="px-6 py-4 text-slate-900 dark:text-white font-mono font-bold">{money(row.amount)}</td>
                    <td className="px-6 py-4">
                      {row.status === "paid" && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"><CheckCircle2 size={12} /> Paid</span>}
                      {row.status === "pending" && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-300"><Clock size={12} /> Pending</span>}
                      {row.status === "approved" && <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-[11px] font-black text-sky-800 dark:bg-sky-950 dark:text-sky-300"><CheckCircle2 size={12} /> Approved</span>}
                      {row.status === "failed" && <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-[11px] font-black text-rose-800 dark:bg-rose-950 dark:text-rose-300"><XCircle size={12} /> Failed</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono">{row.requestedOn}</td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1">
                        <MoreVertical size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-slate-400 font-medium">
                    No payouts recorded for this workspace.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-white px-6 py-4 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <span>Showing 1 to {filteredPayouts.length} of {payouts.length} payouts</span>
          <div className="flex items-center gap-1.5">
            <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"><ChevronLeft size={14} /></button>
            <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600 text-white font-bold">1</button>
            <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
