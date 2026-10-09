import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";

import Spinner from "@/shared/components/ui/Spinner";
import adminSupportService from "../services/adminSupport.service";
import NotesPanel from "../components/support/NotesPanel";
import { ActionDialog, btn, Card, CaseStatusPill, categoryLabel, EmptyState, errText, fmtDateTime, inputCls, PriorityPill } from "../components/support/supportUi";

export default function AdminSupportCasePage() {
  const { caseId } = useParams();
  const [supportCase, setCase] = useState(null);
  const [assignees, setAssignees] = useState([]);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(null); // 'resolved' | 'closed'
  const [timelineKey, setTimelineKey] = useState(0);

  const load = useCallback(async () => {
    try {
      setCase(await adminSupportService.getCase(caseId));
      setError("");
    } catch (err) { setError(errText(err, "Could not load this case")); }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { adminSupportService.listAssignees().then(setAssignees).catch(() => setAssignees([])); }, []);

  async function patch(body, okMessage) {
    try {
      setCase(await adminSupportService.updateCase(caseId, body));
      setTimelineKey((k) => k + 1);
      if (okMessage) toast.success(okMessage);
    } catch (err) { toast.error(errText(err)); }
  }

  if (error) return <Card><EmptyState>{error}</EmptyState></Card>;
  if (!supportCase) return <Spinner />;

  const c = supportCase;
  const done = c.status === "resolved" || c.status === "closed";
  const subjectPath = c.subject_type === "user" ? `/admin/support/users/${c.subject_id}` : `/admin/support/chamas/${c.subject_id}`;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/support" className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-violet-600"><ArrowLeft size={12} /> Support Desk</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-400">{c.number}</span>
              <CaseStatusPill status={c.status} /> <PriorityPill priority={c.priority} />
            </div>
            <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{c.title}</h1>
            <p className="mt-1 text-xs text-slate-500">
              {c.subject_type === "user" ? "User" : "Chama"}:{" "}
              <Link to={subjectPath} className="font-bold text-violet-600 hover:underline">{c.subject_label || "Open"}</Link>
              {" · "}{categoryLabel(c.category)} · opened {fmtDateTime(c.created_at)} by {c.created_by?.name || "an admin"}
            </p>
          </div>
          <div className="flex gap-2">
            {done ? (
              <button type="button" className={btn.outline} onClick={() => patch({ status: "open" }, "Case reopened")}><RotateCcw size={13} /> Reopen</button>
            ) : (
              <>
                {c.status === "open" ? <button type="button" className={btn.outline} onClick={() => patch({ status: "pending" }, "Marked as waiting")}>Waiting on someone</button> : <button type="button" className={btn.outline} onClick={() => patch({ status: "open" }, "Back to open")}>Back to open</button>}
                <button type="button" className={btn.primary} onClick={() => setClosing("resolved")}><CheckCircle2 size={13} /> Resolve</button>
              </>
            )}
          </div>
        </div>
      </div>

      {done ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          {c.status === "closed" ? "Closed" : "Resolved"} {fmtDateTime(c.resolved_at)} — {c.resolution}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NotesPanel key={timelineKey} case_id={caseId} title="Timeline & notes" onChange={load} />
        </div>
        <Card title="Details">
          <div className="space-y-4">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Assigned to
              <select className={`${inputCls} mt-1`} value={c.assignee?._id || ""} onChange={(e) => patch({ assignee_id: e.target.value || null })}>
                <option value="">Unassigned</option>
                {assignees.map((a) => <option key={a._id} value={a._id}>{a.name} · {a.role}</option>)}
              </select>
            </label>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Priority
              <select className={`${inputCls} mt-1`} value={c.priority} onChange={(e) => patch({ priority: e.target.value })}>
                {["low", "normal", "high", "urgent"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            {c.invoice_id ? (
              <p className="text-[11px] font-semibold text-slate-500">
                Linked to an invoice.{" "}
                {c.subject_type === "chama" ? <Link className="font-bold text-violet-600 hover:underline" to={subjectPath}>See it in billing</Link> : null}
              </p>
            ) : null}
            <p className="text-[11px] text-slate-400">Last activity {fmtDateTime(c.updated_at)}</p>
          </div>
        </Card>
      </div>

      <ActionDialog
        open={Boolean(closing)} onClose={() => setClosing(null)}
        title="Resolve this case" description="Say what was done so the next person reading this knows. You can reopen it later."
        confirmLabel="Resolve case" needsReason={false}
        fields={[{ name: "resolution", label: "How was it resolved?", placeholder: "e.g. Marked invoice paid with receipt SLK…, access restored" }]}
        onSubmit={async (v) => { await adminSupportService.updateCase(caseId, { status: closing, resolution: v.resolution }); toast.success("Case resolved"); await load(); setTimelineKey((k) => k + 1); }}
      />
    </div>
  );
}
