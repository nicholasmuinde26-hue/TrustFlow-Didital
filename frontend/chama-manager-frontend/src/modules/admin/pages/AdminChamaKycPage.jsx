import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, CheckCircle2, Clock, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import adminService from "../services/admin.service";
import Spinner from "@/shared/components/ui/Spinner";

// ========================================
// ADMIN: CHAMA (ORGANISATION) KYC
// ========================================
//
// Reviews the registration details a chairperson submitted for their
// group. Member and official identity (ID + selfie) is reviewed INSIDE the
// Chama by the chairperson/treasurer; this queue is only for the group
// itself, so a group can never verify itself.
//
// ========================================

const TABS = [["pending", "Pending", Clock], ["verified", "Verified", CheckCircle2], ["rejected", "Rejected", XCircle]];

export default function AdminChamaKycPage() {
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setRows(null);
    try { setRows(await adminService.listChamaKyc(status)); } catch (err) { toast.error(err?.response?.data?.message || "Could not load the queue."); setRows([]); }
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const open = async (row) => {
    try { setSelected(await adminService.getChamaKyc(row.chama_id?._id || row.chama_id)); } catch (err) { toast.error(err?.response?.data?.message || "Could not open this submission."); }
  };

  const decide = async (decision) => {
    const chamaId = selected.chama_id?._id || selected.chama_id;
    let reason;
    if (decision === "rejected") {
      reason = window.prompt("Why is this being rejected? The chairperson will see this reason:");
      if (!reason?.trim()) return;
    }
    setBusy(true);
    try {
      await adminService.reviewChamaKyc(chamaId, decision, reason?.trim());
      toast.success(decision === "verified" ? "Group verified" : "Submission rejected");
      setSelected(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not record that decision.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-white"><BadgeCheck size={20} className="text-emerald-600" />Chama verification</h1>
        <p className="mt-1 text-sm text-slate-500">Check the group's registration and that its officials are authorised. Members' own ID checks are done inside each Chama.</p>
      </div>

      <div className="flex gap-2">
        {TABS.map(([value, label, Icon]) => (
          <button key={value} type="button" onClick={() => { setStatus(value); setSelected(null); }} className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold ${status === value ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"}`}><Icon size={14} />{label}</button>
        ))}
      </div>

      {rows === null ? <Spinner /> : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">Nothing here.</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {rows.map((row) => (
            <li key={row._id}>
              <button type="button" onClick={() => open(row)} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-400 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-sm font-black text-slate-900 dark:text-white">{row.chama_id?.name || row.legal_name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{row.legal_name} · {String(row.registration_type).replace(/_/g, " ")}{row.registration_number ? ` · ${row.registration_number}` : ""}</p>
                <p className="mt-1 text-[11px] text-slate-400">Submitted by {row.submitted_by?.name || "chairperson"} · {row.submitted_at ? new Date(row.submitted_at).toLocaleDateString() : ""}</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 dark:bg-slate-900">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">{selected.chama_id?.name}</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {[["Registered name", selected.legal_name], ["Type", String(selected.registration_type).replace(/_/g, " ")], ["Registration no.", selected.registration_number || "—"], ["KRA PIN", selected.kra_pin || "—"], ["Address", selected.physical_address || "—"], ["Phone", selected.contact_phone || "—"], ["Submitted by", `${selected.submitted_by?.name || "—"} ${selected.submitted_by?.phone || ""}`], ["Officials authorised", selected.officials_confirmed ? "Confirmed by chairperson" : "No"]].map(([k, v]) => (
                <div key={k}><dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{k}</dt><dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">{v}</dd></div>
              ))}
            </dl>
            {selected.certificate_url ? <img src={selected.certificate_url} alt="Registration document" className="mt-4 w-full rounded-2xl border border-slate-200 object-contain dark:border-slate-700" /> : <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800">No document uploaded.</p>}
            {selected.status === "rejected" && selected.rejection_reason && <p className="mt-3 text-xs text-rose-600"><strong>Rejected:</strong> {selected.rejection_reason}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">Close</button>
              {selected.status !== "verified" && <button type="button" disabled={busy} onClick={() => decide("rejected")} className="rounded-xl border border-rose-200 px-4 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">Reject</button>}
              {selected.status !== "verified" && <button type="button" disabled={busy} onClick={() => decide("verified")} className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50">Verify group</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
