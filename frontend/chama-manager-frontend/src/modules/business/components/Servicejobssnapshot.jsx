import React from "react";
import { ClipboardList, Clock, CheckCircle2, Users } from "lucide-react";
import { useBusinessSales, useBusinessCustomers } from "../hooks/useBusiness";

/* ============================================================
   SERVICE JOBS SNAPSHOT

   An appointments/jobs view for service-provider workspaces,
   shown on the Business Dashboard just below the cash stat
   cards. Answers what a service business checks first: how
   many jobs are on record, how many invoices are still
   pending payment, and how many clients they're serving.

   Derived entirely client-side from the same jobs/invoices and
   client lists already fetched for the "Appointments & Jobs"
   and "Clients & Customers" pages GÇö no separate backend
   endpoint required.
============================================================ */

export function ServiceJobsSnapshot({ workspaceId }) {
  const { sales, isLoading: loadingJobs } = useBusinessSales(workspaceId);
  const { customers, isLoading: loadingClients } = useBusinessCustomers(workspaceId);

  const jobs = Array.isArray(sales) ? sales : [];
  const clients = Array.isArray(customers) ? customers : [];

  if ((loadingJobs && loadingClients) || (jobs.length === 0 && clients.length === 0)) {
    return null;
  }

  const pendingCount = jobs.filter((j) => j.status && j.status !== "completed").length;
  const completedCount = jobs.filter((j) => !j.status || j.status === "completed").length;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
        Jobs & Clients Snapshot
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SnapshotStat label="Total Jobs" value={jobs.length} icon={ClipboardList} tone="emerald" />
        <SnapshotStat label="Pending Invoices" value={pendingCount} icon={Clock} tone="amber" />
        <SnapshotStat label="Completed" value={completedCount} icon={CheckCircle2} tone="violet" />
        <SnapshotStat label="Active Clients" value={clients.length} icon={Users} tone="cyan" />
      </div>
    </div>
  );
}

function SnapshotStat({ label, value, icon: Icon, tone }) {
  const toneClasses = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  }[tone];

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${toneClasses}`}>
        <Icon size={18} />
      </span>
      <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">{value}</p>
    </div>
  );
}

export default ServiceJobsSnapshot;