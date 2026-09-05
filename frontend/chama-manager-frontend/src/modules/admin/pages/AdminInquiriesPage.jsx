import { useState, useEffect } from "react";
import {
  MessageSquare,
  ShieldAlert,
  Search,
  RefreshCw,
  Send,
  CheckCircle2,
  Clock,
  Building2,
  Store,
  Wallet,
  User,
  Phone,
  Mail,
  AlertCircle,
  Tag,
  ChevronRight,
  Filter,
} from "lucide-react";
import inquiryService from "@/app/services/inquiry.service";
import Spinner from "@/shared/components/ui/Spinner";

const TYPE_ICONS = {
  chama: Building2,
  business: Store,
  contribution_group: Wallet,
};

const CATEGORY_LABELS = {
  general_inquiry: "General Inquiry",
  discrepancy_report: "Discrepancy Report",
  technical_issue: "Technical Issue",
  account_help: "Account / KYC Help",
  governance_support: "Governance Support",
  other: "Other Report",
};

export default function AdminInquiriesPage() {
  const [inquiries, setInquiries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedInquiry, setSelectedInquiry] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Actions
  const [replyText, setReplyText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    try {
      const [listRes, statsRes] = await Promise.all([
        inquiryService.listAdminInquiries({
          status: statusFilter === "all" ? "" : statusFilter,
          workspaceType: typeFilter === "all" ? "" : typeFilter,
          search: searchTerm,
        }),
        inquiryService.getAdminInquiryStats(),
      ]);

      setInquiries(listRes.inquiries || []);
      setStats(statsRes);

      if (selectedInquiry) {
        const updated = (listRes.inquiries || []).find(
          (i) => i._id === selectedInquiry._id
        );
        if (updated) setSelectedInquiry(updated);
      }
    } catch (err) {
      console.error("Failed to load inquiries:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 12000); // Polling for incoming inquiries
    return () => clearInterval(interval);
  }, [statusFilter, typeFilter, searchTerm]);

  async function handleStatusChange(inquiryId, newStatus) {
    setActionLoading(true);
    setNotice("");
    setError("");
    try {
      const updated = await inquiryService.updateAdminInquiryStatus(
        inquiryId,
        newStatus
      );
      setSelectedInquiry(updated);
      setNotice(`Inquiry marked as ${newStatus}`);
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update status");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSendReply(e) {
    e.preventDefault();
    if (!selectedInquiry || !replyText.trim()) return;

    setActionLoading(true);
    setNotice("");
    setError("");
    try {
      const updated = await inquiryService.replyAdminInquiry(
        selectedInquiry._id,
        replyText.trim()
      );
      setSelectedInquiry(updated);
      setReplyText("");
      setNotice("Reply transmitted to Chama / workspace successfully");
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to send reply");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading && inquiries.length === 0) {
    return <Spinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              Inquiries & Reports Console
            </h1>
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Active Listener
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Listen for incoming inquiries, dispute reports, and support requests from any Chama, Business, or Contribution Group.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setLoading(true);
            loadData();
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 transition"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* Stats Counter Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300">
            <span>Open Inquiries</span>
            <Clock size={16} />
          </div>
          <p className="mt-2 text-2xl font-black text-amber-950 dark:text-amber-100">
            {stats?.openCount || 0}
          </p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
          <div className="flex items-center justify-between text-xs font-bold text-blue-800 dark:text-blue-300">
            <span>In Progress</span>
            <MessageSquare size={16} />
          </div>
          <p className="mt-2 text-2xl font-black text-blue-950 dark:text-blue-100">
            {stats?.inProgressCount || 0}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
            <span>Resolved</span>
            <CheckCircle2 size={16} />
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-950 dark:text-emerald-100">
            {stats?.resolvedCount || 0}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>Total Inquiries</span>
            <ShieldAlert size={16} />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {stats?.totalCount || 0}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap gap-1.5">
          {["all", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                statusFilter === st
                  ? "bg-violet-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {st === "all" ? "All Statuses" : st.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="all">All Types</option>
            <option value="chama">Chama</option>
            <option value="business">Business</option>
            <option value="contribution_group">Contribution Group</option>
          </select>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search inquiry, chama, sender..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-48 sm:w-64 rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs font-medium outline-none focus:border-violet-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>
      </div>

      {notice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Split Console: Left = Inquiries List, Right = Active Detail & Reply */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Inquiries List (5 cols) */}
        <div className="lg:col-span-5 rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Incoming Inquiries ({inquiries.length})
            </h3>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[680px] overflow-y-auto">
            {inquiries.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                No inquiries match your current filters.
              </div>
            ) : (
              inquiries.map((inq) => {
                const Icon = TYPE_ICONS[inq.workspaceType] || Building2;
                const isSelected = selectedInquiry?._id === inq._id;
                return (
                  <div
                    key={inq._id}
                    onClick={() => setSelectedInquiry(inq)}
                    className={`p-4 cursor-pointer transition ${
                      isSelected
                        ? "bg-violet-50/80 dark:bg-violet-950/40 border-l-4 border-l-violet-600"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] font-black text-violet-600 dark:text-violet-400">
                          {inq.inquiryNumber}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          • {new Date(inq.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <span
                        className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                          inq.status === "RESOLVED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : inq.status === "IN_PROGRESS"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {inq.status}
                      </span>
                    </div>

                    <h4 className="text-xs font-black text-slate-900 dark:text-white line-clamp-1">
                      {inq.subject}
                    </h4>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                        <Icon size={12} className="text-violet-500" />
                        {inq.workspaceName}
                      </span>
                      <span>•</span>
                      <span>{inq.senderName} ({inq.senderRole})</span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                      {inq.message}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/50">
                      <span className="capitalize">{CATEGORY_LABELS[inq.category] || inq.category}</span>
                      <span className="font-bold text-violet-600 dark:text-violet-400">
                        {inq.responses?.length || 0} replies
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Detail & Response Console (7 cols) */}
        <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          {selectedInquiry ? (
            <div className="flex flex-col h-[740px]">
              {/* Detail Header */}
              <div className="border-b border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/50 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-violet-600 dark:text-violet-400">
                        {selectedInquiry.inquiryNumber}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                          selectedInquiry.status === "RESOLVED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : selectedInquiry.status === "IN_PROGRESS"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {selectedInquiry.status}
                      </span>
                    </div>

                    <h2 className="text-base font-black text-slate-900 dark:text-white mt-1">
                      {selectedInquiry.subject}
                    </h2>
                  </div>

                  {/* Status Action Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {selectedInquiry.status !== "IN_PROGRESS" && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleStatusChange(selectedInquiry._id, "IN_PROGRESS")}
                        className="rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-800 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300 transition"
                      >
                        In Progress
                      </button>
                    )}

                    {selectedInquiry.status !== "RESOLVED" && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleStatusChange(selectedInquiry._id, "RESOLVED")}
                        className="rounded-xl bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-emerald-700 transition"
                      >
                        Resolve
                      </button>
                    )}

                    {selectedInquiry.status === "RESOLVED" && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleStatusChange(selectedInquiry._id, "OPEN")}
                        className="rounded-xl border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition"
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </div>

                {/* Workspace & Sender Metadata Info Box */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-2xl border border-slate-200/80 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Workspace</span>
                    <p className="font-bold text-slate-900 dark:text-white truncate">
                      {selectedInquiry.workspaceName}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Sender (Role)</span>
                    <p className="font-bold text-slate-900 dark:text-white truncate">
                      {selectedInquiry.senderName} ({selectedInquiry.senderRole})
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Contact</span>
                    <p className="font-bold text-slate-900 dark:text-white truncate">
                      {selectedInquiry.senderPhone || selectedInquiry.senderEmail || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Conversation Thread */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Initial Client Message */}
                <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
                    <span className="font-bold text-violet-900 dark:text-violet-300">
                      {selectedInquiry.senderName} • {selectedInquiry.senderRole}
                    </span>
                    <span>{new Date(selectedInquiry.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                    {selectedInquiry.message}
                  </p>
                </div>

                {/* Responses Stream */}
                {selectedInquiry.responses?.map((r, idx) => (
                  <div
                    key={idx}
                    className={`rounded-2xl p-4 text-xs ${
                      r.isAdmin
                        ? "border border-indigo-200 bg-indigo-50/80 text-indigo-950 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-200 ml-6"
                        : "border border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200 mr-6"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                      <span className="font-bold flex items-center gap-1.5">
                        {r.isAdmin && (
                          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[9px] font-black uppercase text-white">
                            Platform Admin
                          </span>
                        )}
                        {r.senderName}
                      </span>
                      <span>{new Date(r.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-line">{r.message}</p>
                  </div>
                ))}
              </div>

              {/* Admin Reply Composer */}
              <form onSubmit={handleSendReply} className="border-t border-slate-200 p-4 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/40 space-y-2">
                <textarea
                  rows={3}
                  required
                  placeholder={`Reply to ${selectedInquiry.senderName} at ${selectedInquiry.workspaceName}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-xs font-medium outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Your response will appear immediately on the Chama's bottom Admin Panel.
                  </span>

                  <button
                    type="submit"
                    disabled={actionLoading || !replyText.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-50 transition"
                  >
                    <Send size={13} />
                    {actionLoading ? "Sending..." : "Send Response"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[600px] text-center p-8 text-slate-400">
              <ShieldAlert size={40} className="text-slate-300 dark:text-slate-700 mb-3" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                Select an inquiry from the list
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                View inquiry details, contact the Chama chairperson, and send resolutions directly from this console.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
