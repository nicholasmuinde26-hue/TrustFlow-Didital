import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  Lock,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

import useWorkspace from "@/app/hooks/useWorkspace";
import loansApi from "@/modules/loans/api/loans.api";
import loanService from "@/modules/loans/services/loan.service";
import {
  canDisburseLoan,
  isLoanOfficial,
} from "@/modules/workspaces/permissions/Permissions";

import {
  EmptyState,
  MetricCard,
  Notice,
  RoleLocked,
  SectionCard,
  money,
} from "../components/DeskUI";

// ========================================
// LOANS TAB
// ========================================
//
// The full approve → disburse pipeline from the old Command Center,
// with the things it got wrong fixed rather than carried over:
//
// First, the role checks route through Permissions.js instead of
// inlining `["chairperson","treasurer","secretary"].includes(role)` —
// the old page's `official` flag quietly disagreed with the backend's
// LOAN_OFFICIAL_ROLES (which also includes auditor and committee
// member, and matters for recusal quorum).
//
// Second, this no longer calls chamaApi.approveLoan/disburseLoan.
// approveLoan posted to /chamas/:id/loans/:id/approve, which nothing
// on the backend mounts — every "Approve" click here was a silent
// 404. The real decision endpoint is loansApi.decide(), which posts
// to /decision with the reviewer's decision, a comment, and the
// loan's version token (optimistic-concurrency, so two officials
// can't race each other's review). disburseLoan happened to match
// loansApi.disburse()'s route, but routing both actions through
// loanService keeps this tab on the one API surface the rest of the
// loans module already trusts, instead of a second copy that can
// drift again.
//
// Third, this reads from GET /loans/portfolio (loansApi.portfolio)
// rather than the command-center summary the desk loads for every
// tab. The command-center payload only ever carried amount/status/
// purpose — enough for a badge, not enough to actually review a
// loan. The portfolio is the officials-only endpoint the standalone
// Loans page itself reviews from: per-loan approvals already cast,
// guarantor confirmations, conflict-of-interest recusal + quorum,
// and disbursement/failure detail. It's fetched here, separately
// from the desk's shared `data`, and only for officials — plain
// members would just get a 403 from it.
//
// Fourth, disbursement asks for the PIN again. That prompt is raised
// by the API layer off the server's LEADERSHIP_STEP_UP_REQUIRED
// response, so there's no confirmation logic here to get out of step
// with the backend's rules.
//
// ========================================

const STATUS_STYLES = {
  approved:
    "border-teal-300 bg-teal-100 text-teal-800 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-400",
  pending_approval:
    "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400",
  pending_guarantee:
    "border-yellow-300 bg-yellow-100 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-400",
  disbursement_pending:
    "border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-400",
  disbursed:
    "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-400",
  active:
    "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-400",
  partially_repaid:
    "border-indigo-300 bg-indigo-100 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-400",
  overdue:
    "border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-400",
  defaulted:
    "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400",
  rejected:
    "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400",
  closed:
    "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  recovered:
    "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400",
};

const PENDING_APPROVAL_STATUSES = ["pending_approval", "submitted", "pending", "draft"];
const DISBURSED_STATUSES = [
  "disbursed",
  "active",
  "partially_repaid",
  "overdue",
  "defaulted",
  "recovered",
  "closed",
];

function StatusBadge({ status }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide ${
        STATUS_STYLES[status] ||
        "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
      }`}
    >
      {(status || "unknown").replace(/_/g, " ")}
    </span>
  );
}

function borrowerName(loan) {
  return loan.member_name || loan.membership_id?.user_id?.name || "Chama member";
}

export default function LoansTab({ workspaceId, role, type, reload }) {
  const { membership } = useWorkspace();

  const mayReview = isLoanOfficial(role, type);
  const mayDisburse = canDisburseLoan(role, type);

  const [portfolio, setPortfolio] = useState(null);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [busyLoanId, setBusyLoanId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Manual (cash/bank/cheque) disbursement confirmation modal.
  const [confirmManualLoan, setConfirmManualLoan] = useState(null);
  const [manualMethod, setManualMethod] = useState("cash");
  const [manualReference, setManualReference] = useState("");
  const [confirmingManual, setConfirmingManual] = useState(false);

  const loadPortfolio = useCallback(async () => {
    if (!workspaceId || !mayReview) return;
    setLoadingPortfolio(true);
    setLoadError(null);
    try {
      const response = await loansApi.portfolio(workspaceId);
      setPortfolio(response.data.data);
    } catch (error) {
      setLoadError(
        error?.response?.data?.message || "Could not load the loan portfolio."
      );
    } finally {
      setLoadingPortfolio(false);
    }
  }, [workspaceId, mayReview]);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  const loans = portfolio?.loans || [];
  const summary = portfolio?.summary || {};
  const repaymentRate = summary.repayment_rate_percent;

  const pendingApprovalLoans = loans.filter((loan) =>
    PENDING_APPROVAL_STATUSES.includes(loan.status)
  );
  const approvedLoans = loans.filter((loan) => loan.status === "approved");
  const disbursementPendingLoans = loans.filter(
    (loan) => loan.status === "disbursement_pending"
  );
  const disburserQueue = [...disbursementPendingLoans, ...approvedLoans];
  const rejectedLoans = loans.filter((loan) => loan.status === "rejected");
  const disbursedLoans = loans.filter((loan) => DISBURSED_STATUSES.includes(loan.status));

  // Refresh both this tab's own richer data and the desk's shared
  // summary (Overview's counts are derived from the latter).
  const refreshAfterAction = () => {
    loadPortfolio();
    reload?.();
  };

  const run = async (loanId, action, successText) => {
    setBusyLoanId(loanId);
    setFeedback(null);

    try {
      await action();
      setFeedback({ tone: "success", text: successText });
      refreshAfterAction();
    } catch (error) {
      // Dismissing the PIN prompt is a deliberate choice — don't shout
      // about it as though something broke.
      if (error?.leadershipCancelled) return;
      setFeedback({
        tone: "error",
        text: error?.response?.data?.message || "That action didn't complete.",
      });
    } finally {
      setBusyLoanId(null);
    }
  };

  const handleDecision = (loan, decision) => {
    run(
      loan._id,
      () =>
        loanService.decide(
          workspaceId,
          loan._id,
          decision,
          "Decision recorded from the Leadership Desk.",
          loan.updatedAt?.toString()
        ),
      decision === "approved" ? "Loan approved." : "Loan rejected."
    );
  };

  const handleDisburse = (loan) => {
    run(
      loan._id,
      () => loanService.initiateDisbursement(workspaceId, loan._id),
      "Disbursement initiated via M-Pesa."
    );
  };

  const handleManualSubmit = async (event) => {
    event.preventDefault();
    if (!confirmManualLoan) return;

    setConfirmingManual(true);
    setFeedback(null);
    try {
      await loanService.confirmDisbursement(workspaceId, confirmManualLoan._id, {
        disbursementMethod: manualMethod,
        externalReference:
          manualReference.trim() || `MANUAL-${manualMethod.toUpperCase()}-${Date.now()}`,
      });
      setFeedback({
        tone: "success",
        text: `Disbursement for ${confirmManualLoan.reference || "that loan"} confirmed.`,
      });
      setConfirmManualLoan(null);
      setManualReference("");
      setManualMethod("cash");
      refreshAfterAction();
    } catch (error) {
      if (error?.leadershipCancelled) return;
      setFeedback({
        tone: "error",
        text: error?.response?.data?.message || "Disbursement confirmation failed.",
      });
    } finally {
      setConfirmingManual(false);
    }
  };

  return (
    <div className="space-y-6">
      {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
      {loadError && <Notice tone="error">{loadError}</Notice>}

      {!mayReview && (
        <RoleLocked>
          Loan review is limited to Chama officials — chairperson, treasurer,
          secretary, auditor and committee members.
        </RoleLocked>
      )}

      {mayReview && portfolio && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Active loan book"
            value={money(summary.total_outstanding)}
            icon={CreditCard}
            subtitle={`${summary.loan_count || 0} loan(s) total`}
          />
          <MetricCard
            title="Awaiting a decision"
            value={pendingApprovalLoans.length + approvedLoans.length + disbursementPendingLoans.length}
            icon={Clock3}
            subtitle="Applications & disbursements"
          />
          <MetricCard
            title="Repayment rate"
            value={typeof repaymentRate === "number" ? `${repaymentRate}%` : "—"}
            icon={ShieldCheck}
            subtitle={summary.all_loans_current ? "All loans current" : "Some loans overdue"}
          />
          <MetricCard
            title="Overdue / defaulted"
            value={money((summary.overdue || 0) + (summary.defaulted || 0))}
            icon={AlertCircle}
            subtitle={`Interest earned: ${money(summary.interest_earned)}`}
          />
        </div>
      )}

      <SectionCard
        icon={ShieldCheck}
        title="Official approval & conflict-of-interest recusal queue"
        description="Approvals need official consensus. An applicant who is also an official is recused from their own application."
        action={
          <Link
            to={`/workspace/${workspaceId}/loans`}
            className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
          >
            Full loan book
          </Link>
        }
      >
        {!mayReview ? null : loadingPortfolio && !portfolio ? (
          <div className="flex items-center justify-center gap-2.5 py-8 text-sm font-semibold text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
            Loading the loan portfolio…
          </div>
        ) : pendingApprovalLoans.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Nothing waiting on a decision"
            detail="Applications appear here once their guarantor(s) have accepted."
          />
        ) : (
          <ul className="space-y-3">
            {pendingApprovalLoans.map((loan) => {
              const busy = busyLoanId === loan._id;
              const applicantId = loan.membership_id?._id || loan.membership_id;
              const isApplicant = String(applicantId) === String(membership?._id);
              const myDecision = (loan.approvals || []).find(
                (a) => String(a.membership_id?._id || a.membership_id) === String(membership?._id)
              );

              const quorumRequired = loan.recusal_quorum_required || 0;
              const quorumFillers =
                quorumRequired > 0
                  ? new Set(
                      (loan.approvals || [])
                        .filter(
                          (a) =>
                            a.decision === "approved" &&
                            !(loan.required_approval_roles || []).includes(a.role)
                        )
                        .map((a) => String(a.membership_id))
                    ).size
                  : 0;

              const guarantors = loan.guarantors || [];
              const guarantorsConfirmed = guarantors.filter((g) => g.status === "accepted").length;

              return (
                <li
                  key={loan._id}
                  className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono text-[10px] font-bold text-slate-400">
                          {loan.reference || loan._id}
                        </span>
                        {isApplicant && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/40 bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <Lock size={10} /> Conflict of interest: recused
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">
                        {borrowerName(loan)}
                      </p>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {loan.purpose || "No stated purpose"}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-black text-slate-900 dark:text-white">
                        {money(loan.amount)}
                      </span>
                      {loan.repayment_period_months && (
                        <p className="text-[11px] text-slate-500">
                          {loan.repayment_period_months} month term
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <StatusBadge status={loan.status} />
                    <span>
                      Guarantors:{" "}
                      {guarantors.length ? `${guarantorsConfirmed}/${guarantors.length} confirmed` : "none required"}
                    </span>
                  </div>

                  {loan.conflict_of_interest && (
                    <div className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                      <Lock size={12} />
                      {(loan.recused_roles || []).join(", ") || "Officer"} recused —{" "}
                      {quorumFillers}/{quorumRequired} independent approvals collected
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    {isApplicant ? (
                      <span className="text-xs font-bold italic text-amber-600 dark:text-amber-400">
                        Recused: you cannot decide on your own application.
                      </span>
                    ) : myDecision ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold italic text-slate-500 dark:text-slate-400">
                        <CheckCircle2
                          size={13}
                          className={myDecision.decision === "approved" ? "text-emerald-500" : "text-rose-500"}
                        />
                        You already {myDecision.decision === "approved" ? "approved" : "rejected"} this loan
                        {myDecision.decision === "approved" ? " — awaiting other required approver(s)." : "."}
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDecision(loan, "rejected")}
                          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDecision(loan, "approved")}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                          Approve
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {mayDisburse && (
        <SectionCard
          icon={Building2}
          title="Disburser queue"
          description="Disbursement is the Treasurer's act, or the Chairperson's when the Treasurer is themself the applicant. This moves real money out of the group account, so it asks for your Leadership PIN again."
        >
          {loadingPortfolio && !portfolio ? (
            <div className="flex items-center justify-center gap-2.5 py-8 text-sm font-semibold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              Loading the loan portfolio…
            </div>
          ) : disburserQueue.length === 0 ? (
            <EmptyState
              icon={Send}
              title="Nothing waiting on you"
              detail="Approved loans appear here once they're ready to be paid out."
            />
          ) : (
            <ul className="space-y-3">
              {disburserQueue.map((loan) => {
                const busy = busyLoanId === loan._id;
                const applicantId = loan.membership_id?._id || loan.membership_id;
                const isApplicant = String(applicantId) === String(membership?._id);
                const borrowerRole = loan.membership_id?.role;
                const isProcessing = loan.status === "disbursement_pending";
                const lastAttemptFailed = !isProcessing && loan.disbursement?.status === "failed";
                // Mirrors assertAuthorizedDisburser() on the backend, which
                // is the source of truth: Treasurer disburses normally, and
                // the Chairperson is only the authorized fallback when the
                // Treasurer themself is the recused applicant.
                const canDisburseThisLoan =
                  !isApplicant && (role === "treasurer" || (role === "chairperson" && borrowerRole === "treasurer"));

                return (
                  <li
                    key={loan._id}
                    className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <span className="font-mono text-[10px] font-bold text-slate-400">
                          {loan.reference || loan._id}
                        </span>
                        <p className="text-sm font-black text-slate-900 dark:text-white">
                          {borrowerName(loan)}
                        </p>
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Amount: <strong className="text-emerald-600 dark:text-emerald-400">{money(loan.amount)}</strong>
                          {" • "}Method: {loan.disbursement_method || "mpesa"}
                        </p>
                      </div>

                      {isProcessing ? (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-violet-600 dark:text-violet-400">
                          <Loader2 size={14} className="animate-spin" /> Processing disbursement…
                        </span>
                      ) : isApplicant ? (
                        <span className="text-xs font-bold italic text-amber-600 dark:text-amber-400">
                          Recused: you cannot disburse your own loan.
                        </span>
                      ) : canDisburseThisLoan ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleDisburse(loan)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-sky-500 disabled:opacity-50"
                          >
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            Disburse via M-Pesa
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setConfirmManualLoan(loan)}
                            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Confirm cash/bank
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-bold italic text-slate-500 dark:text-slate-400">
                          Treasurer only — {borrowerRole === "treasurer" ? "Chairperson may disburse instead" : "not disbursable by your role"}.
                        </span>
                      )}
                    </div>

                    {lastAttemptFailed && (
                      <div className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
                        <AlertCircle size={12} />
                        Last attempt failed: {loan.disbursement?.failure_reason || "Unknown error"}. You can retry above.
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      )}

      {mayReview && rejectedLoans.length > 0 && (
        <SectionCard
          icon={XCircle}
          title="Rejected loans"
          description="Read-only — no further action is possible on a rejected application."
        >
          <ul className="space-y-2.5">
            {rejectedLoans.map((loan) => {
              const rejector = (loan.approvals || []).find((a) => a.decision === "rejected");
              return (
                <li
                  key={loan._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200/60 bg-rose-50/40 p-4 dark:border-rose-900/40 dark:bg-rose-950/10"
                >
                  <div>
                    <span className="font-mono text-[10px] font-bold text-slate-400">
                      {loan.reference || loan._id}
                    </span>
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                      {borrowerName(loan)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {money(loan.amount)}
                      {rejector && ` • Rejected by ${rejector.role}`}
                      {loan.rejected_at && ` on ${new Date(loan.rejected_at).toLocaleDateString()}`}
                    </p>
                    {loan.rejection_reason && (
                      <p className="mt-1 text-xs italic text-rose-700 dark:text-rose-300">
                        “{loan.rejection_reason}”
                      </p>
                    )}
                  </div>
                  <StatusBadge status={loan.status} />
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}

      {mayReview && disbursedLoans.length > 0 && (
        <SectionCard
          icon={CheckCircle2}
          title="Disbursement history"
          description="Loans that have been paid out, and everything since — repaying, overdue, or closed."
        >
          <ul className="space-y-2.5">
            {disbursedLoans.slice(0, 5).map((loan) => (
              <li
                key={loan._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200/60 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/10"
              >
                <div>
                  <span className="font-mono text-[10px] font-bold text-slate-400">
                    {loan.reference || loan._id}
                  </span>
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {borrowerName(loan)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Disbursed: <strong className="text-emerald-600 dark:text-emerald-400">{money(loan.amount)}</strong> via{" "}
                    {loan.disbursement?.provider || loan.disbursement_method || "mpesa"}
                    {loan.disbursement?.disbursed_at &&
                      ` on ${new Date(loan.disbursement.disbursed_at).toLocaleDateString()}`}
                  </p>
                  <p className="text-[11px] text-slate-400">Outstanding: {money(loan.outstanding)}</p>
                </div>
                <StatusBadge status={loan.status} />
              </li>
            ))}
          </ul>
          {disbursedLoans.length > 5 && (
            <p className="text-center text-[11px] text-slate-400">
              +{disbursedLoans.length - 5} more in the{" "}
              <Link to={`/workspace/${workspaceId}/loans`} className="font-bold text-emerald-700 dark:text-emerald-400">
                full loan book
              </Link>
              .
            </p>
          )}
        </SectionCard>
      )}

      {/* Confirm manual (cash/bank/cheque) disbursement */}
      {confirmManualLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Confirm disbursement
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {confirmManualLoan.reference || "Loan disbursement"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmManualLoan(null)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className="space-y-1.5 rounded-2xl border border-slate-200/60 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-800/50">
              <div className="flex justify-between">
                <span className="text-slate-500">Borrower:</span>
                <b className="text-slate-900 dark:text-white">{borrowerName(confirmManualLoan)}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount:</span>
                <b className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {money(confirmManualLoan.amount)}
                </b>
              </div>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Disbursement method *</label>
                <select
                  value={manualMethod}
                  onChange={(event) => setManualMethod(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="cash">Cash settlement</option>
                  <option value="bank">Bank transfer (EFT / RTGS)</option>
                  <option value="cheque">Cheque</option>
                  <option value="mpesa">Manual M-Pesa offline</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Transaction reference / receipt</label>
                <input
                  type="text"
                  placeholder="e.g. CHQ-89021, TXN-998822"
                  value={manualReference}
                  onChange={(event) => setManualReference(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs font-medium text-slate-900 outline-none focus:border-emerald-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmManualLoan(null)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={confirmingManual}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 font-black text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  {confirmingManual ? "Confirming…" : "Confirm & post"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}