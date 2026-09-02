import React from "react";
import { Home, Key, DoorOpen, Percent } from "lucide-react";
import { useRentalListings } from "../hooks/useBusiness";

/* ============================================================
   RENTAL OCCUPANCY SNAPSHOT

   A portfolio-level view for rental workspaces, shown on the
   Business Dashboard just below the cash stat cards. Answers
   the questions a landlord/property manager checks first:
   how many units do I have, how many are occupied, and what's
   my occupancy rate — whether the portfolio is one bedsitter
   or a hundred units.

   Derived entirely client-side from the same rental listings
   already fetched for the "Rooms & Plots" page — no separate
   backend endpoint required.
============================================================ */

function formatMoney(amount, currency = "KES") {
  return `${currency} ${Number(amount || 0).toLocaleString()}`;
}

export function RentalOccupancySnapshot({ workspaceId, currency = "KES" }) {
  const { listings, isLoading } = useRentalListings(workspaceId);
  const listingList = Array.isArray(listings) ? listings : [];

  if (isLoading || listingList.length === 0) {
    return null;
  }

  const totalUnits = listingList.length;
  const occupiedCount = listingList.filter((l) => l.status === "occupied").length;
  const vacantCount = totalUnits - occupiedCount;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedCount / totalUnits) * 100) : 0;
  const potentialMonthlyRent = listingList
    .filter((l) => (l.rent_period || "month") === "month")
    .reduce((sum, l) => sum + Number(l.rent_amount || 0), 0);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
        Rental Portfolio
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SnapshotStat label="Total Units" value={totalUnits} icon={Home} tone="emerald" />
        <SnapshotStat label="Occupied" value={occupiedCount} icon={Key} tone="violet" />
        <SnapshotStat label="Vacant" value={vacantCount} icon={DoorOpen} tone="amber" />
        <SnapshotStat label="Occupancy Rate" value={`${occupancyRate}%`} icon={Percent} tone="cyan" />
      </div>

      {potentialMonthlyRent > 0 && (
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Potential monthly rent across all listed units:{" "}
          <span className="font-bold text-slate-900 dark:text-white">
            {formatMoney(potentialMonthlyRent, currency)}
          </span>
        </p>
      )}
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

export default RentalOccupancySnapshot;