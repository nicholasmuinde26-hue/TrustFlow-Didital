import { CheckCircle2, Clock, XCircle, Banknote, Ban } from "lucide-react";

const tones = {
  paid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  approved: "bg-teal-500/10 text-teal-400 border-teal-500/30",
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  rejected: "bg-red-500/10 text-rose-400 border-red-500/30",
  cancelled: "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

const icons = {
  paid: Banknote,
  approved: CheckCircle2,
  pending: Clock,
  rejected: XCircle,
  cancelled: Ban,
};

export default function WithdrawalStatusBadge({ status }) {
  const tone = tones[status] || tones.pending;
  const Icon = icons[status] || Clock;
  const label = (status || "pending").replaceAll("_", " ");

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${tone}`}>
      <Icon className="h-3 w-3" />
      <span>{label}</span>
    </span>
  );
}