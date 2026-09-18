import React from "react";
import { useParams, useLocation, NavLink } from "react-router-dom";
import { Users, ShieldCheck, Gavel, ScrollText } from "lucide-react";

// The related people/governance pages, kept in one place so a single
// layout (GovernanceLayout) can render this bar once and keep it
// mounted while the pages underneath swap out.
//
// Note: Disputes is also linked from the Loans quick-nav (it's
// relevant to both groups), but it only lives as a routed child under
// this governance layout — so this bar is the one that stays visible
// when you land on Disputes itself.
function governancePages(base) {
  return [
    { label: "Members", icon: Users, to: `${base}/members` },
    { label: "Officials", icon: ShieldCheck, to: `${base}/officials` },
    { label: "Disputes", icon: Gavel, to: `${base}/disputes` },
   
    
  ];
}

export default function GovernanceQuickNav() {
  const { workspaceId } = useParams();
  const location = useLocation();
  const base = `/workspace/${workspaceId}`;

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
      <p className="mb-3 px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
        Quick actions · People & governance
      </p>
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {governancePages(base).map(({ label, icon: Icon, to }) => {
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