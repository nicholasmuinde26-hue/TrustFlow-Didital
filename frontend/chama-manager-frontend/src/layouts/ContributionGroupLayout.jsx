import { useState, useEffect } from "react";
import {
  ShieldAlert,
  Send,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  X,
  Plus,
  Radio,
  HelpCircle,
  LifeBuoy,
} from "lucide-react";
import inquiryService from "@/app/services/inquiry.service";
import useAuth from "@/app/hooks/useAuth";

export default function AdminInquiryBottomPanel({ workspace, workspaceId }) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("new"); // "new" | "history"

  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState(null);

  // New Inquiry Form State
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("general_inquiry");
  const [priority, setPriority] = useState("medium");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Reply state
  const [replyText, setReplyText] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);

  const resolvedWorkspaceId = workspaceId || workspace?.id || workspace?._id;
  const rawType = workspace?.type || "chama";
  const normalizedType =
    rawType === "business"
      ? "business"
      : rawType === "contribution-group" || rawType === "contribution"
      ? "contribution_group"
      : "chama";

  async function loadInquiries() {
    if (!resolvedWorkspaceId) return;
    try {
      const data = await inquiryService.getWorkspaceInquiries(resolvedWorkspaceId);
      setInquiries(data);
      if (selectedInquiry) {
        const updated = data.find((i) => i._id === selectedInquiry._id);
        if (updated) setSelectedInquiry(updated);
      }
    } catch {
      // Soft fail
    }
  }

  useEffect(() => {
    loadInquiries();
    const interval = setInterval(loadInquiries, 15000); // Polling for admin replies
    return () => clearInterval(interval);
  }, [resolvedWorkspaceId]);

  async function handleSubmitInquiry(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!subject.trim() || !message.trim()) {
      setError("Please fill in both the subject and description.");
      return;
    }

    setSubmitting(true);
    try {
      const newInq = await inquiryService.submitInquiry({
        workspaceId: resolvedWorkspaceId,
        workspaceType: normalizedType,
        subject: subject.trim(),
        category,
        priority,
        message: message.trim(),
      });

      setNotice("Your inquiry has been submitted to Platform Administration!");
      setSubject("");
      setMessage("");
      await loadInquiries();
      setSelectedInquiry(newInq);
      setActiveTab("history");
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to submit inquiry. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendReply(e) {
    e.preventDefault();
    if (!selectedInquiry || !replyText.trim()) return;

    setReplyLoading(true);
    try {
      const updated = await inquiryService.replyToInquiry(
        selectedInquiry._id,
        replyText.trim()
      );
      setSelectedInquiry(updated);
      setReplyText("");
      await loadInquiries();
    } catch {
      // Soft fail
    } finally {
      setReplyLoading(false);
    }
  }

  const openCount = inquiries.filter((i) => i.status === "OPEN" || i.status === "IN_PROGRESS").length;

  return (
    // A dedicated utility row in the Sidebar footer — its own line,
    // full width, stacked separately from the promo card above/below
    // it so the two never compete for space. `relative` is the anchor
    // the expanded drawer pops up from.
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close Admin Panel & Support" : "Open Admin Panel & Support"}
        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition select-none ${
          isOpen
            ? "border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/40"
            : "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60"
        }`}
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
          <LifeBuoy size={17} />
          {/* Online indicator */}
          <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-slate-900" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold text-slate-700 dark:text-slate-200">
            Admin & Support
          </span>
          <span className="block truncate text-[10px] text-slate-400 dark:text-slate-500">
            Report an issue or ask a question
          </span>
        </span>

        {openCount > 0 ? (
          <span className="shrink-0 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-black text-slate-950">
            {openCount}
          </span>
        ) : (
          <ChevronRight size={14} className="shrink-0 text-slate-300 dark:text-slate-600" />
        )}
      </button>

      {/* Expanded Drawer Panel — pops up from this row rather than the
          page edge, and overlays the main content since it's wider
          than the sidebar itself. */}
      {isOpen && (
        <div
          aria-label="Platform Admin Inquiries Panel"
          className="absolute bottom-full left-0 z-50 mb-3 flex h-[520px] max-h-[70vh] w-[min(92vw,420px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        >
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 px-4 py-3 text-white shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-600/60 border border-violet-400/40 text-violet-200">
                <LifeBuoy size={15} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black tracking-tight">Admin Panel & Support</span>
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-1.5 py-0.2 text-[9px] font-bold text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Listening
                  </span>
                </div>
                <p className="text-[10px] text-slate-300">Submit inquiries & reports directly to Platform Admins</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close"
              className="rounded-lg p-1 text-slate-300 hover:bg-white/10"
            >
              <X size={16} />
            </button>
          </div>

          {/* Subheader & Tabs */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("new");
                  setSelectedInquiry(null);
                }}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  activeTab === "new"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                <Plus size={13} />
                New Inquiry
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  activeTab === "history"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                <MessageSquare size={13} />
                Inquiries History ({inquiries.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X size={15} />
            </button>
          </div>

          {/* Tab 1: Submit New Inquiry */}
          {activeTab === "new" && (
            <form onSubmit={handleSubmitInquiry} className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
              {notice && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {notice}
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300">
                  {error}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Subject / Summary *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Discrepancy in monthly shareout ledger, or account question"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-violet-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-violet-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="general_inquiry">General Inquiry</option>
                    <option value="discrepancy_report">Discrepancy Report</option>
                    <option value="technical_issue">Technical Issue</option>
                    <option value="account_help">Account / KYC Help</option>
                    <option value="governance_support">Governance Support</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-violet-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Message Details / Report Description *
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Provide all relevant details so the platform administration can assist your Chama/workspace..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium outline-none focus:border-violet-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 font-bold text-white shadow-md shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-50 transition"
              >
                <Send size={13} />
                {submitting ? "Sending Inquiry..." : "Submit Inquiry to Admin"}
              </button>
            </form>
          )}

          {/* Tab 2: Inquiries History & Replies */}
          {activeTab === "history" && (
            <div className="flex flex-1 overflow-hidden">
              {/* Inquiry Thread Detail View */}
              {selectedInquiry ? (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-violet-600 dark:text-violet-400">
                        {selectedInquiry.inquiryNumber}
                      </span>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white line-clamp-1">
                        {selectedInquiry.subject}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                          selectedInquiry.status === "RESOLVED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : selectedInquiry.status === "IN_PROGRESS"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {selectedInquiry.status}
                      </span>

                      <button
                        type="button"
                        onClick={() => setSelectedInquiry(null)}
                        className="rounded-lg bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300"
                      >
                        Back
                      </button>
                    </div>
                  </div>

                  {/* Message Stream */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {/* Initial Inquiry */}
                    <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3 dark:border-violet-900/40 dark:bg-violet-950/20">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                        <span className="font-bold text-violet-700 dark:text-violet-300">
                          {selectedInquiry.senderName} ({selectedInquiry.senderRole})
                        </span>
                        <span>{new Date(selectedInquiry.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line">
                        {selectedInquiry.message}
                      </p>
                    </div>

                    {/* Admin Replies */}
                    {selectedInquiry.responses?.map((r, i) => (
                      <div
                        key={i}
                        className={`rounded-xl p-3 text-xs ${
                          r.isAdmin
                            ? "border border-indigo-200 bg-indigo-50/80 text-indigo-950 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-200 ml-4"
                            : "border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50 mr-4"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                          <span className="font-bold flex items-center gap-1">
                            {r.isAdmin && (
                              <span className="rounded bg-indigo-600 px-1 py-0.2 text-[8px] font-black uppercase text-white">
                                Admin
                              </span>
                            )}
                            {r.senderName}
                          </span>
                          <span>{new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="whitespace-pre-line">{r.message}</p>
                      </div>
                    ))}
                  </div>

                  {/* Send Reply Input */}
                  <form onSubmit={handleSendReply} className="border-t border-slate-200 p-2.5 flex gap-2 dark:border-slate-800">
                    <input
                      type="text"
                      placeholder="Type a follow-up reply to admin..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <button
                      type="submit"
                      disabled={replyLoading || !replyText.trim()}
                      className="rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      Reply
                    </button>
                  </form>
                </div>
              ) : (
                /* Inquiries List View */
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {inquiries.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      No inquiries or reports submitted yet for this workspace.
                    </div>
                  ) : (
                    inquiries.map((inq) => (
                      <div
                        key={inq._id}
                        onClick={() => setSelectedInquiry(inq)}
                        className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50/50 p-3 transition hover:border-violet-300 hover:bg-violet-50/20 dark:border-slate-800 dark:bg-slate-800/40"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono font-bold text-violet-600 dark:text-violet-400">
                            {inq.inquiryNumber}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase ${
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

                        <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                          {inq.subject}
                        </p>
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {inq.message}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2">
                          <span>{new Date(inq.createdAt).toLocaleDateString()}</span>
                          <span>{inq.responses?.length || 0} replies</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}