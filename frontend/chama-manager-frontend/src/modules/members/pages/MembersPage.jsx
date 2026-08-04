import { useParams } from "react-router-dom";
import { Users } from "lucide-react";

import useAuth from "@/app/hooks/useAuth";
import useWorkspace from "@/app/hooks/useWorkspace";
import { usePresence } from "@/modules/presence/hooks/usePresence";
import { canManageMembers } from "@/modules/workspaces/permissions/permissions";

import {
  useMembers,
  useInviteMember,
  useUpdateMemberRole,
  useRemoveMember,
} from "../hooks/useMembers";

import MemberRow from "../components/MemberRow";
import InviteMemberForm from "../components/InviteMemberForm";
import Spinner from "@/shared/components/ui/Spinner";

export default function MembersPage() {
  const { workspaceId } = useParams();
  const { user } = useAuth();
  const { workspaces } = useWorkspace();

  const workspace = workspaces.find((w) => (w.id ?? w._id) === workspaceId);
  const manage = canManageMembers(workspace?.role);

  const { data: members = [], isLoading, isError } = useMembers(workspaceId);
  const { data: presence = [] } = usePresence(workspaceId);

  const inviteMember = useInviteMember(workspaceId);
  const updateRole = useUpdateMemberRole(workspaceId);
  const removeMember = useRemoveMember(workspaceId);

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
          <InviteMemberForm
            submitting={inviteMember.isPending}
            onSubmit={(payload) => inviteMember.mutateAsync(payload)}
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
            const memberId = member.id ?? member._id;

            return (
              <MemberRow
                key={memberId}
                member={member}
                status={presenceById.get(String(memberId)) || "offline"}
                canManage={manage}
                isSelf={Boolean(userId) && String(memberId) === String(userId)}
                onChangeRole={(item, role) =>
                  updateRole.mutate({ memberId: item.id ?? item._id, role })
                }
                onRemove={(item) =>
                  removeMember.mutate(item.id ?? item._id)
                }
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}