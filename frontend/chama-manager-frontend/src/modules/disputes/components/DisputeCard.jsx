import { useState } from "react";
import { Clock, CheckCircle2, XCircle, Search } from "lucide-react";

import Button from "@/shared/components/ui/Button/Button";
import Badge from "@/shared/components/ui/Badge";

const STATUS_BADGE = {
  open: { variant: "warning", label: "Open" },
  investigating: { variant: "info", label: "Investigating" },
  resolved: { variant: "success", label: "Resolved" },
  dismissed: { variant: "neutral", label: "Dismissed" },
};

const SUBJECT_LABEL = {
  loan: "Loan decision",
  contribution: "Contribution",
  withdrawal: "Withdrawal",
  payout: "Payout",
  official_conduct: "Official's conduct",
  other: "Other",
};

export default function DisputeCard({ dispute, canManage, onUpdateStatus, isUpdating }) {
  const [notes, setNotes] = useState("");
  const [showResolveForm, setShowResolveForm] = useState(false);

  const badge = STATUS_BADGE[dispute.status] || STATUS_BADGE.open;

  const submitResolution = (status) => {
    onUpdateStatus({ disputeId: dispute.id, status, resolutionNotes: notes || undefined });
    setShowResolveForm(false);
    setNotes("");
  };

  const canAdvance = canManage && ["open", "investigating"].includes(dispute.status);

  return (
    <div className="border-b border-slate-100 py-4 last:border-0 dark:border-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {dispute.title}
            </p>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {SUBJECT_LABEL[dispute.subjectType] || dispute.subjectType} · raised by{" "}
            {dispute.raisedBy} · {new Date(dispute.createdAt).toLocaleDateString()}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {dispute.description}
          </p>
          {dispute.resolutionNotes && (
            <p className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              Resolution note: {dispute.resolutionNotes}
            </p>
          )}
        </div>
      </div>

      {canAdvance && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {dispute.status === "open" && (
            <Button
              size="sm"
              variant="secondary"
              disabled={isUpdating}
              onClick={() => submitResolution("investigating")}
            >
              <Search size={14} />
              Start investigating
            </Button>
          )}

          {!showResolveForm ? (
            <Button size="sm" variant="secondary" onClick={() => setShowResolveForm(true)}>
              <CheckCircle2 size={14} />
              Resolve / dismiss
            </Button>
          ) : (
            <div className="mt-2 w-full space-y-2">
              <textarea
                className="w-full rounded-[var(--radius-control)] border border-slate-300 bg-white p-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900"
                rows={2}
                placeholder="Resolution notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={isUpdating}
                  onClick={() => submitResolution("resolved")}
                >
                  <CheckCircle2 size={14} />
                  Mark resolved
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isUpdating}
                  onClick={() => submitResolution("dismissed")}
                >
                  <XCircle size={14} />
                  Dismiss
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowResolveForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {dispute.status === "investigating" && !canManage && (
        <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">
          <Clock size={12} />
          Under review
        </p>
      )}
    </div>
  );
}
