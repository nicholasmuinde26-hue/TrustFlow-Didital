import React from "react";
import { useParams, useLocation, NavLink } from "react-router-dom";
import {
  Receipt,
  BookOpen,
  Landmark,
  Building2,
  Scale,
  BarChart3,
  TrendingUp,
  LineChart,
  FileBarChart2,
} from "lucide-react";

// The "books of accounts" every chama keeps, in the classic accounting
// order (journal/ledger -> trial balance -> financial statements),
// each linking straight to its real, already-existing page.
//
// This lives in one shared place (instead of being redefined per page)
// so the bar itself is identical everywhere, and — more importantly —
// so it can be rendered by a layout that wraps every book page, which
// is what keeps it on screen while navigating between books instead of
// disappearing and reappearing per page.
function booksOfAccounts(base) {
  return [
    { label: "Transactions", icon: Receipt, to: `${base}/finance/transactions` },
    { label: "General Ledger", icon: BookOpen, to: `${base}/finance/ledger` },
    { label: "Chama Wallet", icon: Landmark, to: `${base}/finance/accounts` },
    { label: "Bank Accounts", icon: Building2, to: `${base}/finance/bank-accounts` },
    { label: "Trial Balance", icon: Scale, to: `${base}/finance/trial-balance` },
    { label: "Balance Sheet", icon: BarChart3, to: `${base}/finance/balance-sheet` },
    { label: "Income Statement", icon: TrendingUp, to: `${base}/finance/income-statement` },
    { label: "Cash Flow", icon: LineChart, to: `${base}/finance/cash-flow` },
    { label: "Reports", icon: FileBarChart2, to: `${base}/reports` },
  ];
}

export default function BooksOfAccountsNav() {
  const { workspaceId } = useParams();
  const location = useLocation();
  const base = `/workspace/${workspaceId}`;

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
      <p className="mb-3 px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
        Quick actions · Books of accounts
      </p>
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {booksOfAccounts(base).map(({ label, icon: Icon, to }) => {
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