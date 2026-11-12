import { useState } from "react";
import { AlertCircle, Plus, Trash2, Vote } from "lucide-react";

import Dialog from "@/shared/components/ui/Dialog";
import Input from "@/shared/components/ui/Input/Input";
import { POLL_CATEGORIES, POLL_TYPES, POLL_ELIGIBILITY, categoryDefaults } from "../constants/pollMeta";

const fieldClass = "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-primary dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist";
const STEPS = ["Decision", "Ballot", "Rules"];

function defaultState() {
  const defaults = categoryDefaults("general");
  return {
    title: "", description: "", category: "general", pollType: defaults.pollType,
    options: ["", ""], eligibility: "all_members", anonymous: defaults.anonymous,
    revealResults: defaults.revealResults, quorumPercent: defaults.quorumPercent,
    passThresholdPercent: defaults.passThresholdPercent, closesAt: "",
  };
}

export default function PollComposer({ onSubmit, submitting, canPublish, open, onClose }) {
  const [form, setForm] = useState(defaultState);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const needsOptions = form.pollType !== "yes_no";

  function set(patch) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function setCategory(category) {
    const defaults = categoryDefaults(category);
    set({ category, pollType: defaults.pollType, anonymous: defaults.anonymous, revealResults: defaults.revealResults, quorumPercent: defaults.quorumPercent, passThresholdPercent: defaults.passThresholdPercent });
  }

  function updateOption(index, value) {
    const options = [...form.options];
    options[index] = value;
    set({ options });
  }

  function validateStep() {
    setError("");
    if (step === 0 && !form.title.trim()) {
      setError("Add a clear question before continuing.");
      return false;
    }
    if (step === 1 && needsOptions && form.options.filter((option) => option.trim()).length < 2) {
      setError("Add at least two ballot options before continuing.");
      return false;
    }
    return true;
  }

  async function handleSubmit(event, publish) {
    event.preventDefault();
    setError("");
    if (!form.title.trim()) {
      setError("Add a clear question before saving this vote.");
      setStep(0);
      return;
    }
    if (needsOptions && form.options.filter((option) => option.trim()).length < 2) {
      setError("Add at least two ballot options before saving this vote.");
      setStep(1);
      return;
    }

    try {
      await onSubmit({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        pollType: form.pollType,
        options: needsOptions ? form.options.map((option) => option.trim()).filter(Boolean) : undefined,
        eligibility: form.eligibility,
        anonymous: form.anonymous,
        revealResults: form.revealResults,
        quorumPercent: Number(form.quorumPercent),
        passThresholdPercent: Number(form.passThresholdPercent),
        closesAt: form.closesAt ? new Date(form.closesAt).toISOString() : undefined,
        publish,
      });
      setForm(defaultState());
      setStep(0);
      onClose?.();
    } catch (submitError) {
      setError(submitError?.response?.data?.message || submitError?.message || "Could not save this vote. Please try again.");
    }
  }

  return (
    <Dialog open={open} onClose={() => !submitting && onClose?.()} title="Call a vote" description="Set up a clear, fair decision for your members." icon={Vote}>
      <form className="space-y-5" onSubmit={(event) => handleSubmit(event, true)}>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            {STEPS.map((label, index) => (
              <button key={label} type="button" disabled={submitting || index > step} onClick={() => index < step && setStep(index)} className={`flex items-center gap-2 text-xs font-bold transition ${index === step ? "text-violet-700 dark:text-mint" : index < step ? "text-slate-500 hover:text-violet-700 dark:text-mist-muted" : "text-slate-300 dark:text-slate-600"}`}>
                <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${index === step ? "bg-violet-600 text-white dark:bg-mint dark:text-obsidian-rail" : index < step ? "bg-violet-100 text-violet-700 dark:bg-mint-deep/50 dark:text-mint" : "bg-slate-100 text-slate-400 dark:bg-obsidian-raised"}`}>{index + 1}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-obsidian-raised"><div className="h-full rounded-full bg-violet-600 transition-all duration-300 dark:bg-mint" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
        </div>

        {step === 0 && <div className="space-y-4">
          <div className="rounded-2xl bg-violet-50 px-4 py-3 text-xs text-violet-900 dark:bg-violet-950/30 dark:text-violet-200"><p className="font-bold">Start with the decision</p><p className="mt-0.5 text-violet-700/80 dark:text-violet-200/70">A focused question helps members cast a clear vote.</p></div>
          <Input label="What are members deciding?" placeholder="e.g. Approve KES 50,000 for the community hall" value={form.title} onChange={(event) => set({ title: event.target.value })} required />
          <div className="space-y-2"><label className="text-sm font-medium">Details <span className="font-normal text-slate-400">(optional)</span></label><textarea placeholder="Add context members should know before voting" value={form.description} onChange={(event) => set({ description: event.target.value })} rows={3} className={`resize-none ${fieldClass}`} /></div>
          <div className="space-y-2"><label className="text-sm font-medium">Decision category</label><select className={fieldClass} value={form.category} onChange={(event) => setCategory(event.target.value)}>{POLL_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></div>
        </div>}

        {step === 1 && <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-obsidian-raised/60"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Your question</p><p className="mt-1 text-sm font-semibold text-slate-800 dark:text-mist">{form.title}</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><label className="text-sm font-medium">Ballot type</label><select className={fieldClass} value={form.pollType} onChange={(event) => set({ pollType: event.target.value })}>{POLL_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></div>
            <div className="space-y-2"><label className="text-sm font-medium">Who can vote?</label><select className={fieldClass} value={form.eligibility} onChange={(event) => set({ eligibility: event.target.value })}>{POLL_ELIGIBILITY.map((eligibility) => <option key={eligibility.value} value={eligibility.value}>{eligibility.label}</option>)}</select></div>
          </div>
          {needsOptions && <div className="space-y-2"><div className="flex items-center justify-between"><label className="text-sm font-medium">Voting options</label><span className="text-xs text-slate-400">At least 2</span></div>{form.options.map((option, index) => <div key={index} className="flex items-center gap-2"><input className={fieldClass} placeholder={`Option ${index + 1}`} value={option} onChange={(event) => updateOption(index, event.target.value)} />{form.options.length > 2 && <button type="button" aria-label={`Remove option ${index + 1}`} onClick={() => set({ options: form.options.filter((_, optionIndex) => optionIndex !== index) })} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"><Trash2 size={16} /></button>}</div>)}<button type="button" onClick={() => set({ options: [...form.options, ""] })} className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-mint"><Plus size={14} /> Add option</button></div>}
          <label className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3 dark:border-obsidian-border"><span><span className="block text-sm font-semibold">Voting closes</span><span className="text-xs text-slate-400">Defaults to 7 days if left blank</span></span><input type="datetime-local" className="max-w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs dark:border-obsidian-border dark:bg-obsidian-raised" value={form.closesAt} onChange={(event) => set({ closesAt: event.target.value })} /></label>
        </div>}

        {step === 2 && <div className="space-y-4">
          <div className="rounded-2xl bg-violet-50 p-4 dark:bg-violet-950/30"><p className="text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-300">Ready to publish?</p><p className="mt-1 text-sm font-bold text-slate-900 dark:text-mist">{form.title}</p><p className="mt-1 text-xs capitalize text-slate-500 dark:text-mist-muted">{form.category.replaceAll("_", " ")} · {form.pollType === "yes_no" ? "Yes / No" : `${form.options.filter((option) => option.trim()).length} options`} · {form.anonymous ? "Secret ballot" : "Named ballot"}</p></div>
          <div className="space-y-5 rounded-2xl border border-slate-200 p-4 dark:border-obsidian-border">
            <label className="block space-y-2"><span className="flex justify-between text-sm font-medium"><span>Quorum</span><span className="font-bold text-violet-700 dark:text-mint">{form.quorumPercent}%</span></span><input type="range" min={0} max={100} step={5} value={form.quorumPercent} onChange={(event) => set({ quorumPercent: event.target.value })} className="w-full accent-violet-600" /><span className="block text-xs text-slate-400">Minimum share of eligible voters who must participate.</span></label>
            {form.pollType !== "election" && <label className="block space-y-2"><span className="flex justify-between text-sm font-medium"><span>Pass threshold</span><span className="font-bold text-violet-700 dark:text-mint">{form.passThresholdPercent}%</span></span><input type="range" min={1} max={100} step={1} value={form.passThresholdPercent} onChange={(event) => set({ passThresholdPercent: event.target.value })} className="w-full accent-violet-600" /></label>}
          </div>
          <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 text-sm dark:bg-obsidian-raised/60"><input type="checkbox" checked={form.anonymous} onChange={(event) => set({ anonymous: event.target.checked })} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" /><span><span className="block font-semibold">Secret ballot</span><span className="text-xs text-slate-500 dark:text-mist-muted">Keep each member’s choice private, including from officials.</span></span></label>
          <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 text-sm dark:bg-obsidian-raised/60"><input type="checkbox" checked={form.revealResults === "after_close"} onChange={(event) => set({ revealResults: event.target.checked ? "after_close" : "live" })} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" /><span><span className="block font-semibold">Hide results until voting closes</span><span className="text-xs text-slate-500 dark:text-mist-muted">Prevent running totals from influencing later votes.</span></span></label>
        </div>}

        {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end dark:border-obsidian-border">
          {step > 0 && <button type="button" disabled={submitting} onClick={() => { setError(""); setStep((current) => current - 1); }} className="mr-auto min-h-10 rounded-xl px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-mist-muted dark:hover:bg-obsidian-raised">Back</button>}
          <button type="button" disabled={submitting} onClick={(event) => handleSubmit(event, false)} className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-obsidian-border dark:text-mist dark:hover:bg-obsidian-raised">Save draft</button>
          {step < 2 ? <button type="button" disabled={submitting} onClick={() => validateStep() && setStep((current) => current + 1)} className="min-h-10 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50 dark:bg-mint dark:text-obsidian-rail">Continue</button> : canPublish && <button type="button" disabled={submitting} onClick={(event) => handleSubmit(event, true)} className="min-h-10 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50 dark:bg-mint dark:text-obsidian-rail">{submitting ? "Opening…" : "Open for voting"}</button>}
        </div>
      </form>
    </Dialog>
  );
}
