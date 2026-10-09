import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CalendarDays, Download, Loader2, Mail, Phone, Wallet, X } from "lucide-react";
import api from "@/app/services/api";
import MemberAvatar from "./MemberAvatar";
import { PersonProfileLoader } from "@/modules/chama/components/PersonProfileCard";

const todayMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};
const roleName = (role) => String(role || "member").replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());

export default function MemberDetailsDrawer({ member, workspaceId, canViewContributions, attendance, onClose }) {
  const [month, setMonth] = useState(todayMonth);
  const user = member?.user_id || {};
  const joined = member?.joined_at || member?.createdAt;
  const statementQuery = useQuery({
    queryKey: ["member-contribution-statement", workspaceId, member?._id, month],
    queryFn: async () => {
      const response = await api.get(`/workspaces/${workspaceId}/finance/contribution-statement`, { params: { scope: "month", month, memberId: member._id } });
      return response?.data?.data;
    },
    enabled: Boolean(member?._id && canViewContributions),
  });
  const statement = statementQuery.data;
  const expected = Number(statement?.totals?.expected || 0);
  const paid = Number(statement?.totals?.paid || 0);
  const contributionHealth = expected <= 0 ? "No scheduled amount" : paid >= expected ? "On track" : "Outstanding";
  const downloadCsv = async () => {
    const response = await api.get(`/workspaces/${workspaceId}/finance/contribution-statement`, { params: { scope: "month", month, memberId: member._id, format: "csv" }, responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `contributions-${user.name || "member"}-${month}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const payments = useMemo(() => statement?.payments || [], [statement]);
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  if (!member) return null;

  return <div className="fixed inset-0 z-[65] flex justify-end bg-slate-950/50 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside role="dialog" aria-modal="true" aria-labelledby="member-details-title" className="flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
      <header className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 p-6 text-white sm:p-8">
        <button type="button" aria-label="Close member details" onClick={onClose} className="absolute right-4 top-4 rounded-xl bg-white/10 p-2 text-white/80 transition hover:bg-white/20 hover:text-white"><X size={18}/></button>
        <div className="flex items-center gap-4 pr-10"><MemberAvatar name={user.name || user.first_name || "Member"} src={user.avatar_url} size="xl" className="border-white/30"/><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">Member profile</p><h2 id="member-details-title" className="mt-1 truncate text-2xl font-black">{user.name || user.first_name || "Member"}</h2><p className="mt-1 text-xs capitalize text-emerald-100">{roleName(member.role)} · {member.status || "active"}</p></div></div>
      </header>
      <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain p-5 sm:p-6">
        <section className="rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-3 text-[10px] font-black uppercase tracking-wide text-slate-400">Profile</p>
          <PersonProfileLoader chamaId={workspaceId} membershipId={member._id} />
        </section>
        <section className="grid gap-3 sm:grid-cols-2">
          {canViewContributions && <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Official contact</p><p className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200"><Phone size={14} className="text-emerald-600"/>{user.phone || "No phone on file"}</p><p className="mt-2 flex items-center gap-2 break-all text-xs font-semibold text-slate-700 dark:text-slate-200"><Mail size={14} className="shrink-0 text-emerald-600"/>{user.email || "No email on file"}</p></div>}
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Membership</p><p className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200"><CalendarDays size={14} className="text-emerald-600"/>Joined {joined ? new Date(joined).toLocaleDateString() : "date unavailable"}</p><p className="mt-2 text-xs text-slate-500">{member.status === "suspended" ? "Currently suspended" : "Active member"}</p></div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Meeting attendance</p><p className="mt-3 text-sm font-black text-slate-800 dark:text-slate-100">{attendance?.total ? `${attendance.attended} of ${attendance.total} meetings` : "No attendance recorded"}</p>{attendance?.total > 0 && <p className="mt-1 text-xs text-slate-500">{attendance.total - attendance.attended} missed</p>}</div>
        </section>

        {canViewContributions && <section className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 dark:bg-slate-950/40"><div><h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white"><Wallet size={16} className="text-emerald-600"/>Contributions</h3><p className="mt-1 text-[11px] text-slate-500">{statement?.period_label || "Monthly member statement"}{statement && ` · ${contributionHealth}`}</p></div><div className="flex items-center gap-2"><input aria-label="Contribution statement month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"/><button type="button" onClick={downloadCsv} disabled={!statement || statementQuery.isLoading} aria-label="Download contribution statement" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><Download size={15}/></button></div></div>
          {statementQuery.isLoading ? <div className="flex items-center justify-center gap-2 p-10 text-xs text-slate-500"><Loader2 size={16} className="animate-spin"/>Loading this member’s statement…</div> : statementQuery.isError ? <div className="m-4 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"><AlertCircle size={15} className="mt-0.5 shrink-0"/>Could not load this member’s contributions. {statementQuery.error?.response?.data?.message || "Try again."}</div> : <>
            <div className="grid grid-cols-3 divide-x divide-slate-100 border-y border-slate-100 dark:divide-slate-800 dark:border-slate-800">{[["Expected", statement?.totals?.expected], ["Paid", statement?.totals?.paid], ["Outstanding", statement?.totals?.balance]].map(([label, value]) => <div key={label} className="p-3"><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-xs font-black text-slate-900 dark:text-white">KES {Number(value || 0).toLocaleString()}</p></div>)}</div>
            <div className="max-h-72 overflow-y-auto overscroll-contain"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-white text-[10px] font-black uppercase text-slate-400 dark:bg-slate-900"><tr><th className="px-4 py-3">Contribution</th><th className="px-3 py-3">Period</th><th className="px-4 py-3 text-right">Paid</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{payments.map((payment, index) => <tr key={`${payment.date}-${payment.reference}-${index}`}><td className="px-4 py-3"><p className="font-bold text-slate-800 dark:text-slate-200">{payment.contribution}</p><p className="mt-0.5 text-[10px] text-slate-400">{payment.date ? new Date(payment.date).toLocaleDateString() : ""} · {payment.method || "Payment"}</p></td><td className="px-3 py-3 text-slate-500">{payment.period || "—"}</td><td className="px-4 py-3 text-right font-black text-slate-800 dark:text-slate-200">KES {Number(payment.amount || 0).toLocaleString()}</td></tr>)}</tbody></table>{payments.length === 0 && <p className="p-6 text-center text-xs text-slate-500">No completed contribution payments in this period.</p>}</div>
            {!!statement?.summary?.length && <div className="border-t border-slate-100 p-4 dark:border-slate-800"><p className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-400">By contribution</p><ul className="space-y-2">{statement.summary.map((item) => <li key={item.plan_id} className="flex items-center justify-between gap-3 text-xs"><span className="truncate font-semibold text-slate-700 dark:text-slate-200">{item.name}</span><span className="shrink-0 text-slate-500">{Number(item.paid || 0).toLocaleString()} / {Number(item.expected || 0).toLocaleString()} KES</span></li>)}</ul></div>}
          </>}
        </section>}
        {!canViewContributions && <p className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">Contribution statements are available to the Chairperson, Treasurer and Secretary.</p>}
      </div>
    </aside>
  </div>;
}
