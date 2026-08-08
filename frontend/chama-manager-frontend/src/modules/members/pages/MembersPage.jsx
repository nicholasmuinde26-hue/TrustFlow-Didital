import { useParams } from "react-router-dom";
import { Users } from "lucide-react";

import useAuth from "@/app/hooks/useAuth";
import useWorkspace from "@/app/hooks/useWorkspace";
import { usePresence } from "@/modules/presence/hooks/usePresence";
import {
  canManageMembers,
  canInviteMembers,
} from "@/modules/workspaces/permissions/permissions";

import {
  useMembers,
  useAddMember,
  useUpdateMemberRole,
  useRemoveMember,
} from "../hooks/useMembers";
import { useSendInvitation } from "@/modules/invitations/hooks/useInvitations";

import MemberRow from "../components/MemberRow";
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

  const presenceById = new Map(
    presence.map((p) => [String(p.id ?? p._id), p.status])
  );

  const userId = user?.id ?? user?._id;

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

            return (
              <MemberRow
                key={member._id}
                member={member}
                type={type}
                status={presenceById.get(String(memberUserId)) || "offline"}
                canManage={manage}
                isSelf={Boolean(userId) && String(memberUserId) === String(userId)}
                onChangeRole={(item, role) =>
                  updateRole.mutate({ memberId: item._id, role })
                }
                onRemove={(item) => removeMember.mutate(item._id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}