import { useState } from "react";
import { useParams } from "react-router-dom";
import { Users } from "lucide-react";

import useAuth from "@/app/hooks/useAuth";
import useWorkspace from "@/app/hooks/useWorkspace";
import { usePresence } from "@/modules/presence/hooks/usePresence";
import {
  canManageMembers,
  canInviteMembers,
  canEditMemberProfile,
} from "@/modules/workspaces/permissions/Permissions";

import {
  useMembers,
  useAddMember,
  useUpdateMemberRole,
  useRemoveMember,
  useUpdateMemberProfile,
  useUpdateMemberStatus,
  useTransferTreasurer,
} from "../hooks/useMembers";
import { useSendInvitation } from "@/modules/invitations/hooks/useInvitations";

import MemberRow from "../components/MemberRow";
import EditProfileModal from "../components/EditProfileModal";
import AddMemberForm from "../components/AddMemberForm";
import InviteMemberForm from "../components/InviteMemberForm";
import Spinner from "@/shared/components/ui/Spinner";

export default function MembersPage() {
  const { workspaceId } = useParams();
  const { user } = useAuth();
  const { workspaces } = useWorkspace();

  const workspace = workspaces.find((w) => (w.id ?? w._id) === workspaceId);
  const type = workspace?.type;

  const manage = canManageMembers(workspace?.role, type);
  const canInvite = canInviteMembers(workspace?.role, type);

  const { data: members = [], isLoading, isError } = useMembers(type, workspaceId);
  const { data: presence = [] } = usePresence(workspaceId);

  const addMember = useAddMember(type, workspaceId);
  const updateRole = useUpdateMemberRole(type, workspaceId);
  const removeMember = useRemoveMember(type, workspaceId);
  const sendInvitation = useSendInvitation(workspaceId);
  const updateProfile = useUpdateMemberProfile(type, workspaceId);
  const updateStatus = useUpdateMemberStatus(type, workspaceId);
  const transferTreasurer = useTransferTreasurer(type, workspaceId);

  const [editingMember, setEditingMember] = useState(null);
  const [actionError, setActionError] = useState(null);

  const presenceById = new Map(
    presence.map((p) => [String(p.id ?? p._id), p.status])
  );

  const userId = user?.id ?? user?._id;

  const handleToggleStatus = (member) => {
    setActionError(null);
    const nextStatus = member.status === "active" ? "suspended" : "active";
    updateStatus.mutate(
      { memberId: member._id, status: nextStatus },
      {
        onError: (error) =>
          setActionError(error.response?.data?.message || "Could not update member status."),
      }
    );
  };

  const handleMakeTreasurer = (member) => {
    setActionError(null);
    if (!window.confirm(`Make ${member.user_id?.name || "this member"} the treasurer?`)) return;
    transferTreasurer.mutate(member._id, {
      onError: (error) =>
        setActionError(error.response?.data?.message || "Could not transfer the treasurer role."),
    });
  };

  const handleSaveProfile = async (payload) => {
    await updateProfile.mutateAsync({ memberId: editingMember._id, payload });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Members
          </h1>

          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {members.length} {members.length === 1 ? "member" : "members"} in
            this workspace.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {manage && (
          <AddMemberForm
            submitting={addMember.isPending}
            onSubmit={(userId) => addMember.mutateAsync(userId)}
          />
        )}

        {canInvite && (
          <InviteMemberForm
            submitting={sendInvitation.isPending}
            onSubmit={(payload) => sendInvitation.mutateAsync(payload)}
          />
        )}

        {isLoading && (
          <div className="py-10">
            <Spinner />
          </div>
        )}

        {isError && (
          <p className="text-sm text-red-500">
            Couldn't load members. Try again shortly.
          </p>
        )}

        {actionError && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
            {actionError}
          </p>
        )}

        {!isLoading && !isError && members.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
            <Users size={28} className="text-slate-400" />

            <p className="text-slate-500 dark:text-slate-400">
              No members yet.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {members.map((member) => {
            const memberUserId = member.user_id?._id ?? member.user_id;
            const isSelf = Boolean(userId) && String(memberUserId) === String(userId);

            return (
              <MemberRow
                key={member._id}
                member={member}
                type={type}
                status={presenceById.get(String(memberUserId)) || "offline"}
                canManage={manage}
                canEditProfile={canEditMemberProfile(workspace?.role, type, isSelf)}
                isSelf={isSelf}
                onChangeRole={(item, role) =>
                  updateRole.mutate({ memberId: item._id, role })
                }
                onRemove={(item) => removeMember.mutate(item._id)}
                onEditProfile={(item) => setEditingMember(item)}
                onToggleStatus={handleToggleStatus}
                onMakeTreasurer={handleMakeTreasurer}
                updatingRole={updateRole.isPending}
                updatingStatus={updateStatus.isPending}
                transferring={transferTreasurer.isPending}
              />
            );
          })}
        </div>
      </div>

      <EditProfileModal
        open={Boolean(editingMember)}
        onClose={() => setEditingMember(null)}
        initial={editingMember?.user_id || {}}
        onSave={handleSaveProfile}
        saving={updateProfile.isPending}
      />
    </div>
  );
}