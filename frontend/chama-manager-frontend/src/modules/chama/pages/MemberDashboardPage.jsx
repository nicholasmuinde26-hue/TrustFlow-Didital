import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Wallet,
  PiggyBank,
  Layers,
  CreditCard,
  CalendarClock,
  ShieldCheck,
  QrCode,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";

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
         * The two requests are independent, but they're not equally
         * essential: the Command Center feed (role, KYC, goals,
         * officials) is what makes this "My Chama" at all, while the
         * loan summary is one widget on it. A role that legitimately
         * has no loan access (e.g. a Patron, or a Chama whose
         * permissions haven't been fully configured yet) should still
         * see the rest of their dashboard rather than a hard error —
         * so settle both and only require the Command Center call to
         * succeed.
         */
        const [
          commandCenterResult,
          summaryResult,
        ] = await Promise.allSettled([
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

        if (commandCenterResult.status === "rejected") {
          throw commandCenterResult.reason;
        }

        /*
         * Preserve the API envelope currently used by the project:
         *
         * {
         *   success: true,
         *   data: {...}
         * }
         */
        const commandCenterData =
          commandCenterResult.value?.data?.data;

        if (!commandCenterData) {
          throw new Error(
            "Member dashboard data is unavailable."
          );
        }

        const loanSummaryData =
          summaryResult.status === "fulfilled"
            ? summaryResult.value?.data?.data
            : null;

        if (summaryResult.status === "rejected") {
          const abortedLoanCall =
            summaryResult.reason?.name === "AbortError" ||
            summaryResult.reason?.code === "ERR_CANCELED";

          if (abortedLoanCall) {
            return;
          }

          console.warn(
            "Loan summary unavailable for My Chama dashboard:",
            summaryResult.reason
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

  return (
    <MemberDashboardView
      data={data}
      loanSummary={loanSummary}
    />
  );
}

/* ============================================================================
 * VIEW
 * ========================================================================== */

function MemberDashboardView({ data, loanSummary }) {

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
   * DERIVED — LOAN PROGRESS
   * ======================================================================== */

  const loanPrincipal = activeLoan
    ? toNumber(activeLoan.amount || activeLoan.principal || 0)
    : 0;

  const loanOutstanding = activeLoan
    ? toNumber(activeLoan.outstanding_balance ?? activeLoan.balance ?? 0)
    : 0;

  const loanRepaidPct =
    activeLoan && loanPrincipal > 0
      ? Math.max(
          0,
          Math.min(100, Math.round(((loanPrincipal - loanOutstanding) / loanPrincipal) * 100))
        )
      : 0;

  const kycAccent =
    kycStatus === MEMBER_DASHBOARD_CONFIG.kycStatuses.approved
      ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400"
      : kycStatus === MEMBER_DASHBOARD_CONFIG.kycStatuses.rejected
      ? "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-400"
      : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-400";

  /* ==========================================================================
   * RENDER
   * ======================================================================== */

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto max-w-7xl space-y-6 pb-12 font-sans text-slate-900 dark:text-slate-100"
    >
      {/* ======================================================================
       * HEADER — matches the Command Center's gradient banner language so
       * the two chama pages feel like one product, not two.
       * ==================================================================== */}

      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 border border-white/30 px-3 py-1 text-xs font-semibold text-white">
              <Wallet className="h-3.5 w-3.5" />
              MY CHAMA
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Your Position at a Glance
            </h1>
            <p className="max-w-xl text-sm text-emerald-100">
              Savings, shares, loan position, and your digital membership card — all in one place.
            </p>
          </div>

          {/* Compact digital card preview, echoing Command Center's card */}
          <div className="relative overflow-hidden rounded-2xl bg-black/20 border border-white/20 backdrop-blur px-5 py-4 min-w-[220px]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] tracking-widest text-emerald-100 uppercase font-semibold">
                Member ID
              </p>
              <QrCode className="h-4 w-4 text-emerald-100" />
            </div>
            <p className="font-mono text-lg font-black tracking-wider">
              {displayMemberId}
            </p>
            <span className="mt-2 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              {role}
            </span>
          </div>
        </div>
      </header>

      {/* ======================================================================
       * FINANCIAL SUMMARY
       * ==================================================================== */}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Savings"
          value={money(savingsBalance)}
          icon={PiggyBank}
          accent="emerald"
        />

        <SummaryCard
          title="Shares"
          value={money(sharesBalance)}
          icon={Layers}
          accent="sky"
          subtitle={
            loanSummary?.shares_balance != null ||
            loanSummary?.shares != null
              ? "Your current share balance"
              : "Tracked from total contributions"
          }
        />

        <SummaryCard
          title="Loan limit"
          value={money(loanLimit)}
          icon={CreditCard}
          accent="violet"
        />

        <SummaryCard
          title="Next due date"
          value={nextPaymentDate}
          icon={CalendarClock}
          accent="amber"
          subtitle={nextPaymentAmount}
        />
      </div>

      {/* ======================================================================
       * ACTIVE LOAN
       * ==================================================================== */}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5 mb-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400">
              <TrendingUp className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Loan Position
              </h2>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Your current borrowing and repayment position.
              </p>
            </div>
          </div>

          <LoanStatusBadge loan={activeLoan} />
        </div>

        {activeLoan ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Loan amount" value={money(loanPrincipal)} />
              <Metric label="Outstanding" value={money(loanOutstanding)} />
              <Metric
                label="Next payment"
                value={nextPayment?.amount ? money(nextPayment.amount) : "—"}
              />
              <Metric label="Due date" value={nextPaymentDate} />
            </div>

            {loanPrincipal > 0 && (
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                  <span>Repaid</span>
                  <span>{loanRepaidPct}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${loanRepaidPct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-10 text-center dark:border-slate-700 dark:bg-slate-800/40">
            <CreditCard className="h-6 w-6 text-slate-400" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              You currently have no active loan.
            </p>
          </div>
        )}
      </section>

      {/* ======================================================================
       * DIGITAL MEMBER CARD
       * ==================================================================== */}

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-5 mb-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Digital Member Card
              </h2>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Your role, verification status, and Chama membership identity.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <MemberDetail label="Role" value={role} />
            <MemberDetail
              label="KYC status"
              value={kycStatus}
              badgeClassName={kycAccent}
            />
            <MemberDetail label="Member ID" value={displayMemberId} mono />
          </div>
        </div>

        {/* Card visual — mirrors the Command Center's gradient card so the
            two pages read as one design system. */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-800 p-5 text-white shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start">
              <p className="text-[10px] tracking-widest text-emerald-100 uppercase font-semibold">
                Official Member Badge
              </p>
              <QrCode className="h-5 w-5 text-emerald-100" />
            </div>
            <h3 className="text-xl font-black mt-1 tracking-tight capitalize">
              {role}
            </h3>
          </div>
          <div className="mt-8 flex justify-between items-end">
            <div>
              <p className="text-[10px] text-emerald-100">MEMBER ID</p>
              <p className="font-mono text-xs font-bold tracking-wider">
                CHAMA-{displayMemberId}
              </p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
}

/* ============================================================================
 * SUMMARY CARD
 * ========================================================================== */

const SUMMARY_ACCENTS = {
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
};

function SummaryCard({ title, value, subtitle, icon: Icon, accent = "emerald" }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{title}</span>
        {Icon && (
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${SUMMARY_ACCENTS[accent] || SUMMARY_ACCENTS.emerald}`}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <p className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
        {value}
      </p>
      {subtitle && <p className="text-[11px] text-slate-500 mt-1">{subtitle}</p>}
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

function MemberDetail({ label, value, mono = false, badgeClassName }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      {badgeClassName ? (
        <span
          className={`mt-1.5 inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase ${badgeClassName}`}
        >
          {value}
        </span>
      ) : (
        <p className={`mt-1 font-semibold text-slate-900 dark:text-white capitalize ${mono ? "font-mono" : ""}`}>
          {value}
        </p>
      )}
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
      className={`flex h-96 items-center justify-center rounded-3xl border p-6 text-center shadow-sm ${
        error
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          : "border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900"
      }`}
    >
      <div className="flex items-center gap-3 font-medium">
        {error ? (
          <AlertTriangle className="h-6 w-6 text-red-600" />
        ) : (
          <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
        )}
        <span>{children}</span>
      </div>
    </div>
  );
}