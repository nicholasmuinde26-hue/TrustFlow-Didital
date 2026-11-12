import React from "react";
import { ShoppingBag, Receipt, UserPlus, PackagePlus, Home, UtensilsCrossed, Calendar, ClipboardList, Wrench, Boxes } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

export function QuickActions({ category }) {
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const base = `/workspace/${workspaceId}`;

  const isRental = category === "rental";
  const isRestaurant = category === "restaurant";
  const isService = category === "service";
  const categoryLabel = ({ rental: "Rental property", retail: "Retail & wholesale", restaurant: "Restaurant & food", service: "Service provider", other: "General business" })[category] || "General business";

  let actions = [];

  if (isRental) {
    actions = [
      { label: "Add Room / Unit", icon: Home, onClick: () => navigate(`${base}/business/rental-listings`) },
      { label: "Record Rent / Payment", icon: ShoppingBag, onClick: () => navigate(`${base}/business/sales`) },
      { label: "Tenant Inquiries", icon: ClipboardList, onClick: () => navigate(`${base}/business/rental-inquiries`) },
      { label: "Maintenance & Expenses", icon: Receipt, onClick: () => navigate(`${base}/business/expenses`) },
    ];
  } else if (isRestaurant) {
    actions = [
      { label: "Start an Order", icon: UtensilsCrossed, onClick: () => navigate(`${base}/business/pos`) },
      { label: "Kitchen Queue", icon: ClipboardList, onClick: () => navigate(`${base}/business/kitchen`) },
      { label: "Update Menu & Stock", icon: PackagePlus, onClick: () => navigate(`${base}/business/inventory`) },
      { label: "Record Expense", icon: Receipt, onClick: () => navigate(`${base}/business/expenses`) },
    ];
  } else if (isService) {
    actions = [
      { label: "Create Job / Invoice", icon: Calendar, onClick: () => navigate(`${base}/business/sales`) },
      { label: "Manage Services", icon: Wrench, onClick: () => navigate(`${base}/business/inventory`) },
      { label: "Add Client", icon: UserPlus, onClick: () => navigate(`${base}/business/customers`) },
      { label: "Record Expense", icon: Receipt, onClick: () => navigate(`${base}/business/expenses`) },
    ];
  } else {
    // Retail & Other
    actions = [
      { label: "Open Point of Sale", icon: ShoppingBag, onClick: () => navigate(`${base}/business/pos`) },
      { label: "Add Product / Service", icon: Boxes, onClick: () => navigate(`${base}/business/inventory`) },
      { label: "Add Customer", icon: UserPlus, onClick: () => navigate(`${base}/business/customers`) },
      { label: "Record Expense", icon: Receipt, onClick: () => navigate(`${base}/business/expenses`) },
    ];
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
        Quick actions · {categoryLabel}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.label}
              type="button"
              onClick={act.onClick}
              className="flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3.5 text-left text-xs font-bold text-white shadow-xs transition hover:-translate-y-0.5 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:bg-slate-800 dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-900"
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
