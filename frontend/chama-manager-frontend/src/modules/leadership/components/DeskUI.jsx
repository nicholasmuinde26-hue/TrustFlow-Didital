import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Lock,
  Minus,
  Plus,
  X,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

// ========================================
// LEADERSHIP DESK UI KIT (v2)
// ========================================
//
// Every tab on the desk renders through these. Two ideas run through the kit:
//
//   1. AREA ACCENTS. Each area of the desk (Overview, People, Finance,
//      Operations, Settings) has its own colour. The shell publishes the
//      current area through DeskAccentContext, so every SectionCard in every
//      tab picks up the right accent without the tab knowing about it.
//
//   2. SHORT INPUTS, NOT LONG FORMS. Comma-separated text boxes, bare
//      checkboxes and walls of number fields are replaced by chips, switches,
//      steppers, segmented choices and collapsible groups that show their
//      current value even when closed.
//
// The original exports (FIELD_CLASS, LABEL_CLASS, SectionCard, MetricCard,
// Notice, RoleLocked, InputField, SelectField, EmptyState, money) keep their
// names and props, so tabs that haven't been redesigned yet keep working.
//
// ========================================

// ---------- Accents ----------
// Full class names on purpose: Tailwind only ships classes it can read.
export const ACCENTS = {
  emerald: {
    solid: "bg-emerald-600 text-white hover:bg-emerald-500",
    soft: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-900",
    bar: "bg-emerald-500",
    ring: "focus-visible:ring-emerald-500",
    active: "bg-emerald-600 text-white",
    tint: "bg-emerald-50/70 dark:bg-emerald-950/20",
    focus: "focus:border-emerald-600",
  },
  sky: {
    solid: "bg-sky-600 text-white hover:bg-sky-500",
    soft: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    text: "text-sky-700 dark:text-sky-300",
    border: "border-sky-200 dark:border-sky-900",
    bar: "bg-sky-500",
    ring: "focus-visible:ring-sky-500",
    active: "bg-sky-600 text-white",
    tint: "bg-sky-50/70 dark:bg-sky-950/20",
    focus: "focus:border-sky-600",
  },
  amber: {
    solid: "bg-amber-600 text-white hover:bg-amber-500",
    soft: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    text: "text-amber-800 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-900",
    bar: "bg-amber-500",
    ring: "focus-visible:ring-amber-500",
    active: "bg-amber-600 text-white",
    tint: "bg-amber-50/70 dark:bg-amber-950/20",
    focus: "focus:border-amber-600",
  },
  violet: {
    solid: "bg-violet-600 text-white hover:bg-violet-500",
    soft: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
    text: "text-violet-700 dark:text-violet-300",
    border: "border-violet-200 dark:border-violet-900",
    bar: "bg-violet-500",
    ring: "focus-visible:ring-violet-500",
    active: "bg-violet-600 text-white",
    tint: "bg-violet-50/70 dark:bg-violet-950/20",
    focus: "focus:border-violet-600",
  },
  slate: {
    solid: "bg-slate-800 text-white hover:bg-slate-700 dark:bg-mint dark:text-obsidian-rail",
    soft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    text: "text-slate-700 dark:text-slate-200",
    border: "border-slate-200 dark:border-slate-700",
    bar: "bg-slate-500",
    ring: "focus-visible:ring-slate-500",
    active: "bg-slate-800 text-white dark:bg-mint dark:text-obsidian-rail",
    tint: "bg-slate-50 dark:bg-slate-800/30",
    focus: "focus:border-slate-500",
  },
  rose: {
    solid: "bg-rose-600 text-white hover:bg-rose-500",
    soft: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-900",
    bar: "bg-rose-500",
    ring: "focus-visible:ring-rose-500",
    active: "bg-rose-600 text-white",
    tint: "bg-rose-50/70 dark:bg-rose-950/20",
    focus: "focus:border-rose-600",
  },
};

export const DeskAccentContext = createContext("emerald");
export const useAccent = (override) => {
  const fromContext = useContext(DeskAccentContext);
  return ACCENTS[override] || ACCENTS[fromContext] || ACCENTS.emerald;
};

// ---------- Base classes ----------
export const FIELD_CLASS =
  "w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white";

export const LABEL_CLASS =
  "mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300";

const CARD_SURFACE =
  "border border-slate-200/80 bg-white shadow-[0_8px_30px_-22px_rgba(15,23,42,0.34)] dark:border-obsidian-border dark:bg-obsidian-card dark:shadow-black/10";

export const slugify = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const money = (amount) => `KES ${Number(amount || 0).toLocaleString()}`;

// ---------- Cards ----------
// Every SectionCard marks itself with data-desk-section so the shell can build
// a "Jump to" bar for long pages. Cards fold shut; the body stays mounted
// (hidden, not removed) so a half-filled form never loses its state.
export function SectionCard({
  icon: Icon,
  title,
  description,
  action,
  children,
  accent,
  defaultOpen = true,
  collapsible = true,
  summary,
  className = "",
}) {
  const tone = useAccent(accent);
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <section
      id={`desk-${slugify(title)}`}
      data-desk-section={title}
      className={`group scroll-mt-28 overflow-hidden rounded-3xl ${CARD_SURFACE} transition-[border-color,box-shadow,transform] duration-200 hover:border-slate-300/90 hover:shadow-[0_18px_44px_-28px_rgba(15,23,42,0.4)] dark:hover:border-slate-600 ${className}`}
    >
      <header className="relative flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6">
        <span className={`absolute inset-y-4 left-0 w-1 rounded-r-full ${tone.bar}`} aria-hidden="true" />
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone.soft}`}>
              <Icon size={18} aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-bold leading-tight text-slate-900 dark:text-white">
              {title}
            </h2>
            {description && open && (
              <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
            {!open && summary && (
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{summary}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {action}
          {collapsible && (
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls={bodyId}
              aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
              className={`grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 dark:hover:bg-obsidian-raised ${tone.ring}`}
            >
              <ChevronDown size={16} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
            </button>
          )}
        </div>
      </header>
      <div id={bodyId} hidden={!open} className="space-y-5 border-t border-slate-100 px-6 py-6 dark:border-obsidian-border">
        {children}
      </div>
    </section>
  );
}

// A plain, non-collapsible card for dashboards (the Overview). Same surface and
// spacing as SectionCard, so the two sit together without looking mismatched.
export function DeskPanel({ icon: Icon, title, description, action, children, className = "", accent, flush = false }) {
  const tone = useAccent(accent);
  return (
    <section className={`overflow-hidden rounded-3xl ${CARD_SURFACE} ${className}`}>
      <header className="relative flex items-start justify-between gap-3 px-5 pt-5 sm:px-6">
        <span className={`absolute inset-y-5 left-0 w-1 rounded-r-full ${tone.bar}`} aria-hidden="true" />
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone.soft}`}>
              <Icon size={18} aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-bold leading-tight text-slate-900 dark:text-white">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className={flush ? "pt-4" : "px-6 pb-6 pt-5"}>{children}</div>
    </section>
  );
}

export function MetricCard({ title, value, icon: Icon, subtitle, onClick, tone: toneName }) {
  const tone = useAccent(toneName);
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`relative flex w-full flex-col justify-between overflow-hidden rounded-3xl p-5 text-left ${CARD_SURFACE} ${
        onClick ? `transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg focus:outline-none focus-visible:ring-2 ${tone.ring}` : "transition-colors hover:border-slate-300/90"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</span>
        {Icon && (
          <span className={`grid h-8 w-8 place-items-center rounded-lg ${tone.soft}`}>
            <Icon size={15} aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-1 text-[1.75rem] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
    </Wrapper>
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
  const Icon = tone === "success" ? CheckCircle2 : tone === "info" ? Lock : AlertTriangle;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs font-medium ${tones[tone]}`}
    >
      <Icon size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex-1 leading-5">{children}</div>
    </div>
  );
}

// Shown in place of a control the viewer's role can't operate. Saying which
// role CAN do it is deliberate: "you can't" invites a support message, "only
// the chairperson can" tells them who to ask.
export function RoleLocked({ children }) {
  return <Notice tone="warn">{children}</Notice>;
}

export function EmptyState({ icon: Icon, title, detail, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center dark:border-obsidian-border dark:bg-obsidian-card/40">
      {Icon && <Icon className="mx-auto mb-2 h-8 w-8 text-slate-300" aria-hidden="true" />}
      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</p>
      {detail && <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">{detail}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "h-4 w-full" }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/70 dark:bg-slate-700/50 ${className}`} />;
}

// ---------- Buttons ----------
export function Button({
  children,
  onClick,
  type = "button",
  variant = "solid",
  accent,
  size = "md",
  icon: Icon,
  disabled,
  className = "",
  ...rest
}) {
  const tone = useAccent(accent);
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm" };
  const variants = {
    solid: tone.solid,
    soft: `${tone.soft} hover:brightness-95`,
    ghost: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-obsidian-raised",
    outline:
      "border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-obsidian-border dark:text-slate-200 dark:hover:bg-obsidian-raised",
    danger: "bg-rose-600 text-white hover:bg-rose-500",
    onDark: "bg-white/10 text-white hover:bg-white/20",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${tone.ring} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {Icon && <Icon size={size === "sm" ? 13 : 15} aria-hidden="true" />}
      {children}
    </button>
  );
}

export function CopyButton({ value, label = "Copy", copiedLabel = "Copied", size = "sm", variant = "outline" }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard?.writeText(String(value));
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: nothing useful to tell the leader */
    }
  };

  return (
    <Button size={size} variant={variant} icon={copied ? Check : Copy} onClick={copy} disabled={!value} aria-live="polite">
      {copied ? copiedLabel : label}
    </Button>
  );
}

// ---------- Inputs ----------
export function InputField({ label, value, onChange, type = "text", placeholder, disabled, hint, prefix, suffix, ...rest }) {
  const id = useId();
  const hasAdornment = prefix || suffix;
  const input = (
    <input
      id={id}
      type={type}
      value={value ?? ""}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={`${FIELD_CLASS} ${hasAdornment ? "border-0 bg-transparent px-0 focus:bg-transparent" : ""}`}
      {...rest}
    />
  );

  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      {hasAdornment ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 transition focus-within:border-emerald-600 focus-within:bg-white dark:border-slate-700 dark:bg-slate-800">
          {prefix && <span className="text-xs font-bold text-slate-400">{prefix}</span>}
          {input}
          {suffix && <span className="shrink-0 text-xs font-bold text-slate-400">{suffix}</span>}
        </div>
      ) : (
        input
      )}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export function SelectField({ label, value, onChange, options, disabled, hint }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <select
        id={id}
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

// A number with - / + buttons: far quicker on a phone than typing, and the
// unit sits beside the value so "3" is never ambiguous.
export function Stepper({ label, value, onChange, min = 0, max, step = 1, suffix, prefix, disabled, hint }) {
  const id = useId();
  const numeric = Number(value);
  const current = Number.isFinite(numeric) ? numeric : 0;
  const clamp = (next) => {
    let result = Math.round(next * 1000) / 1000;
    if (min !== undefined) result = Math.max(min, result);
    if (max !== undefined) result = Math.min(max, result);
    return result;
  };

  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <div className="flex items-stretch overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60 transition focus-within:border-emerald-600 dark:border-slate-700 dark:bg-slate-800">
        <button
          type="button"
          disabled={disabled || (min !== undefined && current <= min)}
          onClick={() => onChange(clamp(current - step))}
          aria-label={`Decrease ${label}`}
          className="grid w-10 place-items-center text-slate-500 transition hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-obsidian-raised"
        >
          <Minus size={14} />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-1">
          {prefix && <span className="text-xs font-bold text-slate-400">{prefix}</span>}
          <input
            id={id}
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={value ?? ""}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            className="w-full min-w-0 bg-transparent py-2.5 text-center text-sm font-semibold text-slate-900 outline-none [appearance:textfield] dark:text-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          {suffix && <span className="shrink-0 pr-1 text-xs font-bold text-slate-400">{suffix}</span>}
        </div>
        <button
          type="button"
          disabled={disabled || (max !== undefined && current >= max)}
          onClick={() => onChange(clamp(current + step))}
          aria-label={`Increase ${label}`}
          className="grid w-10 place-items-center text-slate-500 transition hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-obsidian-raised"
        >
          <Plus size={14} />
        </button>
      </div>
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

// One choice out of a few, all visible at once.
export function Segmented({ label, value, onChange, options, disabled, hint, accent }) {
  const tone = useAccent(accent);
  return (
    <div>
      {label && <p className={LABEL_CLASS}>{label}</p>}
      <div role="radiogroup" aria-label={label} className="inline-flex w-full flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-obsidian-raised/60">
        {options.map((option) => {
          const selected = String(option.value) === String(value);
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed ${tone.ring} ${
                selected
                  ? "bg-white text-slate-900 shadow-sm dark:bg-obsidian-card dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-mist-muted dark:hover:text-mist"
              } ${disabled && !selected ? "opacity-50" : ""}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

// Big selectable cards for choices that need a sentence of explanation.
export function ChoiceCards({ label, value, onChange, options, disabled, accent }) {
  const tone = useAccent(accent);
  return (
    <div>
      {label && <p className={LABEL_CLASS}>{label}</p>}
      <div role="radiogroup" aria-label={label} className="grid gap-2.5 sm:grid-cols-2">
        {options.map((option) => {
          const selected = option.value === value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed ${tone.ring} ${
                selected
                  ? `${tone.border} ${tone.tint}`
                  : "border-slate-200 hover:border-slate-300 dark:border-obsidian-border"
              } ${disabled && !selected ? "opacity-50" : ""}`}
            >
              {Icon && (
                <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${selected ? tone.soft : "bg-slate-100 text-slate-500 dark:bg-obsidian-raised"}`}>
                  <Icon size={15} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">{option.label}</span>
                {option.detail && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{option.detail}</span>}
              </span>
              <span
                className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                  selected ? `${tone.bar} border-transparent text-white` : "border-slate-300 dark:border-slate-600"
                }`}
              >
                {selected && <Check size={10} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// A real switch with a sentence beside it, in place of a bare checkbox.
export function ToggleRow({ label, description, checked, onChange, disabled }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3 dark:border-obsidian-border">
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-sm font-semibold text-slate-900 dark:text-white">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={Boolean(checked)}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-600"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}

// A list of short values as removable chips, with one-tap suggestions.
// Replaces "type a comma separated list".
export function ChipInput({ label, values = [], onChange, suggestions = [], placeholder = "Type and press Enter", disabled, hint, transform = (v) => v, validate }) {
  const [draft, setDraft] = useState("");
  const list = Array.isArray(values) ? values : [];

  const add = (raw) => {
    const next = transform(String(raw).trim());
    if (next === "" || next === undefined || next === null) return;
    if (validate && !validate(next)) return;
    if (list.some((item) => String(item).toLowerCase() === String(next).toLowerCase())) return;
    onChange([...list, next]);
    setDraft("");
  };
  const remove = (item) => onChange(list.filter((entry) => entry !== item));
  const openSuggestions = suggestions.filter(
    (suggestion) => !list.some((item) => String(item).toLowerCase() === String(suggestion).toLowerCase())
  );

  return (
    <div>
      {label && <p className={LABEL_CLASS}>{label}</p>}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-2 transition focus-within:border-emerald-600 dark:border-slate-700 dark:bg-slate-800">
        {list.map((item) => (
          <span key={item} className="inline-flex items-center gap-1 rounded-lg bg-white py-1 pl-2.5 pr-1 text-xs font-semibold text-slate-700 shadow-sm dark:bg-obsidian-card dark:text-slate-200">
            {item}
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(item)}
                aria-label={`Remove ${item}`}
                className="grid h-5 w-5 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              >
                <X size={11} />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            value={draft}
            placeholder={list.length ? "Add another" : placeholder}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                add(draft);
              } else if (event.key === "Backspace" && !draft && list.length) {
                remove(list[list.length - 1]);
              }
            }}
            onBlur={() => draft && add(draft)}
            className="min-w-[8rem] flex-1 bg-transparent px-1.5 py-1 text-sm outline-none dark:text-white"
          />
        )}
      </div>
      {!disabled && openSuggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-400">Quick add:</span>
          {openSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => add(suggestion)}
              className="rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 transition hover:border-emerald-500 hover:text-emerald-700 dark:border-slate-600"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      )}
      {hint && <p className="mt-1.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

// Pick any of a fixed set (roles, frequencies). Values already saved but not in
// the list stay visible, so nothing the backend holds is silently hidden.
export function MultiPick({ label, values = [], onChange, options, disabled, hint, format = (v) => v }) {
  const list = Array.isArray(values) ? values : [];
  const all = [...options, ...list.filter((value) => !options.includes(value))];
  const toggle = (option) =>
    onChange(list.includes(option) ? list.filter((value) => value !== option) : [...list, option]);

  return (
    <div>
      {label && <p className={LABEL_CLASS}>{label}</p>}
      <div className="flex flex-wrap gap-1.5">
        {all.map((option) => {
          const on = list.includes(option);
          return (
            <button
              key={option}
              type="button"
              role="checkbox"
              aria-checked={on}
              disabled={disabled}
              onClick={() => toggle(option)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed ${
                on
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-obsidian-border dark:text-slate-300"
              } ${disabled && !on ? "opacity-50" : ""}`}
            >
              {on && <Check size={12} strokeWidth={3} />}
              {format(option)}
            </button>
          );
        })}
      </div>
      {hint && <p className="mt-1.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

// An ordered list the leader can reorder with arrows (repayment waterfall).
export function OrderList({ label, values = [], onChange, disabled, hint, format = (v) => v }) {
  const list = Array.isArray(values) ? values : [];
  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div>
      {label && <p className={LABEL_CLASS}>{label}</p>}
      <ol className="space-y-1.5">
        {list.map((item, index) => (
          <li key={item} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 dark:border-obsidian-border">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600 dark:bg-obsidian-raised dark:text-slate-300">
              {index + 1}
            </span>
            <span className="flex-1 text-sm font-semibold capitalize text-slate-800 dark:text-slate-100">{format(item)}</span>
            {!disabled && (
              <span className="flex gap-0.5">
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${item} up`} className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-obsidian-raised">
                  <ArrowUp size={14} />
                </button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === list.length - 1} aria-label={`Move ${item} down`} className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-obsidian-raised">
                  <ArrowDown size={14} />
                </button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {hint && <p className="mt-1.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

// ---------- Disclosure ----------
// A group of related settings that shows its current value while closed, so a
// leader can read the whole policy without opening anything.
export function Disclosure({ title, summary, icon: Icon, defaultOpen = false, children, accent, badge }) {
  const tone = useAccent(accent);
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-obsidian-border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={bodyId}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset dark:hover:bg-obsidian-raised/40 ${tone.ring}`}
      >
        {Icon && (
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone.soft}`}>
            <Icon size={15} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
          {summary && <span className="mt-0.5 block truncate text-xs text-slate-500">{summary}</span>}
        </span>
        {badge}
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div id={bodyId} hidden={!open} className="space-y-4 border-t border-slate-100 bg-slate-50/40 px-4 py-4 dark:border-obsidian-border dark:bg-transparent">
        {children}
      </div>
    </div>
  );
}

// ---------- Drawer ----------
// A side sheet for "edit one thing" so the page behind it never turns into a
// form. Esc closes it; focus moves in on open and returns on close.
export function Drawer({ open, onClose, title, description, children, footer }) {
  const panelRef = useRef(null);
  const returnTo = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    returnTo.current = document.activeElement;
    const onKey = (event) => event.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      returnTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl outline-none dark:bg-obsidian-card"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-obsidian-border">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-obsidian-raised">
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="border-t border-slate-100 px-5 py-4 dark:border-obsidian-border">{footer}</footer>}
      </aside>
    </div>
  );
}

// ---------- Small display pieces ----------
export function StatusPill({ tone = "slate", children }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    red: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

export function CountBadge({ count, tone = "red" }) {
  if (!count) return null;
  const tones = {
    red: "bg-rose-600 text-white",
    amber: "bg-amber-500 text-white",
    neutral: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  };
  return (
    <span aria-hidden="true" className={`grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold leading-none ${tones[tone]}`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

// Sticky bar that appears only when a form has unsaved edits.
export function SaveBar({ dirty, saving, onSave, onDiscard, label = "Save changes", message = "You have unsaved changes" }) {
  if (!dirty && !saving) return null;
  return (
    <div className="sticky bottom-3 z-30 mx-auto flex w-full max-w-2xl items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-xl backdrop-blur dark:border-obsidian-border dark:bg-obsidian-card/95">
      <p className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
        <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
        {message}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>
          Discard
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? "SavingÃ¢â‚¬Â¦" : label}
        </Button>
      </div>
    </div>
  );
}
