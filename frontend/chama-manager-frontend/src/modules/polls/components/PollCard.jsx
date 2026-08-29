import { useState } from "react";
import { CheckCircle2, Clock, Lock, ShieldCheck, Users, XCircle } from "lucide-react";

import Badge from "@/shared/components/ui/Badge";
import Button from "@/shared/components/ui/Button";

import { categoryLabel, OUTCOME_LABELS } from "../constants/pollMeta";

function formatDeadline(value) {
  if (!value) return null;
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusBadge(status) {
  const map = {
    draft: { label: "Draft", variant: "neutral" },
    open: { label: "Open for Voting", variant: "info" },
    closed: { label: "Closed", variant: "neutral" },
    cancelled: { label: "Cancelled", variant: "danger" },
  };
  return map[status] || map.draft;
}

function ResultBar({ optionText, count, percent, approved, isWinner }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-200">
          {optionText}
          {isWinner && <CheckCircle2 size={13} className="text-emerald-600" />}
          {approved === true && <CheckCircle2 size={13} className="text-emerald-600" />}
          {approved === false && <XCircle size={13} className="text-red-400" />}
        </span>
        <span>
          {count} vote{count === 1 ? "" : "s"} ({percent}%)
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-violet-600 transition-all"
          style={{ width: `${Math.max(percent, count > 0 ? 3 : 0)}%` }}
        />
      </div>
    </div>
  );
}

export default function PollCard({ poll, canManage, onVote, onPublish, onClose, onCancel, busy }) {
  const [selected, setSelected] = useState([]);

  const isMulti = poll.pollType === "multi_choice";
  const badge = statusBadge(poll.status);
  const outcome = poll.result ? OUTCOME_LABELS[poll.result.outcome] : null;

  function toggleOption(id) {
    if (isMulti) {
      setSelected((prev) => (prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]));
    } else {
      setSelected([id]);
    }
  }

  function submitVote() {
    if (selected.length === 0) return;
    onVote(poll.id, isMulti ? selected : selected[0]);
    setSelected([]);
  }

  const showResults = Boolean(poll.result) && (poll.status !== "open" || poll.hasVoted || canManage);
  const votingBlocked = poll.status !== "open" || !poll.canVote;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900 dark:text-white">{poll.title}</h3>
            <Badge variant={badge.variant}>{badge.label}</Badge>
            {poll.anonymous && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <ShieldCheck size={12} /> Secret ballot
              </span>
            )}
          </div>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-violet-600 dark:text-violet-400">
            {categoryLabel(poll.category)}
          </p>
        </div>

        {outcome && (
          <Badge variant={outcome.variant}>{outcome.label}</Badge>
        )}
      </div>

      {poll.description && (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{poll.description}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        {poll.closesAt && poll.status === "open" && (
          <span className="flex items-center gap-1">
            <Clock size={13} /> Closes {formatDeadline(poll.closesAt)}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Users size={13} />
          {poll.totalVotesCast} of {poll.eligibleCountSnapshot || "?"} voted
        </span>
        {poll.eligibility === "officials_only" && (
          <span className="flex items-center gap-1">
            <Lock size={13} /> Officials only
          </span>
        )}
      </div>

      {/* Voting UI */}
      {poll.status === "open" && !poll.hasVoted && poll.canVote && (
        <div className="mt-4 space-y-2">
          {poll.options.map((option) => (
            <label
              key={option.id}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-colors ${
                selected.includes(option.id)
                  ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
                  : "border-slate-200 dark:border-slate-700"
              }`}
            >
              <input
                type={isMulti ? "checkbox" : "radio"}
                name={`poll-${poll.id}`}
                checked={selected.includes(option.id)}
                onChange={() => toggleOption(option.id)}
                className="h-4 w-4 text-primary focus:ring-primary"
              />
              {option.text}
            </label>
          ))}

          <Button size="sm" disabled={busy || selected.length === 0} onClick={submitVote}>
            {busy ? "Casting Vote..." : "Cast Vote"}
          </Button>
        </div>
      )}

      {poll.status === "open" && poll.hasVoted && (
        <p className="mt-3 text-sm font-medium text-emerald-600">
          ✓ You voted — thanks for participating.
        </p>
      )}

      {poll.status === "open" && !poll.canVote && !poll.hasVoted && (
        <p className="mt-3 text-sm text-slate-400">
          You're not eligible to vote in this poll.
        </p>
      )}

      {/* Results */}
      {showResults && (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          {poll.result.tally.map((t) => (
            <ResultBar
              key={t.optionId}
              optionText={t.text}
              count={t.count}
              percent={t.percent}
              approved={t.approved}
              isWinner={poll.result.winningOptionId === t.optionId}
            />
          ))}
          {!poll.result.quorumMet && poll.status !== "open" && (
            <p className="text-xs text-amber-600">
              Quorum was not met ({poll.result.turnoutPercent}% turnout, {poll.quorumPercent}% required).
            </p>
          )}
        </div>
      )}

      {poll.status === "open" && !showResults && (
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400 dark:border-slate-800">
          Results are hidden until voting closes.
        </p>
      )}

      {/* Official controls */}
      {canManage && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          {poll.status === "draft" && (
            <>
              <Button size="sm" disabled={busy} onClick={() => onPublish(poll.id)}>
                Open for Voting
              </Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => onCancel(poll.id)}>
                Discard
              </Button>
            </>
          )}
          {poll.status === "open" && (
            <>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => onClose(poll.id)}>
                Close & Tally Now
              </Button>
              <Button size="sm" variant="danger" disabled={busy} onClick={() => onCancel(poll.id)}>
                Cancel Poll
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
