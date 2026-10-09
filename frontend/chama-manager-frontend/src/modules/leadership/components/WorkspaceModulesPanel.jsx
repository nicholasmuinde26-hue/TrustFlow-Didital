import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Layers, Loader2 } from "lucide-react";
import { useSocket } from "@/app/providers/SocketProvider";
import useWorkspace from "@/app/hooks/useWorkspace";

import WorkspaceSetupPicker from "@/modules/workspaces/components/WorkspaceSetupPicker";
import {
  useModuleCatalog,
  useModuleChangeMutations,
  useModuleSettings,
} from "@/modules/workspaces/hooks/useWorkspaceModules";
import {
  dependencyProblems,
  diffSelections,
  matchPreset,
} from "@/modules/workspaces/utils/moduleSelection";

import { FIELD_CLASS, LABEL_CLASS, Notice, SectionCard } from "./DeskUI";

/**
 * Leadership Desk -> Governance Settings -> "Workspace features".
 *
 * Chama leaders request module changes from platform administration. Admin
 * approval applies the change immediately and records it in the audit trail.
 *
 * A module that still has live business cannot be switched off - Loans stays
 * on while members still owe money. The server computes that (`blocked`) and
 * this panel explains it, both on the row and in the summary, rather than
 * just greying a checkbox out.
 */

const errorMessage = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

export default function WorkspaceModulesPanel({ workspaceId, role }) {
  const { membership } = useWorkspace();
  const { data: catalog } = useModuleCatalog();
  const { socket } = useSocket();
  const { data: settings, isLoading, isError, refetch } = useModuleSettings(workspaceId);
  const { request, cancel } = useModuleChangeMutations(workspaceId);

  const [draft, setDraft] = useState({ preset: "custom", modules: [] });
  const [note, setNote] = useState("");
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    if (!socket) return undefined;
    const refreshModuleSettings = (event) => {
      if (String(event?.chama_id) === String(workspaceId)) refetch();
    };
    socket.on("chama:workspace_modules_changed", refreshModuleSettings);
    return () => socket.off("chama:workspace_modules_changed", refreshModuleSettings);
  }, [socket, workspaceId, refetch]);

  const labelOf = useMemo(() => {
    const index = Object.fromEntries((catalog?.modules || []).map((m) => [m.key, m.label]));
    return (key) => index[key] || key;
  }, [catalog]);

  // Start the draft from what the chama has today (and re-sync when a request
  // is decided and the live setup changes).
  const current = settings?.modules;
  useEffect(() => {
    if (current && catalog) {
      setDraft({ preset: settings.preset || matchPreset(catalog, current), modules: current });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.join("|"), catalog]);

  if (isLoading || !catalog) {
    return (
      <SectionCard icon={Layers} title="Workspace features">
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        </div>
      </SectionCard>
    );
  }

  if (isError || !settings) {
    return (
      <SectionCard icon={Layers} title="Workspace features">
        <Notice tone="error">Couldn&apos;t load the workspace features. Please refresh.</Notice>
      </SectionCard>
    );
  }

  const { pending, blocked = {}, recent = [] } = settings;
  const myMembershipId = String(membership?._id || "");
  const { enable, disable } = diffSelections(settings.modules, draft.modules);
  const problems = dependencyProblems(catalog, draft.modules);
  const blockedNames = Object.keys(blocked);

  async function submitRequest() {
    setServerError("");
    try {
      await request.mutateAsync({ modules: draft.modules, note: note.trim() });
      setNote("");
      toast.success("Feature change sent to platform administration for review.");
    } catch (err) {
      // 409 MODULE_HAS_OPEN_DATA arrives here with the reason, e.g.
      // "Loans has 4 loan(s) not yet settled. Wait until they are repaid..."
      setServerError(errorMessage(err, "Couldn't request the change."));
    }
  }

  async function withdraw() {
    setServerError("");
    try {
      await cancel.mutateAsync({ requestId: pending.id });
      toast.success("Request withdrawn.");
    } catch (err) {
      setServerError(errorMessage(err, "Couldn't withdraw the request."));
    }
  }

  // ---------------------------------------------------------------- pending
  if (pending) {
    const iAmRequester = String(pending.initiated_by) === myMembershipId;

    return (
      <SectionCard
        icon={Layers}
        title="Workspace features"
        description="A change to the chama's features is waiting for approval."
      >
        <div className="space-y-4">
          <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs dark:border-amber-900 dark:bg-amber-950/30">
            {pending.enable.length > 0 && (
              <p>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">Switch on: </span>
                {pending.enable.map(labelOf).join(", ")}
              </p>
            )}
            {pending.disable.length > 0 && (
              <p>
                <span className="font-bold text-rose-700 dark:text-rose-400">Switch off: </span>
                {pending.disable.map(labelOf).join(", ")}
              </p>
            )}
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              Waiting for platform admin review
            </p>
          </div>

          {iAmRequester && (
            <>
              <Notice tone="info">You requested this change. A platform administrator will review it; workspace features change only after approval.</Notice>
              <button
                type="button"
                onClick={withdraw}
                disabled={cancel.isPending}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
              >
                {cancel.isPending ? "Withdrawing..." : "Withdraw request"}
              </button>
            </>
          )}

          {!iAmRequester && <Notice tone="info">This request is under platform administrator review. Chama members cannot approve it.</Notice>}
          {serverError && <Notice tone="error">{serverError}</Notice>}
        </div>
      </SectionCard>
    );
  }

  // ------------------------------------------------------------ no request
  const canRequestFeatureChange = ["chairperson", "treasurer"].includes(role);
  const canSubmit =
    canRequestFeatureChange && (enable.length > 0 || disable.length > 0) && problems.length === 0 && !request.isPending;

  return (
    <SectionCard
      icon={Layers}
      title="Workspace features"
      description="Choose which features this Chama workspace includes. An admin reviews changes; disabled features are removed from navigation and access while their records remain available if restored."
    >
      <div className="space-y-4">
        {!canRequestFeatureChange && (
          <Notice tone="warn">
            Only the chairperson or treasurer can request a feature change. Platform administration reviews and applies requests.
          </Notice>
        )}

        {canRequestFeatureChange && blockedNames.length > 0 && (
          <Notice tone="info">
            <p className="font-bold">Some features can&apos;t be switched off right now</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 font-medium">
              {blockedNames.map((key) => (
                <li key={key}>{blocked[key].reason}</li>
              ))}
            </ul>
          </Notice>
        )}

        <WorkspaceSetupPicker
          value={draft}
          onChange={setDraft}
          baseline={settings.modules}
          blocked={blocked}
          readOnly={!canRequestFeatureChange}
        />

        {canRequestFeatureChange && (enable.length > 0 || disable.length > 0) && (
          <div className="space-y-3 rounded-2xl border border-slate-200 p-4 text-xs dark:border-slate-800">
            {enable.length > 0 && (
              <p>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">Switch on: </span>
                {enable.map(labelOf).join(", ")}
              </p>
            )}
            {disable.length > 0 && (
              <p>
                <span className="font-bold text-rose-700 dark:text-rose-400">Switch off: </span>
                {disable.map(labelOf).join(", ")}
              </p>
            )}

            <div>
              <label className={LABEL_CLASS} htmlFor="module-change-note">
                Reason for the change (shown to platform administrators)
              </label>
              <textarea
                id="module-change-note"
                className={`${FIELD_CLASS} min-h-[60px]`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
              />
            </div>

            {serverError && <Notice tone="error">{serverError}</Notice>}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={submitRequest}
                disabled={!canSubmit}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {request.isPending ? "Requesting..." : "Request this change"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft({ preset: settings.preset || matchPreset(catalog, settings.modules), modules: settings.modules });
                  setServerError("");
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                Reset
              </button>
              {problems.length > 0 && (
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  Fix the dependency warnings first.
                </span>
              )}
            </div>
          </div>
        )}

        {recent.length > 0 && (
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Recent changes
            </h4>
            <ul className="mt-2 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
              {recent.map((item) => (
                <li key={item.id} className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/40">
                  <span className="font-bold capitalize text-slate-800 dark:text-slate-200">{item.status}</span>
                  {" - "}
                  {[
                    item.enable.length ? `on: ${item.enable.map(labelOf).join(", ")}` : null,
                    item.disable.length ? `off: ${item.disable.map(labelOf).join(", ")}` : null,
                  ]
                    .filter(Boolean)
                    .join("; ")}
                  {item.cancel_reason && <span className="block text-rose-700 dark:text-rose-400">{item.cancel_reason}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
