import { useState } from "react";
import { Plus, Trash2, Vote } from "lucide-react";

import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input/Input";

import { POLL_CATEGORIES, POLL_TYPES, POLL_ELIGIBILITY, categoryDefaults } from "../constants/pollMeta";

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white";

function defaultState() {
  const defaults = categoryDefaults("general");
  return {
    title: "",
    description: "",
    category: "general",
    pollType: defaults.pollType,
    options: ["", ""],
    eligibility: "all_members",
    anonymous: defaults.anonymous,
    revealResults: defaults.revealResults,
    quorumPercent: defaults.quorumPercent,
    passThresholdPercent: defaults.passThresholdPercent,
    closesAt: "",
  };
}

export default function PollComposer({ onSubmit, submitting, canPublish }) {
  const [form, setForm] = useState(defaultState);

  function set(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function handleCategoryChange(category) {
    const defaults = categoryDefaults(category);
    set({
      category,
      pollType: defaults.pollType,
      anonymous: defaults.anonymous,
      revealResults: defaults.revealResults,
      quorumPercent: defaults.quorumPercent,
      passThresholdPercent: defaults.passThresholdPercent,
    });
  }

  function updateOption(index, value) {
    const options = [...form.options];
    options[index] = value;
    set({ options });
  }

  function addOption() {
    set({ options: [...form.options, ""] });
  }

  function removeOption(index) {
    if (form.options.length <= 2) return;
    set({ options: form.options.filter((_, i) => i !== index) });
  }

  async function handleSubmit(event, publish) {
    event.preventDefault();

    if (!form.title.trim()) return;
    if (form.pollType !== "yes_no" && form.options.filter((o) => o.trim()).length < 2) return;

    await onSubmit({
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      pollType: form.pollType,
      options: form.pollType === "yes_no" ? undefined : form.options.map((o) => o.trim()).filter(Boolean),
      eligibility: form.eligibility,
      anonymous: form.anonymous,
      revealResults: form.revealResults,
      quorumPercent: Number(form.quorumPercent),
      passThresholdPercent: Number(form.passThresholdPercent),
      closesAt: form.closesAt ? new Date(form.closesAt).toISOString() : undefined,
      publish,
    });

    setForm(defaultState());
  }

  const needsOptions = form.pollType !== "yes_no";

  return (
    <form className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
        <Vote size={18} className="text-violet-600" />
        Call a Vote
      </h3>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input
            label="What are members deciding?"
            placeholder="e.g. Approve KES 50,000 loan for Jane Wanjiru"
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
            required
          />
        </div>

        <div className="sm:col-span-2 space-y-2">
          <label className="text-sm font-medium">Details (optional)</label>
          <textarea
            placeholder="Add context members should know before voting"
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            rows={2}
            className={`resize-none ${fieldClass}`}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Category</label>
          <select
            className={fieldClass}
            value={form.category}
            onChange={(e) => handleCategoryChange(e.target.value)}
          >
            {POLL_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Ballot type</label>
          <select
            className={fieldClass}
            value={form.pollType}
            onChange={(e) => set({ pollType: e.target.value })}
          >
            {POLL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {needsOptions && (
          <div className="sm:col-span-2 space-y-2">
            <label className="text-sm font-medium">Options</label>
            {form.options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  className={fieldClass}
                  placeholder={`Option ${index + 1}`}
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                />
                {form.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addOption}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300"
            >
              <Plus size={14} /> Add option
            </button>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Who can vote</label>
          <select
            className={fieldClass}
            value={form.eligibility}
            onChange={(e) => set({ eligibility: e.target.value })}
          >
            {POLL_ELIGIBILITY.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Voting closes</label>
          <input
            type="datetime-local"
            className={fieldClass}
            value={form.closesAt}
            onChange={(e) => set({ closesAt: e.target.value })}
          />
          <p className="text-xs text-slate-400">Defaults to 7 days if left blank.</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Quorum required ({form.quorumPercent}% of eligible voters)
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={form.quorumPercent}
            onChange={(e) => set({ quorumPercent: e.target.value })}
            className="w-full"
          />
        </div>

        {form.pollType !== "election" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Pass threshold ({form.passThresholdPercent}%)
            </label>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={form.passThresholdPercent}
              onChange={(e) => set({ passThresholdPercent: e.target.value })}
              className="w-full"
            />
          </div>
        )}

        <div className="sm:col-span-2 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={form.anonymous}
              onChange={(e) => set({ anonymous: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            Secret ballot (nobody, including officials, sees who voted for what)
          </label>
        </div>

        <div className="sm:col-span-2 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={form.revealResults === "after_close"}
              onChange={(e) => set({ revealResults: e.target.checked ? "after_close" : "live" })}
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            Hide running results until voting closes
          </label>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={submitting}
          onClick={(e) => handleSubmit(e, false)}
        >
          Save as Draft
        </Button>

        {canPublish && (
          <Button type="button" disabled={submitting} onClick={(e) => handleSubmit(e, true)}>
            {submitting ? "Opening..." : "Open for Voting"}
          </Button>
        )}
      </div>
    </form>
  );
}
