import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Pencil,
  Search,
  Trash2,
  UserMinus,
  X,
} from "lucide-react";

import chamaApi from "../../chama/api/chama.api.js";
import contributionPlanApi from "../../contribution-group/api/contributionPlan.api.js";
import MgrSetupWizard from "../../chama/components/MgrSetupWizard.jsx";
import {
  ChoiceCards,
  InputField,
  Notice,
  Segmented,
  Stepper,
  ToggleRow,
  money,
  useAccent,
} from "./DeskUI";

// ========================================
// CONTRIBUTION WIZARD (create + edit)
// ========================================
//
// One place for the treasurer / chairperson to create a contribution.
//
//   name       -> chosen freely by the chama ("Hisa", "Mchango wa Mazishi")
//   behaviour  -> what the system needs to know (dues, savings, welfare...)
//
// Steps: What -> Amount -> Schedule -> Who pays -> Review.
// Picking "Merry-go-round" swaps the Amount/Schedule/Who steps for the
// existing MGR rotation setup, so it is one option in the same wizard.
//
// Templates (create mode): a Kenyan-chama starting point - table banking,
// welfare, shares, registration fee, annual subscription, project fund,
// harambee - pre-fills behaviour, schedule and a suggested late penalty.
// The name stays fully editable (English, Kiswahili or your own); amounts are
// left blank on purpose.
//
// Late penalty: per contribution, after the grace days. Fixed KES or a % of
// what is unpaid, once / weekly / monthly, optional cap.
//
// Edit mode (`plan` passed in) covers what the details endpoint edits:
// name, behaviour, amount mode, amount, late penalty, audience, per-member amounts.
// Timings are edited in the plan's own schedule panel. Any new amount
// applies from the NEXT period; past obligations are never rewritten.
//
// v2 form (same steps, same payloads - only the form changed):
//   - a numbered progress rail; finished steps can be re-opened
//   - Segmented / Stepper / ToggleRow in place of long selects and checkboxes
//   - live previews: reminder -> due -> late timeline, a worked late-penalty
//     example, and the expected total per period on the Review step
//   - searchable member picker with select-all, and a short "exceptions" list
//     instead of one amount box per member
//   - Enter moves to the next step; Esc asks before throwing a draft away
//   - a new contribution's draft survives a refresh (this browser tab only)
// ========================================


const AMOUNT_MODES = [
  { value: "fixed", label: "Fixed", detail: "Everyone pays exactly this amount." },
  { value: "minimum", label: "Minimum", detail: "At least this much. Paying more is welcome." },
  { value: "member_chooses", label: "Member chooses", detail: "This is only a suggestion. Each member picks what to pay." },
];

const AMOUNT_PRESETS = [200, 500, 1000, 2000, 5000];

const FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

const PENALTY_TYPES = [
  { value: "fixed", label: "Fixed amount" },
  { value: "percentage_of_due", label: "% of what is unpaid" },
];

const PENALTY_INTERVALS = [
  { value: "once", label: "Once" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
];

const INTERVAL_PHRASE = { once: "", weekly: " every week it stays unpaid", monthly: " every month it stays unpaid" };

/** Current month as "YYYY-MM" in the browser's local time. */
const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const AMOUNT_LABEL = {
  fixed: "Amount per period (KES)",
  minimum: "Minimum per period (KES)",
  member_chooses: "Suggested amount per period (KES)",
};

const memberName = (m) => m.user_id?.name || m.name || m.full_name || "Member";
const errText = (err) => err?.response?.data?.message || err?.message || "Something went wrong.";

const emptyDraft = {
  name: "",
  behavior: "dues",
  amount_mode: "fixed",
  amount: "",
  frequency: "monthly",
  start_month: "",
  end_month: "",
  due_day: "5",
  grace_days: "0",
  reminder_days_before: "3",
  applies_mode: "all",
  participant_ids: [],
  overrides: {}, // { [membershipId]: { amount: "500", reason: "Half share" } }
  template_key: null,
  one_time: false,
  category: null,
  target_amount: "",
  needs_target: false,
  late_enabled: false,
  late_type: "fixed",
  late_amount: "",
  late_interval: "once",
  late_max: "",
};

const lateFromRule = (r = {}) => ({
  late_enabled: Boolean(r.enabled),
  late_type: r.type || "fixed",
  late_amount: r.amount ? String(r.amount) : "",
  late_interval: r.interval || "once",
  late_max: r.max_amount ? String(r.max_amount) : "",
});

const draftFromPlan = (plan) => ({
  ...emptyDraft,
  name: plan.name || "",
  behavior: plan.behavior || "dues",
  amount_mode: plan.amount_mode || "fixed",
  amount: plan.amount ? String(Number(plan.amount)) : "",
  frequency: plan.frequency || "monthly",
  applies_mode: plan.applies_to?.mode || "all",
  participant_ids: plan.applies_to?.participant_ids || [],
  ...lateFromRule(plan.late_penalty),
  overrides: Object.fromEntries(
    (plan.member_amount_overrides || []).map((o) => [o.participant_id, { amount: String(Number(o.amount)), reason: o.reason || "" }])
  ),
});

const DRAFT_KEY = (chamaId) => `desk.contributionDraft.${chamaId}`;

const readDraft = (chamaId) => {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY(chamaId));
    return raw ? { ...emptyDraft, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
};
const writeDraft = (chamaId, draft) => {
  try {
    if (draft) window.sessionStorage.setItem(DRAFT_KEY(chamaId), JSON.stringify(draft));
    else window.sessionStorage.removeItem(DRAFT_KEY(chamaId));
  } catch {
    /* storage unavailable: the draft just is not remembered */
  }
};

const fmtDate = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// ---------- small pieces ----------

// Numbered progress rail. Finished steps can be re-opened; later ones unlock as you go.
function StepRail({ steps, step, onJump }) {
  const tone = useAccent();
  const pct = steps.length > 1 ? Math.round((step / (steps.length - 1)) * 100) : 100;
  return (
    <div className="px-5 pb-3">
      <div className="h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden="true">
        <div className={`h-full rounded-full transition-all duration-300 ${tone.bar}`} style={{ width: `${pct}%` }} />
      </div>
      <ol className="mt-3 flex gap-1 overflow-x-auto pb-1" aria-label="Steps">
        {steps.map((label, index) => {
          const done = index < step;
          const active = index === step;
          return (
            <li key={label} className="shrink-0">
              <button
                type="button"
                disabled={index > step}
                onClick={() => onJump(index)}
                aria-current={active ? "step" : undefined}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 ${tone.ring} ${
                  active
                    ? tone.active
                    : done
                    ? `${tone.soft} hover:opacity-80`
                    : "text-slate-400 dark:text-slate-500"
                }`}
              >
                <span
                  className={`grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold ${
                    active ? "bg-white/25" : done ? "bg-white/70 dark:bg-white/10" : "bg-slate-100 dark:bg-slate-800"
                  }`}
                >
                  {done ? <Check size={9} strokeWidth={3} /> : index + 1}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// "KES 500" beside quick amounts, so the usual figures are one tap.
function AmountPresets({ value, onPick }) {
  const tone = useAccent();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-semibold text-slate-400">Quick pick</span>
      {AMOUNT_PRESETS.map((amount) => {
        const selected = Number(value) === amount;
        return (
          <button
            key={amount}
            type="button"
            onClick={() => onPick(String(amount))}
            aria-pressed={selected}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 ${tone.ring} ${
              selected ? `${tone.border} ${tone.soft}` : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300"
            }`}
          >
            {amount.toLocaleString()}
          </button>
        );
      })}
    </div>
  );
}

// Reminder -> due -> late, drawn from the numbers the leader just entered.
function ScheduleTimeline({ draft }) {
  const tone = useAccent();
  const base = draft.start_month || thisMonth();
  const [year, month] = base.split("-").map(Number);
  if (!year || !month) return null;
  const day = Math.min(Math.max(Number(draft.due_day) || 1, 1), new Date(year, month, 0).getDate());
  const grace = Math.max(Number(draft.grace_days) || 0, 0);
  const remind = Math.max(Number(draft.reminder_days_before) || 0, 0);
  const points = [
    { label: remind ? `Reminder (${remind}d before)` : "No reminder", date: remind ? fmtDate(new Date(year, month - 1, day - remind)) : "-" },
    { label: "Due", date: fmtDate(new Date(year, month - 1, day)) },
    { label: grace ? `Late after ${grace}d grace` : "Late from next day", date: fmtDate(new Date(year, month - 1, day + Math.max(grace, 1))) },
  ];
  return (
    <div className={`rounded-xl border p-3.5 ${tone.border} ${tone.tint}`}>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {draft.start_month ? "First period" : "If it starts this month"}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {points.map((point, index) => (
          <div key={point.label} className="min-w-0">
            <div className="mb-1.5 flex items-center gap-1.5" aria-hidden="true">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${index === 1 ? tone.bar : "bg-slate-300 dark:bg-slate-600"}`} />
              {index < points.length - 1 && <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />}
            </div>
            <p className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">{point.label}</p>
            <p className="text-[11px] text-slate-500">{point.date}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Searchable member list with select-all, for "Selected members".
function MemberPicker({ members, selectedIds, onToggle, onSetMany }) {
  const tone = useAccent();
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? members.filter((m) => memberName(m).toLowerCase().includes(needle)) : members;
  }, [members, query]);
  const allShownSelected = shown.length > 0 && shown.every((m) => selectedIds.includes(m._id));

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
        <Search size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search members"
          aria-label="Search members"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-white"
        />
        <button
          type="button"
          onClick={() => onSetMany(shown.map((m) => m._id), !allShownSelected)}
          className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold ${tone.text} hover:bg-slate-100 dark:hover:bg-slate-800`}
        >
          {allShownSelected ? "Clear" : query ? "Select shown" : "Select all"}
        </button>
      </div>
      <div className="max-h-52 overflow-y-auto p-1.5">
        {shown.map((m) => {
          const on = selectedIds.includes(m._id);
          return (
            <button
              key={m._id}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => onToggle(m._id)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <span
                className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                  on ? `${tone.bar} border-transparent text-white` : "border-slate-300 dark:border-slate-600"
                }`}
              >
                {on && <Check size={10} strokeWidth={3} />}
              </span>
              <span className="truncate">{memberName(m)}</span>
            </button>
          );
        })}
        {!shown.length && (
          <p className="p-3 text-xs text-slate-500">{members.length ? "No member matches that search." : "No members loaded."}</p>
        )}
      </div>
      <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-800">
        {selectedIds.length} of {members.length} selected
      </p>
    </div>
  );
}

// "A different amount for some members" as a short list of exceptions you add
// one at a time, instead of an amount box for every member.
function ExceptionList({ audience, overrides, planAmount, onAdd, onChange, onRemove }) {
  const free = audience.filter((m) => !overrides[m._id]);
  const rows = audience.filter((m) => overrides[m._id]);
  return (
    <div>
      <p className="mb-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">Different amount for some members</p>
      <p className="mb-2.5 text-[11px] text-slate-500">
        For example a member holding half a share. Use "Exempt" to charge someone nothing. Optional.
      </p>

      {rows.length > 0 && (
        <ul className="mb-2.5 space-y-2">
          {rows.map((m) => {
            const o = overrides[m._id];
            return (
              <li key={m._id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-slate-800 dark:text-white">{memberName(m)}</span>
                  <button
                    type="button"
                    onClick={() => onRemove(m._id)}
                    aria-label={`Remove the exception for ${memberName(m)}`}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-[9rem_1fr_auto]">
                  <InputField
                    label="Amount"
                    type="number"
                    min="0"
                    prefix="KES"
                    placeholder={planAmount || "Plan amount"}
                    value={o.amount}
                    onChange={(v) => onChange(m._id, { amount: v })}
                  />
                  <InputField label="Reason" placeholder="Half share" value={o.reason} onChange={(v) => onChange(m._id, { reason: v })} />
                  <button
                    type="button"
                    onClick={() => onChange(m._id, { amount: "0", reason: o.reason || "Exempt" })}
                    className="mt-auto inline-flex h-[42px] items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300"
                  >
                    <UserMinus size={13} aria-hidden="true" /> Exempt
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {free.length > 0 ? (
        <select
          aria-label="Add a member with a different amount"
          value=""
          onChange={(event) => event.target.value && onAdd(event.target.value)}
          className="w-full rounded-xl border border-dashed border-slate-300 bg-transparent px-3.5 py-2.5 text-sm font-medium text-slate-500 outline-none focus:border-emerald-600 dark:border-slate-600"
        >
          <option value="">+ Add a member with a different amount...</option>
          {free.map((m) => (
            <option key={m._id} value={m._id}>
              {memberName(m)}
            </option>
          ))}
        </select>
      ) : (
        !rows.length && <p className="text-[11px] text-slate-400">No members to choose from yet.</p>
      )}
    </div>
  );
}

export default function ContributionWizard({ chamaId, behaviors = [], templates = [], plan = null, onClose, onDone }) {
  const tone = useAccent();
  const editing = Boolean(plan);
  const initialDraft = useMemo(() => (plan ? draftFromPlan(plan) : emptyDraft), [plan]);
  const initialJson = useMemo(() => JSON.stringify(initialDraft), [initialDraft]);

  // A new contribution's half-finished draft is kept for this browser tab, so a
  // refresh or an accidental close does not lose it.
  const restored = useMemo(() => (editing ? null : readDraft(chamaId)), [editing, chamaId]);
  const [draft, setDraft] = useState(() => restored || initialDraft);
  const [restoredBanner, setRestoredBanner] = useState(Boolean(restored));
  const [step, setStep] = useState(0);
  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showMgr, setShowMgr] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const isRotation = draft.behavior === "rotation";
  const dirty = JSON.stringify(draft) !== initialJson;

  useEffect(() => {
    if (!editing) writeDraft(chamaId, dirty ? draft : null);
  }, [chamaId, draft, dirty, editing]);

  useEffect(() => {
    let live = true;
    chamaApi
      .listMembers(chamaId)
      .then((res) => {
        const list = res?.data?.data?.members || res?.data?.members || res?.data?.data || [];
        if (live) setMembers(Array.isArray(list) ? list : []);
      })
      .catch(() => live && setMembers([]));
    return () => {
      live = false;
    };
  }, [chamaId]);

  // Closing with unsaved edits asks first.
  const requestClose = () => {
    if (dirty && !busy) setConfirmDiscard(true);
    else onClose?.();
  };
  const discardAndClose = () => {
    if (!editing) writeDraft(chamaId, null);
    onClose?.();
  };
  useEffect(() => {
    if (showMgr) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMgr, dirty, busy]);

  // Rotation cannot be switched to or from once a plan exists (backend rule).
  const behaviorOptions = useMemo(() => {
    const list = behaviors.filter((b) => !editing || plan.behavior === "rotation" || b.value !== "rotation");
    return list.map((b) => ({ value: b.value, label: b.label, detail: b.description }));
  }, [behaviors, editing, plan]);

  // The built-in "Late penalties" contribution has no amount or audience of its
  // own; leadership can only rename it (Kiswahili names welcome).
  const nameOnly = editing && plan?.system_key === "late_penalties";

  const steps = useMemo(() => {
    if (nameOnly) return ["What", "Review"];
    if (isRotation && !editing) return ["What", "Rotation"];
    return editing
      ? ["What", "Amount", "Late penalty", "Who pays", "Review"]
      : ["What", "Amount", "Schedule", "Late penalty", "Who pays", "Review"];
  }, [isRotation, editing, nameOnly]);

  const activeTemplate = templates.find((t) => t.key === draft.template_key) || null;

  // A template pre-fills everything except the amount. It keeps a name the
  // chama already typed; otherwise the name starts as the English suggestion.
  const applyTemplate = (t) => {
    const knownNames = templates.flatMap((x) => [x.name_en, x.name_sw]);
    const typedOwnName = draft.name.trim() && !knownNames.includes(draft.name.trim());
    setDraft((d) => ({
      ...d,
      template_key: t.key,
      name: typedOwnName ? d.name : t.name_en,
      behavior: t.behavior,
      category: t.category,
      amount_mode: t.amount_mode,
      frequency: t.frequency,
      one_time: Boolean(t.one_time),
      needs_target: Boolean(t.needs_target),
      due_day: String(t.due_day),
      grace_days: String(t.grace_days),
      end_month: t.one_time ? d.start_month || thisMonth() : "",
      start_month: t.one_time ? d.start_month || thisMonth() : d.start_month,
      ...lateFromRule(t.late_penalty || {}),
    }));
  };

  const clearTemplate = () => set({ template_key: null, one_time: false, needs_target: false, category: null });
  const current = steps[step];

  const validate = () => {
    if (current === "What" && draft.name.trim().length < 2) return "Give the contribution a name.";
    if (current === "Amount" && !(Number(draft.amount) > 0)) return "Enter an amount above zero.";
    if (current === "Schedule") {
      const day = Number(draft.due_day);
      if (!Number.isInteger(day) || day < 1 || day > 31) return "Due day must be between 1 and 31.";
      if (draft.end_month && draft.start_month && draft.end_month < draft.start_month) return "The end month cannot be before the start month.";
    }
    if (current === "Late penalty" && draft.late_enabled) {
      const amount = Number(draft.late_amount);
      if (!(amount > 0)) return "Enter the penalty amount, or switch the late penalty off.";
      if (draft.late_type === "percentage_of_due" && amount > 100) return "A percentage penalty cannot be more than 100.";
      if (draft.late_max !== "" && !(Number(draft.late_max) >= 0)) return "The penalty cap must be zero (no cap) or more.";
    }
    if (current === "Who pays" && draft.applies_mode === "selected" && draft.participant_ids.length === 0) {
      return "Choose at least one member, or apply it to everyone.";
    }
    return "";
  };

  const next = () => {
    const problem = validate();
    if (problem) return setError(problem);
    setError("");
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const back = () => {
    if (step === 0) return requestClose();
    setError("");
    setStep((s) => s - 1);
  };

  const jumpTo = (index) => {
    if (index > step) return;
    setError("");
    setStep(index);
  };

  const overridesPayload = () =>
    Object.entries(draft.overrides)
      .filter(([, v]) => v.amount !== "" && v.amount !== undefined)
      .map(([participant_id, v]) => ({ participant_id, amount: Number(v.amount), reason: v.reason || "" }));

  const latePenaltyPayload = () =>
    draft.late_enabled
      ? {
          enabled: true,
          type: draft.late_type,
          amount: Number(draft.late_amount),
          interval: draft.late_interval,
          max_amount: draft.late_max === "" ? 0 : Number(draft.late_max),
        }
      : { enabled: false };

  const finished = (payload) => {
    if (!editing) writeDraft(chamaId, null);
    onDone?.(payload);
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      if (nameOnly) {
        await contributionPlanApi.updatePlanDetails(chamaId, plan.id, { name: draft.name.trim() });
        finished({ mode: "edit", outcome: {} });
        return;
      }
      const shared = {
        late_penalty: latePenaltyPayload(),
        name: draft.name.trim(),
        behavior: draft.behavior,
        amount_mode: draft.amount_mode,
        amount: Number(draft.amount),
        applies_to: { mode: draft.applies_mode, participant_ids: draft.applies_mode === "selected" ? draft.participant_ids : [] },
        member_amount_overrides: overridesPayload(),
      };
      if (editing) {
        const res = await contributionPlanApi.updatePlanDetails(chamaId, plan.id, shared);
        finished({ mode: "edit", outcome: res.data?.data?.outcome });
      } else {
        // A one-time contribution is a single monthly period: end month = start month.
        const startMonth = draft.start_month || (draft.one_time ? thisMonth() : "");
        const endMonth = draft.one_time ? startMonth : draft.end_month;
        await contributionPlanApi.createScheduledPlan(chamaId, {
          ...shared,
          ...(draft.template_key ? { template_key: draft.template_key } : {}),
          ...(draft.category ? { category: draft.category } : {}),
          ...(draft.needs_target && Number(draft.target_amount) > 0 ? { target_amount: Number(draft.target_amount) } : {}),
          frequency: draft.frequency,
          start_month: startMonth || undefined,
          end_month: endMonth || undefined,
          due_day: Number(draft.due_day),
          grace_days: Number(draft.grace_days),
          reminder_days_before: Number(draft.reminder_days_before),
        });
        finished({ mode: "create" });
      }
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleMember = (id) =>
    set({ participant_ids: draft.participant_ids.includes(id) ? draft.participant_ids.filter((x) => x !== id) : [...draft.participant_ids, id] });

  const setManyMembers = (ids, on) =>
    set({
      participant_ids: on
        ? Array.from(new Set([...draft.participant_ids, ...ids]))
        : draft.participant_ids.filter((x) => !ids.includes(x)),
    });

  const setOverride = (id, patch) =>
    setDraft((d) => ({ ...d, overrides: { ...d.overrides, [id]: { amount: "", reason: "", ...d.overrides[id], ...patch } } }));

  const clearOverride = (id) =>
    setDraft((d) => {
      const { [id]: _drop, ...rest } = d.overrides;
      return { ...d, overrides: rest };
    });

  const audience = draft.applies_mode === "selected" ? members.filter((m) => draft.participant_ids.includes(m._id)) : members;

  // What the group can expect per period, counting exceptions and exemptions.
  const estimate = useMemo(() => {
    const base = Number(draft.amount);
    if (!(base > 0) || !audience.length) return null;
    const total = audience.reduce((sum, m) => {
      const o = draft.overrides[m._id];
      return sum + (o && o.amount !== "" && o.amount !== undefined ? Number(o.amount) || 0 : base);
    }, 0);
    return { total, count: audience.length };
  }, [audience, draft.amount, draft.overrides]);
  const estimateWord = { fixed: "", minimum: "at least ", member_chooses: "about " }[draft.amount_mode];

  if (showMgr) {
    return (
      <MgrSetupWizard
        chamaId={chamaId}
        members={members}
        onClose={() => setShowMgr(false)}
        onSuccess={() => finished({ mode: "create", rotation: true })}
      />
    );
  }

  const amountMode = AMOUNT_MODES.find((m) => m.value === draft.amount_mode);
  const lateExampleDue = Number(draft.amount) > 0 ? Number(draft.amount) : 1000;
  const lateCharge =
    draft.late_type === "percentage_of_due"
      ? Math.round((lateExampleDue * Number(draft.late_amount || 0)) / 100)
      : Number(draft.late_amount || 0);

  // Enter moves on from any text box, like a form should.
  const onContentKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    const tag = event.target.tagName;
    if ((tag === "INPUT" && event.target.type !== "search") && current !== "Review" && current !== "Rotation") {
      event.preventDefault();
      next();
    }
  };

  const stepTitle = {
    What: ["What is it?", "Pick a starting point, then name it your way."],
    Rotation: ["Rotation", "Merry-go-round has its own setup."],
    Amount: ["How much?", "Set the amount members pay each period."],
    Schedule: ["When is it due?", "Dates, grace days and reminders."],
    "Late penalty": ["Late payments", "Decide whether paying late costs extra."],
    "Who pays": ["Who pays?", "Everyone, or only some members."],
    Review: ["Review", editing ? "Check the changes, then save." : "Check everything, then create it."],
  };

  // Review: grouped, each with a shortcut back to the step that sets it.
  const reviewGroups = [
    {
      title: "Basics",
      step: "What",
      rows: [
        ["Name", draft.name],
        ...(nameOnly ? [] : [["Behaviour", behaviors.find((b) => b.value === draft.behavior)?.label || draft.behavior]]),
      ],
    },
    ...(nameOnly
      ? []
      : [
          {
            title: "Amount",
            step: "Amount",
            rows: [
              ["How it is set", amountMode?.label],
              ["Amount", `${money(draft.amount)} per period`],
              ...(!editing && draft.needs_target && Number(draft.target_amount) > 0 ? [["Target", money(draft.target_amount)]] : []),
            ],
          },
          ...(!editing
            ? [
                {
                  title: "Schedule",
                  step: "Schedule",
                  rows: [
                    ["Repeats", draft.one_time ? "Once" : draft.frequency],
                    ["Due day", `Day ${draft.due_day}, ${draft.grace_days} grace day(s), reminder ${draft.reminder_days_before} day(s) before`],
                    ["Runs", `${draft.start_month || "from this month"}${draft.one_time ? "" : draft.end_month ? ` to ${draft.end_month}` : ", ongoing"}`],
                  ],
                },
              ]
            : []),
          {
            title: "Late penalty",
            step: "Late penalty",
            rows: [
              [
                "Penalty",
                draft.late_enabled
                  ? `${draft.late_type === "percentage_of_due" ? `${draft.late_amount}% of what is unpaid` : money(draft.late_amount)}, ${PENALTY_INTERVALS.find((i) => i.value === draft.late_interval)?.label.toLowerCase()}${
                      Number(draft.late_max) > 0 ? `, up to ${money(draft.late_max)}` : ""
                    }`
                  : "None",
              ],
            ],
          },
          {
            title: "Who pays",
            step: "Who pays",
            rows: [
              ["Applies to", draft.applies_mode === "all" ? "All members" : `${draft.participant_ids.length} selected member(s)`],
              ["Custom amounts", String(overridesPayload().length || "None")],
            ],
          },
        ]),
  ];

  const [title, subtitle] = stepTitle[current] || ["", ""];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={editing ? `Edit ${plan.name}` : "New contribution"}
        className="flex max-h-[94vh] w-full max-w-2xl flex-col rounded-t-3xl bg-white shadow-xl dark:bg-slate-900 sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {editing ? `Editing ${plan.name}` : "New contribution"} - step {step + 1} of {steps.length}
            </p>
            <h3 className="mt-0.5 text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <StepRail steps={steps} step={step} onJump={jumpTo} />

        <div className="flex-1 space-y-4 overflow-y-auto border-t border-slate-100 p-5 dark:border-slate-800" onKeyDown={onContentKeyDown}>
          {restoredBanner && !editing && (
            <Notice tone="info">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span>We kept your unfinished draft from earlier.</span>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(emptyDraft);
                    setStep(0);
                    setRestoredBanner(false);
                    writeDraft(chamaId, null);
                  }}
                  className="font-semibold underline"
                >
                  Start over
                </button>
              </span>
            </Notice>
          )}
          {confirmDiscard && (
            <div role="alertdialog" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <span className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={14} aria-hidden="true" /> {editing ? "Discard your changes?" : "Close without creating it?"}
              </span>
              <span className="flex gap-2">
                <button type="button" onClick={() => setConfirmDiscard(false)} className="rounded-lg px-3 py-1.5 font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40">
                  Keep editing
                </button>
                <button type="button" onClick={discardAndClose} className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-500">
                  {editing ? "Discard" : "Close"}
                </button>
              </span>
            </div>
          )}
          {error && <Notice tone="error">{error}</Notice>}

          {current === "What" && (
            <>
              {!editing && templates.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">Start from a template (optional)</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {templates.map((t) => {
                      const selected = draft.template_key === t.key;
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => (selected ? clearTemplate() : applyTemplate(t))}
                          aria-pressed={selected}
                          className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 ${tone.ring} ${
                            selected ? `${tone.border} ${tone.tint}` : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
                          }`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-bold text-slate-900 dark:text-white">{t.name_en}</span>
                            <span className="block truncate text-[11px] text-slate-500">{t.name_sw}</span>
                          </span>
                          <span
                            className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                              selected ? `${tone.bar} border-transparent text-white` : "border-slate-300 dark:border-slate-600"
                            }`}
                          >
                            {selected && <Check size={10} strokeWidth={3} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {activeTemplate && (
                    <div className="mt-2 space-y-2">
                      <p className="text-[11px] text-slate-500">{activeTemplate.description_en}</p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="text-slate-500">Use name:</span>
                        {[activeTemplate.name_en, activeTemplate.name_sw].map((nm) => (
                          <button
                            key={nm}
                            type="button"
                            onClick={() => set({ name: nm })}
                            aria-pressed={draft.name === nm}
                            className={`rounded-full border px-2.5 py-1 font-semibold transition ${
                              draft.name === nm ? `${tone.border} ${tone.soft}` : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {nm}
                          </button>
                        ))}
                        <span className="text-slate-400">or type your own below</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <InputField
                label="Name"
                value={draft.name}
                onChange={(v) => set({ name: v })}
                placeholder="Hisa, Mchango wa Mazishi, Ada ya Mwaka..."
                hint="Any name, in any language. The system never reads meaning from it."
                autoFocus
              />
              {!nameOnly && (
                <ChoiceCards label="Behaviour" value={draft.behavior} onChange={(v) => set({ behavior: v })} options={behaviorOptions} />
              )}
              {nameOnly && <Notice tone="info">Penalties are added here automatically when a contribution is paid late. You can rename this in any language.</Notice>}
              {isRotation && !editing && (
                <Notice tone="info">Merry-go-round needs a rotation, so the next step is the rotation setup.</Notice>
              )}
            </>
          )}

          {current === "Rotation" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Set the rotation order, amount and payout rules. It will appear on the dashboard like any other contribution.
              </p>
              <button
                type="button"
                onClick={() => setShowMgr(true)}
                className={`rounded-xl px-4 py-2.5 text-xs font-semibold ${tone.solid}`}
              >
                Open rotation setup
              </button>
              <p className="text-[11px] text-slate-500">Name entered here ("{draft.name}") is not carried into the rotation setup yet.</p>
            </div>
          )}

          {current === "Amount" && (
            <>
              <Segmented
                label="How is the amount set?"
                value={draft.amount_mode}
                onChange={(v) => set({ amount_mode: v })}
                options={AMOUNT_MODES.map(({ value, label }) => ({ value, label }))}
                hint={amountMode?.detail}
              />
              <InputField
                label={AMOUNT_LABEL[draft.amount_mode]}
                type="number"
                min="1"
                inputMode="numeric"
                prefix="KES"
                value={draft.amount}
                onChange={(v) => set({ amount: v })}
                autoFocus
              />
              <AmountPresets value={draft.amount} onPick={(v) => set({ amount: v })} />
              {!editing && draft.needs_target && (
                <InputField
                  label="Target to raise (optional)"
                  type="number"
                  min="1"
                  prefix="KES"
                  value={draft.target_amount}
                  onChange={(v) => set({ target_amount: v })}
                  hint="The goal this fund or harambee is working toward."
                />
              )}
              {editing && (
                <Notice tone="info">A new amount applies from the next period. Periods already open, and anything paid, stay as they are.</Notice>
              )}
            </>
          )}

          {current === "Schedule" && (
            <>
              {draft.one_time ? (
                <Notice tone="info">This is charged once, in the month you pick below.</Notice>
              ) : (
                <Segmented
                  label="Repeats"
                  value={draft.frequency}
                  onChange={(v) => set({ frequency: v })}
                  options={FREQUENCIES}
                  hint={draft.frequency !== "monthly" ? "Quarterly and yearly amounts fall due in the first month of each period (for yearly, the start of the financial year)." : undefined}
                />
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  label={draft.one_time ? "Month charged" : "Start month"}
                  type="month"
                  value={draft.start_month}
                  onChange={(v) => set(draft.one_time ? { start_month: v, end_month: v } : { start_month: v })}
                  hint="Defaults to the current month"
                />
                {!draft.one_time && (
                  <InputField label="End month (optional)" type="month" value={draft.end_month} onChange={(v) => set({ end_month: v })} hint="Blank = ongoing" />
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Stepper label="Due day of the month" value={draft.due_day} onChange={(v) => set({ due_day: String(v) })} min={1} max={31} />
                <Stepper label="Grace days" value={draft.grace_days} onChange={(v) => set({ grace_days: String(v) })} min={0} max={60} suffix="days" />
                <Stepper label="Reminder before due" value={draft.reminder_days_before} onChange={(v) => set({ reminder_days_before: String(v) })} min={0} max={30} suffix="days" />
              </div>
              <ScheduleTimeline draft={draft} />
            </>
          )}

          {current === "Late penalty" && (
            <>
              <ToggleRow
                label="Charge a penalty when someone pays late"
                description="Late members are otherwise simply marked overdue."
                checked={draft.late_enabled}
                onChange={(v) => set({ late_enabled: v })}
              />

              {draft.late_enabled && (
                <>
                  <Segmented label="Penalty is" value={draft.late_type} onChange={(v) => set({ late_type: v })} options={PENALTY_TYPES} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InputField
                      label={draft.late_type === "percentage_of_due" ? "Percent of what is unpaid" : "Penalty amount"}
                      type="number"
                      min="1"
                      prefix={draft.late_type === "percentage_of_due" ? undefined : "KES"}
                      suffix={draft.late_type === "percentage_of_due" ? "%" : undefined}
                      value={draft.late_amount}
                      onChange={(v) => set({ late_amount: v })}
                    />
                    <InputField
                      label="Most one member can be charged (optional)"
                      type="number"
                      min="0"
                      prefix="KES"
                      value={draft.late_max}
                      onChange={(v) => set({ late_max: v })}
                      hint="Leave blank for no limit"
                    />
                  </div>
                  <Segmented label="Charged" value={draft.late_interval} onChange={(v) => set({ late_interval: v })} options={PENALTY_INTERVALS} />

                  {lateCharge > 0 && (
                    <div className={`rounded-xl border px-4 py-3 text-xs leading-5 ${tone.border} ${tone.tint} text-slate-700 dark:text-slate-200`}>
                      <span className="font-bold">Example. </span>
                      Someone who owes {money(lateExampleDue)} and misses the grace period ({draft.grace_days || 0} day(s)) is charged {money(lateCharge)}
                      {INTERVAL_PHRASE[draft.late_interval]}
                      {Number(draft.late_max) > 0 ? `, up to ${money(draft.late_max)} in total` : ""}.
                    </div>
                  )}
                </>
              )}

              <Notice tone="info">
                The penalty is added automatically to the member's dues under "Late penalties". It stops growing once they pay, and leadership can waive it.
                {editing ? " Changes apply to penalties from now on; penalties already added are not reduced." : ""}
              </Notice>
            </>
          )}

          {current === "Who pays" && (
            <>
              <Segmented
                label="Applies to"
                value={draft.applies_mode}
                onChange={(v) => set({ applies_mode: v })}
                options={[
                  { value: "all", label: "All members" },
                  { value: "selected", label: "Selected members" },
                ]}
              />

              {draft.applies_mode === "selected" && (
                <MemberPicker members={members} selectedIds={draft.participant_ids} onToggle={toggleMember} onSetMany={setManyMembers} />
              )}

              <ExceptionList
                audience={audience}
                overrides={draft.overrides}
                planAmount={draft.amount}
                onAdd={(id) => setOverride(id, {})}
                onChange={setOverride}
                onRemove={clearOverride}
              />

              {estimate && (
                <p className="rounded-xl bg-slate-50 px-4 py-2.5 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                  {estimate.count} member{estimate.count === 1 ? "" : "s"} paying {estimateWord}
                  <span className="font-bold text-slate-900 dark:text-white">{money(estimate.total)}</span> each period.
                </p>
              )}
              {editing && <Notice tone="info">Changed amounts apply to future periods only.</Notice>}
            </>
          )}

          {current === "Review" && (
            <>
              <div className="space-y-3">
                {reviewGroups.map((group) => (
                  <section key={group.title} className="rounded-xl border border-slate-200 dark:border-slate-700">
                    <header className="flex items-center justify-between border-b border-slate-100 px-4 py-2 dark:border-slate-800">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{group.title}</h4>
                      {steps.includes(group.step) && (
                        <button
                          type="button"
                          onClick={() => jumpTo(steps.indexOf(group.step))}
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${tone.text}`}
                        >
                          <Pencil size={11} aria-hidden="true" /> Edit
                        </button>
                      )}
                    </header>
                    <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1.5 px-4 py-3 text-xs">
                      {group.rows.map(([term, value]) => (
                        <div key={term} className="contents">
                          <dt className="text-slate-500">{term}</dt>
                          <dd className="min-w-0 break-words font-medium text-slate-800 dark:text-slate-100">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
              </div>
              {!nameOnly && estimate && (
                <p className={`rounded-xl border px-4 py-3 text-xs ${tone.border} ${tone.tint} text-slate-700 dark:text-slate-200`}>
                  Expected each period: {estimateWord}
                  <span className="font-bold">{money(estimate.total)}</span> from {estimate.count} member{estimate.count === 1 ? "" : "s"}.
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 p-4 dark:border-slate-800">
          <button
            type="button"
            onClick={back}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {step === 0 ? "Cancel" : "Back"}
          </button>

          {current === "Rotation" ? null : current === "Review" ? (
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-60 ${tone.solid}`}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {editing ? "Save changes" : "Create contribution"}
            </button>
          ) : (
            <button type="button" onClick={next} className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold ${tone.solid}`}>
              Next <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
