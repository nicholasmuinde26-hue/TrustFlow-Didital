import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BellRing, ChevronRight } from "lucide-react";

/**
 * "This needs you" popup for the treasurer, chairperson and secretary.
 *
 * A toast is easy to miss and disappears. Anything an official must DECIDE
 * (a loan to approve, a withdrawal to sign off) or that is urgent (a failed
 * payment, an overdue cash deposit) gets this instead: it dims the screen,
 * says plainly what is waiting, and sends the person to the real page where
 * the decision is made. Decisions are never taken inside the popup itself.
 *
 * Rendered by RealtimeNotificationHost, which decides who sees it and when.
 */

const MAX_ROWS = 3;

const ROLE_LABEL = {
  treasurer: "Treasurer",
  chairperson: "Chairperson",
  secretary: "Secretary",
};

function rolesOf(items) {
  const roles = [...new Set(items.map((n) => ROLE_LABEL[n.recipient_role]).filter(Boolean))];
  return roles.join(" / ");
}

function chamaNameOf(notification) {
  return typeof notification.chama_id === "object" ? notification.chama_id?.name : null;
}

export default function ActionRequiredModal({ items, onReview, onLater, onOpenAll }) {
  const primaryRef = useRef(null);
  const open = items.length > 0;

  useEffect(() => {
    if (!open) return undefined;
    primaryRef.current?.focus();

    function onKey(event) {
      if (event.key === "Escape") onLater();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onLater]);

  if (typeof document === "undefined") return null;

  const urgent = items.some((n) => n.priority === "urgent");
  const shown = items.slice(0, MAX_ROWS);
  const hidden = items.length - shown.length;
  const role = rolesOf(items);

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="action-required-backdrop"
          className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-900/55 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="action-required-title"
            aria-describedby="action-required-desc"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-obsidian-border dark:bg-obsidian-card"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            <div className={`h-1.5 ${urgent ? "bg-red-500" : "bg-amber-500"}`} aria-hidden="true" />

            <div className="p-5">
              <div className="flex items-start gap-3">
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                    urgent
                      ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                  }`}
                >
                  <BellRing size={20} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2
                    id="action-required-title"
                    className="text-base font-bold text-slate-900 dark:text-mist"
                  >
                    {items.length === 1
                      ? "Something needs your attention"
                      : `${items.length} things need your attention`}
                  </h2>
                  <p
                    id="action-required-desc"
                    className="mt-0.5 text-[13px] text-slate-600 dark:text-mist-muted"
                  >
                    {role ? `As ${role}, ` : ""}these are waiting on you.
                  </p>
                </div>
              </div>

              <ul className="mt-4 space-y-2">
                {shown.map((notification, index) => {
                  const chamaName = chamaNameOf(notification);
                  return (
                    <li
                      key={notification._id}
                      className="rounded-xl border border-slate-200 p-3 dark:border-obsidian-border"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-lg leading-6" aria-hidden="true">
                          {notification.icon || "🔔"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-5 text-slate-900 dark:text-mist">
                            {notification.title}
                          </p>
                          {notification.message ? (
                            <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-slate-600 dark:text-mist-muted">
                              {notification.message}
                            </p>
                          ) : null}
                          {chamaName ? (
                            <p className="mt-1 text-xs text-slate-400 dark:text-mist-muted">
                              {chamaName}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <button
                        ref={index === 0 ? primaryRef : undefined}
                        type="button"
                        onClick={() => onReview(notification)}
                        className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-mint dark:text-obsidian-rail dark:hover:bg-mint-hover"
                      >
                        {notification.action_text || "Review now"}
                        <ChevronRight size={15} aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onLater}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-mist-muted dark:hover:bg-obsidian-raised"
                >
                  Remind me later
                </button>

                {hidden > 0 ? (
                  <button
                    type="button"
                    onClick={onOpenAll}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-violet-300 dark:hover:bg-violet-500/10"
                  >
                    +{hidden} more - open all
                  </button>
                ) : null}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
