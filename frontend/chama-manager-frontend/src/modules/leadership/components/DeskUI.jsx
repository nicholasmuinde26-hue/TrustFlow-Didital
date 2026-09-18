import { AlertTriangle, CheckCircle2, Lock } from "lucide-react";

// ========================================
// LEADERSHIP DESK UI KIT
// ========================================
//
// The desk merges three pages that each had their own visual language
// (Command Center's "mission control" cards, Settings' form sections,
// Members' table chrome). Folding them into one page only helps if they
// stop looking like three pages, so every tab renders through these.
//
// ========================================

export const FIELD_CLASS =
  "w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs font-medium text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white";

export const LABEL_CLASS =
  "mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300";

export function SectionCard({ icon: Icon, title, description, action, children }) {
  return (
    <section className="space-y-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div className="flex items-start gap-3">
          {Icon && (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              <Icon size={19} />
            </span>
          )}
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white">{title}</h2>
            {description && (
              <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function MetricCard({ title, value, icon: Icon, subtitle }) {
  return (
    <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{title}</span>
        {Icon && (
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            <Icon size={16} />
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          {value}
        </p>
        {subtitle && <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

export function Notice({ tone = "info", children }) {
  const tones = {
    error:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    warn: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300",
    info: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300",
  };

  const Icon =
    tone === "success" ? CheckCircle2 : tone === "info" ? Lock : AlertTriangle;

  return (
    <div
      className={`flex items-start gap-2.5 rounded-2xl border p-3.5 text-xs font-semibold ${tones[tone]}`}
    >
      <Icon size={15} className="mt-0.5 shrink-0" />
      <div className="flex-1 leading-5">{children}</div>
    </div>
  );
}

// Shown in place of a control the viewer's role can't operate. Saying
// which role CAN do it is deliberate: "you can't" invites a support
// message, "only the chairperson can" tells them who to ask.
export function RoleLocked({ children }) {
  return <Notice tone="warn">{children}</Notice>;
}

export function InputField({ label, value, onChange, type = "text", placeholder, disabled, hint, ...rest }) {
  return (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      <input
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD_CLASS}
        {...rest}
      />
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export function SelectField({ label, value, onChange, options, disabled, hint }) {
  return (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      <select
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD_CLASS}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, detail }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center dark:border-slate-800 dark:bg-slate-900/40">
      {Icon && <Icon className="mx-auto mb-2 h-9 w-9 text-slate-300" />}
      <p className="text-sm font-black text-slate-700 dark:text-slate-200">{title}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

export const money = (amount) => `KES ${Number(amount || 0).toLocaleString()}`;
