import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  Lock,
  Loader2,
  AlertTriangle,
  Send,
} from "lucide-react";
import useWorkspace from "@/app/hooks/useWorkspace";
import {
  isPayoutOfficial,
  canSettlePayout,
  canCancelPayout,
} from "@/modules/workspaces/permissions/Permissions";
import payoutService from "../services/payout.service";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

const BASE_PAYOUT_APPROVAL_ROLES = ["chairperson", "treasurer"];

// ============================================================
// SETTLE (MARK PAID) MODAL
// ============================================================
// Mirrors LoansTab's manual-disbursement modal: the treasurer is
// recording that they already sent the money themselves, not
// triggering a transfer, so it just needs the method + reference.
function SettleModal({ payout, onClose, onSubmit }) {
  const [method, setMethod] = useState("mpesa");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        disbursement_method: method,
        external_reference: reference.trim() || undefined,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 font-sans">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 dark:bg-obsidian-card dark:border-obsidian-border space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-obsidian-border">
          <Send className="text-rose-600" size={20} />
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-mist">Mark Payout as Paid</h3>
            <p className="text-xs font-medium text-slate-400">
              {money(payout.amount)} to {payout.recipientName}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-mist-muted mb-1">
            Disbursement method
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 px-3 text-xs font-bold text-slate-700 dark:border-obsidian-border dark:bg-obsidian dark:text-mist-muted focus:outline-none"
          >
            <option value="mpesa">M-Pesa</option>
            <option value="wallet">Member wallet</option>
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-mist-muted mb-1">
            Reference (optional)
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="M-Pesa code / bank ref"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 px-3 text-xs font-semibold text-slate-900 dark:border-obsidian-border dark:bg-obsidian dark:text-mist focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 dark:border-obsidian-border dark:text-mist-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-rose-700 transition disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Confirm Paid
          </button>
        </div>
      </form>
    </div>
  );
}

export default function PayoutsPage() {
  const { workspaceId } = useParams();
  const { membership, workspaceType } = useWorkspace();
  const myMembershipId = membership?._id;
  const myRole = membership?.role;

  const [rawPayouts, setRawPayouts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [settlingPayout, setSettlingPayout] = useState(null);
  const [notice, setNotice] = useState(null);

  const notify = (msg, tone = "success") => {
    setNotice({ msg, tone });
    setTimeout(() => setNotice(null), 4500);
  };

  async function loadPayouts() {
    if (!workspaceId) return;
    try {
      setLoading(true);
      const response = await payoutService.getAll(workspaceId);
      setRawPayouts(Array.isArray(response?.payouts) ? response.payouts : []);
    } catch {
      setRawPayouts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPayouts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const isOfficial = isPayoutOfficial(myRole, workspaceType);
  const mayPay = canSettlePayout(myRole, workspaceType);
  const mayCancel = canCancelPayout(myRole, workspaceType);

  // Derive display + governance state per payout, without throwing away
  // the approvals / required_approval_roles / recusal data the table
  // needs to gate the action column correctly.
  const payouts = rawPayouts.map((p) => {
    const recipientId = p.member_id?._id || p.member_id;
    const recipientName = p.member_id?.user_id?.name || p.member_id?.name || "Member";
    const requiredRoles =
      p.required_approval_roles && p.required_approval_roles.length > 0
        ? p.required_approval_roles
        : BASE_PAYOUT_APPROVAL_ROLES;
    const quorumRequired = Number(p.recusal_quorum_required || 0);
    const approvals = p.approvals || [];
    const approvedRoles = new Set(approvals.map((a) => a.role));
    const allRequiredRolesApproved = requiredRoles.every((r) => approvedRoles.has(r));
    const quorumFillers = new Set(
      approvals.filter((a) => !requiredRoles.includes(a.role)).map((a) => String(a.membership_id))
    );
    const recusedRoles = BASE_PAYOUT_APPROVAL_ROLES.filter((r) => !requiredRoles.includes(r));

    const isRecipient = myMembershipId && recipientId && String(recipientId) === String(myMembershipId);
    const myDecision = approvals.find(
      (a) => String(a.membership_id?._id || a.membership_id) === String(myMembershipId)
    );

    const canApproveNow =
      p.status === "pending" &&
      isOfficial &&
      !isRecipient &&
      !myDecision &&
      (requiredRoles.includes(myRole) || quorumRequired > 0);

    return {
      raw: p,
      id: p._id ? `PY-${String(p._id).slice(-4).toUpperCase()}` : "PY-REQ",
      _id: p._id,
      recipientName,
      amount: Number(p.amount || 0),
      status: p.status || "pending",
      requestedOn: p.createdAt ? new Date(p.createdAt).toLocaleString() : "Recent",
      requiredRoles,
      quorumRequired,
      quorumFillersCount: quorumFillers.size,
      recusedRoles,
      isRecipient,
      myDecision,
      canApproveNow,
      approvalsSoFar: approvals.length,
      allRequiredRolesApproved,
    };
  });

  const pendingRequests = payouts.filter((p) => p.status === "pending");
  const approvedRequests = payouts.filter((p) => p.status === "approved");
  const paidRequests = payouts.filter((p) => p.status === "paid");
  const cancelledRequests = payouts.filter((p) => p.status === "cancelled");

  const pendingTotal = pendingRequests.reduce((a, b) => a + b.amount, 0);
  const approvedTotal = approvedRequests.reduce((a, b) => a + b.amount, 0);
  const paidTotal = paidRequests.reduce((a, b) => a + b.amount, 0);
  const cancelledTotal = cancelledRequests.reduce((a, b) => a + b.amount, 0);

  const filteredPayouts = payouts.filter((p) => {
    const matchesSearch =
      p.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const runAction = async (payoutId, action, successMsg) => {
    setBusyId(payoutId);
    try {
      const result = await action();
      notify(result?.message || successMsg);
      await loadPayouts();
    } catch (err) {
      notify(err?.response?.data?.message || "That action didn't complete.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleApprove = (p) =>
    runAction(p._id, () => payoutService.approve(workspaceId, p._id), "Sign-off recorded.");

  const handleCancel = (p) => {
    const reason = window.prompt("Reason for cancelling this payout (optional):", "") || "";
    runAction(p._id, () => payoutService.cancel(workspaceId, p._id, { reason }), "Payout cancelled.");
  };

  const handleSettleSubmit = async (payload) => {
    const p = settlingPayout;
    await runAction(p._id, () => payoutService.pay(workspaceId, p._id, payload), "Payout marked as paid.");
  };

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-mist pb-12">
      {notice && (
        <div
          className={`flex items-center gap-3 rounded-2xl border p-4 shadow-lg ${
            notice.tone === "error"
              ? "border-rose-300 bg-rose-600 text-white"
              : "border-emerald-300 bg-emerald-600 text-white"
          }`}
        >
          {notice.tone === "error" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <p className="text-xs font-bold">{notice.msg}</p>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-mist sm:text-3xl">
            Payouts
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-mist-muted">
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

      {!isOfficial && (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <Lock size={14} />
          Approving or settling payouts is limited to Chama officials — chairperson, treasurer, secretary,
          auditor and committee members.
        </div>
      )}

      {/* Top 4 Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">PENDING</span>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-mist">{money(pendingTotal)}</p>
          <span className="mt-1 text-xs font-bold text-slate-400 block">{pendingRequests.length} Requests</span>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">APPROVED</span>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-mist">{money(approvedTotal)}</p>
          <span className="mt-1 text-xs font-bold text-slate-400 block">{approvedRequests.length} Requests</span>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">PAID</span>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-mist">{money(paidTotal)}</p>
          <span className="mt-1 text-xs font-bold text-slate-400 block">{paidRequests.length} Requests</span>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">CANCELLED</span>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-mist">{money(cancelledTotal)}</p>
          <span className="mt-1 text-xs font-bold text-slate-400 block">{cancelledRequests.length} Requests</span>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
        <div className="grid gap-3 sm:grid-cols-12 items-center">
          <div className="relative sm:col-span-4">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search payout..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-900 focus:border-rose-600 focus:bg-white focus:outline-none dark:border-obsidian-border dark:bg-obsidian dark:text-mist"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 px-3 text-xs font-bold text-slate-700 dark:border-obsidian-border dark:bg-obsidian dark:text-mist-muted focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <select className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 px-3 text-xs font-bold text-slate-700 dark:border-obsidian-border dark:bg-obsidian dark:text-mist-muted focus:outline-none">
              <option value="all">All Types</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <select className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 px-3 text-xs font-bold text-slate-700 dark:border-obsidian-border dark:bg-obsidian dark:text-mist-muted focus:outline-none">
              <option value="all">All Methods</option>
            </select>
          </div>

          <div className="sm:col-span-1 flex justify-end">
            <button className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist-muted">
              <Filter size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Payouts Detailed Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/50 uppercase text-[11px] font-extrabold text-slate-400 dark:border-obsidian-border dark:bg-obsidian-raised/40">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">RECIPIENT</th>
                <th className="px-6 py-4">AMOUNT</th>
                <th className="px-6 py-4">STATUS</th>
                <th className="px-6 py-4">GOVERNANCE</th>
                <th className="px-6 py-4">REQUESTED ON</th>
                <th className="px-6 py-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-obsidian-border/60 font-semibold">
              {filteredPayouts.length > 0 ? (
                filteredPayouts.map((row) => {
                  const busy = busyId === row._id;
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-obsidian-raised/30 transition align-top">
                      <td className="px-6 py-4 text-slate-900 dark:text-mist font-mono font-bold">{row.id}</td>
                      <td className="px-6 py-4 text-slate-900 dark:text-mist font-bold">{row.recipientName}</td>
                      <td className="px-6 py-4 text-slate-900 dark:text-mist font-mono font-bold">{money(row.amount)}</td>
                      <td className="px-6 py-4">
                        {row.status === "paid" && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"><CheckCircle2 size={12} /> Paid</span>}
                        {row.status === "pending" && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-300"><Clock size={12} /> Pending</span>}
                        {row.status === "approved" && <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-[11px] font-black text-sky-800 dark:bg-sky-950 dark:text-sky-300"><CheckCircle2 size={12} /> Approved</span>}
                        {row.status === "cancelled" && <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-[11px] font-black text-rose-800 dark:bg-rose-950 dark:text-rose-300"><XCircle size={12} /> Cancelled</span>}
                      </td>
                      <td className="px-6 py-4 max-w-[220px]">
                        {row.status === "pending" || row.status === "approved" ? (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-mist-muted block">
                              {row.approvalsSoFar}/{row.requiredRoles.length + row.quorumRequired} sign-off(s) —
                              needs {row.requiredRoles.join(" + ")}
                              {row.quorumRequired > 0 && ` + ${row.quorumRequired} independent official`}
                            </span>
                            {row.recusedRoles.length > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/40 bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                <Lock size={10} /> {row.recusedRoles.join(", ")} recused
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-mono">{row.requestedOn}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          {row.isRecipient && row.status === "pending" && (
                            <span className="text-[10px] font-bold italic text-amber-600 dark:text-amber-400">
                              Recused: this is your payout
                            </span>
                          )}
                          {!row.isRecipient && row.myDecision && row.status === "pending" && (
                            <span className="text-[10px] font-bold italic text-slate-500 dark:text-mist-muted">
                              You already signed off — awaiting others
                            </span>
                          )}
                          {row.canApproveNow && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleApprove(row)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-50"
                            >
                              {busy ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                              Approve
                            </button>
                          )}
                          {mayPay && row.status === "approved" && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setSettlingPayout(row)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-[11px] font-black text-white shadow-md transition hover:bg-rose-500 disabled:opacity-50"
                            >
                              <Send size={13} /> Mark Paid
                            </button>
                          )}
                          {mayCancel && ["pending", "approved"].includes(row.status) && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleCancel(row)}
                              className="text-[10px] font-bold text-slate-400 hover:text-rose-600 transition"
                            >
                              Cancel payout
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-slate-400 font-medium">
                    {loading ? "Loading payouts…" : "No payouts recorded for this workspace."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-white px-6 py-4 text-xs font-semibold text-slate-500 dark:border-obsidian-border dark:bg-obsidian-card">
          <span>Showing 1 to {filteredPayouts.length} of {payouts.length} payouts</span>
          <div className="flex items-center gap-1.5">
            <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-obsidian-border dark:hover:bg-obsidian-raised"><ChevronLeft size={14} /></button>
            <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600 text-white font-bold">1</button>
            <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-obsidian-border dark:hover:bg-obsidian-raised"><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      {settlingPayout && (
        <SettleModal
          payout={settlingPayout}
          onClose={() => setSettlingPayout(null)}
          onSubmit={handleSettleSubmit}
        />
      )}
    </div>
  );
}
