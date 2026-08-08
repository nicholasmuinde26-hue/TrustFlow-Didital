import { Link, useParams } from "react-router-dom";
import { CalendarDays, Clock3, MessageCircle } from "lucide-react";

export default function SchedulePage() {
  const { workspaceId } = useParams();
  const base = `/workspace/${workspaceId}`;
  return <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"><section className="rounded-3xl border border-violet-100 bg-white p-7 dark:border-slate-800 dark:bg-slate-900"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><CalendarDays /></div><p className="mt-5 text-sm font-semibold text-violet-700">GROUP RHYTHM</p><h1 className="mt-1 text-3xl font-bold">Plan the moments that matter</h1><p className="mt-3 max-w-lg text-sm leading-6 text-slate-500">Use meetings for deadlines, check-ins, and celebrations. Keep the group aligned without a long message thread.</p><Link to={`${base}/meetings`} className="mt-6 inline-flex rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800">Manage meetings</Link></section><section className="rounded-3xl bg-slate-900 p-7 text-white"><Clock3 className="text-violet-300"/><h2 className="mt-5 text-xl font-bold">Nothing scheduled yet</h2><p className="mt-2 text-sm leading-6 text-slate-300">The next meetup or contribution deadline will appear here for everyone.</p><Link to={`${base}/chat`} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-violet-300 hover:text-white">Ask the group <MessageCircle size={16}/></Link></section></div>;
}
