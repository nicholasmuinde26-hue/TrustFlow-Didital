import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import membersApi from "../api/members.api";

const unwrap = (response) => response?.data?.data ?? response?.data;

export default function RequestExitModal({ open, onClose, workspaceId, type, membership }) {
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const { data: assessment, isLoading, error } = useQuery({
    queryKey: ["member-exit-assessment", workspaceId, membership?._id],
    queryFn: async () => unwrap(await membersApi.assessExit(type, workspaceId, membership._id)),
    enabled: Boolean(open && membership?._id),
  });
  const request = useMutation({
    mutationFn: () => membersApi.requestOwnExit(type, workspaceId, membership._id, reason.trim()),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["member-exits", workspaceId] }),
        client.invalidateQueries({ queryKey: ["members", workspaceId] }),
        client.invalidateQueries({ queryKey: ["members-overview", workspaceId] }),
      ]);
      setReason("");
      setMessage("");
      onClose();
    },
    onError: (e) => setMessage(e?.response?.data?.message || "Could not submit the exit request."),
  });
  if (!open) return null;
  const blockers = assessment?.blockingReasons || assessment?.blocking_reasons || [];
  const fields = [
    ["Savings refund", assessment?.savings ?? assessment?.withdrawableSavings, true],
    ["Contribution arrears", assessment?.arrears, false],
    ["Outstanding loans", assessment?.loanOutstanding ?? assessment?.loan_outstanding, false],
  ];

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="request-exit-title" className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-start justify-between border-b border-slate-100 p-5 dark:border-slate-800"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-600">Membership request</p><h2 id="request-exit-title" className="mt-1 text-lg font-black text-slate-900 dark:text-white">Request to exit the Chama</h2><p className="mt-1 text-xs leading-5 text-slate-500">Your membership stays active until required approvals and any refund are complete.</p></div><button type="button" aria-label="Close" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18}/></button></header>
      <div className="space-y-4 p-5">
        {isLoading && <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500"><Loader2 className="animate-spin" size={16}/>Checking your financial clearance…</div>}
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error?.response?.data?.message || "Could not load your live exit assessment."}</p>}
        {assessment && <div className="grid gap-2 sm:grid-cols-3">{fields.map(([label, value, positive]) => <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 text-sm font-black ${positive ? "text-emerald-700 dark:text-emerald-300" : "text-slate-800 dark:text-slate-100"}`}>KES {Number(value || 0).toLocaleString()}</p></div>)}</div>}
        {blockers.length > 0 && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 dark:border-rose-900 dark:bg-rose-950/30"><p className="flex items-center gap-2 text-xs font-black text-rose-800 dark:text-rose-200"><AlertTriangle size={15}/>Clear these items before requesting an exit</p><ul className="mt-2 list-inside list-disc space-y-1 text-xs text-rose-700 dark:text-rose-300">{blockers.map((item, i) => <li key={`${item}-${i}`}>{item}</li>)}</ul></div>}
        {assessment && blockers.length === 0 && <p className="flex items-start gap-2 rounded-2xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"><CheckCircle2 size={15} className="mt-0.5 shrink-0"/>Your current obligations are clear. Leadership approval is still required before the Treasurer settles the refund and closes the membership.</p>}
        <div><label htmlFor="request-exit-reason" className="text-xs font-bold text-slate-700 dark:text-slate-200">Reason <span className="font-normal text-slate-400">(optional)</span></label><textarea id="request-exit-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="Add context for the leadership team" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950"/></div>
        {message && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{message}</p>}
      </div>
      <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/30"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800">Keep membership</button><button type="button" onClick={() => request.mutate()} disabled={request.isPending || isLoading || Boolean(error) || !assessment || blockers.length > 0} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{request.isPending && <Loader2 size={14} className="animate-spin"/>}Submit exit request</button></footer>
    </section>
  </div>;
}
