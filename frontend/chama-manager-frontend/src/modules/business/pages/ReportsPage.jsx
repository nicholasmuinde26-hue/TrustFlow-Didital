import React from "react";
import { useParams, Link } from "react-router-dom";
import {
  BarChart3,
  Scale,
  TrendingUp,
  PieChart,
  ChevronRight,
  ShieldCheck,
  Printer,
} from "lucide-react";

export default function BusinessReportsPage() {
  const { workspaceId } = useParams();
  const basePath = `/workspace/${workspaceId}/finance`;

  const reportCards = [
    {
      title: "Trial Balance Ledger",
      desc: "Standard Chart of Accounts debit and credit balance audit for controllers and tax compliance.",
      icon: Scale,
      path: `${basePath}/trial-balance`,
      tag: "IFRS / GAAP AUDIT",
    },
    {
      title: "Profit & Loss (Income Statement)",
      desc: "Revenue, COGS, Gross Margin, OpEx breakdown, and Net Operating Profit before tax.",
      icon: TrendingUp,
      path: `${basePath}/income-statement`,
      tag: "TAX & KRA READY",
    },
    {
      title: "Balance Sheet (Financial Position)",
      desc: "Statement of Financial Position: Assets, Accounts Receivable, Liabilities, and Equity.",
      icon: PieChart,
      path: `${basePath}/balance-sheet`,
      tag: "BANK & INVESTOR READY",
    },
    {
      title: "Statement of Cash Flows",
      desc: "Full 3-tier Cash Flow statement: Operating, Investing, and Financing activities.",
      icon: BarChart3,
      path: `${basePath}/cash-flow`,
      tag: "3-TIER CASH FLOW",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12 font-sans text-slate-900 dark:text-slate-100">
      {/* Header Banner */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-sky-700 via-indigo-700 to-sky-800 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 border border-white/30 px-3 py-1 text-xs font-semibold text-white">
                <ShieldCheck className="h-3.5 w-3.5" />
                POWERED BY TRUSTFLOW
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Business Intelligence & Corporate Financial Reports
            </h1>
            <p className="max-w-2xl text-sm text-sky-100">
              Tax-ready, audit-compliant financial statements built for Directors, Accountants, Investors, and KRA compliance.
            </p>
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-sky-900 shadow-sm hover:bg-sky-50 transition"
          >
            <Printer className="h-4 w-4" />
            <span>Export Financial Package</span>
          </button>
        </div>
      </header>

      {/* Reports Grid */}
      <div className="grid md:grid-cols-2 gap-5">
        {reportCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link
              key={idx}
              to={card.path}
              className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all hover:border-sky-500 hover:shadow-md"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="inline-block rounded-full bg-sky-50 border border-sky-200 px-3 py-1 text-[10px] font-bold text-sky-800 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-300 tracking-wider">
                  {card.tag}
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400 group-hover:scale-110 transition">
                  <Icon className="h-5 w-5" />
                </div>
              </div>

              <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-sky-700 dark:group-hover:text-sky-400 transition flex items-center justify-between">
                <span>{card.title}</span>
                <ChevronRight className="h-5 w-5 opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition text-slate-400" />
              </h3>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{card.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}