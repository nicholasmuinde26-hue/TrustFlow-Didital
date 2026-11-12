import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, Loader2, ShieldAlert, X } from "lucide-react";

/**
 * App-wide confirmation / warning / result popups.
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Remove member?", message: "...", variant: "danger" }))) return;
 *
 * Variants: info | warning | danger | success
 *   - danger + requireText     -> user must type the phrase to enable the button
 *   - hideCancel               -> single-button "result" popup (see notifyResult)
 *   - onConfirm (async)        -> dialog stays open with a spinner while it runs and shows
 *                                 the error inside the dialog if it fails
 *
 * Outside React (api helpers, store code) use the imperative helpers:
 *   confirmAction({...})  and  notifyResult({...})
 * They fall back to window.confirm/alert if the provider is not mounted yet.
 */

const ConfirmContext = createContext(null);
let imperativeOpener = null;

const VARIANTS = {
  info: {
    icon: Info,
    ring: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
    button: "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500",
  },
  warning: {
    icon: AlertTriangle,
    ring: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
    button: "bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500",
  },
  danger: {
    icon: ShieldAlert,
    ring: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300",
    button: "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500",
  },
  success: {
    icon: CheckCircle2,
    ring: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
    button: "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500",
  },
};

const errorText = (err) =>
  err?.response?.data?.message || err?.message || "That didn't work. Please try again.";

function ConfirmDialog({ request, onClose }) {
  const {
    title,
    message,
    details,
    variant = "info",
    confirmText,
    cancelText = "Cancel",
    requireText,
    hideCancel = false,
    onConfirm,
  } = request.options;

  const style = VARIANTS[variant] || VARIANTS.info;
  const Icon = style.icon;
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirmRef = useRef(null);
  const inputRef = useRef(null);

  const label = confirmText || (variant === "danger" ? "Yes, continue" : hideCancel ? "Done" : "Confirm");
  const ready = !requireText || typed.trim().toLowerCase() === String(requireText).trim().toLowerCase();

  useEffect(() => {
    (requireText ? inputRef.current : confirmRef.current)?.focus();
  }, [requireText]);

  const cancel = useCallback(() => {
    if (!busy) onClose(false);
  }, [busy, onClose]);

  const accept = useCallback(async () => {
    if (!ready || busy) return;
    if (!onConfirm) return onClose(true);
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      onClose(true);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }, [ready, busy, onConfirm, onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") cancel();
      if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        accept();
      }
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [cancel, accept]);

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-900/60 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => {
        // Destructive dialogs ignore stray backdrop clicks.
        if (e.target === e.currentTarget && variant !== "danger") cancel();
      }}
    >
      <div
        role={variant === "danger" || variant === "warning" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#20342f] dark:bg-[#172623]"
      >
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${style.ring}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="text-base font-semibold text-slate-900 dark:text-[#e8f5ef]">
              {title}
            </h2>
            {message ? (
              <p id="confirm-message" className="mt-1 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
                {message}
              </p>
            ) : null}
            {Array.isArray(details) && details.length > 0 ? (
              <ul className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3 text-sm dark:bg-black/20">
                {details.map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-3">
                    <span className="text-slate-500 dark:text-slate-400">{k}</span>
                    <span className="text-right font-medium text-slate-800 dark:text-slate-100">{v}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {requireText ? (
              <div className="mt-3">
                <label htmlFor="confirm-type" className="text-xs text-slate-500 dark:text-slate-400">
                  Type <span className="font-semibold text-slate-800 dark:text-slate-100">{requireText}</span> to continue
                </label>
                <input
                  id="confirm-type"
                  ref={inputRef}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/30 dark:border-[#20342f] dark:bg-black/20 dark:text-white"
                />
              </div>
            ) : null}
            {error ? (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </p>
            ) : null}
          </div>
          {hideCancel ? null : (
            <button
              type="button"
              onClick={cancel}
              aria-label="Close"
              className="rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {hideCancel ? null : (
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-[#20342f] dark:text-slate-200 dark:hover:bg-white/5"
            >
              {cancelText}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            onClick={accept}
            disabled={!ready || busy}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${style.button}`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {label}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ConfirmProvider({ children }) {
  const [queue, setQueue] = useState([]);

  const open = useCallback(
    (options) =>
      new Promise((resolve) => {
        setQueue((q) => [...q, { id: `${Date.now()}-${Math.random()}`, options: options || {}, resolve }]);
      }),
    []
  );

  const close = useCallback((id, result) => {
    setQueue((q) => {
      const target = q.find((r) => r.id === id);
      target?.resolve(result);
      return q.filter((r) => r.id !== id);
    });
  }, []);

  useEffect(() => {
    imperativeOpener = open;
    return () => {
      if (imperativeOpener === open) imperativeOpener = null;
    };
  }, [open]);

  const value = useMemo(() => open, [open]);
  const current = queue[0];

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {current ? <ConfirmDialog key={current.id} request={current} onClose={(r) => close(current.id, r)} /> : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Never crash a page because the provider is missing - degrade to the browser prompt.
    return (o = {}) => Promise.resolve(window.confirm([o.title, o.message].filter(Boolean).join("\n\n")));
  }
  return ctx;
}

export function confirmAction(options) {
  if (imperativeOpener) return imperativeOpener(options);
  return Promise.resolve(window.confirm([options?.title, options?.message].filter(Boolean).join("\n\n")));
}

/** One-button result popup: success ("Payout recorded"), warning, or error-style danger. */
export function notifyResult({ variant = "success", title, message, confirmText = "Done", details }) {
  const options = { variant, title, message, confirmText, details, hideCancel: true };
  if (imperativeOpener) return imperativeOpener(options);
  window.alert([title, message].filter(Boolean).join("\n\n"));
  return Promise.resolve(true);
}

export default ConfirmProvider;
