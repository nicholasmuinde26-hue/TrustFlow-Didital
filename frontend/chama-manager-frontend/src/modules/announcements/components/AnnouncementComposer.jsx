import { useState } from "react";
import { Megaphone, Pin } from "lucide-react";

import Dialog from "@/shared/components/ui/Dialog";
import Input from "@/shared/components/ui/Input/Input";

export default function AnnouncementComposer({
  onSubmit,
  submitting,
  type = "chama",
  needsApproval = false,
  canPin = false,
  approverLabel = "an approver",
  open = false,
  onClose,
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [titleError, setTitleError] = useState("");
  const [formError, setFormError] = useState("");
  const [pinned, setPinned] = useState(false);
  const [transparencyReason, setTransparencyReason] = useState("");
  const [penaltyDetails, setPenaltyDetails] = useState("");

  const isChama = type === "chama";
  const isContributionGroup = type === "contribution-group";

  async function handleSubmit(event) {
    event.preventDefault();

    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    setTitleError("");
    setFormError("");

    if (cleanTitle.length < 3) {
      setTitleError("Enter a title with at least 3 characters.");
      return;
    }
    if (cleanContent.length < 3) {
      setFormError("Enter announcement details with at least 3 characters.");
      return;
    }
    if (isChama && !transparencyReason.trim()) {
      setFormError("Add a transparency reason before posting this Chama announcement.");
      return;
    }
    if (isContributionGroup && !penaltyDetails.trim()) {
      setFormError("Add the accountability details before posting this announcement.");
      return;
    }

    const payload = { title: cleanTitle, content: cleanContent, pinned };
    if (isChama) {
      payload.chamaDetails = { transparencyReason: transparencyReason.trim() };
    }
    if (isContributionGroup) {
      payload.contributionDetails = { penaltyDetails: penaltyDetails.trim() };
    }

    try {
      await onSubmit(payload);
      setTitle("");
      setContent("");
      setPinned(false);
      setTransparencyReason("");
      setPenaltyDetails("");
      onClose?.();
    } catch (error) {
      setFormError(
        error?.response?.data?.message ||
          error?.message ||
          "Could not post the announcement. Please review the details and try again."
      );
    }
  }

  return (
    <Dialog open={open} onClose={() => !submitting && onClose?.()} title="Post an announcement" description={needsApproval ? `Share an update for review by ${approverLabel}.` : "Write an update your workspace can read and refer back to."} icon={Megaphone} size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-sky-50 px-4 py-3 dark:bg-sky-950/30">
          <div className="flex items-center gap-2 text-sm font-semibold text-sky-900 dark:text-sky-200"><Megaphone size={16} /> Workspace update</div>
          <span className="text-xs tabular-nums text-sky-700 dark:text-sky-300">{content.length.toLocaleString()} / 5,000</span>
        </div>
        <Input
          placeholder="Title"
          hint="Use 3 to 150 characters."
          error={titleError}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setTitleError("");
            setFormError("");
          }}
          onInvalid={(event) => {
            event.preventDefault();
            setTitleError(
              event.currentTarget.validity.valueMissing
                ? "Enter an announcement title."
                : "Enter a title with at least 3 characters."
            );
          }}
          minLength={3}
          maxLength={150}
          required
        />

        <textarea
          placeholder="What do members need to know?"
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            setFormError("");
          }}
          onInvalid={(event) => {
            event.preventDefault();
            setFormError(
              event.currentTarget.validity.valueMissing
                ? "Enter the announcement details."
                : "Enter announcement details with at least 3 characters."
            );
          }}
          rows={3}
          minLength={3}
          maxLength={5000}
          required
          className="
            w-full resize-none rounded-xl border border-slate-200 bg-white
            px-4 py-3 text-sm text-slate-900 outline-none transition-colors
            focus:border-primary
            dark:border-obsidian-border dark:bg-obsidian-raised dark:text-mist
          "
        />

        {formError && (
          <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
            {formError}
          </p>
        )}

        {isChama && (
          <Input
            placeholder="Transparency reason (why members should know this)"
            value={transparencyReason}
            onChange={(event) => setTransparencyReason(event.target.value)}
            required
          />
        )}

        {isContributionGroup && (
          <Input
            placeholder="Penalty details (accountability for missed action)"
            value={penaltyDetails}
            onChange={(event) => setPenaltyDetails(event.target.value)}
            required
          />
        )}

        {needsApproval && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            This will be sent to {approverLabel} for approval before members see it.
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-obsidian-border">
          {canPin && !needsApproval ? (
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-mist-muted">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(event) => setPinned(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <Pin size={14} />
              Pin to top
            </label>
          ) : <span />}
          <div className="flex justify-end gap-2">
            <button type="button" disabled={submitting} onClick={onClose} className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-obsidian-border dark:text-mist dark:hover:bg-obsidian-raised">Cancel</button>
            <button type="submit" disabled={submitting} className="min-h-10 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50">{submitting ? "Posting…" : needsApproval ? "Submit for approval" : "Post announcement"}</button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
