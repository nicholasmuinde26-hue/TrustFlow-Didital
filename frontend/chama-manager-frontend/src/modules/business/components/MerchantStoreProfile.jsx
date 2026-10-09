import React, { useEffect, useState } from "react";
import { Palette, Eye, EyeOff, ExternalLink, Copy, Check } from "lucide-react";
import toast from "react-hot-toast";
import marketplaceService from "../../marketplace/services/marketplace.service";
import Spinner from "@/shared/components/ui/Spinner";

const INPUT =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white";
const LABEL = "mb-1 block text-[11px] font-bold text-slate-500";

const EMPTY = {
  display_name: "",
  tagline: "",
  description: "",
  logo_url: "",
  primary_color: "#064e3b",
  hero_style: "gradient",
  physical_location: "",
  phone: "",
  delivery_info: "",
  return_policy: "",
};

/**
 * Seller-side editor for how the business appears INSIDE the VeriCircle
 * marketplace (the only public selling surface — there is no standalone store).
 * Name, branding and policies apply to every hub the business is enrolled in.
 */
export default function MerchantStoreProfile({ businessId, hubSlug, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [paused, setPaused] = useState(false);
  const [slug, setSlug] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await marketplaceService.getMerchantProfile(businessId);
      setEnrolled(Boolean(res.enrolled));
      setPaused(Boolean(res.paused));
      setSlug(res.slug || null);
      setForm({
        ...EMPTY,
        ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, res.profile?.[k] ?? EMPTY[k]])),
        display_name: res.profile?.display_name || res.business_name || "",
      });
    } catch {
      // Leave the editor empty; the seller can still retry by reloading.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessId) load();
  }, [businessId]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    if (!form.display_name.trim()) {
      toast.error("Give your store a name");
      return;
    }
    setSaving(true);
    try {
      const res = await marketplaceService.updateMerchantProfile(businessId, { merchant_profile: form });
      setSlug(res.slug || slug);
      toast.success("Store page updated");
      onSaved?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not update your store page");
    } finally {
      setSaving(false);
    }
  };

  const togglePaused = async () => {
    const next = !paused;
    try {
      await marketplaceService.updateMerchantProfile(businessId, { paused: next });
      setPaused(next);
      toast.success(next ? "Your store is hidden from the marketplace" : "Your store is visible in the marketplace");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not change store visibility");
    }
  };

  const storeUrl = slug ? `${window.location.origin}/businesses/${slug}` : "";
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — link stays visible.
    }
  };

  if (loading) {
    return (
      <div className="flex h-24 items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <Spinner />
      </div>
    );
  }

  if (!enrolled) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900">
        <p className="font-bold text-slate-800 dark:text-slate-200">Your marketplace store page</p>
        <p className="mt-1">
          Opt in to the {hubSlug ? hubSlug.toUpperCase() : "category"} marketplace above. Once you are enrolled you can
          set your store name and choose how your store looks to buyers.
        </p>
      </div>
    );
  }

  const background =
    form.hero_style === "solid"
      ? form.primary_color
      : `linear-gradient(135deg, ${form.primary_color} 0%, #0f172a 130%)`;

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Palette size={16} className="text-emerald-600" />
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Your store page</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={togglePaused}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {paused ? <Eye size={13} /> : <EyeOff size={13} />}
            {paused ? "Show store in marketplace" : "Hide store from marketplace"}
          </button>
          {storeUrl && (
            <>
              <button
                type="button"
                onClick={copyLink}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy link"}
              </button>
              <a
                href={storeUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"
              >
                <ExternalLink size={13} /> View as buyer
              </a>
            </>
          )}
        </div>
      </div>

      {paused && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Your store and all its listings are currently hidden from buyers.
        </p>
      )}

      {/* Preview mirrors the buyer-facing store header */}
      <div className="overflow-hidden rounded-2xl text-white" style={{ background }}>
        <div className="flex items-center gap-4 px-5 py-6">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/30 bg-white/15 text-lg font-black"
          >
            {form.logo_url ? (
              <img src={form.logo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              (form.display_name || "ST").slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-black">{form.display_name || "Your store name"}</p>
            {form.tagline && <p className="truncate text-xs italic text-white/80">{form.tagline}</p>}
            {form.physical_location && <p className="mt-1 truncate text-[11px] text-white/70">{form.physical_location}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={LABEL}>Store name</label>
          <input className={INPUT} maxLength={80} value={form.display_name} onChange={(e) => set({ display_name: e.target.value })} />
        </div>
        <div>
          <label className={LABEL}>Tagline</label>
          <input className={INPUT} maxLength={140} value={form.tagline} onChange={(e) => set({ tagline: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL}>About your store</label>
          <textarea
            rows={3}
            className={INPUT}
            maxLength={600}
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </div>
        <div>
          <label className={LABEL}>Logo image link (optional)</label>
          <input className={INPUT} placeholder="https://…" value={form.logo_url} onChange={(e) => set({ logo_url: e.target.value })} />
        </div>
        <div>
          <label className={LABEL}>Location</label>
          <input className={INPUT} value={form.physical_location} onChange={(e) => set({ physical_location: e.target.value })} />
        </div>
        <div>
          <label className={LABEL}>Main colour</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.primary_color}
              onChange={(e) => set({ primary_color: e.target.value })}
              className="h-9 w-11 cursor-pointer rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900"
            />
            <input className={INPUT} value={form.primary_color} onChange={(e) => set({ primary_color: e.target.value })} />
          </div>
        </div>
        <div>
          <label className={LABEL}>Header style</label>
          <select className={INPUT} value={form.hero_style} onChange={(e) => set({ hero_style: e.target.value })}>
            <option value="gradient">Gradient</option>
            <option value="solid">Solid colour</option>
          </select>
        </div>
        <div>
          <label className={LABEL}>Contact phone</label>
          <input className={INPUT} value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
        </div>
        <div>
          <label className={LABEL}>Delivery information</label>
          <input className={INPUT} maxLength={400} value={form.delivery_info} onChange={(e) => set({ delivery_info: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL}>Return policy</label>
          <input className={INPUT} maxLength={400} value={form.return_policy} onChange={(e) => set({ return_policy: e.target.value })} />
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save store page"}
      </button>
    </div>
  );
}
