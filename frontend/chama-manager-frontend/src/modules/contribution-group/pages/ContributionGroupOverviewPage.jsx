import { Link, useParams } from "react-router-dom";
import { Users, Target, CircleDollarSign, AlertCircle, CalendarHeart, MapPin } from "lucide-react";
import StatCard from "@/shared/components/ui/StatCard";

const money = (value) => `KES ${Number(value || 0).toLocaleString()}`;

export default function ContributionGroupOverviewPage({ dashboard }) {
  const { workspaceId } = useParams();
  const { workspace, stats, upcoming } = dashboard;
  const base = `/workspace/${workspaceId}`;
  return (
    <div className="space-y-7">
      <section className="rounded-3xl border border-violet-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">EVENT CONTRIBUTION PROGRESS</p>
        <h2 className="mt-1 text-2xl font-bold">{workspace.name}</h2>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
          {workspace.eventDate && <span className="flex items-center gap-1.5"><CalendarHeart size={16} /> {new Date(workspace.eventDate).toLocaleDateString()}</span>}
          {workspace.location && <span className="flex items-center gap-1.5"><MapPin size={16} /> {workspace.location}</span>}
        </div>
        <div className="mt-5 flex gap-3"><Link className="rounded-xl bg-violet-700 px-4 py-2.5 font-semibold text-white" to={`${base}/contributions`}>View contributions</Link><Link className="rounded-xl border border-violet-200 px-4 py-2.5 font-semibold text-violet-700 dark:border-slate-700 dark:text-violet-300" to={`${base}/schedule`}>View schedule</Link></div>
      </section>
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Participants" value={stats.memberCount} description="People in this group" icon={Users} color="violet" />
        <StatCard title="Raised" value={money(stats.totalContributed)} description="Confirmed contributions" icon={CircleDollarSign} color="emerald" />
        <StatCard title="Contribution plans" value={stats.activePlans} description="Active group plans" icon={Target} color="blue" />
        <StatCard title="Needs attention" value={stats.overdueCount} description="Past due obligations" icon={AlertCircle} color="amber" />
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-semibold">Next group moments</h2><div className="mt-4 space-y-3">{upcoming.length ? upcoming.map((meeting) => <div key={meeting.id} className="rounded-xl bg-violet-50 p-4 dark:bg-slate-800"><p className="font-medium">{meeting.title}</p><p className="text-sm text-slate-500">{new Date(meeting.startsAt).toLocaleString()}</p></div>) : <p className="text-sm text-slate-500">No upcoming group meetings scheduled.</p>}</div></section>
    </div>
  );
}
