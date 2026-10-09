import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import chamaApi from "../api/chama.api";

// Reviewer's view of one person's ID photo + selfie. Loaded on demand,
// shown inline (browsers refuse to open data: URIs in a new tab, which is
// why the old "Open ID document" links did nothing).
export default function KycDocumentsModal({ workspaceId, membershipId, name, onClose }) {
  const [state, setState] = useState({ loading: true, docs: null, error: "" });
  useEffect(() => {
    let cancelled = false;
    chamaApi.getKycDocuments(workspaceId, membershipId)
      .then(({ data }) => { if (!cancelled) setState({ loading: false, docs: data.data, error: "" }); })
      .catch((err) => { if (!cancelled) setState({ loading: false, docs: null, error: err?.response?.data?.message || "Could not load the documents." }); });
    return () => { cancelled = true; };
  }, [workspaceId, membershipId]);

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 dark:bg-slate-900">
        <button type="button" aria-label="Close" onClick={onClose} className="absolute right-3 top-3 rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
        <h3 className="pr-8 text-base font-black text-slate-900 dark:text-white">Identity documents · {name}</h3>
        <p className="mt-1 text-xs text-slate-500">Private. Only the chairperson and treasurer can open these.</p>
        {state.loading && <p className="flex items-center gap-2 py-10 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />Loading…</p>}
        {state.error && <p className="py-6 text-sm text-rose-600">{state.error}</p>}
        {state.docs && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <figure><figcaption className="mb-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">ID document</figcaption><img src={state.docs.id_document_url} alt="ID document" className="w-full rounded-2xl border border-slate-200 object-contain dark:border-slate-700" /></figure>
            <figure><figcaption className="mb-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">Selfie</figcaption><img src={state.docs.selfie_url} alt="Selfie" className="w-full rounded-2xl border border-slate-200 object-contain dark:border-slate-700" /></figure>
          </div>
        )}
      </div>
    </div>
  );
}
