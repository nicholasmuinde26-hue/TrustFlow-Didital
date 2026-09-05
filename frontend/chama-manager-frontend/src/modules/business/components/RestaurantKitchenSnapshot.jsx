import React from "react";
import { ClipboardList, CheckCircle2, UtensilsCrossed, Package } from "lucide-react";
import { useKitchenOrders, useBusinessInventory } from "../hooks/useBusiness";

/* ============================================================
   RESTAURANT KITCHEN SNAPSHOT

   An order-prep view for restaurant/food workspaces, shown on
   the Business Dashboard just below the cash stat cards.
   Answers what a restaurant owner checks first: how many
   tickets are queued in the kitchen right now, how many are
   ready and waiting for pickup, and how big the menu is.

   Derived entirely client-side from the same order/menu data
   already fetched for the "Kitchen & Food Prep" and "Menu
   Items" pages — no separate backend endpoint required.
============================================================ */

export function RestaurantKitchenSnapshot({ workspaceId }) {
  const { tickets, readySales, isLoading: loadingOrders } = useKitchenOrders(workspaceId);
  const { inventory, isLoading: loadingMenu } = useBusinessInventory(workspaceId);

  const menuItems = Array.isArray(inventory) ? inventory : [];
  const queuedCount = Array.isArray(tickets) ? tickets.length : 0;
  const readyCount = Array.isArray(readySales) ? readySales.length : 0;

  if ((loadingOrders && loadingMenu) || (queuedCount === 0 && readyCount === 0 && menuItems.length === 0)) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
        Kitchen & Orders Snapshot
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SnapshotStat label="Queued Tickets" value={queuedCount} icon={ClipboardList} tone="amber" />
        <SnapshotStat label="Ready for Pickup" value={readyCount} icon={CheckCircle2} tone="emerald" />
        <SnapshotStat label="Menu Items" value={menuItems.length} icon={UtensilsCrossed} tone="violet" />
        <SnapshotStat
          label="Tracked Ingredients"
          value={menuItems.filter((i) => i.track_stock !== false).length}
          icon={Package}
          tone="cyan"
        />
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

export default RestaurantKitchenSnapshot;