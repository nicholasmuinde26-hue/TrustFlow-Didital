import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  TrendingUp,
  ChevronRight,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  Building2,
  AlertCircle,
} from "lucide-react";
import useWorkspace from "@/app/hooks/useWorkspace";
import loanService from "../services/loan.service";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

export default function LoansPage() {
  const { workspaceId: paramId } = useParams();
  const workspaceCtx = useWorkspace();
  const workspaceId = paramId || workspaceCtx?.workspaceId;
  const userRole = workspaceCtx?.activeWorkspace?.role || "member";

  const [activeSubTab, setActiveSubTab] = useState("overview"); // 'overview' | 'apply' | 'approval'

  const [summary, setSummary] = useState(null);
  const [loans, setLoans] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState({ text: "", isError: false });

  const loadData = () => {
    if (!workspaceId) return;
    setLoading(true);
    loanService
      .getDashboard(workspaceId)
      .then((res) => {
        setSummary(res?.summary || null);
        setLoans(res?.loans || []);
        setPortfolio(res?.portfolio || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  // Unified list of all loans (combining member loans + official portfolio loans)
  const allLoans = portfolio?.loans?.length ? portfolio.loans : loans;

  // Dynamic metrics from backend
  const totalPortfolio = summary?.total_portfolio ?? portfolio?.summary?.total_disbursed ?? 0;
  const totalDisbursed = summary?.total_disbursed ?? 0;
  const outstandingBalance = summary?.outstanding_total ?? summary?.active_loan?.balance ?? 0;
  const activeLoansCount = allLoans.filter((l) => l.status === "active" || l.status === "disbursed").length;

  // Pending approval loans (waiting for dual approval)
  const pendingApprovalLoans = allLoans.filter(
    (l) => l.status === "pending_approval" || l.status === "submitted" || l.status === "pending" || l.status === "draft"
  );
  const pendingApprovalCount = pendingApprovalLoans.length;

  const recentApplications = pendingApprovalLoans.slice(0, 5);

  // Top Borrowers dynamic compute
  const topBorrowers = [...allLoans]
    .sort((a, b) => Number(b.amount || b.principal || 0) - Number(a.amount || a.principal || 0))
    .slice(0, 5)
    .map((l) => ({
      name: l.member_name || l.user_id?.name || "Borrower",
      amount: Number(l.amount || l.principal || 0),
    }));

  const maxBorrowerAmount = topBorrowers.length > 0 ? topBorrowers[0].amount : 1;

  // Apply Loan Form State
  const [applyAmount, setApplyAmount] = useState(10000);
  const [applyPurpose, setApplyPurpose] = useState("Business Expansion");
  const [applyPeriod, setApplyPeriod] = useState("6");
  const [applyFrequency, setApplyFrequency] = useState("monthly");
  const [applyPhoneNumber, setApplyPhoneNumber] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [applySuccess, setApplySuccess] = useState("");

  const currentDateStr = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  async function handleApplySubmit(e) {
    e.preventDefault();
    setApplyError("");
    setApplySuccess("");

    if (!applyAmount || applyAmount < 100) {
      setApplyError("Please enter a valid loan amount (min KES 100).");
      return;
    }

    setApplying(true);
    try {
      await loanService.apply(workspaceId, {
        amount: Number(applyAmount),
        purpose: applyPurpose,
        repayment_period_months: Number(applyPeriod),
        repayment_frequency: applyFrequency,
        disbursement_method: "mpesa",
        phone_number: applyPhoneNumber || undefined,
      });

      setApplySuccess("Loan application submitted successfully! It is now pending dual approval by both Chairperson and Treasurer.");
      loadData();
      setTimeout(() => {
        setActiveSubTab("approval");
        setApplySuccess("");
      }, 1800);
    } catch (err) {
      setApplyError(err?.response?.data?.message || "Could not submit loan application.");
    } finally {
      setApplying(false);
    }
  }

  async function handleApprovalDecision(loanId, decision, roleLabel) {
    setActionMessage({ text: "", isError: false });
    try {
      await loanService.decide(workspaceId, loanId, decision, `Decision by ${roleLabel}`);
      setActionMessage({
        text: `Loan decision recorded (${decision === "approved" ? "Approved" : "Rejected"}) by ${roleLabel}.`,
        isError: false,
      });
      loadData();
    } catch (err) {
      setActionMessage({
        text: err?.response?.data?.message || "Action failed.",
        isError: true,
      });
    }
  }

  async function handleDisburseLoan(loanId) {
    setActionMessage({ text: "", isError: false });
    try {
      await loanService.initiateDisbursement(workspaceId, loanId);
      setActionMessage({ text: "Disbursement initiated successfully!", isError: false });
      loadData();
    } catch (err) {
      setActionMessage({
        text: err?.response?.data?.message || "Disbursement failed.",
        isError: true,
      });
    }
  }

  // Helper to check role approval status for a loan
  const hasRoleApproved = (loan, roleName) => {
    return (loan?.approvals || []).some(
      (a) => a.role?.toLowerCase() === roleName.toLowerCase() && a.decision === "approved"
    );
  };

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 pb-12">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Loans Overview
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Manage loans, applications, dual approvals & repayments
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Switcher Tabs */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <button
              onClick={() => setActiveSubTab("overview")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                activeSubTab === "overview"
                  ? "bg-violet-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveSubTab("apply")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                activeSubTab === "apply"
                  ? "bg-violet-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              Apply Loan
            </button>
            <button
              onClick={() => setActiveSubTab("approval")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                activeSubTab === "approval"
                  ? "bg-violet-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              Approvals ({pendingApprovalCount})
            </button>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            <Calendar size={14} className="text-slate-400" />
            <span>{currentDateStr}</span>
          </div>
        </div>
      </div>

      {actionMessage.text && (
        <div
          className={`flex items-center justify-between rounded-2xl p-4 text-xs font-bold ${
            actionMessage.isError
              ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900"
              : "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
          }`}
        >
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage({ text: "", isError: false })} className="text-xs font-black">
            ✕
          </button>
        </div>
      )}

      {activeSubTab === "overview" && (
        <div className="space-y-6">
          {/* Metric Cards Row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">TOTAL LOAN PORTFOLIO</span>
              <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{money(totalPortfolio)}</p>
              <div className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <TrendingUp size={14} /><span>Total Credit Pool</span>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">TOTAL DISBURSED</span>
              <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{money(totalDisbursed)}</p>
              <div className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <TrendingUp size={14} /><span>Active + Repaid</span>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">OUTSTANDING BALANCE</span>
              <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{money(outstandingBalance)}</p>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">ACTIVE LOANS</span>
              <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{activeLoansCount}</p>
              <div className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-600"><span>Borrowers</span></div>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">PENDING APPROVAL</span>
              <p className="mt-2 text-2xl font-black text-amber-500">{pendingApprovalCount}</p>
              <span className="mt-2 text-xs font-bold text-amber-600 block">Requires dual approval</span>
            </div>
          </div>

          {/* Analytics & Lower Grid Row */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-6 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Pending Dual Approvals</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl bg-amber-50/60 p-4 dark:bg-amber-950/30">
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Loan applications awaiting decision</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Chairperson & Treasurer approvals required</p>
                    </div>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-xs font-black text-amber-800">
                      {pendingApprovalCount}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-right">
                <button
                  onClick={() => setActiveSubTab("approval")}
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                >
                  Go to Approvals Queue <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <div className="lg:col-span-6 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Top Borrowers</h2>
                <div className="space-y-3">
                  {topBorrowers.length > 0 ? (
                    topBorrowers.map((b) => (
                      <div key={b.name} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-900 dark:text-white">{b.name}</span>
                          <span className="font-mono text-indigo-600 dark:text-indigo-400">{money(b.amount)}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 rounded-full"
                            style={{ width: `${Math.round((b.amount / maxBorrowerAmount) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-6">No active borrowers recorded yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* APPLY FOR A LOAN VIEW */}
      {activeSubTab === "apply" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-6">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Apply for a Loan</h2>
              <p className="text-xs text-slate-500 mt-1">
                Loans require dual approval by both the Chama Chairperson and Treasurer.
              </p>
            </div>

            <form onSubmit={handleApplySubmit} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Loan Amount (KES)</label>
                <input
                  type="number"
                  value={applyAmount}
                  onChange={(e) => setApplyAmount(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-bold text-slate-900 focus:border-violet-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">Loan Purpose</label>
                <select
                  value={applyPurpose}
                  onChange={(e) => setApplyPurpose(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 px-4 text-xs font-bold text-slate-900 focus:border-violet-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                >
                  <option value="Business Expansion">Business Expansion</option>
                  <option value="School Fees">School Fees</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Agriculture & Farming">Agriculture & Farming</option>
                  <option value="Medical Expenses">Medical Expenses</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Repayment Term</label>
                  <select
                    value={applyPeriod}
                    onChange={(e) => setApplyPeriod(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 px-4 text-xs font-bold text-slate-900 focus:border-violet-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="1">1 Month</option>
                    <option value="3">3 Months</option>
                    <option value="6">6 Months</option>
                    <option value="12">12 Months</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">Frequency</label>
                  <select
                    value={applyFrequency}
                    onChange={(e) => setApplyFrequency(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 px-4 text-xs font-bold text-slate-900 focus:border-violet-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">M-Pesa Phone Number (For Disbursement)</label>
                <input
                  type="text"
                  placeholder="e.g. 0712345678"
                  value={applyPhoneNumber}
                  onChange={(e) => setApplyPhoneNumber(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 px-4 text-xs font-medium text-slate-900 focus:border-violet-600 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="rounded-2xl bg-violet-50 p-4 border border-violet-100 dark:bg-violet-950/40 dark:border-violet-900">
                <span className="text-[11px] text-violet-600 font-bold uppercase">Estimated Monthly Installment</span>
                <p className="text-xl font-black text-violet-700 dark:text-violet-300 font-mono mt-1">
                  {money(Math.round((Number(applyAmount) || 0) / Number(applyPeriod || 1)))}
                </p>
                <span className="text-[10px] text-violet-500 font-medium">Subject to policy interest & term rules</span>
              </div>

              {applyError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400">
                  {applyError}
                </div>
              )}

              {applySuccess && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {applySuccess}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveSubTab("overview")}
                  className="rounded-2xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={applying}
                  className="rounded-2xl bg-violet-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-violet-700 disabled:opacity-50"
                >
                  {applying ? "Submitting..." : "Submit Application →"}
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-6">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Your Loan Limit</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1">
                {money(summary?.loan_limit || 50000)}
              </p>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Required Approvals</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">Chairperson & Treasurer</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Disbursement</span>
                <span className="font-bold text-slate-900 dark:text-white">Direct M-Pesa / Bank</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LOAN APPROVAL QUEUE VIEW (DUAL APPROVAL TRACKER) */}
      {activeSubTab === "approval" && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => setActiveSubTab("overview")}
                className="text-xs font-bold text-indigo-600 mb-1 flex items-center gap-1"
              >
                ← Back to Overview
              </button>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                Loans Approval Queue
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Every loan application requires dual verification and approval by both Chairperson and Treasurer.
              </p>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-800">
              {pendingApprovalCount} Pending Approval
            </span>
          </div>

          <div className="space-y-4">
            {allLoans.length > 0 ? (
              allLoans.map((app) => {
                const chairApproved = hasRoleApproved(app, "chairperson");
                const treasurerApproved = hasRoleApproved(app, "treasurer");
                const isFullyApproved = app.status === "approved" || (chairApproved && treasurerApproved);
                const isRejected = app.status === "rejected";

                return (
                  <div
                    key={app._id || app.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/40 space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-slate-900 dark:text-white">
                            {app.member_name || "Applicant"}
                          </span>
                          <span className="text-xs font-mono text-slate-400">({app.reference || "LN-REF"})</span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono mt-1">
                          Amount: <strong className="text-slate-900 dark:text-white font-bold">{money(app.amount || app.principal)}</strong> · Purpose: {app.purpose || "General"} · Term: {app.repayment_period_months || 1} months
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {isFullyApproved && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <CheckCircle2 size={14} /> Fully Approved
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-extrabold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                            <XCircle size={14} /> Rejected
                          </span>
                        )}
                        {!isFullyApproved && !isRejected && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <Clock size={14} /> Pending Dual Approval
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dual Approval Status Grid */}
                    <div className="grid gap-3 sm:grid-cols-2 rounded-2xl bg-white p-4 border border-slate-200/80 dark:border-slate-800 dark:bg-slate-900 text-xs font-semibold">
                      {/* Chairperson Approval Box */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950">
                        <div className="flex items-center gap-2">
                          <ShieldCheck size={16} className={chairApproved ? "text-emerald-600" : "text-amber-500"} />
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">1. Chairperson Approval</p>
                            <span className={`text-[11px] font-medium ${chairApproved ? "text-emerald-600" : "text-amber-600"}`}>
                              {chairApproved ? "Approved & Verified" : "Awaiting Chairperson Decision"}
                            </span>
                          </div>
                        </div>
                        {chairApproved ? (
                          <CheckCircle2 size={18} className="text-emerald-600" />
                        ) : (
                          <Clock size={18} className="text-amber-500" />
                        )}
                      </div>

                      {/* Treasurer Approval Box */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950">
                        <div className="flex items-center gap-2">
                          <ShieldCheck size={16} className={treasurerApproved ? "text-emerald-600" : "text-amber-500"} />
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">2. Treasurer Approval</p>
                            <span className={`text-[11px] font-medium ${treasurerApproved ? "text-emerald-600" : "text-amber-600"}`}>
                              {treasurerApproved ? "Approved & Verified" : "Awaiting Treasurer Decision"}
                            </span>
                          </div>
                        </div>
                        {treasurerApproved ? (
                          <CheckCircle2 size={18} className="text-emerald-600" />
                        ) : (
                          <Clock size={18} className="text-amber-500" />
                        )}
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    {!isRejected && (
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                        {/* Chairperson Action */}
                        {!chairApproved && !isFullyApproved && (
                          <button
                            onClick={() => handleApprovalDecision(app._id || app.id, "approved", "Chairperson")}
                            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition"
                          >
                            Approve as Chairperson
                          </button>
                        )}

                        {/* Treasurer Action */}
                        {!treasurerApproved && !isFullyApproved && (
                          <button
                            onClick={() => handleApprovalDecision(app._id || app.id, "approved", "Treasurer")}
                            className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-violet-700 transition"
                          >
                            Approve as Treasurer
                          </button>
                        )}

                        {/* Reject Action */}
                        {!isFullyApproved && (
                          <button
                            onClick={() => handleApprovalDecision(app._id || app.id, "rejected", userRole)}
                            className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-900 dark:hover:bg-rose-950 transition"
                          >
                            Reject Loan
                          </button>
                        )}

                        {/* Disburse Action (when fully approved) */}
                        {isFullyApproved && app.status !== "disbursed" && app.status !== "active" && (
                          <button
                            onClick={() => handleDisburseLoan(app._id || app.id)}
                            className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                          >
                            Disburse Loan via M-Pesa
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-400 text-center py-12">
                No loan applications currently pending approval.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
