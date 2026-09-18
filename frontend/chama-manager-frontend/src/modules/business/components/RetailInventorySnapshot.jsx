import React from "react";
import { Package, PackageX, Boxes, Coins } from "lucide-react";
import { useBusinessInventory } from "../hooks/useBusiness";

/* ============================================================
   RETAIL INVENTORY SNAPSHOT

   A stock-level view for retail/wholesale workspaces, shown on
   the Business Dashboard just below the cash stat cards.
   Answers what a shopkeeper checks first: how many SKUs are
   listed, how many are out of stock, and what the stock on
   hand is worth at retail price.

   Derived entirely client-side from the same inventory list
   already fetched for the "Inventory & Stock" page — no
   separate backend endpoint required.
============================================================ */

function formatMoney(amount, currency = "KES") {
  return `${currency} ${Number(amount || 0).toLocaleString()}`;
}

export function RetailInventorySnapshot({ workspaceId, currency = "KES" }) {
  const { inventory, isLoading } = useBusinessInventory(workspaceId);
  const items = Array.isArray(inventory) ? inventory : [];

  if (isLoading || items.length === 0) {
    return null;
  }

  const trackedItems = items.filter((i) => i.track_stock !== false);
  const totalSkus = items.length;
  const outOfStockCount = trackedItems.filter((i) => Number(i.quantity || 0) <= 0).length;
  const totalUnitsInStock = trackedItems.reduce((sum, i) => sum + Number(i.quantity || 0), 0);
  const stockValue = trackedItems.reduce(
    (sum, i) => sum + Number(i.quantity || 0) * Number(i.cost_price || i.price || 0),
    0
  );

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
        Inventory Snapshot
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SnapshotStat label="SKUs Listed" value={totalSkus} icon={Package} tone="emerald" />
        <SnapshotStat label="Units in Stock" value={totalUnitsInStock} icon={Boxes} tone="violet" />
        <SnapshotStat label="Out of Stock" value={outOfStockCount} icon={PackageX} tone="amber" />
        <SnapshotStat label="Stock Value (cost)" value={formatMoney(stockValue, currency)} icon={Coins} tone="cyan" />
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

export default RetailInventorySnapshot;