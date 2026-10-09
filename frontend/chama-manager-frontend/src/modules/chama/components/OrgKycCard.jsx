import { useEffect, useState } from "react";
import { BadgeCheck, Clock, Loader2, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import chamaApi from "../api/chama.api";
import ImagePicker from "./ImagePicker";

// ========================================
// CHAMA (ORGANISATION) KYC
// ========================================
//
// Member KYC proves who a person is. This proves what the group is. The
// chairperson submits it; the platform's admin team reviews it (the group
// cannot approve itself). Once verified, the public page shows a
// "Verified group" mark.
//
// ========================================

const TYPES = [
  ["self_help_group", "Self-help group (registered)"], ["cbo", "Community-based organisation"], ["sacco", "SACCO"],
  ["society", "Society"], ["company", "Company"], ["informal", "Not registered yet"], ["other", "Other"],
];
const FIELD = "w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white";
const LABEL = "mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300";
const BLANK = { legal_name: "", registration_type: "self_help_group", registration_number: "", kra_pin: "", physical_address: "", contact_phone: "", certificate_url: null, officials_confirmed: false };

export default function OrgKycCard({ workspaceId, role, chamaName }) {
  const [kyc, setKyc] = useState(undefined); // undefined = loading, null = none
  const [form, setForm] = useState({ ...BLANK, legal_name: chamaName || "" });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isChair = role === "chairperson";

  useEffect(() => {
    let cancelled = false;
    chamaApi.getOrgKyc(workspaceId)
      .then(({ data }) => { if (!cancelled) setKyc(data.data || null); })
      .catch((err) => { if (!cancelled) { setKyc(null); setError(err?.response?.data?.message || ""); } });
    return () => { cancelled = true; };
  }, [workspaceId]);

  if (kyc === undefined) return <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" />Loading…</p>;

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const informal = ["informal", "other"].includes(form.registration_type);

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const { data } = await chamaApi.submitOrgKyc(workspaceId, form);
      setKyc(data.data);
      setEditing(false);
      toast.success("Submitted for review");
    } catch (err) {
      setError(err?.response?.data?.message || "Could not submit. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = () => {
    setForm({ ...BLANK, legal_name: kyc?.legal_name || chamaName || "", registration_type: kyc?.registration_type || "self_help_group", registration_number: kyc?.registration_number || "", kra_pin: kyc?.kra_pin || "", physical_address: kyc?.physical_address || "", contact_phone: kyc?.contact_phone || "" });
    setEditing(true);
  };

  const statusBlock = kyc && (
    <div className={`flex items-start gap-3 rounded-2xl p-4 text-sm ${kyc.status === "verified" ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100" : kyc.status === "rejected" ? "bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100" : "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"}`}>
      {kyc.status === "verified" ? <BadgeCheck size={18} className="mt-0.5 shrink-0" /> : kyc.status === "rejected" ? <XCircle size={18} className="mt-0.5 shrink-0" /> : <Clock size={18} className="mt-0.5 shrink-0" />}
      <div>
        <p className="font-black">{kyc.status === "verified" ? "Group verified" : kyc.status === "rejected" ? "Verification was not approved" : "Waiting for review"}</p>
        <p className="mt-0.5 text-xs opacity-80">{kyc.legal_name} · {String(kyc.registration_type).replace(/_/g, " ")}{kyc.registration_number ? ` · ${kyc.registration_number}` : ""}</p>
        {kyc.status === "rejected" && kyc.rejection_reason && <p className="mt-1 text-xs"><strong>Reason:</strong> {kyc.rejection_reason}</p>}
        {kyc.status === "pending" && <p className="mt-1 text-xs opacity-80">The platform team usually reviews within a few working days.</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {statusBlock}
      {!kyc && <p className="text-xs leading-5 text-slate-500">Verify the group itself, not just its members. A verified group gets a mark on its public page, which helps prospective members and partners trust it.</p>}
      {error && !editing && <p className="text-xs font-medium text-rose-600">{error}</p>}
      {!isChair && !kyc && <p className="text-xs text-slate-500">Only the chairperson can submit the group's verification.</p>}

      {isChair && !editing && kyc?.status !== "verified" && kyc?.status !== "pending" && (
        <button type="button" onClick={startEdit} className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white shadow hover:bg-emerald-600">{kyc ? "Update and resubmit" : "Start verification"}</button>
      )}
      {isChair && !editing && kyc?.status === "pending" && <button type="button" onClick={startEdit} className="text-xs font-bold text-emerald-700 underline dark:text-emerald-300">Edit submission</button>}

      {editing && (
        <div className="space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className={LABEL} htmlFor="ok-name">Registered name of the group</label><input id="ok-name" className={FIELD} value={form.legal_name} maxLength={160} onChange={(e) => set("legal_name")(e.target.value)} /></div>
            <div><label className={LABEL} htmlFor="ok-type">How is the group registered?</label>
              <select id="ok-type" className={FIELD} value={form.registration_type} onChange={(e) => set("registration_type")(e.target.value)}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div><label className={LABEL} htmlFor="ok-num">Registration number{informal ? " (if any)" : ""}</label><input id="ok-num" className={FIELD} value={form.registration_number} maxLength={60} onChange={(e) => set("registration_number")(e.target.value)} /></div>
            <div><label className={LABEL} htmlFor="ok-pin">KRA PIN (optional)</label><input id="ok-pin" className={FIELD} value={form.kra_pin} maxLength={20} onChange={(e) => set("kra_pin")(e.target.value)} /></div>
            <div><label className={LABEL} htmlFor="ok-phone">Group contact phone</label><input id="ok-phone" className={FIELD} value={form.contact_phone} maxLength={20} inputMode="tel" onChange={(e) => set("contact_phone")(e.target.value)} /></div>
            <div className="sm:col-span-2"><label className={LABEL} htmlFor="ok-addr">Where does the group meet / operate?</label><input id="ok-addr" className={FIELD} value={form.physical_address} maxLength={240} onChange={(e) => set("physical_address")(e.target.value)} /></div>
          </div>
          <ImagePicker label={informal ? "Signed group letter (optional if you gave an address)" : "Registration certificate"} shape="wide" hint="A clear photo of the document." value={form.certificate_url} onChange={set("certificate_url")} maxDim={1600} maxChars={1_400_000} />
          <label className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
            <input type="checkbox" className="mt-0.5" checked={form.officials_confirmed} onChange={(e) => set("officials_confirmed")(e.target.checked)} />
            I confirm that the officials of this group are authorised to act for it.
          </label>
          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setEditing(false); setError(""); }} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">Cancel</button>
            <button type="button" disabled={saving} onClick={submit} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white shadow hover:bg-emerald-600 disabled:opacity-50">{saving && <Loader2 size={14} className="animate-spin" />}Submit for review</button>
          </div>
        </div>
      )}
    </div>
  );
}
