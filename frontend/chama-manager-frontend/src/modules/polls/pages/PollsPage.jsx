import { useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, Vote } from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";
import { useTerminology } from '@/modules/workspaces/index.js';
import { canManagePolls } from '@/modules/workspaces/index.js';

import Spinner from "@/shared/components/ui/Spinner";
import Badge from "@/shared/components/ui/Badge";

import {
  usePolls,
  useCreatePoll,
  usePublishPoll,
  useCastVote,
  useClosePoll,
  useCancelPoll,
} from "../hooks/usePolls";

import PollComposer from "../components/PollComposer";
import PollCard from "../components/PollCard";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "draft", label: "Drafts" },
  { value: "closed", label: "Closed" },
];

export default function PollsPage() {
  const { workspaceId } = useParams();
  const { workspaces } = useWorkspace();
  const { moduleLabel, workspace: organizationNoun } = useTerminology();
  const [status, setStatus] = useState("all");
  const [composerOpen, setComposerOpen] = useState(false);

  const workspace = workspaces.find((w) => (w.id ?? w._id) === workspaceId);
  const manage = canManagePolls(workspace?.role, workspace?.type);

  const { data: polls = [], isLoading, isError } = usePolls(workspaceId, status);

  const createPoll = useCreatePoll(workspaceId);
  const publishPoll = usePublishPoll(workspaceId);
  const castVote = useCastVote(workspaceId);
  const closePoll = useClosePoll(workspaceId);
  const cancelPoll = useCancelPoll(workspaceId);

  const busy =
    createPoll.isPending ||
    publishPoll.isPending ||
    castVote.isPending ||
    closePoll.isPending ||
    cancelPoll.isPending;

  const openCount = polls.filter((p) => p.status === "open").length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-900 dark:text-mist">
            <Vote className="text-violet-600 dark:text-mint" />
            {moduleLabel("polls", "Polls & Voting")}
          </h1>
          <p className="mt-2 text-slate-500 dark:text-mist-muted">
            Call a vote on loans, expenditure, new members, elections, or any other
            {organizationNoun} decision — and see results tally live.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {openCount > 0 && <Badge variant="info">{openCount} open now</Badge>}
          {manage && <button type="button" onClick={() => setComposerOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 dark:bg-mint dark:text-obsidian-rail"><Plus size={16} /> Create a vote</button>}
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {manage && (
          <PollComposer
            open={composerOpen}
            onClose={() => setComposerOpen(false)}
            submitting={createPoll.isPending}
            canPublish={manage}
            onSubmit={(payload) => createPoll.mutateAsync(payload)}
          />
        )}

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                status === f.value
                  ? "bg-violet-600 text-white dark:bg-mint dark:text-obsidian-rail"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-obsidian-raised dark:text-mist-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="py-10">
            <Spinner />
          </div>
        )}

        {isError && (
          <p className="text-sm text-red-500">Couldn't load polls. Try again shortly.</p>
        )}

        {!isLoading && !isError && polls.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 py-16 text-center dark:border-obsidian-border">
            <Vote size={28} className="text-slate-400" />
            <p className="text-slate-500 dark:text-mist-muted">
              No polls {status !== "all" ? `in "${status}"` : "yet"}.
            </p>
          </div>
        )}

        {polls.map((poll) => (
          <PollCard
            key={poll.id}
            poll={poll}
            canManage={manage}
            busy={busy}
            onVote={(pollId, optionIds) => castVote.mutate({ pollId, optionIds })}
            onPublish={(pollId) => publishPoll.mutate(pollId)}
            onClose={(pollId) => closePoll.mutate(pollId)}
            onCancel={(pollId) => cancelPoll.mutate(pollId)}
          />
        ))}
      </div>
    </div>
  );
}
