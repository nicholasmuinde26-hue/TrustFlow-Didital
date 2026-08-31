import { CheckCircle2, Clock, AlertTriangle, XCircle, ShieldAlert, Sparkles, Coins } from "lucide-react";

const tones = {
  closed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 icon:CheckCircle2",
  active: "bg-sky-500/10 text-sky-400 border-sky-500/30 icon:Coins",
  partially_repaid: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30 icon:Clock",
  approved: "bg-teal-500/10 text-teal-400 border-teal-500/30 icon:CheckCircle2",
  pending_approval: "bg-amber-500/10 text-amber-400 border-amber-500/30 icon:Clock",
  pending_guarantee: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30 icon:Sparkles",
  overdue: "bg-orange-500/10 text-orange-400 border-orange-500/30 icon:AlertTriangle",
  defaulted: "bg-red-500/10 text-red-400 border-red-500/30 icon:ShieldAlert",
  rejected: "bg-red-500/10 text-rose-400 border-red-500/30 icon:XCircle",
  eligibility_failed: "bg-red-500/10 text-rose-400 border-red-500/30 icon:XCircle",
  blocked_conflict: "bg-red-500/10 text-rose-400 border-red-500/30 icon:ShieldAlert",
};

export default function LoanStatusBadge({ status }) {
  const currentTone = tones[status] || "bg-amber-500/10 text-amber-400 border-amber-500/30";
  const formattedText = (status || "draft").replaceAll("_", " ");

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${currentTone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      <span>{formattedText}</span>
    </span>
  );
}
