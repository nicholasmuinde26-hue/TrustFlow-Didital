import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, Clock3, Loader2, RefreshCw, Wallet, X } from "lucide-react";
import membersApi from "@/modules/members/api/members.api";
import { InputField, Notice, Segmented } from "../components/DeskUI";

const unwrap = (response) => response?.data?.data ?? response?.data;
const label = (status) => ({ pending_approval: "Needs approval", approved: "Awaiting disbursement", disbursed: "Completed", rejected: "Declined", cancelled: "Cancelled" }[status] || status?.replace(/_/g, " "));

export default function MemberExitRequestsTab({ workspaceId, type, role }) {
  const client = useQueryClient();
  const [scope, setScope] = useState("open");
  const [comments, setComments] = useState({});
  const [method, setMethod] = useState({});
  const [reference, setReference] = useState({});
  const [feedback, setFeedback] = useState(null);
  const key = ["member-exits", workspaceId, scope];
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: key,
    queryFn: async () => unwrap(await membersApi.exitQueue(type, workspaceId, scope)),
    enabled: Boolean(workspaceId && type),
    refetchInterval: 45000,
  });
  const invalidate = () => Promise.all([
    client.invalidateQueries({ queryKey: ["member-exits", workspaceId] }),
    client.invalidateQueries({ queryKey: ["members", workspaceId] }),
  ]);
  const decide = useMutation({
    mutationFn: ({ id, decision }) => membersApi.decideExit(type, workspaceId, id, decision, comments[id] || ""),
    onSuccess: async (_, vars) => { setFeedback({ tone: "success", text: `Exit request ${vars.decision === "approve" ? "approved" : "declined"}.` }); await invalidate(); },
    onError: (e) => setFeedback({ tone: "error", text: e?.response?.data?.message || "Could not record your decision." }),
  });
  const disburse = useMutation({
    mutationFn: ({ id }) => membersApi.disburseExit(type, workspaceId, id, { disbursement_method: method[id] || "mpesa", external_reference: reference[id] || undefined }),
    onSuccess: async () => { setFeedback({ tone: "success", text: "Refund recorded and membership closed." }); await invalidate(); },
    onError: (e) => setFeedback({ tone: "error", text: e?.response?.data?.message || "Could not complete the refund." }),
  });
  const items = data?.items || [];

  return <div className="space-y-5">
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Member governance</p><h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">Exit requests</h2><p className="mt-1 text-xs text-slate-500">Review clearance, record required approvals, and track the Treasurer’s settlement.</p></div><button type="button" onClick={() => refetch()} disabled={isFetching} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><RefreshCw size={14} className={isFetching ? "animate-spin" : ""}/>Refresh</button></div>
      <div className="mt-5 flex gap-2"><button type="button" onClick={() => setScope("open")} className={`rounded-xl px-3.5 py-2 text-xs font-bold ${scope === "open" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>Open ({data?.summary?.open ?? "—"})</button><button type="button" onClick={() => setScope("closed")} className={`rounded-xl px-3.5 py-2 text-xs font-bold ${scope === "closed" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>History</button></div>
    </section>
    {feedback && <Notice tone={feedback.tone === "error" ? "error" : "success"}>{feedback.text}</Notice>}
    {isError && <Notice tone="error">{error?.response?.data?.message || "Could not load exit requests."}</Notice>}
    {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-emerald-600"/></div> : items.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900"><Clock3 className="mx-auto h-8 w-8 text-slate-300"/><h3 className="mt-3 text-sm font-black text-slate-800 dark:text-slate-200">No {scope === "open" ? "open" : "past"} exit requests</h3><p className="mt-1 text-xs text-slate-500">Requests from members will appear here with their live clearance and approval progress.</p></div> : <div className="space-y-4">{items.map((item) => <article key={item.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-black text-slate-900 dark:text-white">{item.member?.name || "Member"}</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-300">{label(item.status)}</span></div><p className="mt-1 text-xs text-slate-500">{item.member?.phone || "No phone on file"} · Requested {item.created_at ? new Date(item.created_at).toLocaleDateString() : "recently"}</p>{item.reason && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-950/50 dark:text-slate-300">“{item.reason}”</p>}</div><div className="rounded-2xl bg-emerald-50 px-4 py-3 dark:bg-emerald-950/30"><p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">Refund assessment</p><p className="mt-1 text-lg font-black text-slate-900 dark:text-white">KES {Number(item.clearance?.savings ?? item.savings_amount ?? 0).toLocaleString()}</p></div></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">{[["Savings", item.clearance?.savings], ["Arrears", item.clearance?.arrears], ["Loan balance", item.clearance?.loan_outstanding]].map(([name, value]) => <div key={name} className="rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800"><p className="text-[10px] font-bold uppercase text-slate-400">{name}</p><p className="mt-1 text-xs font-black text-slate-700 dark:text-slate-200">KES {Number(value || 0).toLocaleString()}</p></div>)}</div>
      {item.clearance?.blocking_reasons?.length > 0 && <p className="mt-3 flex gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"><AlertCircle size={15} className="shrink-0"/>{item.clearance.blocking_reasons.join(" · ")}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2">{item.approval?.approvals?.map((approval, i) => <span key={`${approval.role}-${i}`} className={`rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${approval.status === "approved" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : approval.status === "rejected" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>{approval.role?.replace(/_/g, " ")}: {approval.status}{approval.name ? ` · ${approval.name}` : ""}</span>)}</div>
      {item.can_sign && <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800"><label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">Decision note{role === "chairperson" || role === "treasurer" ? " (required when declining)" : ""}</label><textarea value={comments[item.id] || ""} onChange={(e) => setComments((old) => ({ ...old, [item.id]: e.target.value }))} rows={2} maxLength={500} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950" placeholder="Add context for the member and other officials"/><div className="mt-2 flex justify-end gap-2"><button type="button" onClick={() => { if (!comments[item.id]?.trim()) { setFeedback({ tone: "error", text: "Add a reason before declining this request." }); return; } decide.mutate({ id: item.id, decision: "reject" }); }} disabled={decide.isPending} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300"><X size={14}/>Decline</button><button type="button" onClick={() => decide.mutate({ id: item.id, decision: "approve" })} disabled={decide.isPending} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50"><Check size={14}/>Approve</button></div></div>}
      {item.can_disburse && <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800"><div className="min-w-60"><Segmented label="Method" value={method[item.id] || "mpesa"} onChange={(v) => setMethod((old) => ({ ...old, [item.id]: v }))} options={[{ value: "mpesa", label: "M-Pesa" }, { value: "wallet", label: "Member wallet" }, { value: "bank", label: "Bank" }, { value: "cash", label: "Cash" }]} /></div><div className="min-w-44 flex-1"><InputField label="Reference (optional)" value={reference[item.id] || ""} onChange={(v) => setReference((old) => ({ ...old, [item.id]: v }))} placeholder="Transaction reference" /></div><button type="button" onClick={() => disburse.mutate({ id: item.id })} disabled={disburse.isPending} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"><Wallet size={14}/>{disburse.isPending ? "Recording…" : "Record refund & close membership"}</button></div>}
      </article>)}</div>}
  </div>;
}
