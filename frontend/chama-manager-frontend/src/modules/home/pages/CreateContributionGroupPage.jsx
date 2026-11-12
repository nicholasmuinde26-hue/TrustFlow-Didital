import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock3, ShieldCheck, Wallet } from "lucide-react";
import { GROUP_TYPES, GROUP_VISIBILITY } from "@/modules/contribution-group/constants";
import workspaceRequestService from "@/app/services/workspaceRequest.service";

const emptyForm = {
  name: "", description: "", type: "other", visibility: "invite_only", targetAmount: "",
  eventDate: "", contributionEndDate: "", beneficiary: "", location: "", nationalIdNumber: "",
  evidenceKind: "supporting_document", evidenceUrl: "", publicGivingRequested: false,
  referee1Name: "", referee1Phone: "", referee1Relationship: "",
  referee2Name: "", referee2Phone: "", referee2Relationship: "",
  payoutMethod: "mpesa", payoutPhone: "", payoutPaybill: "", payoutAccountName: "",
};

const fieldClass = "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white";
const labelClass = "mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300";

export default function CreateContributionGroupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [request, setRequest] = useState(null);
  const [editingRequestId, setEditingRequestId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    workspaceRequestService.getMyRequests()
      .then((items) => {
        const existing = items.find((item) => item.entityType === "contribution_group" && ["PENDING", "UNDER_REVIEW"].includes(String(item.status).toUpperCase()));
        if (active && existing) setRequest(existing);
      })
      .catch(() => {})
      .finally(() => { if (active) setLoadingRequest(false); });
    return () => { active = false; };
  }, []);

  const update = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const requestData = {
        entityType: "contribution_group",
        name: form.name.trim(),
        description: form.description.trim(),
        contributionGroupDetails: {
          type: form.type,
          visibility: form.visibility,
          targetAmount: form.targetAmount || 0,
          eventDate: form.eventDate || null,
          contributionEndDate: form.contributionEndDate || null,
          beneficiary: form.beneficiary.trim(),
          location: form.location.trim(),
          nationalIdNumber: form.nationalIdNumber.trim(),
          evidence: [{ kind: form.evidenceKind, url: form.evidenceUrl.trim() }],
          publicGivingRequested: form.publicGivingRequested,
          referees: [
            { name: form.referee1Name.trim(), phone: form.referee1Phone.trim(), relationship: form.referee1Relationship.trim() },
            { name: form.referee2Name.trim(), phone: form.referee2Phone.trim(), relationship: form.referee2Relationship.trim() },
          ],
          payout: {
            method: form.payoutMethod,
            phone: form.payoutPhone.trim(),
            paybill: form.payoutPaybill.trim(),
            accountName: form.payoutAccountName.trim(),
          },
        },
      };
      const result = editingRequestId
        ? await workspaceRequestService.updateMyContributionGroupRequest(editingRequestId, requestData)
        : await workspaceRequestService.submitRequest(requestData);
      setRequest(result.data || result);
      setEditingRequestId(null);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not submit the fundraiser request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function editRequestDetails() {
    const details = request?.contributionGroupDetails || {};
    const evidence = details.evidence?.[0] || {};
    const referees = details.referees || [];
    setForm({
      ...emptyForm,
      name: request?.name || "", description: request?.description || "",
      type: details.type || "other", visibility: details.visibility || "invite_only",
      targetAmount: details.targetAmount ? String(details.targetAmount) : "",
      eventDate: details.eventDate ? String(details.eventDate).slice(0, 10) : "",
      contributionEndDate: details.contributionEndDate ? String(details.contributionEndDate).slice(0, 10) : "",
      beneficiary: details.beneficiary || "", location: details.location || "",
      nationalIdNumber: details.nationalIdNumber || "", evidenceKind: evidence.kind || "supporting_document", evidenceUrl: evidence.url || "",
      publicGivingRequested: Boolean(details.publicGivingRequested),
      referee1Name: referees[0]?.name || "", referee1Phone: referees[0]?.phone || "", referee1Relationship: referees[0]?.relationship || "",
      referee2Name: referees[1]?.name || "", referee2Phone: referees[1]?.phone || "", referee2Relationship: referees[1]?.relationship || "",
      payoutMethod: details.payout?.method || "mpesa", payoutPhone: details.payout?.phone || "", payoutPaybill: details.payout?.paybill || "", payoutAccountName: details.payout?.accountName || "",
    });
    setEditingRequestId(request._id);
    setRequest(null);
  }

  if (loadingRequest) return <div className="mx-auto max-w-xl animate-pulse rounded-3xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900"><div className="h-5 w-48 rounded bg-slate-200 dark:bg-slate-800" /><div className="mt-4 h-24 rounded bg-slate-100 dark:bg-slate-800" /></div>;

  if (request) return (
    <main className="mx-auto max-w-2xl rounded-3xl border border-emerald-200 bg-white p-7 shadow-sm dark:border-emerald-900 dark:bg-slate-900 sm:p-10">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"><Clock3 size={23} /></div>
      <p className="mt-6 text-xs font-black uppercase tracking-[.16em] text-amber-700 dark:text-amber-300">Verification in progress</p>
      <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{request.name}</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Your request is {String(request.status).toLowerCase().replaceAll("_", " ")}. No contribution group or public donation link is created until an administrator completes the review.</p>
      <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs dark:bg-slate-800/60"><span className="text-slate-500">Request reference</span><strong className="ml-2 font-mono text-slate-900 dark:text-white">{request.requestNumber}</strong></div>
      {request.adminNotes && <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200"><strong>Message from the review team</strong><p className="mt-1">{request.adminNotes}</p></div>}
      <div className="mt-6 flex flex-wrap gap-3">{String(request.status).toUpperCase() === "UNDER_REVIEW" && request.adminNotes && <button type="button" onClick={editRequestDetails} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800">Update request</button>}<button type="button" onClick={() => navigate("/home")} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">Back to home</button></div>
    </main>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-8">
      <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white"><ArrowLeft size={15} /> Back</button>
      <header className="rounded-3xl bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-950 p-7 text-white shadow-xl sm:p-9">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300"><Wallet size={22} /></span><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-300">Organizer application</p><h1 className="text-2xl font-black sm:text-3xl">{editingRequestId ? "Update fundraiser request" : "Request a fundraiser"}</h1></div></div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300">Tell us what you are raising money for and who will receive it. Our team checks the organizer, evidence, referees, and payout details before approving the group.</p>
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-200"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-300" />Your phone number must be verified. Public donations remain disabled unless an admin separately approves them.</div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <section className="space-y-4"><h2 className="text-sm font-black text-slate-900 dark:text-white">Fundraiser details</h2>
          <div><label className={labelClass}>Name supporters will see</label><input className={fieldClass} required minLength={2} maxLength={100} value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Help the Mumo family rebuild" /></div>
          <div><label className={labelClass}>Purpose and story</label><textarea className={fieldClass} required rows={4} maxLength={1000} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Explain who the fundraiser supports, what happened, and how the money will be used." /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={labelClass}>Contribution group type</label><select className={`${fieldClass} capitalize`} value={form.type} onChange={(e) => update("type", e.target.value)}>{GROUP_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></div>
            <div><label className={labelClass}>Group visibility</label><select className={`${fieldClass} capitalize`} value={form.visibility} onChange={(e) => update("visibility", e.target.value)}>{GROUP_VISIBILITY.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></div>
            <div><label className={labelClass}>Fundraising goal (KES)</label><input className={fieldClass} type="number" min="0" step="1" value={form.targetAmount} onChange={(e) => update("targetAmount", e.target.value)} placeholder="Optional" /></div>
            <div><label className={labelClass}>Beneficiary</label><input className={fieldClass} maxLength={120} value={form.beneficiary} onChange={(e) => update("beneficiary", e.target.value)} placeholder="Person or community supported" /></div>
            <div><label className={labelClass}>Event date</label><input className={fieldClass} type="date" value={form.eventDate} onChange={(e) => update("eventDate", e.target.value)} /></div>
            <div><label className={labelClass}>Contribution close date</label><input className={fieldClass} type="date" value={form.contributionEndDate} onChange={(e) => update("contributionEndDate", e.target.value)} /></div>
            <div className="sm:col-span-2"><label className={labelClass}>Location</label><input className={fieldClass} maxLength={255} value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="Town, county, or venue" /></div>
          </div>
        </section>

        <section className="space-y-4 border-t border-slate-100 pt-5 dark:border-slate-800"><h2 className="text-sm font-black text-slate-900 dark:text-white">Organizer verification</h2>
          <div><label className={labelClass}>National ID number</label><input className={fieldClass} required maxLength={30} value={form.nationalIdNumber} onChange={(e) => update("nationalIdNumber", e.target.value)} autoComplete="off" /></div>
          {form.publicGivingRequested && <><div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Public fundraising requires a stricter review. Add cause-specific evidence and two referees our team can contact.</div><div className="grid gap-3 sm:grid-cols-[1fr_2fr]"><div><label className={labelClass}>Evidence type</label><select className={fieldClass} value={form.evidenceKind} onChange={(e) => update("evidenceKind", e.target.value)}><option value="medical">Medical letter or invoice</option><option value="funeral">Burial permit or chief’s letter</option><option value="education">School fee structure</option><option value="identity">Organizer identity document</option><option value="supporting_document">Other supporting evidence</option></select></div><div><label className={labelClass}>Secure evidence link (HTTPS)</label><input className={fieldClass} type="url" required value={form.evidenceUrl} onChange={(e) => update("evidenceUrl", e.target.value)} placeholder="https://…" /><p className="mt-1 text-[10px] text-slate-500">Share a view-only document link. Avoid links that expose unrelated personal files.</p></div></div><div className="grid gap-3 sm:grid-cols-2">{[1, 2].map((index) => <fieldset key={index} className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><legend className="px-1 text-xs font-bold text-slate-700 dark:text-slate-300">Referee {index}</legend><input className={fieldClass} required placeholder="Full name" value={form[`referee${index}Name`]} onChange={(e) => update(`referee${index}Name`, e.target.value)} /><input className={fieldClass} required type="tel" placeholder="Phone number" value={form[`referee${index}Phone`]} onChange={(e) => update(`referee${index}Phone`, e.target.value)} /><input className={fieldClass} placeholder="Relationship to beneficiary" value={form[`referee${index}Relationship`]} onChange={(e) => update(`referee${index}Relationship`, e.target.value)} /></fieldset>)}</div></>}
        </section>

        <section className="space-y-4 border-t border-slate-100 pt-5 dark:border-slate-800"><h2 className="text-sm font-black text-slate-900 dark:text-white">Payout destination</h2>
          <div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClass}>Payout method</label><select className={fieldClass} value={form.payoutMethod} onChange={(e) => update("payoutMethod", e.target.value)}><option value="mpesa">M-Pesa</option><option value="paybill">Paybill</option><option value="till">Till number</option><option value="bank">Bank account</option></select></div><div><label className={labelClass}>Name registered to payout account</label><input className={fieldClass} required maxLength={120} value={form.payoutAccountName} onChange={(e) => update("payoutAccountName", e.target.value)} /></div>{form.payoutMethod === "mpesa" ? <div className="sm:col-span-2"><label className={labelClass}>M-Pesa phone number</label><input className={fieldClass} required type="tel" value={form.payoutPhone} onChange={(e) => update("payoutPhone", e.target.value)} /></div> : <div className="sm:col-span-2"><label className={labelClass}>{form.payoutMethod === "bank" ? "Account number" : "Paybill or till number"}</label><input className={fieldClass} required value={form.payoutPaybill} onChange={(e) => update("payoutPaybill", e.target.value)} /></div>}</div>
        </section>

        <label className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"><input type="checkbox" checked={form.publicGivingRequested} onChange={(e) => update("publicGivingRequested", e.target.checked)} className="mt-0.5 accent-emerald-600" /><span><strong>Request public giving review.</strong> This asks an admin to consider enabling donations from anyone with the giving link. It does not enable public donations automatically. Leave it off for a members-only contribution group.</span></label>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3.5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60">{submitting ? "Submitting for review…" : <><CheckCircle2 size={17} /> {editingRequestId ? "Update and resubmit" : "Submit fundraiser request"}</>}</button>
        <p className="text-center text-[11px] text-slate-500">Submitting creates a review request only. No group is activated and no money can be collected before approval.</p>
      </form>
    </div>
  );
}
