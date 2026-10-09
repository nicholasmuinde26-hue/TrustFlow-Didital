import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, Loader2, LogOut, X } from "lucide-react";
import membersApi from "../api/members.api";
import RequestExitModal from "./RequestExitModal";

const unwrap = (response) => response?.data?.data ?? response?.data;
const titles = { pending_approval: "Waiting for leadership approval", approved: "Approved · waiting for Treasurer", rejected: "Request declined", cancelled: "Request cancelled", disbursed: "Exit complete" };

export default function MemberExitPanel({ workspaceId, type, membership, requestTrigger = 0 }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: exits = [], isLoading } = useQuery({
    queryKey: ["member-exits", workspaceId, "mine"],
    queryFn: async () => unwrap(await membersApi.myExitRequests(type, workspaceId)) || [],
    enabled: Boolean(workspaceId && membership?._id),
  });
  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey: ["member-exits", workspaceId] }),
    client.invalidateQueries({ queryKey: ["members", workspaceId] }),
    client.invalidateQueries({ queryKey: ["members-overview", workspaceId] }),
  ]);
  const cancel = useMutation({
    mutationFn: (id) => membersApi.cancelExit(type, workspaceId, id),
    onSuccess: refresh,
  });
  useEffect(() => { if (requestTrigger > 0) setOpen(true); }, [requestTrigger]);
  if (!membership || membership.role !== "member") return null;

  const current = exits.find((exit) => ["pending_approval", "approved"].includes(exit.status));
  const latest = exits[0];
  return <>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6" aria-labelledby="member-exit-title">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"><LogOut size={19}/></span><div><h2 id="member-exit-title" className="text-base font-black text-slate-900 dark:text-white">Leaving the Chama?</h2><p className="mt-1 max-w-xl text-xs leading-5 text-slate-500 dark:text-slate-400">Submit a formal request. Your membership stays active through clearance, approvals and any refund settlement.</p></div></div>
        {current ? <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><Clock3 size={14}/>{titles[current.status]}</span> : <button type="button" onClick={() => setOpen(true)} disabled={isLoading} className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-rose-500 disabled:opacity-50">Request to exit</button>}
      </div>
      {current && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40"><div><p className="text-xs font-bold text-slate-800 dark:text-slate-200">Refund assessment: KES {Number(current.savings_amount || 0).toLocaleString()}</p><p className="mt-1 text-[11px] text-slate-500">{current.approval?.approved_count || 0} of {current.approval?.required || 2} approvals recorded</p>{current.clearance?.blocking_reasons?.length > 0 && <p className="mt-2 text-xs text-rose-700 dark:text-rose-300">Clearance: {current.clearance.blocking_reasons.join(" · ")}</p>}</div>{current.can_cancel && <button type="button" onClick={() => cancel.mutate(current.id)} disabled={cancel.isPending} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">{cancel.isPending ? <Loader2 size={14} className="animate-spin"/> : <X size={14}/>}Cancel request</button>}</div>}
      {!current && latest && <p className="mt-3 text-xs text-slate-500">Latest request: {titles[latest.status] || latest.status}</p>}
    </section>
    <RequestExitModal open={open && !current} onClose={() => setOpen(false)} workspaceId={workspaceId} type={type} membership={membership}/>
  </>;
}
