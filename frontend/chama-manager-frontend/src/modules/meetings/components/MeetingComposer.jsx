import { useState } from "react";

import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input/Input";

export default function MeetingComposer({ onSubmit, submitting }) {
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [link, setLink] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!title.trim() || !startsAt) return;

    await onSubmit({
      title: title.trim(),
      startsAt: new Date(startsAt).toISOString(),
      link: link.trim() || undefined,
    });

    setTitle("");
    setStartsAt("");
    setLink("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <h3 className="font-semibold text-slate-900 dark:text-white">
        Schedule a Meeting
      </h3>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Input
          label="Title"
          placeholder="Monthly review"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />

        <Input
          label="Date & Time"
          type="datetime-local"
          value={startsAt}
          onChange={(event) => setStartsAt(event.target.value)}
          required
        />

        <div className="sm:col-span-2">
          <Input
            label="Meeting Link (optional)"
            placeholder="https://..."
            value={link}
            onChange={(event) => setLink(event.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Scheduling..." : "Schedule"}
        </Button>
      </div>
    </form>
  );
}