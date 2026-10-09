import { useState } from "react";
import { Pin } from "lucide-react";

import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input/Input";

export default function AnnouncementComposer({
  onSubmit,
  submitting,
  type = "chama",
  needsApproval = false,
  canPin = false,
  approverLabel = "an approver",
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
    } catch (error) {
      setFormError(
        error?.response?.data?.message ||
          error?.message ||
          "Could not post the announcement. Please review the details and try again."
      );
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-obsidian-border dark:bg-obsidian-card"
    >
      <h3 className="font-semibold text-slate-900 dark:text-mist">
        Post an Announcement
      </h3>

      <div className="mt-4 space-y-3">
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

        <div className="flex items-center justify-between">
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

          <Button type="submit" disabled={submitting}>
            {submitting ? "Posting..." : "Post"}
          </Button>
        </div>
      </div>
    </form>
  );
}
