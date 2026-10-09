import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, Clock, Lock, X } from "lucide-react";
import clsx from "clsx";

import { isChamaBackedType } from "@/modules/workspaces/config/workspaceModules";
import useBillingSummary from "../hooks/useBilling";

const BILLING_ROLES = ["treasurer", "chairperson"];
const normalizeRole = (role) => String(role || "").toLowerCase().replaceAll(" ", "_");

const dayWord = (n) => `${n} day${n === 1 ? "" : "s"}`;

// Shown at the top of a chama workspace only when something needs attention:
// a trial or plan about to end, the grace period, or read-only mode. Reads are
// never blocked, so the wording always says the records stay available.
export default function BillingBanner({ workspace, workspaceId }) {
  const { pathname } = useLocation();
  const isChama = isChamaBackedType(workspace?.type);
  const { summary } = useBillingSummary(workspaceId, isChama);
  const [dismissed, setDismissed] = useState(false);

  if (!isChama || !summary || summary.enforced === false) return null;

  const base = `/workspace/${workspaceId}`;
  const billingPath = `${base}/billing`;
  if (pathname.startsWith(billingPath)) return null; // the page already says it

  const canManage = BILLING_ROLES.includes(normalizeRole(workspace?.role));
  const { state, days_left: daysLeft, grace_days_left: graceDaysLeft } = summary;

  let tone = null;
  let Icon = Clock;
  let title = "";
  let detail = "";
  let cta = canManage ? "Choose a plan" : null;
  let canDismiss = true;

  if (state === "read_only") {
    tone = "rose";
    Icon = Lock;
    canDismiss = false;
    title = "This chama is read-only";
    detail =
      "The plan has lapsed, so new records cannot be added. Everything already recorded stays available, and withdrawals and payouts still work.";
    cta = canManage ? "Renew the plan" : null;
  } else if (state === "grace") {
    tone = "amber";
    Icon = AlertTriangle;
    canDismiss = false;
    title = `Plan expired. ${dayWord(graceDaysLeft ?? 0)} left before read-only`;
    detail = "The chama still works normally during this grace period.";
    cta = canManage ? "Renew now" : null;
  } else if (state === "trial" && daysLeft != null && daysLeft <= 5) {
    tone = "violet";
    title = `Free trial ends in ${dayWord(daysLeft)}`;
    detail = "Pick a plan to keep every feature. The Free plan stays available for small groups.";
  } else if (state === "active" && daysLeft != null && daysLeft <= 3) {
    tone = "violet";
    title = `${summary.plan?.name || "Plan"} renews in ${dayWord(daysLeft)}`;
    detail = "Pay before it ends so nothing is interrupted.";
    cta = canManage ? "Renew" : null;
  }

  if (!tone || (dismissed && canDismiss)) return null;

  const toneClasses = {
    rose: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200",
    amber: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200",
    violet: "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-200",
  };

  return (
    <div
      role="status"
      className={clsx("mb-5 flex items-start gap-3 rounded-2xl border px-4 py-3", toneClasses[tone])}
    >
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-0.5 text-xs opacity-90">
          {detail}
          {!canManage && state !== "trial" && state !== "active"
            ? " Ask your treasurer or chairperson to renew."
            : ""}
        </p>
      </div>
      {cta ? (
        <Link
          to={billingPath}
          className="shrink-0 rounded-xl bg-white/80 px-3 py-1.5 text-xs font-bold shadow-sm transition hover:bg-white dark:bg-black/20 dark:hover:bg-black/30"
        >
          {cta}
        </Link>
      ) : null}
      {canDismiss ? (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-lg p-1 opacity-60 transition hover:opacity-100"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}