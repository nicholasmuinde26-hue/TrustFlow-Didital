import { useParams } from "react-router-dom";
import { Megaphone } from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";
import {
  canManageAnnouncements,
  canPinAnnouncement,
  canDeleteAnnouncement,
  canApproveAnnouncement,
  announcementNeedsApproval,
} from "@/modules/workspaces/permissions/Permissions";

import {
  useAnnouncements,
  useCreateAnnouncement,
  useSetAnnouncementPinned,
  useApproveAnnouncement,
  useRejectAnnouncement,
  useDeleteAnnouncement,
} from "../hooks/useAnnouncements";

import AnnouncementCard from "../components/AnnouncementCard";
import AnnouncementComposer from "../components/AnnouncementComposer";
import Spinner from "@/shared/components/ui/Spinner";

export default function AnnouncementsPage() {
  const { workspaceId } = useParams();
  const { workspaces, currentWorkspace } = useWorkspace();

  const workspace =
    workspaces.find((w) => (w.id ?? w._id) === workspaceId) ||
    currentWorkspace ||
    {};

  const type = workspace?.type || "chama";

  const manage = canManageAnnouncements(workspace?.role, type);
  const canPin = canPinAnnouncement(workspace?.role, type);
  const canDelete = canDeleteAnnouncement(workspace?.role, type);
  const canApprove = canApproveAnnouncement(workspace?.role, type);
  const needsApproval = announcementNeedsApproval(workspace?.role, type);
  const approverLabel =
    type === "contribution-group" ? "the Organizer" : "the Chairperson or Secretary";

  const { data: announcements = [], isLoading, isError } =
    useAnnouncements(workspaceId);

  const createAnnouncement = useCreateAnnouncement(workspaceId);
  const setPinned = useSetAnnouncementPinned(workspaceId);
  const approveAnnouncement = useApproveAnnouncement(workspaceId);
  const rejectAnnouncement = useRejectAnnouncement(workspaceId);
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
          ? needsApproval
            ? `Post updates for everyone in this workspace. Your posts need approval from ${approverLabel} before members see them.`
            : "Post updates for everyone in this workspace. Members can read but not remove them."
          : "Updates from your organizer."}
      </p>

      <div className="mt-6 space-y-6">
        {manage && (
          <AnnouncementComposer
            submitting={createAnnouncement.isPending}
            type={type}
            needsApproval={needsApproval}
            approverLabel={approverLabel}
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
            canPin={canPin}
            canDelete={canDelete}
            canApprove={canApprove}
            onTogglePin={(item) =>
              setPinned.mutate({
                announcementId: item.id ?? item._id,
                pinned: !item.pinned,
              })
            }
            onDelete={(item) =>
              removeAnnouncement.mutate(item.id ?? item._id)
            }
            onApprove={(item) =>
              approveAnnouncement.mutate(item.id ?? item._id)
            }
            onReject={(item) => {
              const reason = window.prompt(
                "Reason for rejecting this announcement (optional):"
              );
              if (reason === null) return;
              rejectAnnouncement.mutate({
                announcementId: item.id ?? item._id,
                reason,
              });
            }}
          />
        ))}
      </div>
    </div>
  );
}