import React from "react";
import { ShoppingBag, Receipt, UserPlus, PackagePlus, Home, UtensilsCrossed, Calendar, ClipboardList } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

export function QuickActions({ onAction, category }) {
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const base = `/workspace/${workspaceId}`;

  const isRental = category === "rental";
  const isRestaurant = category === "restaurant";
  const isService = category === "service";

  let actions = [];

  if (isRental) {
    actions = [
      { label: "Add Room / Unit", icon: Home, onClick: () => navigate(`${base}/business/rental-listings`) },
      { label: "Collect Rent (STK)", icon: ShoppingBag, onClick: () => onAction("mpesa") },
      { label: "Record Expense", icon: Receipt, onClick: () => navigate(`${base}/business/expenses`) },
      { label: "Tenant Inquiries", icon: ClipboardList, onClick: () => navigate(`${base}/business/rental-inquiries`) },
    ];
  } else if (isRestaurant) {
    actions = [
      { label: "Point of Sale (POS)", icon: UtensilsCrossed, onClick: () => navigate(`${base}/business/pos`) },
      { label: "Collect Payment (STK)", icon: ShoppingBag, onClick: () => onAction("mpesa") },
      { label: "Record Expense", icon: Receipt, onClick: () => navigate(`${base}/business/expenses`) },
      { label: "Restock Ingredients", icon: PackagePlus, onClick: () => navigate(`${base}/business/inventory`) },
    ];
  } else if (isService) {
    actions = [
      { label: "New Appointment / Job", icon: Calendar, onClick: () => navigate(`${base}/business/sales`) },
      { label: "Collect Payment (STK)", icon: ShoppingBag, onClick: () => onAction("mpesa") },
      { label: "Record Expense", icon: Receipt, onClick: () => navigate(`${base}/business/expenses`) },
      { label: "Add Client", icon: UserPlus, onClick: () => navigate(`${base}/business/customers`) },
    ];
  } else {
    // Retail & Other
    actions = [
      { label: "Point of Sale (POS)", icon: ShoppingBag, onClick: () => navigate(`${base}/business/pos`) },
      { label: "Collect Payment (STK)", icon: ShoppingBag, onClick: () => onAction("mpesa") },
      { label: "Record Expense", icon: Receipt, onClick: () => navigate(`${base}/business/expenses`) },
      { label: "Restock Inventory", icon: PackagePlus, onClick: () => navigate(`${base}/business/inventory`) },
    ];
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
        Quick Operations ({category ? category.toUpperCase() : "GENERAL"})
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.label}
              type="button"
              onClick={act.onClick}
              className="flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3.5 font-bold text-xs text-white shadow-xs hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 transition hover:-translate-y-0.5"
            >
              <Icon size={18} className="text-emerald-400" />
              <span>{act.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}