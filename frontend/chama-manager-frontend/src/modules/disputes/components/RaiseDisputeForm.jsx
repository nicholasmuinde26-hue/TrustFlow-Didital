import { useState } from "react";

import Button from "@/shared/components/ui/Button/Button";
import Input from "@/shared/components/ui/Input/Input";
import { DISPUTE_SUBJECT_TYPES } from "../services/dispute.service";

const EMPTY = { subjectType: "other", title: "", description: "" };

export default function RaiseDisputeForm({ onSubmit, isSubmitting, onCancel }) {
  const [form, setForm] = useState(EMPTY);

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    onSubmit(form, {
      onSuccess: () => setForm(EMPTY),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          What's this about?
        </label>
        <select
          className="mt-2 h-11 w-full rounded-[var(--radius-control)] border border-slate-300 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          value={form.subjectType}
          onChange={handleChange("subjectType")}
        >
          {DISPUTE_SUBJECT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <Input
        label="Title"
        placeholder="A short summary"
        value={form.title}
        onChange={handleChange("title")}
        required
      />

      <div>
        <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Description
        </label>
        <textarea
          className="mt-2 w-full rounded-[var(--radius-control)] border border-slate-300 bg-white p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          rows={4}
          placeholder="What happened, and what would resolving this look like?"
          value={form.description}
          onChange={handleChange("description")}
          required
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" loading={isSubmitting} loadingLabel="Submitting">
          Raise dispute
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
