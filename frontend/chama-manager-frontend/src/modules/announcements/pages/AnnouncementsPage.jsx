import { useParams } from "react-router-dom";
import { Megaphone } from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";
import { canManageAnnouncements } from "@/modules/workspaces/permissions/Permissions";

import {
  useAnnouncements,
  useCreateAnnouncement,
  useSetAnnouncementPinned,
  useDeleteAnnouncement,
} from "../hooks/useAnnouncements";

import AnnouncementCard from "../components/AnnouncementCard";
import AnnouncementComposer from "../components/AnnouncementComposer";
import Spinner from "@/shared/components/ui/Spinner";

export default function AnnouncementsPage() {
  const { workspaceId } = useParams();
  const { workspaces } = useWorkspace();

  const workspace = workspaces.find(
    (w) => (w.id ?? w._id) === workspaceId
  );

  const manage = canManageAnnouncements(workspace?.role);

  const { data: announcements = [], isLoading, isError } =
    useAnnouncements(workspaceId);

  const createAnnouncement = useCreateAnnouncement(workspaceId);
  const setPinned = useSetAnnouncementPinned(workspaceId);
  const removeAnnouncement = useDeleteAnnouncement(workspaceId);

  const sorted = [...announcements].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
        Announcements
      </h1>

      <p className="mt-2 text-slate-500 dark:text-slate-400">
        {manage
          ? "Post updates for everyone in this workspace. Members can read but not remove them."
          : "Updates from your organizer."}
      </p>

      <div className="mt-6 space-y-6">
        {manage && (
          <AnnouncementComposer
            submitting={createAnnouncement.isPending}
            onSubmit={(payload) => createAnnouncement.mutateAsync(payload)}
          />
        )}

        {isLoading && (
          <div className="py-10">
            <Spinner />
          </div>
        )}

        {isError && (
          <p className="text-sm text-red-500">
            Couldn't load announcements. Try again shortly.
          </p>
        )}

        {!isLoading && !isError && sorted.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
            <Megaphone size={28} className="text-slate-400" />

            <p className="text-slate-500 dark:text-slate-400">
              No announcements yet.
            </p>
          </div>
        )}

        {sorted.map((announcement) => (
          <AnnouncementCard
            key={announcement.id ?? announcement._id}
            announcement={announcement}
            canManage={manage}
            onTogglePin={(item) =>
              setPinned.mutate({
                announcementId: item.id ?? item._id,
                pinned: !item.pinned,
              })
            }
            onDelete={(item) =>
              removeAnnouncement.mutate(item.id ?? item._id)
            }
          />
        ))}
      </div>
    </div>
  );
}