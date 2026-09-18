import {
  Users,
  ShieldCheck,
  HandCoins,
  ArrowLeftRight,
  RefreshCw,
  Activity,
} from "lucide-react";

import Badge from "@/shared/components/ui/Badge";

const CATEGORY_ICON = {
  membership: Users,
  governance: ShieldCheck,
  loan: HandCoins,
  payout: ArrowLeftRight,
  correction: RefreshCw,
  other: Activity,
};

// Not every event is "good news" — a rejection or a suspension is still
// something a member should see, just flagged differently. Anything not
// listed here falls back to the neutral "info" badge.
const NEGATIVE_ACTIONS = new Set([
  "MEMBER_REMOVED",
  "MEMBER_JOIN_REJECTED",
  "CHAMA_SUSPENDED",
  "LOAN_REJECTED",
  "LOAN_DEFAULTED",
]);

const POSITIVE_ACTIONS = new Set([
  "MEMBER_ADDED",
  "MEMBER_JOIN_APPROVED",
  "CHAMA_ACTIVATED",
  "LOAN_APPROVED",
  "LOAN_DISBURSED",
  "LOAN_CLOSED",
  "PAYOUT_TRIGGERED",
]);

function badgeVariant(action) {
  if (NEGATIVE_ACTIONS.has(action)) return "danger";
  if (POSITIVE_ACTIONS.has(action)) return "success";
  return "info";
}

function formatAmount(amount) {
  if (amount === null || amount === undefined) return null;
  return `KES ${Number(amount).toLocaleString()}`;
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TrustTimelineEvent({ event }) {
  const Icon = CATEGORY_ICON[event.category] || Activity;
  const amount = formatAmount(event.amount);

  return (
    <div className="flex gap-3 border-b border-slate-100 py-4 last:border-b-0 dark:border-obsidian-border">
      <div className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-obsidian-raised dark:text-mist-muted">
        <Icon size={16} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-slate-800 dark:text-mist">
            {event.title}
          </p>
          <Badge variant={badgeVariant(event.action)}>
            {event.category}
          </Badge>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-mist-muted">
          <span>{formatTimestamp(event.timestamp)}</span>
          {amount && <span className="font-medium text-slate-600 dark:text-mist-muted">{amount}</span>}
        </div>
      </div>
    </div>
  );
}
