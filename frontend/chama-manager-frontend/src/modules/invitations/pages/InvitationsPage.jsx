import { useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";

import { useMyInvitations, useAcceptInvitation } from "../hooks/useInvitations";
import InvitationCard from "../components/InvitationCard";
import Spinner from "@/shared/components/ui/Spinner";

export default function InvitationsPage() {
  const { data: invitations = [], isLoading, isError } = useMyInvitations("pending");
  const acceptInvitation = useAcceptInvitation();
  const navigate = useNavigate();

  async function handleAccept(invitation) {
    const result = await acceptInvitation.mutateAsync(invitation._id);
    const groupId = result?.group?._id || result?.membership?.contribution_group_id;

    if (groupId) {
      navigate(`/workspace/${groupId}`);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
        Invitations
      </h1>

      <p className="mt-2 text-slate-500 dark:text-slate-400">
        Contribution groups that have invited you to join. Chamas don't use
        invitations — a treasurer adds you directly.
      </p>

      <div className="mt-6 space-y-4">
        {isLoading && (
          <div className="py-10">
            <Spinner />
          </div>
        )}

        {isError && (
          <p className="text-sm text-red-500">
            Couldn't load your invitations. Try again shortly.
          </p>
        )}

        {!isLoading && !isError && invitations.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
            <Mail size={28} className="text-slate-400" />

            <p className="text-slate-500 dark:text-slate-400">
              No pending invitations.
            </p>
          </div>
        )}

        {invitations.map((invitation) => (
          <InvitationCard
            key={invitation._id}
            invitation={invitation}
            accepting={
              acceptInvitation.isPending &&
              acceptInvitation.variables === invitation._id
            }
            onAccept={handleAccept}
          />
        ))}
      </div>
    </div>
  );
}