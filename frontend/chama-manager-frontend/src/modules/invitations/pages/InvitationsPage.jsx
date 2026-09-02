import { useNavigate } from "react-router-dom";
import { Mail, X, AlertCircle, RotateCcw } from "lucide-react";

import { useMyInvitations, useAcceptInvitation } from "../hooks/useInvitations";
import InvitationCard from "../components/InvitationCard";
import Spinner from "@/shared/components/ui/Spinner";

export default function InvitationsPage() {
  const {
    data: invitations = [],
    isLoading,
    isError,
    refetch,
  } = useMyInvitations("pending");

  const acceptInvitation = useAcceptInvitation();
  const navigate = useNavigate();

  async function handleAccept(invitation) {
    const result = await acceptInvitation.mutateAsync(invitation._id);
    const groupId = result?.group?._id || result?.membership?.contribution_group_id;

    if (groupId) {
      navigate(`/workspace/${groupId}`);
    }
  }

  function handleClose() {
    navigate("/workspaces");
  }

  return (
    <div className="mx-auto w-full max-w-2xl pb-10">
      {/* ========================================================
          HEADER — X always returns to the Workspaces hub, which
          is the only place this page is linked from.
      ======================================================== */}

      <div className="mb-6 flex items-start justify-between gap-4 sm:mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
            Invitations
          </h1>

          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Contribution groups that have invited you to join. Chamas don't
            use invitations — a treasurer adds you directly.
          </p>
        </div>

        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      {/* ======================================================
          LIST
      ====================================================== */}

      <div className="space-y-3">
        {isLoading && (
          <div className="flex justify-center py-14">
            <Spinner />
          </div>
        )}

        {isError && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            <span className="flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              Couldn't load your invitations.
            </span>

            <button
              type="button"
              onClick={() => refetch()}
              className="shrink-0 font-bold"
              aria-label="Retry loading invitations"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        )}

        {!isLoading && !isError && invitations.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-300 px-6 py-14 text-center dark:border-slate-700 sm:py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 dark:bg-slate-800">
              <Mail size={22} />
            </div>

            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              You're all caught up
            </p>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              No pending invitations right now.
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