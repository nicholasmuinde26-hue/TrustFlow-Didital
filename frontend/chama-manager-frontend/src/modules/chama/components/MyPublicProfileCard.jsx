import { useEffect, useState } from "react";
import { Eye, Globe2, Loader2, Lock, Users } from "lucide-react";
import toast from "react-hot-toast";
import chamaApi from "../api/chama.api";
import ImagePicker from "./ImagePicker";
import { PersonProfileBody } from "./PersonProfileCard";

// ========================================
// MY PUBLIC PROFILE
// ========================================
//
// Every member and every official can edit this at any time. It is what
// others see when they tap your name. It is completely separate from KYC:
// your ID number, ID photo, selfie and next of kin are never part of it.
//
// ========================================

const VISIBILITY = [
  { value: "public", label: "Anyone", icon: Globe2, hint: "Shown on the Chama's public page, when the Chama has published one." },
  { value: "members", label: "Members only", icon: Users, hint: "Only signed-in members of this Chama." },
  { value: "hidden", label: "Only me", icon: Lock, hint: "Nobody else can open your profile." },
];

const FIELD = "w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white";
const LABEL = "mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300";

export default function MyPublicProfileCard({ workspaceId }) {
  const [form, setForm] = useState(null);
  const [initial, setInitial] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    chamaApi.getMyPublicProfile(workspaceId)
      .then(({ data }) => { if (!cancelled) { setForm(data.data); setInitial(data.data); } })
      .catch((err) => { if (!cancelled) setError(err?.response?.data?.message || "Could not load your profile."); });
    return () => { cancelled = true; };
  }, [workspaceId]);

  if (error && !form) return <p className="text-xs text-rose-600">{error}</p>;
  if (!form) return <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" />Loading your profile…</p>;

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        visibility: form.visibility, headline: form.headline, bio: form.bio, location: form.location, contact_email: form.contact_email,
        // only send the image when it actually changed
        ...(form.image_url !== initial.image_url ? { image_url: form.image_url || null } : {}),
      };
      const { data } = await chamaApi.saveMyPublicProfile(workspaceId, payload);
      setForm(data.data);
      setInitial(data.data);
      toast.success("Profile saved");
    } catch (err) {
      setError(err?.response?.data?.message || "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs leading-5 text-slate-500">This is what people see when they tap your name. Your ID number, ID photo, selfie and next of kin from KYC are <strong>never</strong> shown here. You can change this whenever you like.</p>

      <ImagePicker label="Profile photo" hint="Shown on your profile card. Photos are shrunk automatically." value={form.image_url} onChange={set("image_url")} maxDim={640} maxChars={450_000} />

      <div>
        <label className={LABEL} htmlFor="pp-headline">Headline</label>
        <input id="pp-headline" className={FIELD} maxLength={120} value={form.headline} onChange={(e) => set("headline")(e.target.value)} placeholder="e.g. Treasurer · Mama mboga in Machakos" />
      </div>
      <div>
        <label className={LABEL} htmlFor="pp-bio">About me</label>
        <textarea id="pp-bio" rows={4} maxLength={800} className={FIELD} value={form.bio} onChange={(e) => set("bio")(e.target.value)} placeholder="Tell the group a little about yourself." />
        <span className="mt-1 block text-right text-[11px] text-slate-400">{form.bio.length} / 800</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={LABEL} htmlFor="pp-location">Location</label><input id="pp-location" className={FIELD} maxLength={120} value={form.location} onChange={(e) => set("location")(e.target.value)} placeholder="Town or county" /></div>
        <div><label className={LABEL} htmlFor="pp-email">Contact email (optional)</label><input id="pp-email" type="email" className={FIELD} value={form.contact_email} onChange={(e) => set("contact_email")(e.target.value)} placeholder="you@example.com" /></div>
      </div>

      <div>
        <p className={LABEL}>Who can see my profile</p>
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
          {VISIBILITY.map(({ value, label, icon: Icon }) => (
            <button key={value} type="button" role="radio" aria-checked={form.visibility === value} onClick={() => set("visibility")(value)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition ${form.visibility === value ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400">{VISIBILITY.find((v) => v.value === form.visibility)?.hint}</p>
      </div>

      {preview && <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><PersonProfileBody person={form} /></div>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setPreview((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-300"><Eye size={14} />{preview ? "Hide preview" : "Preview my card"}</button>
        <button type="button" disabled={!dirty || saving} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white shadow transition hover:bg-emerald-600 disabled:opacity-50">
          {saving && <Loader2 size={14} className="animate-spin" />}Save profile
        </button>
      </div>
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}
