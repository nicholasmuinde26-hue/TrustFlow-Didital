import { useState } from "react";
import { CalendarCheck, Loader2, Video, Vote } from "lucide-react";
import { Link } from "react-router-dom";

import chamaApi from "@/modules/chama/api/chama.api";
import { canManageMeetings, canManagePolls } from "@/modules/workspaces/permissions/Permissions";

import { InputField, Notice, RoleLocked, SectionCard } from "../components/DeskUI";

// ========================================
// MEETINGS & POLLS TAB
// ========================================
//
// Deliberately thin. Meetings and Polls already have full member-facing
// pages of their own, and duplicating them here would recreate exactly
// the overlap this redesign is removing. What belongs on the desk is the
// leader-only act of STARTING things — launching a live session, opening
// a vote — with everything else linking out.
//
// ========================================

export default function MeetingsPollsTab({ workspaceId, role, type, data, reload }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const mayManageMeetings = canManageMeetings(role, type);
  const mayManagePolls = canManagePolls(role, type);

  const meetings = data?.meetings || [];
  const liveCount = meetings.filter((meeting) => meeting.status === "active").length;

  const launch = async (event) => {
    event.preventDefault();
    if (!title.trim() || busy) return;

    setBusy(true);
    setFeedback(null);

    try {
      await chamaApi.createMeetingRecord(workspaceId, { title: title.trim() });
      setTitle("");
      setFeedback({ tone: "success", text: "Meeting launched and check-in is open." });
      reload?.();
    } catch (error) {
      if (error?.leadershipCancelled) return;
      setFeedback({
        tone: "error",
        text: error?.response?.data?.message || "Could not start that meeting.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}

      <SectionCard
        icon={Video}
        title="Start a live meeting"
        description={
          liveCount
            ? `${liveCount} session${liveCount === 1 ? "" : "s"} currently running.`
            : "Opens digital check-in for members straight away."
        }
      >
        {mayManageMeetings ? (
          <form onSubmit={launch} className="flex flex-wrap items-end gap-3 sm:flex-nowrap">
            <div className="min-w-0 flex-1">
              <InputField
                label="Meeting title"
                value={title}
                onChange={setTitle}
                placeholder="e.g. October monthly meeting"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !title.trim()}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
              Start meeting
            </button>
          </form>
        ) : (
          <RoleLocked>
            Only the chairperson, treasurer or secretary can call a meeting.
          </RoleLocked>
        )}
      </SectionCard>

      <div className="grid gap-6 sm:grid-cols-2">
        <SectionCard
          icon={CalendarCheck}
          title="Meetings"
          description="Agendas, minutes and attendance records."
        >
          <Link
            to={`/workspace/${workspaceId}/meetings`}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-emerald-500"
          >
            Open meetings
          </Link>
        </SectionCard>

        <SectionCard
          icon={Vote}
          title="Polls"
          description="Put a decision to the group rather than taking it for them."
        >
          {mayManagePolls ? (
            <Link
              to={`/workspace/${workspaceId}/polls`}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-emerald-500"
            >
              Open polls
            </Link>
          ) : (
            <RoleLocked>
              Polls are called by officials and committee members.
            </RoleLocked>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
