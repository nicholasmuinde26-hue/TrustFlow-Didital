import { useState } from "react";
import { AlertCircle, CalendarClock, Video } from "lucide-react";

import Dialog from "@/shared/components/ui/Dialog";
import Input from "@/shared/components/ui/Input/Input";

export default function MeetingComposer({ onSubmit, submitting, open, onClose }) {
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    if (!title.trim() || !startsAt) {
      setError("Add a meeting name and date to continue.");
      return;
    }

    try {
      await onSubmit({
        title: title.trim(),
        startsAt: new Date(startsAt).toISOString(),
        link: link.trim() || undefined,
      });

      setTitle("");
      setStartsAt("");
      setLink("");
      onClose?.();
    } catch (submitError) {
      setError(submitError?.response?.data?.message || submitError?.message || "Could not schedule the meeting. Please try again.");
    }
  }

  return (
    <Dialog open={open} onClose={() => !submitting && onClose?.()} title="Schedule a meeting" description="Choose a time and share a joining link so members know where to be." icon={CalendarClock}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm dark:bg-obsidian-raised dark:text-mint"><CalendarClock size={18} /></div>
          <div className="min-w-0"><p className="text-sm font-bold text-emerald-950 dark:text-emerald-100">Meeting details</p><p className="text-xs text-emerald-800/75 dark:text-emerald-200/70">{startsAt ? new Date(startsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Your selected date and time will appear here."}</p></div>
          {link.trim() && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"><Video size={13} /> Online</span>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
          <Input label="Meeting Link (optional)" placeholder="https://..." value={link} onChange={(event) => setLink(event.target.value)} />
        </div>
      </div>

        {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-obsidian-border">
          <button type="button" disabled={submitting} onClick={onClose} className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-obsidian-border dark:text-mist dark:hover:bg-obsidian-raised">Cancel</button>
          <button type="submit" disabled={submitting} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-mint dark:text-obsidian-rail">{submitting ? "Scheduling…" : "Schedule meeting"}</button>
        </div>
      </form>
    </Dialog>
  );
}
