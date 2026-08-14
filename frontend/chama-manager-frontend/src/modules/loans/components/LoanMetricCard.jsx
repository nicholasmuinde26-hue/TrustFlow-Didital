import { motion } from "framer-motion";
import { Coins, Wallet, Clock, ShieldCheck } from "lucide-react";

const accents = {
  emerald: {
    borderTop: "border-t-emerald-600",
    bgIcon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    icon: Coins,
  },
  sky: {
    borderTop: "border-t-sky-600",
    bgIcon: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
    icon: Wallet,
  },
  amber: {
    borderTop: "border-t-amber-600",
    bgIcon: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    icon: Clock,
  },
  purple: {
    borderTop: "border-t-purple-600",
    bgIcon: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
    icon: ShieldCheck,
  },
};

export default function LoanMetricCard({ label, value, hint, accent = "emerald" }) {
  const config = accents[accent] || accents.emerald;
  const Icon = config.icon;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${config.borderTop} border-t-4 transition-all`}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${config.bgIcon}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{value}</p>
        {hint && <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{hint}</p>}
      </div>
    </motion.div>
  );
}
