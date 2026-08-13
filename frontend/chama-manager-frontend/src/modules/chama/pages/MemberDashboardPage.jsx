
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import chamaApi from "../api/chama.api";
import loansApi from "@/modules/loans/api/loans.api";

/* ============================================================================
 * CONFIGURATION
 * ========================================================================== */

const MEMBER_DASHBOARD_CONFIG = {
  currency:
    import.meta.env.VITE_DEFAULT_CURRENCY || "KES",

  memberIdDisplayLength: Number(
    import.meta.env.VITE_MEMBER_ID_DISPLAY_LENGTH || 8
  ),

  fallback: {
    loading: "Loading your member dashboard…",
    error: "Could not load your member dashboard.",
    noRepayment: "No repayment due",
    notSubmitted: "not submitted",
    unknownRole: "Member",
    unknownMemberId: "—",
  },

  kycStatuses: {
    approved: "approved",
    pending: "pending",
    rejected: "rejected",
    notSubmitted: "not submitted",
  },
};

/* ============================================================================
 * HELPERS
 * ========================================================================== */

const getDecimalValue = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (
    typeof value === "object" &&
    "$numberDecimal" in value
  ) {
    return value.$numberDecimal;
  }

  return value;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(
    getDecimalValue(value, fallback)
  );

  return Number.isFinite(parsed) ? parsed : fallback;
};

const money = (value) => {
  const amount = toNumber(value);

  return `${MEMBER_DASHBOARD_CONFIG.currency} ${amount.toLocaleString()}`;
};

const formatDate = (value, fallback) => {
  if (!value) return fallback;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleDateString();
};

const getMembership = (data) =>
  data?.membership || null;

const getMemberId = (membership) =>
  membership?._id ||
  membership?.id ||
  membership?.membership_id ||
  null;

const getRole = (membership) =>
  membership?.role ||
  MEMBER_DASHBOARD_CONFIG.fallback.unknownRole;

const getKycStatus = (data) =>
  data?.kyc?.status ||
  MEMBER_DASHBOARD_CONFIG.fallback.notSubmitted;

/* ============================================================================
 * COMPONENT
 * ========================================================================== */

export default function MemberDashboardPage() {
  const { workspaceId } = useParams();

  const [data, setData] = useState(null);
  const [loanSummary, setLoanSummary] = useState(null);

  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!workspaceId) {
      setData(null);
      setLoanSummary(null);
      setStatus("error");
      setErrorMessage(
        "No workspace was provided."
      );

      return undefined;
    }

    const controller = new AbortController();

    setStatus("loading");
    setErrorMessage("");
    setData(null);
    setLoanSummary(null);

    const loadDashboard = async () => {
      try {
        /*
         * Both requests are independent, so load them concurrently.
         */
        const [
          commandCenterRes,
          summaryRes,
        ] = await Promise.all([
          chamaApi.getCommandCenter(
            workspaceId,
            {
              signal: controller.signal,
            }
          ),

          loansApi.summary(
            workspaceId,
            {
              signal: controller.signal,
            }
          ),
        ]);

        /*
         * Preserve the API envelope currently used by the project:
         *
         * {
         *   success: true,
         *   data: {...}
         * }
         */
        const commandCenterData =
          commandCenterRes?.data?.data;

        const loanSummaryData =
          summaryRes?.data?.data;

        if (!commandCenterData) {
          throw new Error(
            "Member dashboard data is unavailable."
          );
        }

        if (!loanSummaryData) {
          throw new Error(
            "Loan summary data is unavailable."
          );
        }

        setData(commandCenterData);
        setLoanSummary(loanSummaryData);
        setStatus("ready");
      } catch (error) {
        /*
         * Abort errors are expected when the user changes workspace
         * before the previous request finishes.
         */
        if (
          error?.name === "AbortError" ||
          error?.code === "ERR_CANCELED"
        ) {
          return;
        }

        console.error(
          "Failed to load member dashboard:",
          error
        );

        setStatus("error");

        setErrorMessage(
          error?.response?.data?.message ||
            error?.message ||
            MEMBER_DASHBOARD_CONFIG.fallback.error
        );
      }
    };

    loadDashboard();

    return () => {
      controller.abort();
    };
  }, [workspaceId]);

  /* ==========================================================================
   * LOADING
   * ======================================================================== */

  if (status === "loading") {
    return (
      <DashboardState>
        {MEMBER_DASHBOARD_CONFIG.fallback.loading}
      </DashboardState>
    );
  }

  /* ==========================================================================
   * ERROR
   * ======================================================================== */

  if (status === "error") {
    return (
      <DashboardState error>
        {errorMessage ||
          MEMBER_DASHBOARD_CONFIG.fallback.error}
      </DashboardState>
    );
  }

  /* ==========================================================================
   * SAFE DATA EXTRACTION
   * ======================================================================== */

  const membership = getMembership(data);

  const role = getRole(membership);
  const kycStatus = getKycStatus(data);

  const memberId = getMemberId(membership);

  const activeLoan =
    loanSummary?.active_loan || null;

  const nextPayment =
    activeLoan?.next_payment || null;

  /*
   * Savings comes from the loan savings service.
   */
  const savingsBalance =
    loanSummary?.savings_balance ?? 0;

  /*
   * IMPORTANT:
   *
   * Do not automatically treat savings as shares if the API eventually
   * provides a dedicated shares balance.
   *
   * Until then, preserve the existing backend contract by falling back
   * to savings.
   */
  const sharesBalance =
    loanSummary?.shares_balance ??
    loanSummary?.shares ??
    savingsBalance;

  const loanLimit =
    loanSummary?.loan_limit ?? 0;

  const nextPaymentDate =
    formatDate(
      nextPayment?.due_date,
      MEMBER_DASHBOARD_CONFIG.fallback.noRepayment
    );

  const nextPaymentAmount =
    nextPayment?.amount != null
      ? `${money(nextPayment.amount)} due`
      : null;

  const displayMemberId = memberId
    ? String(memberId)
        .slice(
          -MEMBER_DASHBOARD_CONFIG.memberIdDisplayLength
        )
        .toUpperCase()
    : MEMBER_DASHBOARD_CONFIG.fallback
        .unknownMemberId;

  /* ==========================================================================
   * RENDER
   * ======================================================================== */

  return (
    <div className="space-y-6">
      {/* ======================================================================
       * HEADER
       * ==================================================================== */}

      <div>
        <h1 className="text-3xl font-bold">
          My Chama
        </h1>

        <p className="text-slate-500">
          Your savings, shares, loan position and next payment.
        </p>
      </div>

      {/* ======================================================================
       * FINANCIAL SUMMARY
       * ==================================================================== */}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card
          title="Savings"
          value={money(savingsBalance)}
        />

        <Card
          title="Shares"
          value={money(sharesBalance)}
          subtitle={
            loanSummary?.shares_balance != null ||
            loanSummary?.shares != null
              ? "Your current share balance"
              : "Tracked from total contributions"
          }
        />

        <Card
          title="Loan limit"
          value={money(loanLimit)}
        />

        <Card
          title="Next due date"
          value={nextPaymentDate}
          subtitle={nextPaymentAmount}
        />
      </div>

      {/* ======================================================================
       * ACTIVE LOAN
       * ==================================================================== */}

      <section className="rounded-2xl border bg-white p-5 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-bold">
              Loan position
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Your current borrowing and repayment position.
            </p>
          </div>

          <LoanStatusBadge
            loan={activeLoan}
          />
        </div>

        {activeLoan ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Loan amount"
              value={money(
                activeLoan.amount ||
                  activeLoan.principal ||
                  0
              )}
            />

            <Metric
              label="Outstanding"
              value={money(
                activeLoan.outstanding_balance ??
                  activeLoan.balance ??
                  0
              )}
            />

            <Metric
              label="Next payment"
              value={
                nextPayment?.amount
                  ? money(nextPayment.amount)
                  : "—"
              }
            />

            <Metric
              label="Due date"
              value={nextPaymentDate}
            />
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed p-5 text-sm text-slate-500">
            You currently have no active loan.
          </div>
        )}
      </section>

      {/* ======================================================================
       * DIGITAL MEMBER CARD
       * ==================================================================== */}

      <section className="rounded-2xl border bg-white p-5 dark:bg-slate-900">
        <h2 className="font-bold">
          Digital member card
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MemberDetail
            label="Role"
            value={role}
          />

          <MemberDetail
            label="KYC status"
            value={kycStatus}
          />

          <MemberDetail
            label="Member ID"
            value={displayMemberId}
          />
        </div>
      </section>
    </div>
  );
}

/* ============================================================================
 * CARD
 * ========================================================================== */

function Card({
  title,
  value,
  subtitle,
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 dark:bg-slate-900">
      <p className="text-sm text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-xl font-bold">
        {value}
      </p>

      {subtitle && (
        <p className="mt-1 text-xs text-slate-400">
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* ============================================================================
 * METRIC
 * ========================================================================== */

function Metric({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 font-bold">
        {value}
      </p>
    </div>
  );
}

/* ============================================================================
 * MEMBER DETAIL
 * ========================================================================== */

function MemberDetail({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 font-semibold">
        {value}
      </p>
    </div>
  );
}

/* ============================================================================
 * LOAN STATUS
 * ========================================================================== */

function LoanStatusBadge({ loan }) {
  if (!loan) {
    return (
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        No active loan
      </span>
    );
  }

  const status = String(
    loan.status || "active"
  ).toLowerCase();

  const statusConfig = {
    active: {
      label: "Active",
      className:
        "bg-emerald-100 text-emerald-700",
    },

    pending: {
      label: "Pending",
      className:
        "bg-amber-100 text-amber-700",
    },

    approved: {
      label: "Approved",
      className:
        "bg-blue-100 text-blue-700",
    },

    defaulted: {
      label: "Defaulted",
      className:
        "bg-red-100 text-red-700",
    },

    completed: {
      label: "Completed",
      className:
        "bg-slate-100 text-slate-600",
    },
  };

  const config =
    statusConfig[status] || {
      label:
        status.charAt(0).toUpperCase() +
        status.slice(1),
      className:
        "bg-slate-100 text-slate-600",
    };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}

/* ============================================================================
 * DASHBOARD STATE
 * ========================================================================== */

function DashboardState({
  children,
  error = false,
}) {
  return (
    <div
      className={`flex min-h-[240px] items-center justify-center rounded-2xl border p-6 text-center ${
        error
          ? "border-red-200 bg-red-50 text-red-700"
          : "bg-white text-slate-500 dark:bg-slate-900"
      }`}
    >
      {children}
    </div>
  );
}
