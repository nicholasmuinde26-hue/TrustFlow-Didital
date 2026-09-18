import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Wallet,
  PiggyBank,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Zap,
  Repeat,
  Users,
  HeartHandshake,
  UserCheck,
  UserX,
  Lock,
  ChevronDown,
  X,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Landmark,
  ShieldCheck,
  SlidersHorizontal,
  Check,
  Plus,
} from "lucide-react";
import useWorkspace from "@/app/hooks/useWorkspace";
import loanService from "../services/loan.service";
import memberService from "@/modules/members/services/members.service";
import { isLoanOfficial } from "@/modules/workspaces/permissions/Permissions";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;
const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const readableStatus = (status) => String(status || "").replace(/_/g, " ");

// Outstanding balance for a loan, straight off its own balances —
// never a guessed percentage of the principal.
const getOutstanding = (loan) => {
  if (loan?.balances) {
    return (
      Number(loan.balances.principal_outstanding || 0) +
      Number(loan.balances.interest_outstanding || 0) +
      Number(loan.balances.penalty_outstanding || 0)
    );
  }
  return Number(loan?.outstanding ?? loan?.amount ?? 0);
};

// ========================================
// LOAN PRODUCTS — sourced from the Chama's own loan policy
// ========================================
//
// Every figure and every enable/disable flag here comes straight off
// ChamaLoanPolicy (loan_multiplier, emergency_loan_enabled/limit,
// topup_enabled, group_loans_enabled) rather than being hardcoded, so the
// "store" always reflects what this particular Chama actually allows.
//
// ========================================
function buildProducts({ policy, summary }) {
  if (!policy) return [];
  const hasActiveLoan = !!summary?.active_loan;
  const activeLoanIsTopupable =
    hasActiveLoan && ["active", "partially_repaid"].includes(summary.active_loan.status);

  return [
    {
      key: "standard",
      name: "Standard Loan",
      icon: Landmark,
      tagline: `${policy.loan_multiplier}× your savings`,
      blurb: `Borrow up to ${policy.loan_multiplier}× your savings balance at ${policy.interest_rate_percent}% ${
        policy.interest_type === "reducing_balance" ? "reducing balance" : "flat"
      } interest.`,
      terms: [
        `Up to ${money(summary?.loan_limit)} available to you`,
        `${(policy.allowed_repayment_periods_months || []).join(", ") || "Flexible"} month terms`,
        policy.min_guarantors_required > 0
          ? `${policy.min_guarantors_required} guarantor(s) required`
          : "No guarantors required",
      ],
      available: summary ? summary.can_apply !== false : true,
      disabledReason: summary?.can_apply === false ? "You already have a loan in progress." : null,
    },
    {
      key: "emergency",
      name: "Emergency Loan",
      icon: Zap,
      tagline: `Up to ${money(policy.emergency_loan_limit)}`,
      blurb: "Fast-tracked welfare loan for urgent needs — no minimum membership period, 1-month term.",
      terms: [
        `Capped at ${money(policy.emergency_loan_limit)}`,
        "1 month repayment term",
        "Minimum membership period waived",
      ],
      available: policy.emergency_loan_enabled && (summary ? summary.can_apply !== false : true),
      disabledReason: !policy.emergency_loan_enabled
        ? "Not enabled for this Chama."
        : summary?.can_apply === false
        ? "You already have a loan in progress."
        : null,
    },
    {
      key: "topup",
      name: "Top-Up Loan",
      icon: Repeat,
      tagline: "Extend your current loan",
      blurb: "Borrow more against your existing active loan without waiting for it to close first.",
      terms: [
        `Combined balance stays within ${money(summary?.loan_limit)}`,
        "Same repayment schedule as your current loan",
      ],
      available: policy.topup_enabled && activeLoanIsTopupable,
      disabledReason: !policy.topup_enabled
        ? "Not enabled for this Chama."
        : !activeLoanIsTopupable
        ? "Requires an active loan to top up."
        : null,
    },
    {
      key: "group",
      name: "Group Loan",
      icon: Users,
      tagline: "Shared borrowing",
      blurb: "A loan taken jointly, with repayment responsibility shared across the group.",
      terms: [`${policy.loan_multiplier}× combined savings`, "Same approval chain as a standard loan"],
      available: policy.group_loans_enabled && (summary ? summary.can_apply !== false : true),
      disabledReason: !policy.group_loans_enabled
        ? "Not enabled for this Chama."
        : summary?.can_apply === false
        ? "You already have a loan in progress."
        : null,
    },
  ];
}

// ========================================
// PROGRESS RING — one honest visual for "where is this loan right now"
// ========================================
//
// Before disbursement the ring tracks the application's stage
// (submitted → pending approval → approved → disbursing). Once money is
// out the door, it switches to tracking real repayment progress off the
// loan's own balances/total_payable — never a guess.
//
// ========================================
const STAGE_PERCENT = {
  draft: 10,
  submitted: 20,
  pending_approval: 45,
  approved: 70,
  disbursement_pending: 85,
};

function loanProgress(loan) {
  const status = loan.status;

  if (["rejected", "eligibility_failed", "blocked_conflict", "cancelled"].includes(status)) {
    return { percent: 100, tone: "slate", label: "Not proceeding" };
  }

  if (STAGE_PERCENT[status] !== undefined) {
    return { percent: STAGE_PERCENT[status], tone: "amber", label: readableStatus(status) };
  }

  const outstanding =
    (loan.balances?.principal_outstanding || 0) +
    (loan.balances?.interest_outstanding || 0) +
    (loan.balances?.penalty_outstanding || 0);
  const payable = loan.total_payable || loan.amount || 0;
  const repaidFraction = payable > 0 ? clamp((payable - outstanding) / payable, 0, 1) : 0;

  if (["recovered", "closed"].includes(status)) {
    return { percent: 100, tone: "emerald", label: "Closed" };
  }
  if (status === "defaulted") {
    return { percent: clamp(85 + repaidFraction * 15), tone: "rose", label: "Defaulted" };
  }
  // disbursed / active / partially_repaid / overdue
  return {
    percent: clamp(85 + repaidFraction * 15),
    tone: status === "overdue" ? "rose" : "emerald",
    label: status === "overdue" ? "Overdue" : "Repaying",
  };
}

const RING_TONES = {
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  slate: "#94a3b8",
};

function ProgressRing({ percent, tone = "emerald", size = 56, strokeWidth = 5, children }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamp(percent) / 100) * circumference;
  const color = RING_TONES[tone] || RING_TONES.emerald;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-slate-100 dark:text-obsidian-raised" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-slate-900 dark:text-mist">
        {children ?? `${Math.round(clamp(percent))}%`}
      </div>
    </div>
  );
}

function buildFaqs(policy) {
  if (!policy) return [];
  return [
    {
      q: "How much can I borrow?",
      a: `Your loan limit is your savings balance × ${policy.loan_multiplier} (this Chama's loan multiplier). Interest is charged at ${policy.interest_rate_percent}% ${
        policy.interest_type === "reducing_balance" ? "on a reducing balance" : "flat"
      }.`,
    },
    {
      q: "How many guarantors do I need?",
      a:
        policy.min_guarantors_required > 0
          ? `At least ${policy.min_guarantors_required} member(s) must guarantee your loan before it can move into the approval queue.`
          : "This Chama doesn't require guarantors, though you may still add them if you'd like.",
    },
    policy.emergency_loan_enabled && {
      q: "What if I need money urgently?",
      a: `Apply for an Emergency Loan — up to ${money(policy.emergency_loan_limit)}, no minimum membership period, and a 1-month repayment term.`,
    },
    policy.topup_enabled && {
      q: "Can I top up an existing loan?",
      a: "Yes — if your current loan is active, you can apply for a top-up instead of waiting for it to close.",
    },
    {
      q: "What happens if I pay late?",
      a: `You get a ${policy.grace_period_days}-day grace period after each due date. After that, a ${
        policy.penalty_type === "percentage_of_due" ? `${policy.penalty_amount}% of the amount due` : `${money(policy.penalty_amount)}/week`
      } penalty applies, and the loan is treated as in default after ${policy.default_after_days} days past due.`,
    },
  ].filter(Boolean);
}

export default function LoansPage() {
  const { workspaceId: paramId } = useParams();
  const workspaceCtx = useWorkspace();
  const workspaceId = paramId || workspaceCtx?.workspaceId;
  const role = workspaceCtx?.membership?.role;
  const type = workspaceCtx?.workspaceType;
  // Approving, rejecting and disbursing loans — and editing the loan
  // policy itself — are officials-only actions. They live exclusively
  // in the Leadership Desk's Loans tab now, which is the only surface
  // that talks to the officials-only /loans/portfolio endpoint and the
  // real decision/disbursement API. This page never offers them; it
  // just points an official there.
  const mayReviewLoans = isLoanOfficial(role, type);

  const [summary, setSummary] = useState(null);
  const [loans, setLoans] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [policy, setPolicy] = useState(null);
  const [myGuarantees, setMyGuarantees] = useState([]);
  const [chamaMembers, setChamaMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState({ text: "", isError: false });
  const [openFaq, setOpenFaq] = useState(null);

  // Apply slide-over state
  const [showApply, setShowApply] = useState(false);
  const [step, setStep] = useState(0);
  const [loanType, setLoanType] = useState("standard");
  const [applyAmount, setApplyAmount] = useState(10000);
  const [applyPurpose, setApplyPurpose] = useState("");
  const [applyPeriod, setApplyPeriod] = useState("6");
  const [applyFrequency, setApplyFrequency] = useState("monthly");
  const [applyPhoneNumber, setApplyPhoneNumber] = useState("");
  const [selectedGuarantors, setSelectedGuarantors] = useState([]);
  const [applying, setApplying] = useState(false);
  const [eligibilityData, setEligibilityData] = useState(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  // Repayments tab — fetched live, per loan, on demand.
  const [repayments, setRepayments] = useState([]);
  const [loadingRepayments, setLoadingRepayments] = useState(false);

  // Repay slide-over state
  const [repayLoanId, setRepayLoanId] = useState(null);
  const [repayAmount, setRepayAmount] = useState("");
  const [repayPhone, setRepayPhone] = useState("");
  const [repaying, setRepaying] = useState(false);

  const loadData = async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [dashRes, guaranteesRes, membersRes, policyRes] = await Promise.allSettled([
        loanService.getDashboard(workspaceId),
        loanService.getMyGuarantees(workspaceId),
        memberService.list("chama", workspaceId),
        loanService.getPolicy(workspaceId),
      ]);

      if (dashRes.status === "fulfilled") {
        setSummary(dashRes.value?.summary || null);
        setLoans(dashRes.value?.loans || []);
      }
      if (guaranteesRes.status === "fulfilled") setMyGuarantees(guaranteesRes.value || []);
      if (membersRes.status === "fulfilled") setChamaMembers(membersRes.value || []);
      if (policyRes.status === "fulfilled") {
        const nextPolicy = policyRes.value || null;
        setPolicy(nextPolicy);
        if (nextPolicy?.allowed_repayment_periods_months?.length) {
          setApplyPeriod((current) =>
            nextPolicy.allowed_repayment_periods_months.map(String).includes(String(current))
              ? current
              : String(nextPolicy.allowed_repayment_periods_months[0])
          );
        }
        if (nextPolicy?.allowed_repayment_frequencies?.length) {
          setApplyFrequency((current) =>
            nextPolicy.allowed_repayment_frequencies.includes(current) ? current : nextPolicy.allowed_repayment_frequencies[0]
          );
        }
        setApplyPurpose((current) => (current ? current : nextPolicy?.allowed_purposes?.length ? nextPolicy.allowed_purposes[0] : current));
      }
    } catch (err) {
      console.warn("Could not fetch loan data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    const onFocus = () => loadData();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  // Real-time eligibility pre-check while the slide-over is open
  useEffect(() => {
    if (!showApply || !workspaceId) return;
    let cancelled = false;
    setCheckingEligibility(true);
    const period = loanType === "emergency" ? 1 : applyPeriod;
    loanService
      .checkEligibility(workspaceId, {
        amount: applyAmount,
        purpose: applyPurpose || "General",
        repaymentPeriodMonths: period,
        repaymentFrequency: applyFrequency,
        loanType,
      })
      .then((res) => !cancelled && setEligibilityData(res))
      .catch(() => !cancelled && setEligibilityData(null))
      .finally(() => !cancelled && setCheckingEligibility(false));
    return () => {
      cancelled = true;
    };
  }, [showApply, applyAmount, applyPurpose, applyPeriod, applyFrequency, loanType, workspaceId]);

  const products = useMemo(() => buildProducts({ policy, summary }), [policy, summary]);
  const faqs = useMemo(() => buildFaqs(policy), [policy]);
  const pendingMyGuarantees = myGuarantees.filter((g) => g.status === "pending");
  const minGuarantors = Number(policy?.min_guarantors_required || 0);
  const needsGuarantorStep = minGuarantors > 0;
  const stepKeys = needsGuarantorStep ? ["details", "guarantors", "review"] : ["details", "review"];
  const activeLoan = summary?.active_loan;

  // Fetch repayment transactions for the member's own loans, live,
  // the first time the Repayments tab is opened.
  useEffect(() => {
    if (activeTab !== "repayments" || !workspaceId || loans.length === 0) return;
    let cancelled = false;
    setLoadingRepayments(true);
    Promise.allSettled(loans.map((l) => loanService.getRepayments(workspaceId, l._id || l.id)))
      .then((results) => {
        if (cancelled) return;
        const flattened = results.flatMap((r, i) => {
          if (r.status !== "fulfilled" || !Array.isArray(r.value)) return [];
          const loan = loans[i];
          return r.value.map((payment) => ({ ...payment, loan_reference: loan.reference || loan._id || loan.id }));
        });
        flattened.sort((a, b) => new Date(b.paid_at || 0) - new Date(a.paid_at || 0));
        setRepayments(flattened);
      })
      .finally(() => !cancelled && setLoadingRepayments(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, workspaceId, loans]);

  function openApply(presetType = "standard") {
    setLoanType(presetType);
    setSelectedGuarantors([]);
    setEligibilityData(null);
    setStep(0);
    setShowApply(true);
  }

  function closeApply() {
    setShowApply(false);
    setStep(0);
  }

  function openRepay(loanId) {
    const loan = loans.find((l) => String(l._id || l.id) === String(loanId));
    setRepayLoanId(loanId);
    setRepayAmount(loan ? String(getOutstanding(loan)) : "");
    setRepayPhone("");
    setActionMessage({ text: "", isError: false });
  }

  function closeRepay() {
    setRepayLoanId(null);
  }

  async function handleRepaySubmit(e) {
    e.preventDefault();
    if (!repayAmount || Number(repayAmount) <= 0) {
      setActionMessage({ text: "Enter a valid repayment amount.", isError: true });
      return;
    }
    setRepaying(true);
    try {
      await loanService.startMpesaRepayment(workspaceId, repayLoanId, {
        amount: Number(repayAmount),
        phone_number: repayPhone || undefined,
      });
      setActionMessage({ text: "M-Pesa prompt sent — enter your PIN on your phone to complete the repayment.", isError: false });
      closeRepay();
      loadData();
    } catch (err) {
      setActionMessage({ text: err?.response?.data?.message || "Could not start the repayment.", isError: true });
    } finally {
      setRepaying(false);
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
    if (minGuarantors > 0 && selectedGuarantors.length < minGuarantors) {
      setActionMessage({ text: `This Chama's policy requires at least ${minGuarantors} guarantor(s) for a loan of this size.`, isError: true });
      return;
    }
    if (selectedGuarantors.some((g) => !g.guaranteed_amount || Number(g.guaranteed_amount) <= 0)) {
      setActionMessage({ text: "Enter a guaranteed amount greater than zero for every selected guarantor.", isError: true });
      return;
    }

    setApplying(true);
    try {
      const created = await loanService.apply(workspaceId, {
        amount: Number(applyAmount),
        purpose: applyPurpose || "General",
        loan_type: loanType,
        parent_loan_id: loanType === "topup" ? activeLoan?.id : undefined,
        repayment_period_months: loanType === "emergency" ? 1 : Number(applyPeriod),
        repayment_frequency: applyFrequency,
        disbursement_method: "mpesa",
        phone_number: applyPhoneNumber || undefined,
        guarantors: selectedGuarantors.map((g) => ({
          membership_id: g.membership_id,
          guaranteed_amount: Number(g.guaranteed_amount),
        })),
      });

      if (created?.status === "blocked_conflict") {
        setActionMessage({
          text: created.governance_block_reason || "Application blocked: not enough independent officials are available to approve this loan due to a conflict-of-interest recusal.",
          isError: true,
        });
      } else if (created?.status === "eligibility_failed") {
        setActionMessage({ text: created.eligibility?.reason || "You are not currently eligible for this loan.", isError: true });
      } else if (created?.status === "submitted") {
        setActionMessage({ text: "Loan application submitted! It will enter the approval queue once your guarantor(s) accept.", isError: false });
      } else {
        setActionMessage({ text: "Loan application submitted! It is now in the approval queue.", isError: false });
      }
      closeApply();
      setSelectedGuarantors([]);
      loadData();
    } catch (err) {
      setActionMessage({ text: err?.response?.data?.message || "Could not submit loan application.", isError: true });
    } finally {
      setApplying(false);
    }
  }

  const selectedProductMeta = products.find((p) => p.key === loanType);

  // Derived metrics — sourced entirely from this member's own loans
  // (/loans/me and /loans/me/summary). Chama-wide totals (the whole
  // loan book, every pending request, the institutional repayment
  // rate) come from the officials-only /loans/portfolio endpoint,
  // which this page no longer fetches — that data, and the actions
  // that go with it, belong in the Leadership Desk.
  const activeLoansList = loans.filter((l) => ["active", "disbursed", "partially_repaid", "overdue"].includes(l.status));
  const activeLoanOutstanding = activeLoansList.reduce((s, l) => s + Number(getOutstanding(l)), 0);
  const activeLoansCount = activeLoansList.length;

  const pendingRequestsList = loans.filter((l) => ["submitted", "pending_approval", "guarantor_approval"].includes(l.status));
  const pendingRequestsCount = pendingRequestsList.length;
  const pendingRequestedAmount = pendingRequestsList.reduce((s, l) => s + Number(l.amount || 0), 0);

  const totalBorrowed = loans.reduce((s, l) => s + Number(l.amount || 0), 0);
  const totalRepaid = loans.reduce((s, l) => s + Math.max(0, Number(l.amount || 0) - getOutstanding(l)), 0);
  const repaymentRatePercent = totalBorrowed > 0 ? clamp((totalRepaid / totalBorrowed) * 100) : null;

  // Active loan display items — live, no placeholder borrowers.
  const displayActiveLoans = activeLoansList.map((l) => {
    const borrower = l.borrower_name || l.borrower_membership_id?.user_id?.name || "You";
    const amt = Number(l.amount || 0);
    const outstandingAmt = getOutstanding(l);
    const repaidAmt = Math.max(0, amt - outstandingAmt);
    const pct = amt > 0 ? Math.min(100, Math.round((repaidAmt / amt) * 100)) : 0;
    return {
      id: l._id || l.id,
      name: borrower,
      amount: amt,
      purpose: l.purpose || "General",
      repaid: repaidAmt,
      percentage: pct,
      status: readableStatus(l.status),
    };
  });

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-mist pb-16">
      {/* Top Header matching Image 2 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-mist-muted mb-1">
            <Link
              to={`/workspace/${workspaceId}`}
              className="inline-flex items-center gap-1 hover:text-emerald-700 dark:hover:text-mint"
            >
              <ArrowLeft size={13} />
              Command Center
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-mist">
            Loans
          </h1>
          <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500 dark:text-mist-muted">
            Your loans, applications and repayments
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {mayReviewLoans && (
            <Link
              to={`/workspace/${workspaceId}/leadership?tab=loans`}
              className="flex items-center gap-1.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-700 shadow-xs hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 transition"
            >
              <ShieldCheck size={15} />
              Review requests in Leadership Desk
            </Link>
          )}

          <button
            type="button"
            onClick={() => setActiveTab("policy")}
            className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist dark:hover:bg-obsidian-raised transition"
          >
            <SlidersHorizontal size={15} />
            Loan policy
          </button>

          <button
            type="button"
            onClick={() => openApply("standard")}
            className="flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 dark:bg-mint dark:text-obsidian-rail dark:hover:bg-mint-hover transition"
          >
            <Plus size={16} strokeWidth={3} />
            New loan request
          </button>
        </div>
      </div>

      {/* Tabs navigation row */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 pb-2 dark:border-obsidian-border text-xs font-bold">
        {[
          { key: "overview", label: "Overview" },
          { key: "active", label: "My active loans" },
          { key: "repayments", label: "Repayments" },
          { key: "policy", label: "Policy" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-xl px-4 py-2 transition whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-slate-900 text-white dark:bg-mint dark:text-obsidian-rail"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-mist-muted dark:hover:bg-obsidian-card dark:hover:text-mist"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

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

      {/* Main Tab Content */}
      {activeTab === "overview" && (
        <>
          {/* 3 Top Summary Cards matching Image 2 */}
          <div className="grid gap-5 sm:grid-cols-3">
            {/* Card 1: Active Loan Book */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  MY OUTSTANDING BALANCE
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-mint-deep dark:text-mint">
                  <Wallet size={16} />
                </div>
              </div>
              <p className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-mist">
                {money(activeLoanOutstanding)}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-mint">
                <TrendingUp size={14} />
                <span>{activeLoansCount} active loan{activeLoansCount === 1 ? "" : "s"}</span>
              </div>
              <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] font-medium text-slate-400 dark:border-obsidian-border dark:text-mist-muted">
                {loans.length} loan{loans.length === 1 ? "" : "s"} on record with this Chama
              </p>
            </div>

            {/* Card 2: Awaiting Decision */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  AWAITING DECISION
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                  <Clock size={16} />
                </div>
              </div>
              <p className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-mist">
                {pendingRequestsCount} request{pendingRequestsCount === 1 ? "" : "s"}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs font-semibold">
                <span className="text-amber-600 dark:text-amber-400 font-bold">{money(pendingRequestedAmount)} requested</span>
              </div>
              <p className="mt-4 border-t border-slate-100 pt-2 text-[11px] font-medium text-slate-400 dark:border-obsidian-border dark:text-mist-muted">
                {pendingRequestsCount > 0 ? "Your guarantor(s) or the loan committee still need to act." : "Nothing of yours is waiting on a decision."}
              </p>
            </div>

            {/* Card 3: Repayment Rate */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  MY REPAYMENT PROGRESS
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-mint-deep dark:text-mint">
                  <CheckCircle2 size={16} />
                </div>
              </div>
              <p className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-mist">
                {repaymentRatePercent === null ? "—" : `${Math.round(repaymentRatePercent)}%`}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-mint">
                <span>{money(totalRepaid)} repaid of {money(totalBorrowed)} borrowed</span>
              </div>
              <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] font-medium text-slate-400 dark:border-obsidian-border dark:text-mist-muted">
                Across every loan you've taken with this Chama
              </p>
            </div>
          </div>

          {/* Main 2-Column Grid: Left (My requests & Active Loans) + Right (Policy & Guarantees) */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left Column: 7 Cols */}
            <div className="space-y-6 lg:col-span-7">
              {/* Card: My requests awaiting a decision */}
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-obsidian-border">
                  <h2 className="text-base font-bold text-slate-900 dark:text-mist">
                    My requests awaiting a decision
                  </h2>
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                    {pendingRequestsCount} pending
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {pendingRequestsList.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-xs text-slate-500 dark:border-obsidian-border dark:text-mist-muted">
                      You have no loan requests waiting on a decision right now.
                    </p>
                  )}
                  {pendingRequestsList.map((l) => (
                    <div key={l._id || l.id} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-obsidian-border dark:bg-obsidian-raised/30">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-slate-900 dark:text-mist">
                            {money(l.amount)} · {l.purpose || "General"}
                          </p>
                          <p className="text-xs font-semibold text-slate-500 dark:text-mist-muted">
                            Reference {l.reference || l._id}
                          </p>
                        </div>
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                          {readableStatus(l.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {mayReviewLoans && (
                    <p className="text-[11px] text-slate-400">
                      Approving or declining requests happens in the{" "}
                      <Link to={`/workspace/${workspaceId}/leadership?tab=loans`} className="font-bold text-emerald-600 hover:underline dark:text-mint">
                        Leadership Desk
                      </Link>
                      .
                    </p>
                  )}
                </div>
              </div>

              {/* Card: Active Loans matching Image 2 */}
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-obsidian-border">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-mist">
                      Active loans
                    </h2>
                    <p className="text-xs text-slate-400">
                      {displayActiveLoans.length} loans currently being serviced
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("active")}
                    className="text-xs font-bold text-emerald-600 hover:underline dark:text-mint"
                  >
                    View all →
                  </button>
                </div>

                <div className="mt-4 divide-y divide-slate-100 dark:divide-obsidian-border">
                  {displayActiveLoans.length === 0 && (
                    <p className="py-6 text-center text-xs text-slate-400">You have no active loans right now.</p>
                  )}
                  {displayActiveLoans.map((loan) => {
                    const initials = loan.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();
                    return (
                      <div key={loan.id} className="py-4 first:pt-1 last:pb-0 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-xs font-black text-slate-700 dark:bg-obsidian-raised dark:text-mist">
                              {initials}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900 dark:text-mist">
                                {loan.name} · {money(loan.amount)}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                {loan.purpose}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-mono font-bold text-slate-900 dark:text-mist">
                              {money(loan.repaid)} / {money(loan.amount)}
                            </span>
                            <p className="text-[10px] font-bold text-emerald-600 dark:text-mint">
                              {loan.percentage}% repaid
                            </p>
                          </div>
                        </div>

                        {/* Repayment Progress Bar */}
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-obsidian-raised">
                          <div
                            className="h-full rounded-full bg-emerald-500 dark:bg-mint transition-all"
                            style={{ width: `${loan.percentage}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-500 dark:text-mist-muted">
                            {loan.status}
                          </span>
                          <button
                            type="button"
                            onClick={() => openRepay(loan.id)}
                            className="font-bold text-emerald-600 hover:underline dark:text-mint"
                          >
                            Record repayment
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: 5 Cols */}
            <div className="space-y-6 lg:col-span-5">
              {/* Card: Loan policy at a glance matching Image 2 */}
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-obsidian-border">
                  <h2 className="text-base font-bold text-slate-900 dark:text-mist">
                    Loan policy at a glance
                  </h2>
                  {workspaceCtx?.membership?.role === "chairperson" ? (
                    <Link
                      to={`/workspace/${workspaceId}/leadership?tab=governance`}
                      className="text-xs font-bold text-emerald-600 hover:underline dark:text-mint"
                    >
                      Edit rules
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveTab("policy")}
                      className="text-xs font-bold text-emerald-600 hover:underline dark:text-mint"
                    >
                      View details
                    </button>
                  )}
                </div>

                {!policy ? (
                  <p className="mt-4 text-xs text-slate-400">Loading policy…</p>
                ) : (
                  <div className="mt-4 space-y-3.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-mist-muted">Max loan size</span>
                      <span className="font-bold text-slate-900 dark:text-mist">
                        {policy.loan_multiplier}x member savings
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-mist-muted">Interest rate</span>
                      <span className="font-bold text-slate-900 dark:text-mist">
                        {policy.interest_rate_percent}% per month ({policy.interest_type === 'flat' ? 'flat' : 'reducing balance'})
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-mist-muted">Max repayment period</span>
                      <span className="font-bold text-slate-900 dark:text-mist">
                        {policy.allowed_repayment_periods_months?.slice(-1)[0] ?? "—"} months
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-mist-muted">Guarantors required</span>
                      <span className="font-bold text-slate-900 dark:text-mist">
                        {policy.min_guarantors_required > 0 ? `At least ${policy.min_guarantors_required} active members` : "None required"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-mist-muted">Emergency loan cap</span>
                      <span className="font-bold text-slate-900 dark:text-mist">
                        {policy.emergency_loan_enabled ? `${money(policy.emergency_loan_limit)} (instant approval)` : "Not enabled"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Guarantee Requests & Personal Limit */}
              {pendingMyGuarantees.length > 0 && (
                <div className="rounded-3xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-900/60 dark:bg-amber-950/30">
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <HeartHandshake size={15} /> Guarantee Request Awaiting You
                  </h3>
                  <div className="mt-3 space-y-2.5">
                    {pendingMyGuarantees.map((g) => (
                      <div key={g.loan_id} className="rounded-2xl bg-white p-3.5 shadow-xs dark:bg-obsidian-card">
                        <p className="text-xs font-black text-slate-900 dark:text-mist">{g.borrower_name}</p>
                        <p className="text-[11px] text-slate-500">
                          Guarantee {money(g.guaranteed_amount)} for "{g.purpose}"
                        </p>
                        <div className="mt-2.5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRespondGuarantee(g.loan_id, "accepted")}
                            className="rounded-xl bg-emerald-600 px-3 py-1 text-xs font-bold text-white dark:bg-mint dark:text-obsidian-rail"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRespondGuarantee(g.loan_id, "declined")}
                            className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-bold text-rose-600 dark:border-obsidian-border dark:text-rose-400"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Subtab: Active Loans Tab */}
      {activeTab === "active" && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-mist">My Active Loans</h2>
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card divide-y divide-slate-100 dark:divide-obsidian-border">
            {displayActiveLoans.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-400">You have no active loans right now.</p>
            )}
            {displayActiveLoans.map((loan) => (
              <div key={loan.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-mist">{loan.name}</p>
                  <p className="text-xs text-slate-500">{loan.purpose} · {money(loan.amount)}</p>
                  <p className="text-[11px] font-semibold text-emerald-600 dark:text-mint">{loan.status}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-bold text-slate-900 dark:text-mist">{money(loan.repaid)} repaid</p>
                  <button
                    onClick={() => openRepay(loan.id)}
                    className="mt-1 rounded-xl bg-slate-900 px-3 py-1 text-[11px] font-bold text-white dark:bg-obsidian-raised"
                  >
                    Repay
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subtab: Repayments Tab */}
      {activeTab === "repayments" && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-mist">Repayment Records</h2>
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
            <p className="text-xs text-slate-500">Repayment transactions recorded against your own loans.</p>
            <div className="mt-4 divide-y divide-slate-100 dark:divide-obsidian-border text-xs">
              {loadingRepayments && (
                <p className="py-4 text-center text-slate-400">Loading repayments…</p>
              )}
              {!loadingRepayments && repayments.length === 0 && (
                <p className="py-4 text-center text-slate-400">No repayments recorded yet.</p>
              )}
              {!loadingRepayments &&
                repayments.map((r) => (
                  <div key={r._id || r.id} className="py-3 flex justify-between">
                    <span>
                      {r.loan_reference || r.loan_id} · {r.method || "Repayment"}
                      {r.paid_at && <span className="ml-1 text-slate-400">{new Date(r.paid_at).toLocaleDateString()}</span>}
                    </span>
                    <span className="font-mono font-bold text-emerald-600">+{money(r.amount)}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Subtab: Policy Tab */}
      {activeTab === "policy" && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-mist">Chama Loan Policy &amp; Rules</h2>
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card space-y-4 text-xs">
            {!policy ? (
              <p className="text-slate-400">Loading policy…</p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-obsidian-raised">
                    <span className="font-bold text-slate-700 dark:text-mist">Borrowing Multiplier:</span>
                    <p className="text-lg font-black mt-1 text-slate-900 dark:text-mist">{policy.loan_multiplier}× savings balance</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-obsidian-raised">
                    <span className="font-bold text-slate-700 dark:text-mist">Monthly Interest:</span>
                    <p className="text-lg font-black mt-1 text-slate-900 dark:text-mist">{policy.interest_rate_percent}%</p>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-obsidian-raised">
                  <span className="font-bold text-slate-700 dark:text-mist">Required Guarantors:</span>
                  <p className="text-sm font-bold mt-1 text-slate-900 dark:text-mist">
                    {policy.min_guarantors_required > 0 ? `${policy.min_guarantors_required} members must co-sign` : "None required"}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Apply Slide-Over */}
      {showApply && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-obsidian-card animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-obsidian-border">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-mist">
                  Apply for a {selectedProductMeta?.name || "Loan"}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Step {step + 1} of {stepKeys.length}: {stepKeys[step] === "details" ? "Loan details" : stepKeys[step] === "guarantors" ? "Guarantors" : "Review & submit"}
                </p>
              </div>
              <button onClick={closeApply} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-obsidian-raised">
                <X size={18} />
              </button>
            </div>

            {/* Step progress dots */}
            <div className="flex gap-1.5 px-5 pt-4">
              {stepKeys.map((key, i) => (
                <div key={key} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-emerald-500" : "bg-slate-100 dark:bg-obsidian-raised"}`} />
              ))}
            </div>

            <form onSubmit={handleApplySubmit} className="flex flex-1 flex-col overflow-y-auto">
              <div className="flex-1 space-y-4 p-5">
                {stepKeys[step] === "details" && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-mist-muted">Loan Product</label>
                      <div className="grid grid-cols-2 gap-2">
                        {products.filter((p) => p.available || p.key === loanType).map((p) => (
                          <button
                            type="button"
                            key={p.key}
                            disabled={!p.available}
                            onClick={() => setLoanType(p.key)}
                            className={`rounded-2xl border p-3 text-left text-xs font-bold transition disabled:opacity-40 ${
                              loanType === p.key
                                ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-obsidian-border dark:text-mist-muted"
                            }`}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-mist-muted">Loan Amount (KES)</label>
                      <input
                        type="number"
                        min="100"
                        required
                        value={applyAmount}
                        onChange={(e) => setApplyAmount(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 px-4 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-mist-muted">Loan Purpose</label>
                      {policy?.allowed_purposes?.length ? (
                        <select
                          value={applyPurpose}
                          onChange={(e) => setApplyPurpose(e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
                        >
                          {policy.allowed_purposes.map((purpose) => (
                            <option key={purpose} value={purpose}>{purpose}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          required
                          value={applyPurpose}
                          onChange={(e) => setApplyPurpose(e.target.value)}
                          placeholder="e.g. Business expansion, Emergency"
                          className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 px-4 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
                        />
                      )}
                    </div>

                    {loanType !== "emergency" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700 dark:text-mist-muted">Repayment Period</label>
                          <select
                            value={applyPeriod}
                            onChange={(e) => setApplyPeriod(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
                          >
                            {(policy?.allowed_repayment_periods_months || [1, 3, 6, 12]).map((m) => (
                              <option key={m} value={m}>{m} Month{m > 1 ? "s" : ""}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700 dark:text-mist-muted">Frequency</label>
                          <select
                            value={applyFrequency}
                            onChange={(e) => setApplyFrequency(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
                          >
                            {(policy?.allowed_repayment_frequencies || ["monthly", "weekly"]).map((f) => (
                              <option key={f} value={f} className="capitalize">{f}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                    {loanType === "emergency" && (
                      <p className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                        Emergency loans are fixed at a 1-month repayment term.
                      </p>
                    )}
                    {loanType === "topup" && activeLoan && (
                      <p className="rounded-xl bg-slate-50 dark:bg-obsidian-raised/50 border border-slate-200 dark:border-obsidian-border p-3 text-[11px] font-bold text-slate-600 dark:text-mist-muted">
                        This will top up your active loan {activeLoan.reference}.
                      </p>
                    )}

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-mist-muted">Disbursement M-Pesa Phone Number</label>
                      <input
                        type="text"
                        value={applyPhoneNumber}
                        onChange={(e) => setApplyPhoneNumber(e.target.value)}
                        placeholder="e.g. 0712345678"
                        className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 px-4 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
                      />
                    </div>
                  </>
                )}

                {stepKeys[step] === "guarantors" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-mist-muted">
                        Guarantors <span className="font-normal text-slate-400">(min. {minGuarantors} required)</span>
                      </label>
                      <span className={`text-[10px] font-bold ${selectedGuarantors.length < minGuarantors ? "text-rose-600" : "text-emerald-600"}`}>
                        {selectedGuarantors.length} selected
                      </span>
                    </div>
                    <div className="max-h-96 overflow-y-auto rounded-2xl border border-slate-200 dark:border-obsidian-border divide-y divide-slate-100 dark:divide-obsidian-border">
                      {chamaMembers
                        .filter((m) => String(m._id) !== String(workspaceCtx?.membership?._id) && (!m.status || m.status === "active"))
                        .map((m) => {
                          const picked = selectedGuarantors.find((g) => g.membership_id === m._id);
                          return (
                            <label key={m._id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-obsidian-raised/50">
                              <input
                                type="checkbox"
                                checked={!!picked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedGuarantors((prev) => [...prev, { membership_id: m._id, guaranteed_amount: "" }]);
                                  } else {
                                    setSelectedGuarantors((prev) => prev.filter((g) => g.membership_id !== m._id));
                                  }
                                }}
                                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="flex-1 text-xs font-semibold text-slate-800 dark:text-mist">
                                {m.user_id?.name || m.name || "Member"}
                                <span className="ml-1 font-normal text-slate-400">· {m.role}</span>
                              </span>
                              {picked && (
                                <input
                                  type="number"
                                  min="1"
                                  placeholder="Amount"
                                  value={picked.guaranteed_amount}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedGuarantors((prev) => prev.map((g) => (g.membership_id === m._id ? { ...g, guaranteed_amount: val } : g)));
                                  }}
                                  className="w-24 rounded-xl border border-slate-200 bg-white py-1.5 px-2 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-obsidian-border dark:bg-obsidian dark:text-mist"
                                />
                              )}
                            </label>
                          );
                        })}
                      {chamaMembers.length === 0 && <p className="px-3 py-3 text-xs text-slate-500">No other members available to guarantee this loan.</p>}
                    </div>
                    <p className="text-[10px] text-slate-400">Each guarantor is notified and must accept before this loan can enter the approval queue.</p>
                  </div>
                )}

                {stepKeys[step] === "review" && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-obsidian-border dark:bg-obsidian space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Automated Eligibility Pre-Check</span>
                        {checkingEligibility ? (
                          <Loader2 size={14} className="animate-spin text-indigo-600" />
                        ) : eligibilityData?.eligible ? (
                          <span className="inline-flex items-center gap-1 font-extrabold text-xs text-emerald-600"><CheckCircle2 size={14} /> ELIGIBLE</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-extrabold text-xs text-rose-600"><AlertCircle size={14} /> INELIGIBLE</span>
                        )}
                      </div>
                      {eligibilityData && (
                        <div className="text-xs space-y-1 font-medium text-slate-600 dark:text-mist-muted">
                          <p>Max Loan Limit: <strong className="font-mono text-slate-900 dark:text-mist">{money(eligibilityData.loanLimit)}</strong></p>
                          {!eligibilityData.eligible && <p className="text-rose-600 font-semibold">{eligibilityData.reason}</p>}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-obsidian-border divide-y divide-slate-100 dark:divide-obsidian-border text-xs">
                      <ReviewRow label="Product" value={selectedProductMeta?.name} />
                      <ReviewRow label="Amount" value={money(applyAmount)} />
                      <ReviewRow label="Purpose" value={applyPurpose} />
                      <ReviewRow label="Term" value={loanType === "emergency" ? "1 month" : `${applyPeriod} month(s), ${applyFrequency}`} />
                      {needsGuarantorStep && <ReviewRow label="Guarantors" value={`${selectedGuarantors.length} selected`} />}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2.5 border-t border-slate-100 p-5 dark:border-obsidian-border">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s - 1)}
                    className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist-muted"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                ) : (
                  <span />
                )}

                {step < stepKeys.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s + 1)}
                    className="flex items-center gap-1.5 rounded-2xl bg-slate-900 px-5 py-2.5 text-xs font-black text-white hover:bg-slate-800 dark:bg-obsidian-raised"
                  >
                    Next <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={applying || (eligibilityData && !eligibilityData.eligible)}
                    className="rounded-2xl bg-emerald-500 px-5 py-2.5 text-xs font-black text-slate-950 shadow-xl hover:bg-emerald-400 transition disabled:opacity-50"
                  >
                    {applying ? "Submitting..." : "Submit Application"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Repay Modal */}
      {repayLoanId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-obsidian-border dark:bg-obsidian-card">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-obsidian-border">
              <h3 className="text-base font-black text-slate-900 dark:text-mist">Repay via M-Pesa</h3>
              <button onClick={closeRepay} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-obsidian-raised">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRepaySubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-mist-muted">Amount (KES)</label>
                <input
                  type="number"
                  min="1"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 px-4 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-mist-muted">M-Pesa Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. 0712345678"
                  value={repayPhone}
                  onChange={(e) => setRepayPhone(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 px-4 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist"
                />
              </div>
              <button
                type="submit"
                disabled={repaying}
                className="w-full rounded-2xl bg-emerald-500 px-5 py-2.5 text-xs font-black text-slate-950 shadow-xl hover:bg-emerald-400 transition disabled:opacity-50"
              >
                {repaying ? "Sending STK push…" : "Send M-Pesa prompt"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCell({ icon: Icon, label, value, subtitle, tone = "slate" }) {
  const toneClass = tone === "amber" ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-mist";
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <Icon size={16} className="text-slate-300 dark:text-mist-muted" />
      </div>
      <p className={`text-xl font-black font-mono ${toneClass}`}>{value}</p>
      {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold text-slate-900 dark:text-mist">{value}</span>
    </div>
  );
}