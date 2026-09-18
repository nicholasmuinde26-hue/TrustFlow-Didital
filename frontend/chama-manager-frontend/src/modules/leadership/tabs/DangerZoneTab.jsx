import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";
import {
  useChamaSettings,
  useDeleteChama,
} from "@/modules/chama/hooks/useChamaSettings";

import { FIELD_CLASS, Notice } from "../components/DeskUI";

// ========================================
// DANGER ZONE TAB
// ========================================
//
// Its own tab rather than a red box stapled to the bottom of a settings
// form. On the old page, "Delete Chama" sat one scroll below fields
// people edit routinely — the kind of adjacency that produces accidents.
//
// Three independent things now stand between a mistake and a deleted
// Chama: the tab has to be chosen deliberately, the Chama's name has to
// be typed exactly, and the backend demands a fresh PIN confirmation
// (requireLeadershipStepUp) before it will act.
//
// Rendered only for the Treasurer — the sole role the backend permits to
// delete — so it isn't a dead tab for anyone else.
//
// ========================================

export default function DangerZoneTab({ workspaceId }) {
  const navigate = useNavigate();
  const { refresh } = useWorkspace();

  const { data } = useChamaSettings(workspaceId, true);
  const deleteChama = useDeleteChama(workspaceId);

  const [armed, setArmed] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const chamaName = data?.chama?.name || "";
  const nameMatches = confirmText.trim() === chamaName && chamaName.length > 0;

  const handleDelete = async () => {
    if (!nameMatches) return;

    try {
      await deleteChama.mutateAsync();
      toast.success("Chama deleted");
      if (refresh) await refresh();
      navigate("/home", { replace: true });
    } catch (error) {
      // A cancelled PIN prompt means the Treasurer changed their mind at
      // the last gate. That's the system working, not an error.
      if (error?.leadershipCancelled) {
        setArmed(false);
        setConfirmText("");
        return;
      }

      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Couldn't delete this Chama. Please try again."
      );
    }
  };

  return (
    <div className="space-y-6">
      <Notice tone="warn">
        Nothing in this section can be undone. Everything here is recorded in
        the audit trail against your name.
      </Notice>

      <section className="space-y-5 rounded-3xl border-2 border-rose-200 bg-rose-50/40 p-6 dark:border-rose-900 dark:bg-rose-950/20">
        <header className="flex items-center gap-3 border-b border-rose-200/60 pb-4 dark:border-rose-900">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
            <AlertTriangle size={20} />
          </span>
          <div>
            <h2 className="text-sm font-black text-rose-700 dark:text-rose-400">
              Delete this Chama
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Permanently removes the Chama and every member's association with
              it.
            </p>
          </div>
        </header>

        {!armed ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-xl text-xs leading-5 text-slate-600 dark:text-slate-300">
              Members lose access to their contribution history here. If the
              group is simply dormant, consider leaving it in place instead —
              the records stay readable and nothing is destroyed.
            </p>
            <button
              type="button"
              onClick={() => setArmed(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border-2 border-rose-300 px-4 py-2.5 text-xs font-black text-rose-600 transition hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-950/40"
            >
              <Trash2 size={15} /> I want to delete this Chama
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs leading-5 text-slate-700 dark:text-slate-300">
              Type <strong className="font-black">{chamaName}</strong> exactly to
              confirm. You'll then be asked for your Leadership PIN.
            </p>

            <input
              type="text"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={chamaName}
              aria-label="Type the Chama name to confirm deletion"
              className={`${FIELD_CLASS} max-w-sm border-rose-300 bg-white dark:border-rose-800 dark:bg-slate-900`}
            />

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={!nameMatches || deleteChama.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-rose-500 disabled:opacity-50"
              >
                {deleteChama.isPending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Trash2 size={15} />
                )}
                Delete permanently
              </button>

              <button
                type="button"
                onClick={() => {
                  setArmed(false);
                  setConfirmText("");
                }}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
