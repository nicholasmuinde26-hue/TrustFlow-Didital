import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Settings2 } from "lucide-react";

import { useModuleCatalog } from "@/modules/workspaces/hooks/useWorkspaceModules";
import WorkspaceSetupPicker from "@/modules/workspaces/components/WorkspaceSetupPicker";
import { dependencyProblems, diffSelections, matchPreset } from "@/modules/workspaces/utils/moduleSelection";
import adminService from "../services/admin.service";

export default function AdminWorkspaceFeatureManager({ onChanged }) {
  const { data: catalog } = useModuleCatalog();
  const [chamas, setChamas] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState({ preset: "custom", modules: [] });
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminService.getFeatureManagedChamas();
      setChamas(result);
      setSelectedId((current) => result.some((item) => String(item.id) === String(current)) ? current : String(result[0]?.id || ""));
    } catch (error) {
      setMessage({ type: "error", text: error?.response?.data?.message || "Could not load Chama workspaces." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selected = chamas.find((item) => String(item.id) === String(selectedId));
  useEffect(() => {
    if (!selected || !catalog) return;
    setDraft({ preset: selected.preset || matchPreset(catalog, selected.modules), modules: selected.modules || [] });
    setNote("");
  }, [selected, catalog]);

  const labels = useMemo(() => Object.fromEntries((catalog?.modules || []).map((item) => [item.key, item.label])), [catalog]);
  const { enable, disable } = diffSelections(selected?.modules || [], draft.modules);
  const draftChamaType = draft.modules.includes("burial_welfare") ? "Burial & welfare" : "Standard";
  const problems = catalog ? dependencyProblems(catalog, draft.modules) : [];
  const blockedNames = Object.keys(selected?.blocked || {}).filter((key) => disable.includes(key));

  async function save() {
    if (!selected || saving || (!enable.length && !disable.length) || problems.length || blockedNames.length) return;
    setSaving(true);
    setMessage(null);
    try {
      await adminService.configureChamaFeatures(selected.id, { ...draft, note });
      setMessage({ type: "success", text: `${selected.name} feature configuration applied.` });
      await load();
      onChanged?.();
    } catch (error) {
      setMessage({ type: "error", text: error?.response?.data?.message || "Could not apply this feature configuration." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center rounded-3xl border border-slate-200 bg-white p-12 dark:border-slate-800 dark:bg-slate-900"><Loader2 className="animate-spin text-violet-600" /></div>;

  return (
    <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"><Settings2 size={18} /></span>
        <div>
          <h2 className="text-base font-black text-slate-900 dark:text-white">Manage an existing workspace</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Admins can update a Chama’s feature set at any time, even when no feature request is pending. Changes are applied immediately and audited.</p>
        </div>
      </header>

      {message && <div role="status" className={`rounded-2xl border p-3 text-xs font-semibold ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"}`}>{message.text}</div>}

      {chamas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">No active Chama workspaces found.</p>
      ) : (
        <>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Choose a Chama
            <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              {chamas.map((chama) => <option key={chama.id} value={chama.id}>{chama.name} · {chama.chama_type === "burial" ? "Burial & welfare" : "Standard"}</option>)}
            </select>
          </label>

          {selected && catalog && <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/50"><p className="text-[10px] font-bold uppercase text-slate-400">Selected Chama type</p><p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{draftChamaType}</p></div>
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/50"><p className="text-[10px] font-bold uppercase text-slate-400">Features enabled</p><p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{selected.modules.length} of {catalog.modules.length}</p></div>
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/50"><p className="text-[10px] font-bold uppercase text-slate-400">Pending request</p><p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{selected.pending_request ? "Will be replaced by this change" : "None"}</p></div>
            </div>

            {blockedNames.length > 0 && <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><p className="font-bold">Some features cannot be removed while they contain active records.</p><ul className="mt-1 list-disc pl-4">{blockedNames.map((key) => <li key={key}>{selected.blocked[key].reason}</li>)}</ul></div>}

            <WorkspaceSetupPicker value={draft} onChange={setDraft} baseline={selected.modules} blocked={selected.blocked || {}} />

            {(enable.length > 0 || disable.length > 0) && <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="grid gap-2 sm:grid-cols-2 text-xs">
                <p className="rounded-xl bg-emerald-50 p-3 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"><strong>Enable:</strong> {enable.length ? enable.map((key) => labels[key] || key).join(", ") : "None"}</p>
                <p className="rounded-xl bg-rose-50 p-3 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"><strong>Remove:</strong> {disable.length ? disable.map((key) => labels[key] || key).join(", ") : "None"}</p>
              </div>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={2} placeholder="Admin note for the audit record (optional)" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              <div className="flex justify-end">
                <button type="button" onClick={save} disabled={saving || problems.length > 0 || blockedNames.length > 0} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  {saving ? "Applying…" : "Apply feature configuration"}
                </button>
              </div>
            </div>}
          </>}
        </>
      )}
    </section>
  );
}
