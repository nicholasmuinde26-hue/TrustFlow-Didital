import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Clock3, FileHeart, HeartPulse, Users } from "lucide-react";
import api from "@/app/services/api";
import membersApi from "@/modules/members/api/members.api";
import Dialog from "@/shared/components/ui/Dialog";
import { Notice, SectionCard } from "../components/DeskUI";

const statusLabel = (status) => String(status || "reported").replace(/_/g, " ");

export default function BurialCasesTab({ workspaceId, role }) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [evidenceForms, setEvidenceForms] = useState({});
  const [form, setForm] = useState({ membership_id: "", first_name: "", last_name: "", relationship: "self", date_of_death: "", claimant_name: "", claimant_phone: "" });
  const canReportForMember = ["chairperson", "treasurer", "secretary"].includes(role);

  const casesQuery = useQuery({
    queryKey: ["burial-cases", workspaceId],
    queryFn: async () => (await api.get(`/burial-chama/chama/${workspaceId}/cases`)).data?.data || [],
    enabled: Boolean(workspaceId),
  });
  const membersQuery = useQuery({
    queryKey: ["leadership-burial-case-members", workspaceId],
    queryFn: async () => (await membersApi.list("burial-chama", workspaceId)).data?.data?.members || [],
    enabled: Boolean(workspaceId && canReportForMember),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["burial-cases", workspaceId] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const relationship = form.relationship;
      const caseType = relationship === "self" ? "member_death" : relationship === "spouse" ? "spouse_death" : relationship === "child" ? "child_death" : relationship === "parent" ? "parent_death" : "dependant_death";
      return api.post("/burial-chama/cases", {
        chamaId: workspaceId,
        burial_chama_profile_id: workspaceId,
        member: { membership_id: form.membership_id },
        case_type: caseType,
        deceased: { first_name: form.first_name.trim(), last_name: form.last_name.trim(), full_name: `${form.first_name.trim()} ${form.last_name.trim()}`, relationship_to_member: relationship, date_of_death: form.date_of_death },
        claimant: { name: form.claimant_name.trim(), phone: form.claimant_phone.trim(), relationship: relationship === "self" ? "member" : relationship },
      });
    },
    onSuccess: () => {
      setNotice({ message: "Case reported and added to the review queue." });
      setReportOpen(false);
      setForm({ membership_id: "", first_name: "", last_name: "", relationship: "self", date_of_death: "", claimant_name: "", claimant_phone: "" });
      refresh();
    },
    onError: (error) => setNotice({ message: error.response?.data?.message || "Could not report the case.", isError: true }),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ caseItem, action, documentId }) => {
      if (action === "review") return api.put(`/burial-chama/cases/${caseItem._id}/status`, { status: "under_review" });
      if (action === "eligibility") return api.put(`/burial-chama/cases/${caseItem._id}/status`, { status: "eligibility_check" });
      if (action === "calculate") return api.post(`/burial-chama/cases/${caseItem._id}/calculate-benefit`, {});
      if (action === "committee") return api.put(`/burial-chama/cases/${caseItem._id}/status`, { status: "committee_review" });
      if (action === "verify-case") return api.put(`/burial-chama/cases/${caseItem._id}/status`, { status: "verified" });
      if (action === "add-document") return api.post(`/burial-chama/cases/${caseItem._id}/documents`, { documents: [{ document_type: evidenceForms[caseItem._id]?.type || "death_certificate", document_url: evidenceForms[caseItem._id]?.url || "" }] });
      if (action === "verify-document") return api.put(`/burial-chama/cases/${caseItem._id}/documents/${documentId}/verify`, { verified: true });
      if (action === "home-visit") return api.put(`/burial-chama/cases/${caseItem._id}/home-visit`, { completed: true, notes: "Home visit completed by leadership." });
      return api.post(`/burial-chama/cases/${caseItem._id}/committee-vote`, { vote: action, comments: "Leadership Desk review" });
    },
    onSuccess: () => { setNotice({ message: "Leadership decision recorded." }); refresh(); },
    onError: (error) => setNotice({ message: error.response?.data?.message || "Could not update this case.", isError: true }),
  });

  const cases = casesQuery.data || [];
  const pending = cases.filter((item) => !["closed", "rejected", "cancelled", "approved", "payment_authorized", "disbursement", "confirmed"].includes(item.status));

  return <div className="space-y-5">
    {notice && <Notice tone={notice.isError ? "error" : "success"}>{notice.message}</Notice>}
    <SectionCard icon={HeartPulse} title="Burial case review" description="Review member reports, record committee decisions, and track cover eligibility before benefits are calculated." action={canReportForMember ? <button type="button" onClick={() => setReportOpen(true)} className="rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-500">Report for a member</button> : null}>
        {casesQuery.isLoading ? <p className="p-5 text-sm text-slate-500">Loading cases…</p> : casesQuery.isError ? <div className="p-5 text-sm text-rose-700">Could not load burial cases. Refresh the desk and try again.</div> : pending.length === 0 ? <div className="flex items-center gap-3 p-6 text-sm text-slate-500"><FileHeart size={18} />No burial cases currently need leadership review.</div> : <div className="divide-y divide-slate-100 dark:divide-slate-800">{pending.map((item) => {
        const eligible = item.eligibility?.is_eligible;
        return <article key={item._id} className="space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900 dark:text-white">{item.deceased?.full_name || "Bereavement report"}</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-300">{statusLabel(item.status)}</span></div><p className="mt-1 text-xs text-slate-500">{item.case_number} · Reported {item.reported_at ? new Date(item.reported_at).toLocaleDateString() : "recently"} · {item.member?.first_name} {item.member?.last_name}</p></div>
            <div className="flex flex-wrap gap-2">{["reported", "documents_pending"].includes(item.status) && <button type="button" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ caseItem: item, action: "review" })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">Start review</button>}{item.status === "under_review" && role === "treasurer" && <button type="button" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ caseItem: item, action: "verify-case" })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">Verify case</button>}{["verified"].includes(item.status) && <button type="button" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ caseItem: item, action: "eligibility" })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">Check eligibility</button>}{item.status === "eligibility_check" && ["chairperson", "treasurer"].includes(role) && <button type="button" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ caseItem: item, action: "calculate" })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">Calculate benefit</button>}{item.status === "benefit_calculated" && <button type="button" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ caseItem: item, action: "committee" })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">Send to committee</button>}{item.status === "committee_review" && <><button type="button" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ caseItem: item, action: "yes" })} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">Approve vote</button><button type="button" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ caseItem: item, action: "no" })} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Reject vote</button></>}</div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">Claimant: {item.claimant?.name || "Not listed"} · {item.claimant?.phone || "No phone"} · {item.deceased?.relationship_to_member?.replace(/_/g, " ") || "Relationship not listed"}</p>
          <div className={`flex items-start gap-2 rounded-xl px-3.5 py-3 text-xs ${eligible === false ? "bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200" : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"}`}><AlertCircle size={15} className="mt-0.5 shrink-0" /><span><strong>{eligible === false ? "Eligibility requires review" : eligible === true ? "Eligible at report time" : "Eligibility not yet assessed"}</strong>{item.eligibility?.reasons?.length ? ` · ${item.eligibility.reasons.join("; ")}` : " · Case review can proceed; benefit calculation still follows the configured cover rules."}</span></div>
          {item.status === "committee_review" && <p className="flex items-center gap-1.5 text-xs text-slate-500"><Users size={14} />{item.committee_review?.votes?.length || 0} committee vote(s) recorded. Your own family claim cannot be voted on.</p>}
          {item.status === "eligibility_check" && <p className="flex items-center gap-1.5 text-xs text-slate-500"><Clock3 size={14} />Benefit calculation is blocked until evidence is verified and cover rules pass. Waiting-period cases remain reportable, but are not payable until eligible.</p>}
          <details className="rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700"><summary className="cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200">Evidence and verification · {(item.documents || []).length} document(s)</summary><div className="mt-3 space-y-3">{(item.documents || []).map((document) => <div key={document._id} className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="capitalize text-slate-600 dark:text-slate-300">{document.document_type?.replace(/_/g, " ")} · {document.status}</span>{role === "treasurer" && document.status === "submitted" && <button type="button" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ caseItem: item, action: "verify-document", documentId: document._id })} className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">Verify</button>}</div>)}{["chairperson", "secretary"].includes(role) && !item.home_visit?.completed && <button type="button" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ caseItem: item, action: "home-visit" })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">Record home visit complete</button>}<div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]"><select value={evidenceForms[item._id]?.type || "death_certificate"} onChange={(event) => setEvidenceForms((current) => ({ ...current, [item._id]: { ...current[item._id], type: event.target.value } }))} aria-label="Evidence type" className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900">{[["death_certificate", "Death certificate"], ["burial_permit", "Burial permit"], ["deceased_id", "Deceased ID"], ["relationship_proof", "Relationship proof"], ["matanga_photo", "Funeral photo"], ["other", "Other"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input type="url" placeholder="Secure evidence URL" value={evidenceForms[item._id]?.url || ""} onChange={(event) => setEvidenceForms((current) => ({ ...current, [item._id]: { ...current[item._id], url: event.target.value } }))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900" /><button type="button" disabled={actionMutation.isPending || !evidenceForms[item._id]?.url} onClick={() => actionMutation.mutate({ caseItem: item, action: "add-document" })} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Add evidence</button></div></div></details>
        </article>;
      })}</div>}
    </SectionCard>

    <Dialog open={reportOpen} onClose={() => setReportOpen(false)} title="Report a case for a member" description="This creates a case for leadership review. Eligibility is recorded for the reviewers and checked again before benefits are calculated." icon={FileHeart} size="lg">
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); createMutation.mutate(); }}>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2 dark:text-slate-200">Member<select required value={form.membership_id} onChange={(event) => setForm({ ...form, membership_id: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="">Choose a member</option>{(membersQuery.data || []).filter((member) => member.status === "active").map((member) => <option key={member._id} value={member._id}>{member.user_id?.name || `${member.user_id?.first_name || "Member"} ${member.user_id?.last_name || ""}`} · {member.membership_number || member._id.slice(-6)}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Relationship to member<select required value={form.relationship} onChange={(event) => setForm({ ...form, relationship: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="self">Member</option><option value="spouse">Spouse</option><option value="child">Child</option><option value="parent">Parent</option><option value="sibling">Sibling</option><option value="dependant">Other dependant</option></select></label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Date of death<input required type="date" max={new Date().toISOString().slice(0, 10)} value={form.date_of_death} onChange={(event) => setForm({ ...form, date_of_death: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" /></label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Deceased first name<input required maxLength={100} value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" /></label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Deceased last name<input required maxLength={100} value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" /></label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Claimant name<input required maxLength={200} value={form.claimant_name} onChange={(event) => setForm({ ...form, claimant_name: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" /></label>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Claimant phone<input required type="tel" value={form.claimant_phone} onChange={(event) => setForm({ ...form, claimant_phone: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" /></label>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2 dark:border-slate-800"><button type="button" onClick={() => setReportOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Cancel</button><button type="submit" disabled={createMutation.isPending || !form.membership_id} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{createMutation.isPending ? "Submitting…" : "Submit report"}</button></div>
      </form>
    </Dialog>
  </div>;
}
