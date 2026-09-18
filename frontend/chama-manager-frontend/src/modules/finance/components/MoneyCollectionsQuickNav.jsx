import React from "react";
import { useParams, useLocation, NavLink } from "react-router-dom";
import {
  LayoutGrid,
  CircleDollarSign,
  PlusCircle,
  RefreshCw,
  PiggyBank,
  Send,
  Users,
  Wallet,
} from "lucide-react";

// The tabs across the top of the "Money & Collections" section, kept
// in one place so a single layout (MoneyCollectionsLayout) can render
// them once and keep the bar mounted while the pages underneath swap
// out.
function moneyCollectionsTabs(base) {
  return [
    { label: "Dashboard", icon: LayoutGrid, to: `${base}/finance` },
    { label: "Contributions", icon: CircleDollarSign, to: `${base}/finance/contributions` },
    { label: "Record Contribution", icon: PlusCircle, to: `${base}/finance/record-contribution` },
    { label: "Savings", icon: Wallet, to: `${base}/finance/savings` },
    { label: "Merry-Go-Round (MGR)", icon: RefreshCw, to: `${base}/mgr` },
    { label: "Chama Contributions", icon: Users, to: `${base}/chama-contributions` },
    { label: "Payouts", icon: Send, to: `${base}/finance/payouts` },
    { label: "Savings Share-Out", icon: PiggyBank, to: `${base}/finance/savings-shareout` },
  ];
}

export default function MoneyCollectionsQuickNav() {
  const { workspaceId } = useParams();
  const location = useLocation();
  const base = `/workspace/${workspaceId}`;

  // "Overview" also matches /finance/overview, so its tab stays active
  // on that alias too.
  const isTabActive = (to) => {
    if (to === `${base}/finance`) {
      return location.pathname === to || location.pathname === `${base}/finance/overview`;
    }
    return location.pathname === to;
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 pb-2 dark:border-obsidian-border text-xs font-bold">
      {moneyCollectionsTabs(base).map(({ label, icon: Icon, to }) => {
        const isActive = isTabActive(to);
        return (
          <NavLink
            key={to}
            to={to}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 transition whitespace-nowrap ${
              isActive
                ? ""
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-mist-muted dark:hover:bg-obsidian-card dark:hover:text-mist"
            }`}
            style={isActive ? { backgroundColor: "#059669", color: "#ffffff" } : undefined}
          >
            <Icon size={14} />
            {label}
          </NavLink>
        );
      })}
    </div>
  );
}