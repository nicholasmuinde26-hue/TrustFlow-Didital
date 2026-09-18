import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { CalendarClock, Plus, Link2, Users, Vote } from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";
import { canManageMeetings } from "@/modules/workspaces/permissions/Permissions";
import { usePolls } from "@/modules/polls/hooks/usePolls";

import {
  useMeetings,
  useCreateMeeting,
  useDeleteMeeting,
} from "../hooks/useMeetings";

import MeetingCard from "../components/MeetingCard";
import MeetingComposer from "../components/MeetingComposer";
import Spinner from "@/shared/components/ui/Spinner";

function formatWhen(value) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MeetingsPage() {
  const { workspaceId } = useParams();
  const { workspaces } = useWorkspace();
  const [showComposer, setShowComposer] = useState(false);

  const workspace = workspaces.find((w) => (w.id ?? w._id) === workspaceId);
  const manage = canManageMeetings(workspace?.role, workspace?.type);

  const { data: meetings = [], isLoading, isError } = useMeetings(workspaceId);
  const { data: openPolls = [] } = usePolls(workspaceId, "open");

  const createMeeting = useCreateMeeting(workspaceId);
  const deleteMeeting = useDeleteMeeting(workspaceId);

  const sorted = useMemo(
    () => [...meetings].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)),
    [meetings]
  );

  const now = Date.now();
  const upcoming = sorted.filter((m) => new Date(m.startsAt).getTime() >= now);
  const past = sorted.filter((m) => new Date(m.startsAt).getTime() < now).reverse();
  const nextMeeting = upcoming[0];
  const restUpcoming = upcoming.slice(1);

  const agendaItems = nextMeeting?.agenda
    ? nextMeeting.agenda
        .split(/\r?\n+/)
        .map((s) => s.replace(/^[-•\s]+/, "").trim())
        .filter(Boolean)
    : [];

  const featuredPoll = openPolls[0];
  const topOption = featuredPoll?.options?.length
    ? [...featuredPoll.options].sort((a, b) => (b.percent || 0) - (a.percent || 0))[0]
    : null;

  async function handleCreate(payload) {
    await createMeeting.mutateAsync(payload);
    setShowComposer(false);
  }

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-mist pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1 text-xs text-slate-400 font-medium mb-1">
            <span>{workspace?.name || "Workspace"}</span>
            <span>›</span>
            <span className="text-slate-600 dark:text-mist-muted font-bold">Meetings &amp; decisions</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-mist">Meetings</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-mist-muted">
            Keep every decision moving forward.
          </p>
        </div>

        {manage && (
          <button
            onClick={() => setShowComposer((v) => !v)}
            className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-2.5 text-xs font-black text-slate-950 shadow-md hover:bg-emerald-400 transition dark:bg-mint dark:text-obsidian-rail dark:hover:bg-mint-hover"
          >
            <Plus size={16} /> {showComposer ? "Cancel" : "Schedule meeting"}
          </button>
        )}
      </div>

      {manage && showComposer && (
        <MeetingComposer
          submitting={createMeeting.isPending}
          onSubmit={handleCreate}
        />
      )}

      {isLoading && (
        <div className="py-10">
          <Spinner />
        </div>
      )}

      {isError && (
        <p className="text-sm text-red-500">Couldn't load meetings. Try again shortly.</p>
      )}

      {!isLoading && !isError && sorted.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 py-16 text-center dark:border-obsidian-border">
          <CalendarClock size={28} className="text-slate-400" />
          <p className="text-slate-500 dark:text-mist-muted">No meetings scheduled yet.</p>
        </div>
      )}

      {!isLoading && !isError && sorted.length > 0 && (
        <>
          {/* Stat row */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Upcoming</span>
              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-mist">{upcoming.length}</p>
              <p className="text-xs text-slate-500">{upcoming.length === 1 ? "meeting" : "meetings"} scheduled</p>
            </div>
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Past</span>
              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-mist">{past.length}</p>
              <p className="text-xs text-slate-500">on record</p>
            </div>
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Open polls</span>
              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-mist">{openPolls.length}</p>
              <p className="text-xs text-slate-500">awaiting votes</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {/* Hero: next meeting */}
              {nextMeeting ? (
                <div className="rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-slate-900 p-6 text-white shadow-xl border border-white/10 space-y-4 dark:from-mint-strong dark:via-obsidian-rail dark:to-obsidian-rail dark:border-mint-deep/40">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-200 dark:text-mint font-mono">
                      {formatWhen(nextMeeting.startsAt)}
                    </span>
                    <h2 className="mt-1 text-xl font-black text-white">{nextMeeting.title}</h2>
                  </div>

                  {agendaItems.length > 0 ? (
                    <ul className="space-y-1.5 text-sm text-emerald-50/90">
                      {agendaItems.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-emerald-50/70">No agenda added yet.</p>
                  )}

                  {nextMeeting.link ? (
                    <a
                      href={nextMeeting.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/25 transition"
                    >
                      <Link2 size={14} /> Join virtual meeting
                    </a>
                  ) : (
                    <p className="text-xs font-medium text-emerald-50/80">
                      📍 {nextMeeting.location || "Community Hall / Venue"}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 dark:border-obsidian-border p-8 text-center text-sm text-slate-500">
                  No upcoming meeting scheduled.
                </div>
              )}

              {/* Also upcoming */}
              {restUpcoming.length > 0 && (
                <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card space-y-4">
                  <h2 className="text-base font-black text-slate-900 dark:text-mist">Also upcoming</h2>
                  <div className="space-y-3">
                    {restUpcoming.map((m) => (
                      <MeetingCard
                        key={m.id ?? m._id}
                        meeting={m}
                        canManage={manage}
                        onDelete={(item) => deleteMeeting.mutate(item.id ?? item._id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Past meetings */}
              {past.length > 0 && (
                <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card space-y-4">
                  <h2 className="text-base font-black text-slate-900 dark:text-mist">Past meetings</h2>
                  <div className="space-y-3">
                    {past.map((m) => (
                      <MeetingCard
                        key={m.id ?? m._id}
                        meeting={m}
                        canManage={manage}
                        onDelete={(item) => deleteMeeting.mutate(item.id ?? item._id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right column */}
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 text-base font-black text-slate-900 dark:text-mist">
                    <Vote size={16} className="text-emerald-600 dark:text-mint" /> Open poll
                  </h2>
                  {workspaceId && (
                    <Link
                      to={`/workspace/${workspaceId}/polls`}
                      className="text-xs font-bold text-emerald-600 dark:text-mint hover:underline"
                    >
                      See all →
                    </Link>
                  )}
                </div>

                {featuredPoll ? (
                  <div className="space-y-3">
                    <p className="text-sm font-bold text-slate-900 dark:text-mist">{featuredPoll.title}</p>

                    {topOption && (
                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-mist-muted">
                          <span className="font-medium text-slate-700 dark:text-mist">{topOption.text}</span>
                          <span>{topOption.percent ?? 0}%</span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-obsidian-raised">
                          <div
                            className="h-full rounded-full bg-emerald-500 dark:bg-mint transition-all"
                            style={{ width: `${Math.max(topOption.percent || 0, 3)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-mist-muted">
                      <Users size={13} />
                      {featuredPoll.totalVotesCast ?? 0} of {featuredPoll.eligibleCountSnapshot || "?"} voted
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-mist-muted">No open polls right now.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}