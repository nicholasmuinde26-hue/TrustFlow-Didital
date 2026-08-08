import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, CircleDollarSign, UsersRound } from "lucide-react";

export default function ContributionsPage() {
  const { workspaceId } = useParams();
  const base = `/workspace/${workspaceId}`;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-violet-700">SHARED FUND</p><h1 className="mt-1 text-3xl font-bold">Contributions</h1><p className="mt-2 text-slate-500">Make every contribution feel visible and encouraging.</p></div><Link to={`${base}/members`} className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800">Invite a member</Link></div>
    <div className="grid gap-4 md:grid-cols-3"><Stat icon={CircleDollarSign} label="Group goal" value="Set your first goal" /><Stat icon={UsersRound} label="Contributors" value="Invite your circle" /><Stat icon={ArrowUpRight} label="Next step" value="Create a schedule" /></div>
    <section className="rounded-3xl border border-dashed border-violet-200 bg-white p-8 text-center dark:border-violet-900 dark:bg-slate-900"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><CircleDollarSign size={26} /></div><h2 className="mt-4 text-xl font-bold">Your contribution story starts here</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Set a schedule, invite members, and each contribution will become part of a clear shared timeline.</p><Link to={`${base}/schedule`} className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Plan the schedule</Link></section>
  </div>;
}

function Stat({ icon: Icon, label, value }) { return <div className="rounded-2xl border border-violet-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><Icon size={19} className="text-violet-600"/><p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }
