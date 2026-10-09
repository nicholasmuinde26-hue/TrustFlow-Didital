import { Link, useParams } from "react-router-dom";
import { Gem } from "lucide-react";
import clsx from "clsx";

import useWorkspace from "@/app/hooks/useWorkspace";
import { isChamaBackedType } from "@/modules/workspaces/config/workspaceModules";
import useBillingSummary from "../hooks/useBilling";

const OFFICIALS = ["treasurer", "chairperson"];
const normalizeRole = (role) => String(role || "").toLowerCase().replaceAll(" ", "_");

// A small plan chip for the top bar: the plan name at a glance, and one tap to
// the plan page. It replaces a sidebar icon so the rail stays uncluttered.
// Only the people who can act on the plan (treasurer, chairperson) see it.
export default function PlanBadge() {
  const { workspaceId } = useParams();
  const { workspaces, activeWorkspace } = useWorkspace();
  const workspace =
    workspaces?.find((w) => (w?.id ?? w?._id) === workspaceId) || activeWorkspace || null;

  const eligible =
    Boolean(workspaceId) &&
    isChamaBackedType(workspace?.type) &&
    OFFICIALS.includes(normalizeRole(workspace?.role));

  const { summary } = useBillingSummary(workspaceId, eligible);
  if (!eligible || !summary) return null;

  const { state, days_left: daysLeft } = summary;
  const planName = summary.plan?.name || "Plan";

  let label = planName;
  let hint = "";
  let tone = "emerald";

  if (state === "trial") {
    label = daysLeft != null ? `Trial · ${daysLeft}d` : "Trial";
    hint = "Free trial of every feature";
    tone = "violet";
  } else if (state === "free") {
    label = "Free";
    hint = "Upgrade";
    tone = "slate";
  } else if (state === "grace") {
    label = "Renew";
    hint = "Plan expired";
    tone = "amber";
  } else if (state === "read_only") {
    label = "Renew";
    hint = "Read-only";
    tone = "rose";
  }

  const tones = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50",
    violet: "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-950/50",
    slate: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist dark:hover:bg-obsidian-raised",
    amber: "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/50",
    rose: "border-rose-300 bg-rose-50 text-rose-900 hover:bg-rose-100 dark:border-rose-800/60 dark:bg-rose-950/30 dark:text-rose-200 dark:hover:bg-rose-950/50",
  };

  const title = summary.enforced === false
    ? `${planName} plan. Billing is not switched on yet.`
    : hint ? `${planName} plan · ${hint}` : `${planName} plan`;

  return (
    <Link
      to={`/workspace/${workspaceId}/billing`}
      title={title}
      aria-label={`${title}. Open plan and billing`}
      className={clsx(
        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-extrabold transition sm:px-3",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        tones[tone]
      )}
    >
      <Gem size={15} aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
      {state === "free" ? (
        <span className="hidden rounded-md bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white lg:inline dark:bg-mint dark:text-mint-strong">
          Upgrade
        </span>
      ) : null}
    </Link>
  );
}