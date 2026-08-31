import { AlertTriangle, AlertOctagon, CheckCircle2, Info } from "lucide-react";

export const SEVERITY_STYLES = {
  critical: {
    icon: AlertOctagon,
    badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    dot: "bg-red-500",
  },
  warning: {
    icon: AlertTriangle,
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  info: {
    icon: Info,
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  good: {
    icon: CheckCircle2,
    badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    dot: "bg-green-500",
  },
};

export const PRIORITY_STYLES = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  normal: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};
