import React from "react";
import { Plus, ShoppingBag, Receipt, UserPlus, PackagePlus } from "lucide-react";

export function QuickActions({ onAction }) {
  const actions = [
    { label: "New Sale / Invoice", icon: ShoppingBag, color: "bg-violet-600 hover:bg-violet-700 text-white" },
    { label: "Record Expense", icon: Receipt, color: "bg-amber-600 hover:bg-amber-700 text-white" },
    { label: "Add Customer", icon: UserPlus, color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
    { label: "Restock Inventory", icon: PackagePlus, color: "bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600" },
  ];

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
        Quick Operations
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.label}
              type="button"
              onClick={() => onAction && onAction(act.label)}
              className={`flex items-center gap-3 rounded-xl p-3.5 font-bold text-xs shadow-xs transition hover:-translate-y-0.5 ${act.color}`}
            >
              <Icon size={18} />
              <span>{act.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}