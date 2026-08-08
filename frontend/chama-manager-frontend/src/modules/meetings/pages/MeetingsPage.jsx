import { useParams } from "react-router-dom";
import { CalendarClock } from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";
import { canManageMeetings } from "@/modules/workspaces/permissions/permissions";

import {
  useMeetings,
  useCreateMeeting,
  useDeleteMeeting,
} from "../hooks/useMeetings";

import MeetingCard from "../components/MeetingCard";
import MeetingComposer from "../components/MeetingComposer";
import Spinner from "@/shared/components/ui/Spinner";

export default function MeetingsPage() {
  const { workspaceId } = useParams();
  const { workspaces } = useWorkspace();

  const workspace = workspaces.find((w) => (w.id ?? w._id) === workspaceId);
  const manage = canManageMeetings(workspace?.role, workspace?.type);

  const { data: meetings = [], isLoading, isError } = useMeetings(workspaceId);
  const createMeeting = useCreateMeeting(workspaceId);
  const deleteMeeting = useDeleteMeeting(workspaceId);

  const sorted = [...meetings].sort(
    (a, b) => new Date(a.startsAt) - new Date(b.startsAt)
  );

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
        Meetings
      </h1>

      <p className="mt-2 text-slate-500 dark:text-slate-400">
        Upcoming and past meetings for this workspace.
      </p>

      <div className="mt-6 space-y-6">
        {manage && (
          <MeetingComposer
            submitting={createMeeting.isPending}
            onSubmit={(payload) => createMeeting.mutateAsync(payload)}
          />
        )}

        {isLoading && (
          <div className="py-10">
            <Spinner />
          </div>
        )}

        {isError && (
          <p className="text-sm text-red-500">
            Couldn't load meetings. Try again shortly.
          </p>
        )}

        {!isLoading && !isError && sorted.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
            <CalendarClock size={28} className="text-slate-400" />

            <p className="text-slate-500 dark:text-slate-400">
              No meetings scheduled yet.
            </p>
          </div>
        )}

        {sorted.map((meeting) => (
          <MeetingCard
            key={meeting.id ?? meeting._id}
            meeting={meeting}
            canManage={manage}
            onDelete={(item) => deleteMeeting.mutate(item.id ?? item._id)}
          />
        ))}
      </div>
    </div>
  );
}
