import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  HeartPulse,
  UserPlus,
  QrCode,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  FileText,
  ChevronRight,
} from "lucide-react";

import chamaApi from "@/modules/chama/api/chama.api";
import api from "@/app/services/api";
import useAuth from "@/app/hooks/useAuth";
import KycSubmitModal from "@/modules/chama/components/KycSubmitModal";

/* ============================================================================
 * CONFIGURATION
 * ========================================================================== */

const CONFIG = {
  currency: import.meta.env.VITE_DEFAULT_CURRENCY || "KES",
  memberIdDisplayLength: Number(import.meta.env.VITE_MEMBER_ID_DISPLAY_LENGTH || 8),
  fallback: {
    loading: "Loading your welfare cover…",
    error: "Could not load your welfare cover.",
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
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object" && "$numberDecimal" in value) return value.$numberDecimal;
  return value;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(getDecimalValue(value, fallback));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const money = (value) => `${CONFIG.currency} ${toNumber(value).toLocaleString()}`;

const formatDate = (value, fallback) => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString();
};

const getMembership = (data) => data?.membership || null;
const getMemberId = (membership) => membership?._id || membership?.id || membership?.membership_id || null;
const getRole = (membership) => membership?.role || CONFIG.fallback.unknownRole;
const getKycStatus = (data) => data?.kyc?.status || CONFIG.fallback.notSubmitted;

/* ============================================================================
 * COMPONENT
 * ========================================================================== */

export default function BurialMemberDashboardPage() {
  const { workspaceId } = useParams();

  const [data, setData] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!workspaceId) {
      setData(null);
      setCoverage(null);
      setStatus("error");
      setErrorMessage("No workspace was provided.");
      return undefined;
    }

    const controller = new AbortController();
    setStatus("loading");
    setErrorMessage("");
    setData(null);
    setCoverage(null);

    const loadDashboard = async () => {
      try {
        const [commandCenterResult, coverageResult] = await Promise.allSettled([
          chamaApi.getCommandCenter(workspaceId, { signal: controller.signal }),
          api.get(`/burial-chama/chama/${workspaceId}/coverage/me`, { signal: controller.signal }),
        ]);

        if (commandCenterResult.status === "rejected") {
          throw commandCenterResult.reason;
        }

        const commandCenterData = commandCenterResult.value?.data?.data;
        if (!commandCenterData) throw new Error("Member dashboard data is unavailable.");

        setData(commandCenterData);
        setCoverage(coverageResult.status === "fulfilled" ? coverageResult.value?.data?.data : null);
        setStatus("ready");
      } catch (error) {
        if (error?.name === "AbortError" || error?.code === "ERR_CANCELED") return;
        console.error("Failed to load burial member dashboard:", error);
        setStatus("error");
        setErrorMessage(error?.response?.data?.message || error?.message || CONFIG.fallback.error);
      }
    };

    loadDashboard();
    window.addEventListener("chama:kyc-updated", loadDashboard);

    return () => {
      controller.abort();
      window.removeEventListener("chama:kyc-updated", loadDashboard);
    };
  }, [workspaceId]);

  if (status === "loading") {
    return <DashboardState>{CONFIG.fallback.loading}</DashboardState>;
  }

  if (status === "error") {
    return <DashboardState error>{errorMessage || CONFIG.fallback.error}</DashboardState>;
  }

  return <BurialMemberDashboardView data={data} coverage={coverage} workspaceId={workspaceId} />;
}

/* ============================================================================
 * VIEW
 * ========================================================================== */

function BurialMemberDashboardView({ data, coverage, workspaceId }) {
  const { user } = useAuth();
  const [showKycModal, setShowKycModal] = useState(false);

  const membership = getMembership(data);
  const role = getRole(membership);
  const kycStatus = getKycStatus(data);
  const canSubmitKyc =
    kycStatus !== CONFIG.kycStatuses.approved && kycStatus !== CONFIG.kycStatuses.pending;
  const memberId = getMemberId(membership);

  const coverageLabels = { covered: 'Covered', waiting_period: `Waiting period · ${coverage?.days_remaining || 0} days`, at_risk: 'In arrears · cover at risk', out_of_good_standing: 'Out of good standing', lapsed: 'Cover lapsed' };
  const coverageLabel = coverageLabels[coverage?.status] || 'Cover status unavailable';

  const displayMemberId = memberId
    ? String(memberId).slice(-CONFIG.memberIdDisplayLength).toUpperCase()
    : CONFIG.fallback.unknownMemberId;


  const kycAccent =
    kycStatus === CONFIG.kycStatuses.approved
      ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400"
      : kycStatus === CONFIG.kycStatuses.rejected
      ? "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-400"
      : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-400";

  const coverActive = coverage?.status === 'covered';
  const base = `/workspace/${workspaceId}`;

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto max-w-7xl space-y-6 pb-12 font-sans text-slate-900 dark:text-slate-100"
    >
      {/* ======================================================================
       * HEADER
       * ==================================================================== */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 border border-white/30 px-3 py-1 text-xs font-semibold text-white">
              <HeartPulse className="h-3.5 w-3.5" />
              MY BURIAL CHAMA
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Your Welfare Cover at a Glance
            </h1>
            <p className="max-w-xl text-sm text-emerald-100">
              Welfare cover, beneficiaries, emergency loan position, and your
              digital membership card — all in one place.
            </p>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-black/20 border border-white/20 backdrop-blur px-5 py-4 min-w-[220px]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] tracking-widest text-emerald-100 uppercase font-semibold">Member ID</p>
              <QrCode className="h-4 w-4 text-emerald-100" />
            </div>
            <p className="font-mono text-lg font-black tracking-wider">{displayMemberId}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                {role}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  coverActive ? "bg-emerald-400/30 text-emerald-50" : "bg-amber-400/30 text-amber-50"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${coverActive ? "bg-emerald-300" : "bg-amber-300"}`} />
                {coverActive ? "Cover Active" : "Cover Pending"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ======================================================================
       * WELFARE SUMMARY
       * ==================================================================== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Your cover status" value={coverageLabel} icon={HeartPulse} accent={coverActive ? "emerald" : "amber"} subtitle={coverage?.covered_since ? `Covered since ${formatDate(coverage.covered_since, "—")}` : coverage?.lapse_reason || "Based on waiting period and contribution standing"} />
        <SummaryCard
          title="Beneficiaries"
          value=""
          icon={UserPlus}
          accent="violet"
          customValue={
            <Link to={`${base}/beneficiaries`} className="inline-flex items-center gap-1 text-sm font-bold text-violet-700 dark:text-violet-400 hover:underline">
              Manage on file <ChevronRight size={14} />
            </Link>
          }
          subtitle="Keep next-of-kin details current"
        />
        <SummaryCard title="Covered dependants" value={String(coverage?.dependants?.length ?? "—")} icon={UserPlus} accent="sky" subtitle="Registered people linked to your cover" />
        <SummaryCard title="Outstanding welfare dues" value={coverage ? money(coverage.arrears_amount) : "—"} icon={AlertTriangle} accent={coverage?.status === "at_risk" || coverage?.status === "out_of_good_standing" || coverage?.status === "lapsed" ? "amber" : "emerald"} subtitle={coverage?.arrears_months ? `${coverage.arrears_months} overdue period(s)` : "No overdue contributions"} />
      </div>

      {/* ======================================================================
       * BENEFICIARIES & CASE HISTORY SHORTCUTS
       * ==================================================================== */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          to={`${base}/beneficiaries`}
          className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400">
              <UserPlus className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">My Beneficiaries</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Add or update who's covered under your membership</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-slate-400" />
        </Link>

        <Link
          to={`${base}/member-statement`}
          className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">My Member Statement</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Download or share your member statement</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-slate-400" />
        </Link>
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
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Digital Cover Card</h2>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Your role, KYC verification, and welfare cover status.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <MemberDetail label="Role" value={role} />
            <MemberDetail label="KYC status" value={kycStatus} badgeClassName={kycAccent} />
            <MemberDetail label="Member ID" value={displayMemberId} mono />
          </div>

          {canSubmitKyc && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <p className="text-xs leading-5 text-amber-800 dark:text-amber-300">
                {kycStatus === CONFIG.kycStatuses.rejected
                  ? "Your last KYC submission was rejected. Resubmit your ID to try again."
                  : "You haven't submitted your ID for this group yet. Submit it so leadership can verify your membership and activate cover."}
              </p>
              <button
                type="button"
                onClick={() => setShowKycModal(true)}
                className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-md transition hover:bg-emerald-500"
              >
                {kycStatus === CONFIG.kycStatuses.rejected ? "Resubmit KYC" : "Submit KYC"}
              </button>
            </div>
          )}
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-800 p-5 text-white shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start">
              <p className="text-[10px] tracking-widest text-emerald-100 uppercase font-semibold">Burial Welfare Cover</p>
              <QrCode className="h-5 w-5 text-emerald-100" />
            </div>
            <h3 className="text-xl font-black mt-1 tracking-tight capitalize">{role}</h3>
          </div>
          <div className="mt-8 flex justify-between items-end">
            <div>
              <p className="text-[10px] text-emerald-100">MEMBER ID</p>
              <p className="font-mono text-xs font-bold tracking-wider">CHAMA-{displayMemberId}</p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>
      </section>
    </motion.div>

      {showKycModal && (
        <KycSubmitModal
          workspaceId={workspaceId}
          initialIdNumber={user?.id_number}
          status={kycStatus}
          onClose={() => setShowKycModal(false)}
          onSubmitted={() => window.dispatchEvent(new Event("chama:kyc-updated"))}
        />
      )}
    </>
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

function SummaryCard({ title, value, subtitle, icon: Icon, accent = "emerald", customValue }) {
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
      {customValue ? (
        customValue
      ) : (
        <p className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{value}</p>
      )}
      {subtitle && <p className="text-[11px] text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}

/* ============================================================================
 * MEMBER DETAIL
 * ========================================================================== */

function MemberDetail({ label, value, mono = false, badgeClassName }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      {badgeClassName ? (
        <span className={`mt-1.5 inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase ${badgeClassName}`}>
          {value}
        </span>
      ) : (
        <p className={`mt-1 font-semibold text-slate-900 dark:text-white capitalize ${mono ? "font-mono" : ""}`}>{value}</p>
      )}
    </div>
  );
}

/* ============================================================================
 * DASHBOARD STATE
 * ========================================================================== */

function DashboardState({ children, error = false }) {
  return (
    <div
      className={`flex h-96 items-center justify-center rounded-3xl border p-6 text-center shadow-sm ${
        error
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          : "border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900"
      }`}
    >
      <div className="flex items-center gap-3 font-medium">
        {error ? <AlertTriangle className="h-6 w-6 text-red-600" /> : <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />}
        <span>{children}</span>
      </div>
    </div>
  );
}
