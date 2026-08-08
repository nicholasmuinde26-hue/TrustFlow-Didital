import { Wallet } from "lucide-react";

import Button from "@/shared/components/ui/Button";

function formatDate(value) {
  if (!value) return "";

  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function InvitationCard({ invitation, onAccept, accepting }) {
  const group = invitation.contribution_group_id || {};
  const invitedBy = invitation.invited_by;

  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex gap-4">
        <span className="rounded-xl bg-primary/10 p-3">
          <Wallet size={20} className="text-primary" />
        </span>

        <div>
          <p className="font-semibold text-slate-900 dark:text-white">
            {group.name || "Contribution Group"}
          </p>

          {invitedBy?.name && (
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Invited by {invitedBy.name}
            </p>
          )}

          {invitation.message && (
            <p className="mt-2 text-sm italic text-slate-500 dark:text-slate-400">
              "{invitation.message}"
            </p>
          )}

          {invitation.expires_at && (
            <p className="mt-2 text-xs text-slate-400">
              Expires {formatDate(invitation.expires_at)}
            </p>
          )}
        </div>
      </div>

      <Button onClick={() => onAccept(invitation)} disabled={accepting}>
        {accepting ? "Joining..." : "Accept"}
      </Button>
    </div>
  );
}