import React, { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Smartphone,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Receipt,
  Bell,
  RefreshCw,
} from "lucide-react";
import BusinessMpesaModal from "@/modules/business/components/BusinessMpesaModal";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

export default function ContributionsPage() {
  const { workspaceId } = useParams();
  const [filter, setFilter] = useState("all"); // 'all' | 'paid' | 'pending' | 'overdue'
  const [searchQuery, setSearchQuery] = useState("");
  const [isStkModalOpen, setIsStkModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [toastNotice, setToastNotice] = useState(null);

  // Mock / Initial Ledger Data
  const initialLedger = [
    { id: "1", name: "Mercy Wambui", phone: "0712345678", amount: 5000, mpesaRef: "RHA92837190", status: "paid", date: "2026-08-14 14:30" },
    { id: "2", name: "John Doe", phone: "0792971466", amount: 5000, mpesaRef: "RHA92837195", status: "paid", date: "2026-08-14 11:15" },
    { id: "3", name: "Mary Smith", phone: "0722001122", amount: 5000, mpesaRef: "-", status: "pending", date: "Due Aug 15" },
    { id: "4", name: "Peter Jones", phone: "0733445566", amount: 5000, mpesaRef: "-", status: "overdue", date: "Due Aug 10" },
    { id: "5", name: "Sarah Connor", phone: "0788990011", amount: 5000, mpesaRef: "RHA92837210", status: "paid", date: "2026-08-13 16:45" },
  ];

  const filteredLedger = initialLedger.filter((item) => {
    const matchesFilter = filter === "all" || item.status === filter;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.phone.includes(searchQuery) ||
      item.mpesaRef.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleSendReminder = (name, phone) => {
    setToastNotice(`M-Pesa STK reminder sent to ${name} (${phone})!`);
    setTimeout(() => setToastNotice(null), 5000);
  };

  const handleOpenStk = (member) => {
    setSelectedMember(member);
    setIsStkModalOpen(true);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Toast Notification */}
      {toastNotice && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-500 p-4 text-white shadow-xl animate-bounce">
          <CheckCircle2 size={20} className="shrink-0 text-white" />
          <p className="text-xs font-bold">{toastNotice}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
            AUTOMATED M-PESA LEDGER
          </span>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            Group Contributions
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Real-time M-Pesa STK payments, automatic receipts & 1-click reminders.
          </p>
        </div>

        <button
          onClick={() => handleOpenStk(null)}
          className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white shadow-lg hover:bg-emerald-700 transition-all shrink-0"
        >
          <Smartphone size={18} /> Collect M-Pesa Contribution
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "All Ledger" },
            { id: "paid", label: "Paid" },
            { id: "pending", label: "Pending" },
            { id: "overdue", label: "Overdue" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                filter === tab.id
                  ? "bg-violet-700 text-white shadow"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, M-Pesa ref..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder:text-slate-400 focus:border-violet-600 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
          />
        </div>
      </div>

      {/* Ledger Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/70 uppercase text-slate-400 font-bold dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 py-4">Member Name</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">M-Pesa Reference</th>
                <th className="px-6 py-4">Date / Due</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-slate-500">
                    No contributions match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredLedger.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                      <div>
                        <span>{row.name}</span>
                        <p className="text-[11px] font-mono text-slate-400 font-normal">{row.phone}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-white">
                      {money(row.amount)}
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-300">
                      {row.mpesaRef !== "-" ? (
                        <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                          <Receipt size={14} /> {row.mpesaRef}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono">
                      {row.date}
                    </td>
                    <td className="px-6 py-4">
                      {row.status === "paid" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <CheckCircle2 size={13} /> Paid
                        </span>
                      )}
                      {row.status === "pending" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          <Clock size={13} /> Pending
                        </span>
                      )}
                      {row.status === "overdue" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-[11px] font-black text-red-800 dark:bg-red-950 dark:text-red-300">
                          <AlertTriangle size={13} /> Overdue
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {row.status !== "paid" ? (
                        <>
                          <button
                            onClick={() => handleOpenStk(row)}
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white shadow hover:bg-emerald-700"
                          >
                            <Smartphone size={13} /> Collect STK
                          </button>
                          <button
                            onClick={() => handleSendReminder(row.name, row.phone)}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                          >
                            <Bell size={13} /> Reminder
                          </button>
                        </>
                      ) : (
                        <span className="text-slate-400 text-[11px] font-medium italic">Verified & Receipted</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* M-Pesa Modal */}
      <BusinessMpesaModal
        isOpen={isStkModalOpen}
        onClose={() => setIsStkModalOpen(false)}
        workspaceId={workspaceId}
        title={`Collect M-Pesa Contribution${selectedMember ? ` (${selectedMember.name})` : ""}`}
      />
    </div>
  );
}
