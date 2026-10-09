import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  CircleDollarSign,
  Info,
  Megaphone,
  Settings,
  ShieldAlert,
  Sparkles,
  User,
  X,
} from "lucide-react";

/**
 * The on-screen card for a live notification.
 *
 * Rendered through toast.custom() by RealtimeNotificationHost. It carries
 * everything a person needs to act without opening the bell: what
 * happened, how important it is, and one clear button.
 */

const CATEGORY = {
  financial: {
    Icon: CircleDollarSign,
    label: "Money",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
  approval: {
    Icon: ShieldAlert,
    label: "Approval needed",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    bar: "bg-amber-500",
  },
  governance: {
    Icon: Megaphone,
    label: "Governance",
    chip: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    bar: "bg-violet-500",
  },
  membership: {
    Icon: User,
    label: "Members",
    chip: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    bar: "bg-blue-500",
  },
  system: {
    Icon: Settings,
    label: "System",
    chip: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
    bar: "bg-slate-400",
  },
  alert: {
    Icon: AlertTriangle,
    label: "Alert",
    chip: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    bar: "bg-red-500",
  },
  burial: {
    Icon: Sparkles,
    label: "Welfare",
    chip: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
    bar: "bg-purple-500",
  },
};

const FALLBACK = {
  Icon: Info,
  label: "Update",
  chip: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
  bar: "bg-cyan-500",
};

export default function NotificationToast({ t, notification, onView }) {
  const style = CATEGORY[notification.category] || FALLBACK;
  const { Icon } = style;

  const urgent = notification.priority === "urgent";
  const high = notification.priority === "high";
  const hasAction = Boolean(notification.action_url);

  function handleView() {
    toast.dismiss(t.id);
    onView?.(notification);
  }

  return (
    <motion.div
      role={urgent ? "alert" : "status"}
      aria-live={urgent ? "assertive" : "polite"}
      initial={{ opacity: 0, x: 56, scale: 0.97 }}
      animate={
        t.visible
          ? { opacity: 1, x: 0, scale: 1 }
          : { opacity: 0, x: 56, scale: 0.97 }
      }
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="pointer-events-auto flex w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-obsidian-border dark:bg-obsidian-card dark:shadow-black/40"
    >
      <span className={`w-1.5 shrink-0 ${style.bar}`} aria-hidden="true" />

      <div className="flex min-w-0 flex-1 gap-3 p-4">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${style.chip}`}
        >
          <Icon size={18} aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold leading-5 text-slate-900 dark:text-mist">
              {notification.title || "New notification"}
            </p>
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              aria-label="Dismiss notification"
              className="-mr-1 -mt-0.5 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-obsidian-raised dark:hover:text-mist"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>

          {notification.message ? (
            <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-slate-600 dark:text-mist-muted">
              {notification.message}
            </p>
          ) : null}

          <div className="mt-2.5 flex items-center gap-3">
            {hasAction ? (
              <button
                type="button"
                onClick={handleView}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-mint dark:text-obsidian-rail dark:hover:bg-mint-hover"
              >
                {notification.action_text || "View"}
              </button>
            ) : null}

            <span className="text-xs text-slate-400 dark:text-mist-muted">
              {urgent ? "Urgent" : high ? "High priority" : style.label}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
