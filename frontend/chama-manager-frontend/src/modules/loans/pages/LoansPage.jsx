import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  Building2,
  AlertCircle,
  UserCheck,
  UserX,
  Lock,
  Search,
  Sparkles,
  ArrowRight,
  Loader2,
  HeartHandshake
} from "lucide-react";
import useWorkspace from "@/app/hooks/useWorkspace";
import loanService from "../services/loan.service";
import memberService from "@/modules/members/services/members.service";
import { isLoanOfficial, canDisburseLoan } from "@/modules/workspaces/permissions/Permissions";
import ActionConfirmationDialog from "@/modules/actionSafety/components/ActionConfirmationDialog";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

export default function LoansPage() {
  const { workspaceId: paramId } = useParams();
  const workspaceCtx = useWorkspace();
  const workspaceId = paramId || workspaceCtx?.workspaceId;
  const userRole = workspaceCtx?.activeWorkspace?.role || "member";
  const workspaceType = workspaceCtx?.activeWorkspace?.type || "chama";
  const currentUserId = workspaceCtx?.user?._id;

  const canReviewLoans = isLoanOfficial(userRole, workspaceType);
  const canDisburse = canDisburseLoan(userRole, workspaceType);

  const [activeSubTab, setActiveSubTab] = useState("overview"); // 'overview' | 'apply' | 'approvals' | 'guarantees'

  const [summary, setSummary] = useState(null);
  const [loans, setLoans] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [myGuarantees, setMyGuarantees] = useState([]);
  const [chamaMembers, setChamaMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState({ text: "", isError: false });

  // Apply Modal state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyAmount, setApplyAmount] = useState(10000);
  const [applyPurpose, setApplyPurpose] = useState("Business Expansion");
  const [applyPeriod, setApplyPeriod] = useState("6");
  const [applyFrequency, setApplyFrequency] = useState("monthly");
  const [selectedGuarantors, setSelectedGuarantors] = useState([]);
  const [applyPhoneNumber, setApplyPhoneNumber] = useState("");
  const [applying, setApplying] = useState(false);

  // Pre-check eligibility state
  const [eligibilityData, setEligibilityData] = useState(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  const loadData = async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [dashRes, guaranteesRes, membersRes] = await Promise.allSettled([
        loanService.getDashboard(workspaceId),
        loanService.getMyGuarantees(workspaceId),
        memberService.getMembers(workspaceId)
      ]);

      if (dashRes.status === "fulfilled") {
        setSummary(dashRes.value?.summary || null);
        setLoans(dashRes.value?.loans || []);
        setPortfolio(dashRes.value?.portfolio || null);
      }
      if (guaranteesRes.status === "fulfilled") {
        setMyGuarantees(guaranteesRes.value || []);
      }
      if (membersRes.status === "fulfilled") {
        setChamaMembers(membersRes.value || []);
      }
    } catch (err) {
      console.warn("Could not fetch loan data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  // Pre-check eligibility whenever apply parameters change
  useEffect(() => {
    if (showApplyModal && workspaceId) {
      async function runCheck() {
        setCheckingEligibility(true);
        try {
          const res = await loanService.checkEligibility(workspaceId, {
            amount: applyAmount,
            purpose: applyPurpose,
            repaymentPeriodMonths: applyPeriod,
            repaymentFrequency: applyFrequency
          });
          setEligibilityData(res);
        } catch (err) {
          setEligibilityData(null);
        } finally {
          setCheckingEligibility(false);
        }
      }
      runCheck();
    }
  }, [showApplyModal, applyAmount, applyPurpose, applyPeriod, applyFrequency, workspaceId]);

  const allLoans = portfolio?.loans?.length ? portfolio.loans : loans;
  const activeLoan = summary?.active_loan || loans.find((l) => ["active", "disbursed", "pending_approval", "approved"].includes(l.status));

  const pendingApprovalLoans = allLoans.filter(
    (l) => ["pending_approval", "submitted", "pending", "draft"].includes(l.status)
  );

  const approvedLoans = allLoans.filter((l) => l.status === "approved");

  const pendingMyGuarantees = myGuarantees.filter((g) => g.status === "pending");

  async function handleApplySubmit(e) {
    e.preventDefault();
    setActionMessage({ text: "", isError: false });

    if (!applyAmount || applyAmount < 100) {
      setActionMessage({ text: "Please enter a valid loan amount (min KES 100).", isError: true });
      return;
    }

    if (eligibilityData && !eligibilityData.eligible) {
      setActionMessage({ text: `Eligibility failed: ${eligibilityData.reason}`, isError: true });
      return;
    }

    setApplying(true);
    try {
      const created = await loanService.apply(workspaceId, {
        amount: Number(applyAmount),
        purpose: applyPurpose,
        repayment_period_months: Number(applyPeriod),
        repayment_frequency: applyFrequency,
        disbursement_method: "mpesa",
        phone_number: applyPhoneNumber || undefined,
        guarantors: selectedGuarantors.map((g) => ({
          membership_id: g.membership_id,
          guaranteed_amount: Number(g.guaranteed_amount)
        }))
      });

      if (created?.status === "blocked_conflict") {
        setActionMessage({
          text: created.governance_block_reason || "Application blocked: not enough independent officials are available to approve this loan due to a conflict-of-interest recusal.",
          isError: true
        });
      } else if (created?.status === "eligibility_failed") {
        setActionMessage({ text: created.eligibility?.reason || "You are not currently eligible for this loan.", isError: true });
      } else {
        setActionMessage({ text: "Loan application submitted! It is now in the approval queue.", isError: false });
      }
      setShowApplyModal(false);
      loadData();
    } catch (err) {
      setActionMessage({ text: err?.response?.data?.message || "Could not submit loan application.", isError: true });
    } finally {
      setApplying(false);
    }
  }

  async function handleRespondGuarantee(loanId, decision) {
    setActionMessage({ text: "", isError: false });
    try {
      await loanService.respondToGuarantee(workspaceId, loanId, decision);
      setActionMessage({ text: `Guarantee request ${decision === "accepted" ? "accepted" : "declined"}.`, isError: false });
      loadData();
    } catch (err) {
      setActionMessage({ text: err?.response?.data?.message || "Action failed.", isError: true });
    }
  }

  async function handleApprovalDecision(loanId, decision) {
    // Show confirmation dialog for loan approval/rejection
    const loan = allLoans.find(l => l._id === loanId);
    if (!loan) {
      setActionMessage({ text: "Loan not found", isError: true });
      return;
    }

    setConfirmationAction(decision === 'approved' ? 'loan.approve' : 'loan.reject');
    setConfirmationLoan(loan);
    setConfirmationDecision(decision);
    setShowConfirmationDialog(true);
  }

  async function handleConfirmAction(dialog) {
    setShowConfirmationDialog(false);
    setActionMessage({ text: "", isError: false });

    try {
      if (confirmationAction === 'loan.approve' || confirmationAction === 'loan.reject') {
        await loanService.decide(
          workspaceId, 
          confirmationLoan._id, 
          confirmationDecision, 
          `Decision recorded`,
          dialog?.versionToken || confirmationLoan.updatedAt?.toString()
        );
        setActionMessage({ text: `Loan decision recorded (${confirmationDecision === "approved" ? "Approved" : "Rejected"}).`, isError: false });
      } else if (confirmationAction === 'loan.disburse') {
        await loanService.initiateDisbursement(workspaceId, confirmationLoan._id);
        setActionMessage({ text: "Loan disbursement initiated successfully!", isError: false });
      }
      loadData();
    } catch (err) {
      setActionMessage({ text: err?.response?.data?.message || "Action failed.", isError: true });
    }
  }

  // Manual Disbursement Modal State
  const [confirmManualLoan, setConfirmManualLoan] = useState(null);
  const [manualMethod, setManualMethod] = useState("cash");
  const [manualReference, setManualReference] = useState("");
  const [confirmingDisburse, setConfirmingDisburse] = useState(false);

  // Action Safety Confirmation Dialog State
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState(null);
  const [confirmationLoan, setConfirmationLoan] = useState(null);
  const [confirmationDecision, setConfirmationDecision] = useState(null);

  async function handleDisburseLoan(loanId) {
    // Show confirmation dialog for loan disbursement
    const loan = allLoans.find(l => l._id === loanId);
    if (!loan) {
      setActionMessage({ text: "Loan not found", isError: true });
      return;
    }

    setConfirmationAction('loan.disburse');
    setConfirmationLoan(loan);
    setShowConfirmationDialog(true);
  }

  async function handleConfirmManualDisbursementSubmit(e) {
    e.preventDefault();
    if (!confirmManualLoan) return;

    setConfirmingDisburse(true);
    setActionMessage({ text: "", isError: false });
    try {
      await loanService.confirmDisbursement(workspaceId, confirmManualLoan._id, {
        disbursementMethod: manualMethod,
        externalReference: manualReference.trim() || `MANUAL-${manualMethod.toUpperCase()}-${Date.now()}`,
      });
      setActionMessage({ text: `Loan ${confirmManualLoan.reference || ""} disbursement confirmed successfully!`, isError: false });
      setConfirmManualLoan(null);
      setManualReference("");
      loadData();
    } catch (err) {
      setActionMessage({ text: err?.response?.data?.message || "Disbursement confirmation failed.", isError: true });
    } finally {
      setConfirmingDisburse(false);
    }
  }

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Loan Governance Workspace
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Eligibility pre-checks, guarantor verifications, conflict-of-interest recusal & disbursements
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <button
              onClick={() => setActiveSubTab("overview")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                activeSubTab === "overview"
                  ? "bg-violet-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              My Loans
            </button>

            {pendingMyGuarantees.length > 0 && (
              <button
                onClick={() => setActiveSubTab("guarantees")}
                className={`relative rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  activeSubTab === "guarantees"
                    ? "bg-violet-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Guarantees ({pendingMyGuarantees.length})
              </button>
            )}

            {canReviewLoans && (
              <button
                onClick={() => setActiveSubTab("approvals")}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  activeSubTab === "approvals"
                    ? "bg-violet-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Approvals Queue ({pendingApprovalLoans.length})
              </button>
            )}
          </div>

          <button
            onClick={() => setShowApplyModal(true)}
            className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-slate-950 shadow-md hover:bg-emerald-400 transition"
          >
            + Apply For Loan
          </button>
        </div>
      </div>

      {/* Action Banner Message */}
      {actionMessage.text && (
        <div
          className={`flex items-center gap-2 rounded-2xl border p-4 text-xs font-bold ${
            actionMessage.isError
              ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          }`}
        >
          {actionMessage.isError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Overview Sub-Tab */}
      {activeSubTab === "overview" && (
        <div className="space-y-6">
          {/* Member Credit Limits Card */}
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Outstanding Loan</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {money(summary?.active_loan?.balance || summary?.outstanding_total || 0)}
              </p>
              <p className="text-xs text-slate-500">{activeLoan ? `Status: ${activeLoan.status}` : "No active loan"}</p>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Available Loan Limit</span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {money(summary?.loan_limit || 150000)}
              </p>
              <p className="text-xs text-slate-500">Calculated from savings x multiplier</p>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Quick Eligibility</span>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 size={14} /> Ready to Apply
                </p>
              </div>
              <button
                onClick={() => setShowApplyModal(true)}
                className="w-full rounded-2xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                Apply for Loan
              </button>
            </div>
          </div>

          {/* Active Loan Stepper Component */}
          {activeLoan && (
            <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl border border-white/10 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 font-mono">
                    Ref: {activeLoan.reference || activeLoan._id}
                  </span>
                  <h2 className="text-xl font-black text-white">{money(activeLoan.amount)} Loan Tracker</h2>
                  <p className="text-xs text-slate-300">Purpose: {activeLoan.purpose}</p>
                </div>
                <span className="rounded-xl bg-emerald-400/20 border border-emerald-400/30 px-3 py-1.5 text-xs font-bold text-emerald-300 uppercase font-mono">
                  {activeLoan.status}
                </span>
              </div>

              {/* Progress Stepper */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold">
                <div className="space-y-1.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400 text-slate-950 font-black mx-auto">
                    ✓
                  </div>
                  <span className="block text-emerald-300">Eligibility</span>
                  <span className="block text-[10px] font-normal text-slate-400">Passed</span>
                </div>

                <div className="space-y-1.5">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full font-black mx-auto ${
                    ["approved", "disbursement_pending", "disbursed", "active", "partially_repaid"].includes(activeLoan.status)
                      ? "bg-emerald-400 text-slate-950"
                      : "bg-amber-400 text-slate-950 animate-pulse"
                  }`}>
                    {["approved", "disbursement_pending", "disbursed", "active"].includes(activeLoan.status) ? "✓" : "●"}
                  </div>
                  <span className="block text-white">Approval</span>
                  <span className="block text-[10px] font-normal text-slate-400">
                    {activeLoan.status === "pending_approval" ? "In Queue" : "Completed"}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full font-black mx-auto ${
                    ["disbursed", "active", "partially_repaid"].includes(activeLoan.status)
                      ? "bg-emerald-400 text-slate-950"
                      : "bg-slate-800 text-slate-400 border border-slate-700"
                  }`}>
                    {["disbursed", "active", "partially_repaid"].includes(activeLoan.status) ? "✓" : "○"}
                  </div>
                  <span className="block text-slate-300">Disbursement</span>
                  <span className="block text-[10px] font-normal text-slate-400">
                    {activeLoan.status === "disbursement_pending" ? "Processing" : activeLoan.status === "active" ? "Sent" : "Pending"}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full font-black mx-auto ${
                    activeLoan.status === "closed" ? "bg-emerald-400 text-slate-950" : "bg-slate-800 text-slate-400 border border-slate-700"
                  }`}>
                    {activeLoan.status === "closed" ? "✓" : "○"}
                  </div>
                  <span className="block text-slate-300">Repayment</span>
                  <span className="block text-[10px] font-normal text-slate-400">
                    {activeLoan.status === "active" ? "Active" : "Pending"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Member Loans History Table */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-base font-black text-slate-900 dark:text-white">My Loans History</h2>
            {loans.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Ref</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Purpose</th>
                      <th className="py-3 px-4">Term</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {loans.map((l) => (
                      <tr key={l._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">{l.reference || l._id?.slice(-6)}</td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-600">{money(l.amount)}</td>
                        <td className="py-3 px-4">{l.purpose}</td>
                        <td className="py-3 px-4">{l.repayment_period_months} months ({l.repayment_frequency})</td>
                        <td className="py-3 px-4">
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 uppercase">
                            {l.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-6">No loan history on record yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Guarantees Queue Sub-Tab */}
      {activeSubTab === "guarantees" && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <HeartHandshake className="text-amber-500" size={18} /> Guarantee Requests
          </h2>
          <p className="text-xs text-slate-500">
            Review and respond to members requesting your guarantee support.
          </p>

          {myGuarantees.length > 0 ? (
            <div className="space-y-3">
              {myGuarantees.map((g) => (
                <div key={g.loan_id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="font-mono text-[10px] font-bold text-slate-400">{g.reference}</span>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">{g.borrower_name}</h3>
                    <p className="text-xs text-slate-500">
                      Loan: {money(g.amount)} for "{g.purpose}" • Requested Guarantee: <strong className="text-emerald-600">{money(g.guaranteed_amount)}</strong>
                    </p>
                  </div>

                  {g.status === "pending" ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRespondGuarantee(g.loan_id, "accepted")}
                        className="flex items-center gap-1 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                      >
                        <UserCheck size={14} /> Accept Guarantee
                      </button>
                      <button
                        onClick={() => handleRespondGuarantee(g.loan_id, "declined")}
                        className="flex items-center gap-1 rounded-xl bg-rose-100 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-300"
                      >
                        <UserX size={14} /> Decline
                      </button>
                    </div>
                  ) : (
                    <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 uppercase">
                      {g.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-6">No guarantee requests.</p>
          )}
        </div>
      )}

      {/* Approvals Queue Sub-Tab */}
      {activeSubTab === "approvals" && canReviewLoans && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="text-violet-600" size={18} /> Official Approval & Conflict-of-Interest Recusal Queue
            </h2>

            {pendingApprovalLoans.length > 0 ? (
              <div className="space-y-4">
                {pendingApprovalLoans.map((l) => {
                  const applicantId = l.membership_id?._id || l.membership_id;
                  const isApplicant = String(applicantId) === String(workspaceCtx?.membership?._id);
                  const quorumRequired = l.recusal_quorum_required || 0;
                  const quorumFillers = quorumRequired > 0
                    ? new Set(
                        (l.approvals || [])
                          .filter((a) => a.decision === "approved" && !(l.required_approval_roles || []).includes(a.role))
                          .map((a) => String(a.membership_id))
                      ).size
                    : 0;

                  return (
                    <div key={l._id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-700/60 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-400">{l.reference || l._id}</span>
                            {isApplicant && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300/40">
                                <Lock size={10} /> Conflict of Interest: Recused
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-black text-slate-900 dark:text-white">
                            {l.member_name || l.membership_id?.user_id?.name || "Member Borrower"}
                          </h3>
                        </div>

                        <div className="text-right">
                          <span className="font-mono text-lg font-black text-emerald-600 dark:text-emerald-400">{money(l.amount)}</span>
                          <span className="block text-[11px] text-slate-500">{l.repayment_period_months} months term</span>
                        </div>
                      </div>

                      {/* Details & Guarantors status */}
                      <div className="grid gap-3 sm:grid-cols-2 text-xs">
                        <div>
                          <span className="text-[11px] font-bold text-slate-500">Loan Purpose</span>
                          <p className="font-medium text-slate-800 dark:text-slate-200">{l.purpose}</p>
                        </div>

                        <div>
                          <span className="text-[11px] font-bold text-slate-500">Guarantors Confirmation</span>
                          <p className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 size={13} /> {l.guarantors?.length ? `${l.guarantors.filter(g => g.status === 'accepted').length}/${l.guarantors.length} Confirmed` : "No guarantors required"}
                          </p>
                        </div>
                      </div>

                      {l.conflict_of_interest && (
                        <div className="flex items-center gap-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-3 py-2 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                          <Lock size={12} />
                          {(l.recused_roles || []).join(", ") || "Officer"} recused — {quorumFillers}/{quorumRequired} independent approvals collected
                        </div>
                      )}

                      {/* Approval CTAs */}
                      <div className="flex items-center justify-end gap-2 pt-2">
                        {isApplicant ? (
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 italic">
                            Recused: You cannot approve your own loan application.
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleApprovalDecision(l._id, "rejected")}
                              className="rounded-xl bg-rose-100 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-300"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleApprovalDecision(l._id, "approved")}
                              className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400"
                            >
                              Approve Loan
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-6">No loans currently awaiting approval.</p>
            )}
          </div>

          {/* Approved Loans Awaiting Disbursement (Treasurer View) */}
          {canDisburse && (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="text-emerald-600" size={18} /> Disburser Queue (Approved Loans)
              </h2>

              {approvedLoans.length > 0 ? (
                <div className="space-y-3">
                  {approvedLoans.map((l) => {
                    const applicantId = l.membership_id?._id || l.membership_id;
                    const isApplicant = String(applicantId) === String(workspaceCtx?.membership?._id);
                    const borrowerRole = l.membership_id?.role;
                    // Treasurer disburses normally; the Chairperson is only the
                    // authorized fallback when the Treasurer themself is the
                    // recused applicant (mirrors assertAuthorizedDisburser()
                    // on the backend, which is the source of truth).
                    const canDisburseThisLoan =
                      !isApplicant && (userRole === "treasurer" || (userRole === "chairperson" && borrowerRole === "treasurer"));

                    return (
                      <div key={l._id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <span className="font-mono text-[10px] font-bold text-slate-400">{l.reference || l._id}</span>
                          <h3 className="text-sm font-black text-slate-900 dark:text-white">
                            {l.member_name || l.membership_id?.user_id?.name || "Borrower"}
                          </h3>
                          <p className="text-xs text-slate-500">
                            Amount: <strong className="text-emerald-600">{money(l.amount)}</strong> • Method: {l.disbursement_method || "mpesa"}
                          </p>
                        </div>

                        {isApplicant ? (
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 italic">
                            Recused: You cannot disburse your own loan.
                          </span>
                        ) : canDisburseThisLoan ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDisburseLoan(l._id)}
                              className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-emerald-400 shadow-md"
                            >
                              Disburse M-Pesa B2C <ArrowRight size={14} />
                            </button>
                            <button
                              onClick={() => setConfirmManualLoan(l)}
                              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                            >
                              Confirm Cash/Bank
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-slate-500 italic">
                            Treasurer only — {borrowerRole === "treasurer" ? "Chairperson may disburse instead" : "not disbursable by your role"}.
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center py-4">No approved loans awaiting disbursement.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Apply For Loan Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Apply for Loan</h3>
                <p className="text-xs text-slate-500">Automated eligibility calculation & guarantor checks</p>
              </div>
              <button
                onClick={() => setShowApplyModal(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Real-time Pre-check Eligibility Card */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Automated Eligibility Pre-Check</span>
                {checkingEligibility ? (
                  <Loader2 size={14} className="animate-spin text-indigo-600" />
                ) : eligibilityData?.eligible ? (
                  <span className="inline-flex items-center gap-1 font-extrabold text-xs text-emerald-600">
                    <CheckCircle2 size={14} /> ELIGIBLE
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-extrabold text-xs text-rose-600">
                    <AlertCircle size={14} /> INELIGIBLE
                  </span>
                )}
              </div>

              {eligibilityData && (
                <div className="text-xs space-y-1 font-medium text-slate-600 dark:text-slate-300">
                  <p>Max Loan Limit: <strong className="font-mono text-slate-900 dark:text-white">{money(eligibilityData.loanLimit)}</strong></p>
                  {!eligibilityData.eligible && (
                    <p className="text-rose-600 font-semibold">{eligibilityData.reason}</p>
                  )}
                </div>
              )}
            </div>

            <form onSubmit={handleApplySubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Loan Amount (KES)</label>
                <input
                  type="number"
                  min="100"
                  required
                  value={applyAmount}
                  onChange={(e) => setApplyAmount(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 px-4 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Loan Purpose</label>
                <input
                  type="text"
                  required
                  value={applyPurpose}
                  onChange={(e) => setApplyPurpose(e.target.value)}
                  placeholder="e.g. Business expansion, Emergency"
                  className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 px-4 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Repayment Period</label>
                  <select
                    value={applyPeriod}
                    onChange={(e) => setApplyPeriod(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="1">1 Month</option>
                    <option value="3">3 Months</option>
                    <option value="6">6 Months</option>
                    <option value="12">12 Months</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Frequency</label>
                  <select
                    value={applyFrequency}
                    onChange={(e) => setApplyFrequency(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Disbursement M-Pesa Phone Number</label>
                <input
                  type="text"
                  value={applyPhoneNumber}
                  onChange={(e) => setApplyPhoneNumber(e.target.value)}
                  placeholder="e.g. 0712345678"
                  className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 px-4 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={applying || (eligibilityData && !eligibilityData.eligible)}
                className="w-full rounded-2xl bg-emerald-500 py-3.5 text-xs font-black text-slate-950 shadow-xl hover:bg-emerald-400 transition disabled:opacity-50"
              >
                {applying ? "Submitting..." : "Submit Loan Application"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Manual Disbursement Modal */}
      {confirmManualLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">CONFIRM DISBURSEMENT</span>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {confirmManualLoan.reference || "Loan Disbursement"}
                </h3>
              </div>
              <button onClick={() => setConfirmManualLoan(null)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                ✕
              </button>
            </div>

            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-200/60 dark:border-slate-700/60 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Borrower:</span>
                <b className="text-slate-900 dark:text-white">{confirmManualLoan.member_name || confirmManualLoan.membership_id?.user_id?.name || "Member"}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount:</span>
                <b className="font-mono text-emerald-600 font-bold">{money(confirmManualLoan.amount)}</b>
              </div>
            </div>

            <form onSubmit={handleConfirmManualDisbursementSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Disbursement Method *</label>
                <select
                  value={manualMethod}
                  onChange={(e) => setManualMethod(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-bold text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                >
                  <option value="cash">Cash Settlement</option>
                  <option value="bank">Bank Transfer (EFT / RTGS)</option>
                  <option value="cheque">Cheque</option>
                  <option value="mpesa">Manual M-Pesa Offline</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Transaction Reference / Receipt</label>
                <input
                  type="text"
                  placeholder="e.g. CHQ-89021, TXN-998822"
                  value={manualReference}
                  onChange={(e) => setManualReference(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmManualLoan(null)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={confirmingDisburse}
                  className="rounded-2xl bg-emerald-600 px-5 py-2.5 font-black text-white shadow-md hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {confirmingDisburse ? "Confirming..." : "Confirm & Post"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Action Safety Confirmation Dialog */}
      <ActionConfirmationDialog
        isOpen={showConfirmationDialog}
        onClose={() => setShowConfirmationDialog(false)}
        onConfirm={handleConfirmAction}
        action={confirmationAction}
        chamaId={workspaceId}
        actionData={
          confirmationLoan ? {
            loanId: confirmationLoan._id,
            amount: confirmationLoan.amount,
            memberName: confirmationLoan.member_name || confirmationLoan.membership_id?.user_id?.name || 'Member',
            loanReference: confirmationLoan.reference,
            versionToken: confirmationLoan.updatedAt?.toString()
          } : {}
        }
      />
    </div>
  );
}