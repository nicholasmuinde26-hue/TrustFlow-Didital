import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, X } from "lucide-react";
import clsx from "clsx";

import { confirmWithPassword, isStepUpFresh, markStepUpStale } from "../../services/adminSupport.service";

export const kes = (n) => `KES ${Math.round(Number(n) || 0).toLocaleString("en-KE")}`;
export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "—";
export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
export const errText = (error, fallback = "Something went wrong") => error?.response?.data?.message || error?.message || fallback;

const TONES = {
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
};

export function Pill({ tone = "slate", children, className }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide", TONES[tone], className)}>
      {children}
    </span>
  );
}

const BILLING_STATE = {
  free: ["Free", "slate"], trial: ["On trial", "blue"], active: ["Paying", "green"],
  grace: ["In grace", "amber"], read_only: ["Read-only", "red"],
};
export const BillingStatePill = ({ state }) => {
  const [label, tone] = BILLING_STATE[state] || ["Unknown", "slate"];
  return <Pill tone={tone}>{label}</Pill>;
};

const CASE_STATUS = { open: "blue", pending: "amber", resolved: "green", closed: "slate" };
export const CaseStatusPill = ({ status }) => <Pill tone={CASE_STATUS[status] || "slate"}>{status}</Pill>;

const PRIORITY = { urgent: "red", high: "amber", normal: "slate", low: "slate" };
export const PriorityPill = ({ priority }) => <Pill tone={PRIORITY[priority] || "slate"}>{priority}</Pill>;

export const CATEGORIES = [
  ["billing", "Billing"], ["payment", "Payment"], ["account_access", "Account access"],
  ["verification", "Verification"], ["data_issue", "Data issue"], ["how_to", "How-to"], ["other", "Other"],
];
export const categoryLabel = (key) => CATEGORIES.find(([k]) => k === key)?.[1] || key;

export function Card({ title, action, children, className }) {
  return (
    <section className={clsx("rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="text-sm font-black text-slate-900 dark:text-white">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-violet-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

export const btn = {
  primary: "inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-violet-700 disabled:opacity-40",
  outline: "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800",
  danger: "inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-40",
};

export function EmptyState({ children }) {
  return <p className="py-8 text-center text-xs font-semibold text-slate-400">{children}</p>;
}

/**
 * One dialog for every support action: describes the effect, collects the
 * inputs, requires a reason (saved in the audit trail) and, for money
 * actions, asks for the admin's password once every few minutes.
 *
 * fields: [{ name, label, type: 'number'|'text'|'select', options, help, required, min, max, initial }]
 */
export function ActionDialog({
  open, onClose, onSubmit, title, description, confirmLabel = "Confirm", tone = "primary",
  fields = [], reasonLabel = "Reason (saved in the audit trail)", needsReason = true, needsStepUp = false,
}) {
  const [values, setValues] = useState({});
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [askPassword, setAskPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setValues(Object.fromEntries(fields.map((f) => [f.name, f.initial ?? ""])));
    setReason(""); setPassword(""); setError(""); setBusy(false);
    setAskPassword(needsStepUp && !isStepUpFresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const missing = fields.some((f) => f.required !== false && String(values[f.name] ?? "").trim() === "");
  const reasonShort = needsReason && reason.trim().length < 10;
  const noPassword = askPassword && !password;

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      if (askPassword) await confirmWithPassword(password);
      await onSubmit({ ...values, ...(needsReason ? { reason: reason.trim() } : {}) });
      onClose(true);
    } catch (err) {
      if (err?.response?.data?.code === "ADMIN_STEP_UP_REQUIRED") { markStepUpStale(); setAskPassword(true); }
      setError(errText(err));
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={busy ? undefined : () => onClose(false)} />
      <form onSubmit={submit} className="relative w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <button type="button" onClick={() => onClose(false)} disabled={busy} className="absolute right-4 top-4 text-slate-400 hover:text-slate-700" aria-label="Close">
          <X size={16} />
        </button>
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white">{title}</h3>
          {description ? <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{description}</p> : null}
        </div>

        {fields.map((f) => (
          <label key={f.name} className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
            {f.label}
            {f.type === "select" ? (
              <select className={clsx(inputCls, "mt-1")} value={values[f.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}>
                {f.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            ) : (
              <input
                className={clsx(inputCls, "mt-1")} type={f.type || "text"} min={f.min} max={f.max}
                value={values[f.name] ?? ""} placeholder={f.placeholder}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              />
            )}
            {f.help ? <span className="mt-1 block text-[10px] font-medium text-slate-400">{f.help}</span> : null}
          </label>
        ))}

        {needsReason && (
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
            {reasonLabel}
            <textarea className={clsx(inputCls, "mt-1 min-h-[72px]")} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What happened and why this is the right fix" />
          </label>
        )}

        {askPassword && (
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1"><ShieldCheck size={12} /> Confirm your password (valid for 5 minutes)</span>
            <input className={clsx(inputCls, "mt-1")} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}

        {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btn.outline} onClick={() => onClose(false)} disabled={busy}>Cancel</button>
          <button type="submit" className={tone === "danger" ? btn.danger : btn.primary} disabled={busy || missing || reasonShort || noPassword}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : null} {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
