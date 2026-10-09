import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import chamaApi from "../api/chama.api";
import ImagePicker from "./ImagePicker";

// ========================================
// CHAMA PUBLIC PROFILE EDITOR
// ========================================
//
// The Chama's own public page: logo, cover, tagline and details. The
// chairperson and secretary can change it at any time. It saves through
// its own endpoint, so it does NOT ask for the payment PIN (that guards
// M-Pesa / bank details, which this never touches).
//
// ========================================

const FIELD = "w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white";
const LABEL = "mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300";
const TEXT_KEYS = ["tagline", "purpose", "location", "description", "contact_email", "website"];

const toForm = (p = {}) => ({
  enabled: Boolean(p.enabled), tagline: p.tagline || "", purpose: p.purpose || "", location: p.location || "", description: p.description || "",
  contact_email: p.contact_email || "", website: p.website || "", logo_url: p.logo_url || null, cover_url: p.cover_url || null,
});

export default function ChamaPublicProfileEditor({ workspaceId, canEdit, chamaIsPublic, onSaved }) {
  const [form, setForm] = useState(null);
  const [initial, setInitial] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canEdit) return undefined;
    let cancelled = false;
    chamaApi.getPublicSettings(workspaceId)
      .then(({ data }) => { if (!cancelled) { const f = toForm(data.data); setForm(f); setInitial(f); } })
      .catch((err) => { if (!cancelled) setError(err?.response?.data?.message || "Could not load the public profile."); });
    return () => { cancelled = true; };
  }, [workspaceId, canEdit]);

  if (!canEdit) return <p className="text-xs text-slate-500">Only the chairperson or secretary can edit the Chama's public profile.</p>;
  if (error && !form) return <p className="text-xs text-rose-600">{error}</p>;
  if (!form) return <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" />Loading…</p>;

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {};
      for (const key of TEXT_KEYS) if (form[key] !== initial[key]) payload[key] = form[key];
      if (form.enabled !== initial.enabled) payload.enabled = form.enabled;
      if (form.logo_url !== initial.logo_url) payload.logo_url = form.logo_url || null;
      if (form.cover_url !== initial.cover_url) payload.cover_url = form.cover_url || null;
      const { data } = await chamaApi.savePublicProfile(workspaceId, payload);
      const next = toForm(data.data);
      setForm(next);
      setInitial(next);
      toast.success("Public profile saved");
      onSaved?.(next);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not save the public profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
        <input type="checkbox" className="mt-1" checked={form.enabled} disabled={!chamaIsPublic && !form.enabled} onChange={(e) => set("enabled")(e.target.checked)} />
        <span><strong className="block text-slate-800 dark:text-slate-100">Publish this Chama's public profile</strong><span className="text-xs text-slate-500">Anyone can open it without signing in. It never shows balances, bank details, KYC or any member who hasn't chosen to be public.</span></span>
      </label>
      {!chamaIsPublic && <p className="text-xs text-amber-700">Set the group's visibility to Public in Basics, then publish.</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <ImagePicker label="Logo" hint="Square works best." value={form.logo_url} onChange={set("logo_url")} maxDim={512} maxChars={450_000} />
        <ImagePicker label="Cover image" hint="Wide banner at the top of the page." shape="wide" value={form.cover_url} onChange={set("cover_url")} maxDim={1400} maxChars={900_000} />
      </div>

      <div><label className={LABEL} htmlFor="cp-tagline">Tagline</label><input id="cp-tagline" className={FIELD} maxLength={140} value={form.tagline} onChange={(e) => set("tagline")(e.target.value)} placeholder="One line that says what the group is about" /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={LABEL} htmlFor="cp-loc">Location</label><input id="cp-loc" className={FIELD} maxLength={160} value={form.location} onChange={(e) => set("location")(e.target.value)} placeholder="Town or county" /></div>
        <div><label className={LABEL} htmlFor="cp-purpose">Group purpose</label><input id="cp-purpose" className={FIELD} maxLength={300} value={form.purpose} onChange={(e) => set("purpose")(e.target.value)} placeholder="e.g. Women-led business savings" /></div>
        <div><label className={LABEL} htmlFor="cp-email">Public contact email</label><input id="cp-email" type="email" className={FIELD} value={form.contact_email} onChange={(e) => set("contact_email")(e.target.value)} placeholder="contact@example.org" /></div>
        <div><label className={LABEL} htmlFor="cp-web">Website</label><input id="cp-web" className={FIELD} value={form.website} onChange={(e) => set("website")(e.target.value)} placeholder="https://example.org" /></div>
      </div>
      <div>
        <label className={LABEL} htmlFor="cp-desc">About this Chama</label>
        <textarea id="cp-desc" rows={5} maxLength={1200} className={FIELD} value={form.description} onChange={(e) => set("description")(e.target.value)} placeholder="Tell prospective members what the group does and who can join." />
        <span className="mt-1 block text-right text-[11px] text-slate-400">{form.description.length} / 1200</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {form.enabled ? <a href={`/chama-profile/${workspaceId}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-emerald-700 underline dark:text-emerald-300">Preview public page</a> : <span />}
        <button type="button" disabled={!dirty || saving} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white shadow transition hover:bg-emerald-600 disabled:opacity-50">
          {saving && <Loader2 size={14} className="animate-spin" />}Save public profile
        </button>
      </div>
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}
