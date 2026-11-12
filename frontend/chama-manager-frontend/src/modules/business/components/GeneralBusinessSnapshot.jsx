import React from "react";
import { Boxes, Package, Users, Truck, AlertTriangle } from "lucide-react";
import { useBusinessCustomers, useBusinessInventory, useBusinessSuppliers } from "../hooks/useBusiness";

export function GeneralBusinessSnapshot({ workspaceId }) {
  const inventoryQuery = useBusinessInventory(workspaceId);
  const customersQuery = useBusinessCustomers(workspaceId);
  const suppliersQuery = useBusinessSuppliers(workspaceId);
  const inventory = Array.isArray(inventoryQuery.inventory) ? inventoryQuery.inventory : [];
  const customers = Array.isArray(customersQuery.customers) ? customersQuery.customers : [];
  const suppliers = Array.isArray(suppliersQuery.suppliers) ? suppliersQuery.suppliers : [];
  const tracked = inventory.filter((item) => item.track_stock !== false);
  const lowStock = tracked.filter((item) => Number(item.quantity || 0) <= 0 || (Number(item.reorder_level) > 0 && Number(item.quantity || 0) <= Number(item.reorder_level)));
  const cards = [
    { label: "Products & services", value: inventory.length, icon: Boxes, tone: "violet" },
    { label: "Customers", value: customers.length, icon: Users, tone: "cyan" },
    { label: "Suppliers", value: suppliers.length, icon: Truck, tone: "emerald" },
    { label: "Low stock items", value: lowStock.length, icon: lowStock.length ? AlertTriangle : Package, tone: lowStock.length ? "amber" : "cyan", note: lowStock.length ? "Review stock and reorder" : "No stock alerts" },
  ];
  const loading = inventoryQuery.isLoading || customersQuery.isLoading || suppliersQuery.isLoading;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-busy={loading}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Operations snapshot</h2><p className="mt-1 text-xs text-slate-500">A quick view of the people, catalogue and stock supporting this business.</p></div>
        {loading && <span className="text-xs font-medium text-slate-400">Updating…</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, tone, note }) => (
          <div key={label} className="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
            <span className={`grid h-9 w-9 place-items-center rounded-xl ${toneClass(tone)}`}><Icon size={17} /></span>
            <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">{loading ? "—" : value}</p>
            {note && !loading && <p className="mt-1 text-[10px] text-slate-400">{note}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function toneClass(tone) {
  return {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  }[tone];
}

export default GeneralBusinessSnapshot;
