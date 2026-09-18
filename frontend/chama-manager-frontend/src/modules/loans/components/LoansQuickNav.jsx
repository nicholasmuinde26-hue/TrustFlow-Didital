import React from "react";
import { useParams, useLocation, NavLink } from "react-router-dom";
import { HandCoins, Gauge, History, Gavel } from "lucide-react";

// The related loans/risk pages, kept in one place so a single layout
// (LoansGroupLayout) can render this bar once and keep it mounted
// while the pages underneath swap out.
//
// Note: Disputes is also linked from the People & Governance
// quick-nav, and that's the group it's actually routed under — this
// bar links to it for convenience, but landing on Disputes itself
// shows the governance bar, not this one.
function loansPages(base) {
  return [
    { label: "Loans", icon: HandCoins, to: `${base}/loans` },
    { label: "Trust Score", icon: Gauge, to: `${base}/trust-score` },
    { label: "Trust Timeline", icon: History, to: `${base}/trust-timeline` },
    
  ];
}

export default function LoansQuickNav() {
  const { workspaceId } = useParams();
  const location = useLocation();
  const base = `/workspace/${workspaceId}`;

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
      <p className="mb-3 px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
        Quick actions · Loans
      </p>
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {loansPages(base).map(({ label, icon: Icon, to }) => {
          const isActive = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              className={`flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-xs font-bold transition whitespace-nowrap ${
                isActive
                  ? "border-indigo-600 bg-indigo-600 text-white shadow-xs dark:border-mint dark:bg-mint dark:text-obsidian-rail"
                  : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/60 dark:border-obsidian-border dark:bg-obsidian-raised/40 dark:text-mist-muted dark:hover:bg-obsidian-raised"
              }`}
            >
              <Icon size={15} />
              {label}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}