import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  Plus,
  Users,
  Settings,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Send,
  DollarSign,
  RotateCcw,
  FileText,
  Loader2,
  PhoneCall,
  X,
  Calendar,
  MessageSquare,
  Trash2,
} from "lucide-react";
import useWorkspace from "@/app/hooks/useWorkspace";
import mgrApi from "../api/mgr.api";
import MgrSetupWizard from "../components/MgrSetupWizard";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

const STATUS_BADGE = {
  upcoming: { label: "Upcoming", color: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
  collecting: { label: "Collecting", color: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  target_reached: { label: "Target Reached", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  eligibility_checking: { label: "Checking Eligibility", color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  payout_proposed: { label: "Payout Proposed", color: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" },
  pending_approval: { label: "Pending Approval", color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  approved: { label: "Approved", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  disbursing: { label: "Disbursing", color: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  paid: { label: "Paid", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  reconciled: { label: "Reconciled", color: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300" },
  completed: { label: "Completed", color: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300" },
  on_hold: { label: "On Hold", color: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
};

function RoundStatusBadge({ status }) {
  const s = STATUS_BADGE[status] || { label: status, color: "bg-slate-100 text-slate-500" };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${s.color}`}>
      {s.label}
    </span>
  );
}

// ============================================================
// APPROVAL MODAL
// ============================================================
function ApprovalModal({ request, onClose, onSubmit }) {
  const [status, setStatus] = useState("approved");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit(request._id, { status, comment });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 font-sans">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <ShieldCheck className="text-amber-500" size={22} />
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">Payout Approval</h3>
            <p className="text-xs font-medium text-slate-400">{request?.title}</p>
          </div>
        </div>

        <div className="py-5 space-y-4 text-xs">
          <div className="rounded-2xl bg-slate-50 p-4 space-y-2 dark:bg-slate-800">
            <div className="flex justify-between font-bold text-slate-600 dark:text-slate-300">
              <span>Amount</span>
              <span className="font-mono text-slate-900 dark:text-white">{money(request?.amount)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-600 dark:text-slate-300">
              <span>Initiated By</span>
              <span className="text-slate-900 dark:text-white">
                {request?.initiated_by?.user_id?.name || "Treasurer"}
              </span>
            </div>
            <div className="flex justify-between font-bold text-slate-600 dark:text-slate-300">
              <span>Approvals So Far</span>
              <span className="text-slate-900 dark:text-white">
                {request?.approvals?.length || 0} / {request?.required_approvals}
              </span>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-2">Decision</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStatus("approved")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-2xl p-3 border font-bold ${
                  status === "approved"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <CheckCircle2 size={16} /> Approve
              </button>
              <button
                type="button"
                onClick={() => setStatus("rejected")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-2xl p-3 border font-bold ${
                  status === "rejected"
                    ? "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <XCircle size={16} /> Reject
              </button>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Comment (optional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add your review comment..."
              rows={3}
              className="w-full rounded-2xl border border-slate-200 p-3 text-slate-900 placeholder-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium"
            />
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 p-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 rounded-2xl bg-amber-500 p-2.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Decision"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PAYOUT PROPOSAL MODAL
// ============================================================
function PayoutProposalModal({ round, onClose, onSubmit }) {
  const expectedPool = Number(round?.expected_amount || 0);
  const collected = Number(round?.collected_amount || 0);
  const [amount, setAmount] = useState(collected);
  const [disbursementMethod, setDisbursementMethod] = useState("mpesa");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit({ roundId: round._id, amount, disbursementMethod, phoneNumber, notes });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 font-sans">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <Send className="text-amber-500" size={22} />
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">Propose Payout</h3>
            <p className="text-xs font-medium text-slate-400">Round #{round?.round_number}</p>
          </div>
        </div>

        <div className="py-5 space-y-4 text-xs">
          <div className="rounded-2xl bg-slate-50 p-4 space-y-2 dark:bg-slate-800">
            <div className="flex justify-between font-bold text-slate-600 dark:text-slate-300">
              <span>Expected Pool</span>
              <span className="font-mono text-slate-900 dark:text-white">{money(expectedPool)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-600 dark:text-slate-300">
              <span>Collected</span>
              <span className="font-mono text-emerald-600">{money(collected)}</span>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Payout Amount (KES)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full rounded-2xl border border-slate-200 p-3 text-slate-900 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Disbursement Method</label>
            <div className="flex gap-3">
              {["mpesa", "bank", "cash"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDisbursementMethod(m)}
                  className={`flex-1 rounded-2xl border p-2.5 font-bold uppercase text-[11px] ${
                    disbursementMethod === m
                      ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      : "border-slate-200 dark:border-slate-700 text-slate-500"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {disbursementMethod === "mpesa" && (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">M-Pesa Phone Number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="07XXXXXXXX"
                className="w-full rounded-2xl border border-slate-200 p-3 text-slate-900 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-2xl border border-slate-200 p-3 text-slate-900 placeholder-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium"
            />
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 p-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 rounded-2xl bg-amber-500 p-2.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit for Approval"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// STK PUSH & PAYMENT RECORDING MODAL
// ============================================================
function StkPaymentModal({ obligation, chamaId, isTreasurer, onClose, onSuccess }) {
  const memberName = obligation?.member_id?.user_id?.name || obligation?.member_id?.name || "Member";
  const defaultPhone = obligation?.member_id?.user_id?.phone || "";
  const expectedAmount = Number(obligation?.expected_amount || obligation?.amount_due || 0);
  const paidAmount = Number(obligation?.amount_paid || obligation?.paid_amount || 0);
  const remainingBalance = Math.max(0, expectedAmount - paidAmount);

  const [paymentMethod, setPaymentMethod] = useState("mpesa");
  const [phoneNumber, setPhoneNumber] = useState(defaultPhone);
  const [amount, setAmount] = useState(remainingBalance > 0 ? remainingBalance : expectedAmount);
  const [step, setStep] = useState("init"); // 'init' | 'stk_sent' | 'completed' | 'failed'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentIntentId, setPaymentIntentId] = useState(null);
  const [countdown, setCountdown] = useState(60);

  const postPaymentBalance = Math.max(0, remainingBalance - Number(amount || 0));
  const isFullPayment = Number(amount || 0) >= remainingBalance;

  // Poll payment status while in 'stk_sent' step
  useEffect(() => {
    if (step !== "stk_sent" || !paymentIntentId) return;

    const interval = setInterval(async () => {
      try {
        const { data } = await mgrApi.getPaymentStatus(paymentIntentId);
        const status = data.data?.status;

        if (status === "completed") {
          setStep("completed");
          clearInterval(interval);
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1500);
        } else if (status === "failed" || status === "cancelled") {
          setStep("failed");
          setError(data.data?.failure_reason || "M-Pesa payment prompt was cancelled or failed");
          clearInterval(interval);
        }
      } catch {
        // Continue polling
      }
    }, 2500);

    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          clearInterval(timer);
          setStep("failed");
          setError("Payment confirmation timed out. If you entered your PIN, the balance will update automatically shortly.");
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, [step, paymentIntentId, onSuccess, onClose]);

  const handleInitiate = async () => {
    setLoading(true);
    setError(null);
    try {
      if (paymentMethod === "mpesa") {
        if (!phoneNumber) throw new Error("Phone number is required for M-Pesa STK push");

        const { data } = await mgrApi.initiateContributionPayment({
          obligationId: obligation._id,
          amount,
          paymentMethod: "MPESA",
          phoneNumber,
        });

        const intentId = data.data?._id || data.data?.paymentIntentId || data.data?.id;
        setPaymentIntentId(intentId);
        setStep("stk_sent");
        setCountdown(60);
      } else {
        // Manual Cash / Bank
        await mgrApi.recordPayment(chamaId, {
          memberId: obligation.member_id?._id || obligation.member_id,
          amount,
          paymentMethod: "cash",
        });

        setStep("completed");
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to initiate payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 font-sans">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              MGR CONTRIBUTION PAYMENT
            </span>
            <h3 className="text-base font-black text-slate-900 dark:text-white">{memberName}</h3>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        <div className="py-4 space-y-4 text-xs font-semibold">
          {step === "init" && (
            <>
              {/* Obligation Breakdown */}
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/80 p-3.5 space-y-2 border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Expected Round Total</span>
                  <span className="font-mono text-slate-900 dark:text-white font-bold">{money(expectedAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Paid So Far</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{money(paidAmount)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                  <span>Remaining Due</span>
                  <span className="font-mono text-rose-600 dark:text-rose-400 font-extrabold">{money(remainingBalance)}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Payment Method</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("mpesa")}
                    className={`flex-1 rounded-2xl border p-2.5 font-bold uppercase text-[11px] ${
                      paymentMethod === "mpesa"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : "border-slate-200 dark:border-slate-700 text-slate-500"
                    }`}
                  >
                    M-Pesa STK Push
                  </button>
                  {isTreasurer && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("cash")}
                      className={`flex-1 rounded-2xl border p-2.5 font-bold uppercase text-[11px] ${
                        paymentMethod === "cash"
                          ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          : "border-slate-200 dark:border-slate-700 text-slate-500"
                      }`}
                    >
                      Record Cash
                    </button>
                  )}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-slate-700 dark:text-slate-300">Payment Amount (KES)</label>
                  {remainingBalance > 0 && (
                    <button
                      type="button"
                      onClick={() => setAmount(remainingBalance)}
                      className="text-[10px] font-bold text-amber-600 hover:underline"
                    >
                      Pay Full Due ({money(remainingBalance)})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full rounded-2xl border border-slate-200 p-3 text-slate-900 font-mono text-sm font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

                {/* Live Balance Calculation Badge */}
                <div className="mt-2 flex items-center justify-between">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                      isFullPayment
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    }`}
                  >
                    {isFullPayment ? "Full Payment" : "Partial Payment"}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-slate-500">
                    Remaining after: <span className="text-slate-900 dark:text-white font-extrabold">{money(postPaymentBalance)}</span>
                  </span>
                </div>
              </div>

              {paymentMethod === "mpesa" && (
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">
                    {isTreasurer ? "Recipient M-Pesa Phone Number" : "Your M-Pesa Phone Number"}
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="07XXXXXXXX"
                    className="w-full rounded-2xl border border-slate-200 p-3 text-slate-900 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              )}
            </>
          )}

          {step === "stk_sent" && (
            <div className="py-6 flex flex-col items-center text-center gap-3">
              <div className="relative flex items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 animate-pulse">
                  <PhoneCall size={28} />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">Check Your Phone</h4>
                <p className="text-xs font-medium text-slate-500 mt-1 max-w-xs">
                  An M-Pesa STK push prompt for <span className="font-bold text-emerald-600 font-mono">{money(amount)}</span> has been sent to{" "}
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{phoneNumber}</span>. Please enter your PIN.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-600 dark:text-amber-400 mt-2">
                <Loader2 className="animate-spin" size={14} />
                Waiting for M-Pesa PIN ({countdown}s)
              </div>
            </div>
          )}

          {step === "completed" && (
            <div className="py-6 flex flex-col items-center text-center gap-3">
              <div className="h-16 w-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={32} />
              </div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white">Payment Confirmed!</h4>
              <p className="text-xs font-medium text-slate-500">
                KES {amount.toLocaleString()} MGR contribution recorded for {memberName}.
              </p>
            </div>
          )}

          {step === "failed" && (
            <div className="py-4 text-center space-y-3">
              <button
                onClick={() => setStep("init")}
                className="rounded-2xl bg-amber-500 px-6 py-2.5 text-xs font-bold text-white hover:bg-amber-600"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {step === "init" && (
          <div className="flex gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 p-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
              Cancel
            </button>
            <button
              onClick={handleInitiate}
              disabled={loading}
              className="flex-1 rounded-2xl bg-emerald-600 p-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? "Initiating..." : paymentMethod === "mpesa" ? `Send STK (${money(amount)})` : `Record Cash (${money(amount)})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MAIN MGR COMMAND CENTER PAGE
// ============================================================
export default function MerryGoRoundPage() {
  const { workspaceId: routeWorkspaceId } = useParams();
  const workspace = useWorkspace();
  const chamaId = routeWorkspaceId || workspace.workspaceId;

  // Derive Treasurer status from the workspace context (populated by workspace mapper)
  const isTreasurer = workspace?.activeWorkspace?.role === 'treasurer'
    || workspace?.currentWorkspace?.role === 'treasurer';

  const [overview, setOverview] = useState(null);
  const [chamaMembers, setChamaMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [approvals, setApprovals] = useState([]);

  // UI State
  const [selectedRoundId, setSelectedRoundId] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showStkModal, setShowStkModal] = useState(false);
  const [selectedApprovalRequest, setSelectedApprovalRequest] = useState(null);
  const [selectedObligationForPay, setSelectedObligationForPay] = useState(null);
  const [selectedPolicyForEdit, setSelectedPolicyForEdit] = useState(null);
  const [expandAuditLog, setExpandAuditLog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  const notify = (msg, type = "success") => {
    setNotice({ msg, type });
    setTimeout(() => setNotice(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch overview and members in parallel
      const [overviewRes, membersRes] = await Promise.allSettled([
        mgrApi.getOverview(chamaId),
        mgrApi.getMembers(chamaId),
      ]);

      if (overviewRes.status === 'fulfilled') {
        setOverview(overviewRes.value.data.data);
      } else {
        setError(overviewRes.reason?.response?.data?.message || "Failed to load MGR data");
      }

      if (membersRes.status === 'fulfilled') {
        setChamaMembers(membersRes.value.data.data || []);
      }

      // Load pending approvals for officials (non-critical)
      if (overviewRes.status === 'fulfilled' && overviewRes.value.data.data?.hasPolicy) {
        try {
          const { data: appData } = await mgrApi.getApprovals(chamaId, "pending");
          setApprovals(appData.data || []);
        } catch {
          // non-critical — approval banner simply won't show
        }
      }
    } finally {
      setLoading(false);
    }
  }, [chamaId]);

  useEffect(() => {
    if (chamaId) load();
  }, [chamaId, load]);


  const handleProposePayout = async (payload) => {
    setActionLoading(true);
    try {
      await mgrApi.proposePayout(payload.roundId, payload);
      notify("Payout submitted for approval. Required officials will be notified.");
      load();
    } catch (err) {
      notify(err.response?.data?.message || "Failed to propose payout", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprovalSignoff = async (requestId, payload) => {
    setActionLoading(true);
    try {
      await mgrApi.submitApprovalSignoff(requestId, payload);
      notify(payload.status === "approved" ? "Payout approved successfully." : "Payout rejected.");
      load();
    } catch (err) {
      notify(err.response?.data?.message || "Failed to submit decision", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisbursePayout = async (roundId) => {
    if (!window.confirm("Confirm disbursement? This action will transfer funds.")) return;
    setActionLoading(true);
    try {
      await mgrApi.disbursePayout(roundId);
      notify("Payout disbursed and round reconciled. Next round is now open.");
      load();
    } catch (err) {
      notify(err.response?.data?.message || "Failed to disburse payout", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendReminders = async () => {
    if (!currentRound?._id) return;
    setActionLoading(true);
    try {
      const { data } = await mgrApi.sendReminders(currentRound._id);
      notify(`Payment reminders sent to ${data.data?.remindedCount || 0} member(s)!`);
      load();
    } catch (err) {
      notify(err.response?.data?.message || "Failed to send reminders", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const policy = overview?.policy;
  const rounds = overview?.rounds || [];
  const currentRound = overview?.currentRound;
  const activeRound = rounds.find((r) => r._id === selectedRoundId) || currentRound || rounds[0];

  const rawObligations = overview?.obligations || [];
  const auditLogs = overview?.auditLogs || [];
  const members = policy?.participants || chamaMembers || [];

  // Guarantee that every member in the policy/chama appears in the table!
  const obligations = rawObligations.length > 0
    ? rawObligations
    : members.map((m, idx) => ({
        _id: m._id || idx,
        participant_id: m,
        member_id: m,
        expected_amount: Number(policy?.contribution_rule?.uniform_amount || 0),
        amount_due: Number(policy?.contribution_rule?.uniform_amount || 0),
        paid_amount: 0,
        amount_paid: 0,
        status: "pending",
      }));

  const expectedPool = Number(activeRound?.expected_amount || 0);
  const collected = Number(activeRound?.collected_amount || 0);
  const collectionPct = expectedPool > 0 ? Math.min(100, Math.round((collected / expectedPool) * 100)) : 0;

  const resolveMemberDetails = useCallback((ob) => {
    const rawObj = ob?.participant_id || ob?.member_id || ob;
    let name = rawObj?.user_id?.name || rawObj?.name || rawObj?.full_name;
    let phone = rawObj?.user_id?.phone || rawObj?.phone || rawObj?.phoneNumber || rawObj?.phone_number;

    if ((!name || name === "Member" || !phone || phone === "—") && Array.isArray(chamaMembers) && chamaMembers.length > 0) {
      const targetId = String(rawObj?._id || rawObj || '');
      const targetUserId = String(rawObj?.user_id?._id || rawObj?.user_id || '');

      const match = chamaMembers.find(cm => 
        String(cm._id) === targetId ||
        String(cm._id) === targetUserId ||
        String(cm.user_id?._id || cm.user_id) === targetId ||
        String(cm.user_id?._id || cm.user_id) === targetUserId
      );

      if (match) {
        name = match.user_id?.name || match.name || match.full_name || name;
        phone = match.user_id?.phone || match.phone || match.phoneNumber || phone;
      }
    }

    return {
      name: name || "Member",
      phone: phone && phone !== "—" ? phone : "—"
    };
  }, [chamaMembers]);

  const recipientRaw = activeRound?.recipient_id;
  const recipientDetails = resolveMemberDetails(recipientRaw);
  const recipientName = recipientDetails.name !== "Member" ? recipientDetails.name : (recipientRaw?.user_id?.name || recipientRaw?.name || "—");

  const paidObligations = obligations.filter((o) => o.status === "paid").length;
  const totalObligations = obligations.length;

  // ─── NO POLICY STATE ─────────────────────────────────────
  if (!loading && (!overview?.hasPolicy)) {
    return (
      <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 pb-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Merry-Go-Round (MGR)
            </h1>
            <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              Controlled financial workflow for chama rotating payouts
            </p>
          </div>
        </div>

        <div className="rounded-3xl border-2 border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-12 flex flex-col items-center text-center gap-4">
          <div className="h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600">
            <RotateCcw size={28} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">No MGR Policy Yet</h2>
            <p className="text-xs font-medium text-slate-500 mt-1 max-w-sm">
              Create your first MGR policy to define contribution rules, rotation order, eligibility checks,
              and multi-official approval controls.
            </p>
          </div>
          {isTreasurer ? (
            <button
              onClick={() => setShowWizard(true)}
              className="flex items-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 text-xs font-bold text-white shadow-md hover:bg-amber-600 transition"
            >
              <Plus size={16} /> Create MGR Policy
            </button>
          ) : (
            <p className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl">
              Only the Chama Treasurer can create or configure the MGR Policy.
            </p>
          )}
        </div>

        {showWizard && (
          <MgrSetupWizard
            chamaId={chamaId}
            members={chamaMembers}
            onClose={() => setShowWizard(false)}
            onSuccess={() => {
              setShowWizard(false);
              load();
            }}
          />
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 font-sans">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 pb-12">
      {/* ── NOTICE ─────────────────────────────────── */}
      {notice && (
        <div
          className={`rounded-2xl p-4 text-xs font-bold flex items-center gap-2 border ${
            notice.type === "error"
              ? "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950 dark:border-rose-900 dark:text-rose-300"
              : "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-900 dark:text-emerald-300"
          }`}
        >
          {notice.type === "error" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          {notice.msg}
        </div>
      )}

      {/* ── PENDING APPROVALS BANNER ─────────────────── */}
      {approvals.length > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-amber-600 dark:text-amber-400" size={20} />
            <div>
              <p className="text-xs font-extrabold text-amber-800 dark:text-amber-300">
                {approvals.length} Pending Approval{approvals.length > 1 ? "s" : ""}
              </p>
              <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                Your sign-off is required to proceed with payout disbursement.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedApprovalRequest(approvals[0]);
              setShowApprovalModal(true);
            }}
            className="rounded-2xl bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600"
          >
            Review & Approve
          </button>
        </div>
      )}

      {/* ── TOP STAT BANNER (Light Theme) ─────────────────── */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-6">
        {/* Header row with Period & Month/Round Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="text-emerald-600 dark:text-emerald-400" size={22} />
            <h2 className="text-xl font-black tracking-wide text-slate-900 dark:text-white uppercase">
              {activeRound?.due_date
                ? new Date(activeRound.due_date).toLocaleDateString("en-US", { month: "short", year: "numeric" }).replace(" ", "-") + " " + new Date(activeRound.due_date).getFullYear()
                : "JULY-2026 2026"}
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Round / Month Dropdown Selector */}
            {rounds.length > 0 && (
              <select
                value={activeRound?._id || ""}
                onChange={(e) => setSelectedRoundId(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition uppercase"
              >
                {rounds.map((r) => {
                  const mName = r.due_date
                    ? new Date(r.due_date).toLocaleDateString("en-US", { month: "short" }).toUpperCase()
                    : `ROUND ${r.round_number}`;
                  return (
                    <option key={r._id} value={r._id} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
                      {mName} (Round #{r.round_number})
                    </option>
                  );
                })}
              </select>
            )}

            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>

            {isTreasurer && policy && (
              <button
                onClick={() => {
                  setSelectedPolicyForEdit(policy);
                  setShowWizard(true);
                }}
                className="flex items-center gap-1.5 rounded-2xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300 transition"
              >
                <Settings size={14} /> Edit Policy
              </button>
            )}

            {isTreasurer && activeRound && ["collecting", "target_reached"].includes(activeRound.status) && (
              <button
                onClick={() => setShowPayoutModal(true)}
                className="flex items-center gap-1.5 rounded-2xl bg-amber-500 hover:bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-md transition"
              >
                <Send size={14} /> Propose Payout
              </button>
            )}
          </div>
        </div>

        {/* 4 Stat Cards Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Monthly Contribution */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40 p-4">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">Monthly Contribution</span>
            <p className="mt-2 text-2xl font-black font-mono text-slate-900 dark:text-white">
              {money(policy?.contribution_rule?.uniform_amount || 5000)}
            </p>
          </div>

          {/* 2. Current Recipient */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40 p-4">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">Current Recipient</span>
            <p className="mt-1 text-base font-extrabold text-slate-900 dark:text-white truncate">
              #{activeRound?.round_number || 1} {recipientName}
            </p>
            <span className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 block mt-0.5">
              {activeRound?.status === 'paid' ? 'Paid' : 'Collecting'}
            </span>
          </div>

          {/* 3. Collected */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40 p-4">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">Collected</span>
            <p className="mt-2 text-2xl font-black font-mono text-slate-900 dark:text-white">
              {money(collected)}
            </p>
          </div>

          {/* 4. Target */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40 p-4">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">Target</span>
            <p className="mt-2 text-2xl font-black font-mono text-slate-900 dark:text-white">
              {money(expectedPool)}
            </p>
          </div>
        </div>
      </div>

      {/* ── MEMBERS CONTAINER CARD (Light Theme) ─────────────────── */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-lg font-black tracking-wide text-slate-900 dark:text-white flex items-center gap-2">
            <Users size={20} className="text-slate-400" /> Members
          </h3>
          {isTreasurer && activeRound && (
            <button
              onClick={handleSendReminders}
              disabled={actionLoading}
              className="flex items-center gap-1.5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300 transition"
            >
              <Send size={13} /> Send Payment Reminders
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-semibold">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="text-left py-3 text-slate-400 font-extrabold uppercase text-[10px]">Pos</th>
                <th className="text-left py-3 text-slate-400 font-extrabold uppercase text-[10px]">Name</th>
                <th className="text-left py-3 text-slate-400 font-extrabold uppercase text-[10px]">Phone</th>
                <th className="text-center py-3 text-slate-400 font-extrabold uppercase text-[10px]">Status</th>
                <th className="text-center py-3 text-slate-400 font-extrabold uppercase text-[10px]">Last Reminded</th>
                <th className="text-center py-3 text-slate-400 font-extrabold uppercase text-[10px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {obligations.map((ob, idx) => {
                const details = resolveMemberDetails(ob);
                const memberName = details.name;
                const memberPhone = details.phone;
                const due = Number(ob.expected_amount || ob.amount_due || 0);
                const paid = Number(ob.paid_amount || ob.amount_paid || 0);
                const balance = Math.max(0, due - paid);

                const rawMember = ob.participant_id || ob.member_id || ob;
                const memberIdStr = String(rawMember?._id || rawMember);
                const recipientIdStr = String(activeRound?.recipient_id?._id || activeRound?.recipient_id);
                const isRecipient = memberIdStr === recipientIdStr;

                const posLabel = isRecipient ? "#T" : `#${idx + 1}`;

                const cleanPhone = String(memberPhone).replace(/[^0-9]/g, '');
                const waPhone = cleanPhone.startsWith('0') ? `254${cleanPhone.slice(1)}` : cleanPhone;
                const waMessage = `Hello ${memberName}, this is a reminder for your Chama MGR Round #${activeRound?.round_number || 1} contribution balance of KES ${balance.toLocaleString()}. Please clear your contribution. Thank you!`;
                const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}`;

                return (
                  <tr key={ob._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3.5 font-mono font-extrabold text-amber-600 dark:text-amber-400 text-[11px]">
                      {posLabel}
                    </td>
                    <td className="py-3.5 font-bold text-slate-900 dark:text-white">{memberName}</td>
                    <td className="py-3.5 font-mono text-slate-500 dark:text-slate-400 text-[11px]">{memberPhone}</td>
                    <td className="py-3.5 text-center">
                      {ob.status === "paid" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          <CheckCircle2 size={12} /> Paid ({money(paid)})
                        </span>
                      ) : ob.status === "partial" || ob.status === "partially_paid" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          <AlertTriangle size={12} /> Partial (Due: {money(balance)})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-extrabold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                          <XCircle size={12} /> Not Paid
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 text-center text-slate-400 font-mono text-[11px]">
                      -
                    </td>
                    <td className="py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {ob.status !== "paid" && (
                          <button
                            onClick={() => {
                              setSelectedObligationForPay(ob);
                              setShowStkModal(true);
                            }}
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-1 text-[10px] font-extrabold text-white transition shadow-xs"
                          >
                            Mark Paid
                          </button>
                        )}
                        {isTreasurer && ob.status !== "paid" && (
                          <>
                            <button
                              onClick={handleSendReminders}
                              title="Send SMS Reminder"
                              className="rounded-xl bg-sky-600 hover:bg-sky-700 px-2.5 py-1 text-[10px] font-extrabold text-white transition shadow-xs flex items-center gap-1"
                            >
                              <MessageSquare size={11} /> SMS
                            </button>
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Send WhatsApp Reminder"
                              className="rounded-xl bg-emerald-500 hover:bg-emerald-600 px-2.5 py-1 text-[10px] font-extrabold text-white transition shadow-xs flex items-center gap-1"
                            >
                              <Send size={10} /> WA
                            </a>
                          </>
                        )}
                        <button
                          onClick={() => notify("Participant options updated")}
                          title="Manage participant"
                          className="rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 p-1.5 transition"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MGR POLICY DETAILS ────────────────────── */}
      {policy && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
            <Settings size={14} /> Active MGR Policy · v{policy.version}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs font-semibold">
            <div>
              <span className="text-[11px] text-slate-400 font-bold">Min Collection Threshold</span>
              <p className="text-base font-black text-slate-900 dark:text-white mt-1">
                {policy.payout_rule?.min_collection_threshold_pct || 100}%
              </p>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-bold">Required Approvals</span>
              <p className="text-base font-black text-slate-900 dark:text-white mt-1">
                {policy.approval_rule?.required_approvals || 2} Officials
              </p>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-bold">Rotation Order</span>
              <p className="text-base font-black text-slate-900 dark:text-white mt-1 capitalize">
                {policy.rotation_rule?.order_type || "Fixed"}
              </p>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-bold">Penalty for Late Payment</span>
              <p className="text-base font-black text-slate-900 dark:text-white mt-1 font-mono">
                {money(policy.penalty_rule?.penalty_amount || 0)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── AUDIT LOG ─────────────────────────────── */}
      {auditLogs.length > 0 && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <button
            onClick={() => setExpandAuditLog((v) => !v)}
            className="flex items-center justify-between w-full text-left"
          >
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <FileText size={14} /> MGR Audit Log
            </h3>
            {expandAuditLog ? (
              <ChevronUp size={16} className="text-slate-400" />
            ) : (
              <ChevronDown size={16} className="text-slate-400" />
            )}
          </button>

          {expandAuditLog && (
            <div className="mt-4 space-y-2 max-h-80 overflow-y-auto">
              {auditLogs.map((log) => (
                <div
                  key={log._id}
                  className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-xs"
                >
                  <div className="h-2 w-2 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-bold text-slate-900 dark:text-white">{log.summary}</p>
                    <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                      {log.actor_id?.name || "System"} ·{" "}
                      {new Date(log.createdAt).toLocaleDateString("en-KE", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-lg px-2 py-1">
                    {log.event_type?.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODALS ─────────────────────────────────── */}
      {showWizard && (
        <MgrSetupWizard
          chamaId={chamaId}
          members={chamaMembers.length > 0 ? chamaMembers : members}
          initialPolicy={selectedPolicyForEdit}
          onClose={() => {
            setShowWizard(false);
            setSelectedPolicyForEdit(null);
          }}
          onSuccess={() => {
            setShowWizard(false);
            setSelectedPolicyForEdit(null);
            notify("MGR Policy saved successfully!");
            load();
          }}
        />
      )}

      {showPayoutModal && currentRound && (
        <PayoutProposalModal
          round={currentRound}
          onClose={() => setShowPayoutModal(false)}
          onSubmit={handleProposePayout}
        />
      )}

      {showApprovalModal && selectedApprovalRequest && (
        <ApprovalModal
          request={selectedApprovalRequest}
          onClose={() => {
            setShowApprovalModal(false);
            setSelectedApprovalRequest(null);
          }}
          onSubmit={handleApprovalSignoff}
        />
      )}

      {showStkModal && selectedObligationForPay && (
        <StkPaymentModal
          obligation={selectedObligationForPay}
          chamaId={chamaId}
          isTreasurer={isTreasurer}
          onClose={() => {
            setShowStkModal(false);
            setSelectedObligationForPay(null);
          }}
          onSuccess={() => {
            notify("Contribution payment processed successfully!");
            load();
          }}
        />
      )}
    </div>
  );
}