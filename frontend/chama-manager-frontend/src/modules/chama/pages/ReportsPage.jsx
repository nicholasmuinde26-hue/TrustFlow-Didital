import React from "react";
import { useParams, Link } from "react-router-dom";
import {
  FileText,
  PieChart,
  Scale,
  TrendingUp,
  ShieldCheck,
  Printer,
  ChevronRight,
} from "lucide-react";

export default function ChamaReportsPage() {
  const { workspaceId } = useParams();
  const basePath = `/workspace/${workspaceId}/finance`;

  const reportCards = [
    {
      title: "Trial Balance (Kugawanya Akaunti)",
      desc: "Equal debit & credit ledger balance of member contributions, MGR payouts, fines & reserves.",
      icon: Scale,
      path: `${basePath}/trial-balance`,
      tag: "CHAMA & BUSINESS MODE",
    },
    {
      title: "Mapato na Matumizi (Income Statement)",
      desc: "Non-accountant summary showing Mapato (Income) - Matumizi (Expenses) = ZILIZOSALIA / SURPLUS.",
      icon: TrendingUp,
      path: `${basePath}/income-statement`,
      tag: "MEMBERS TRANSPARENCY",
    },
    {
      title: "Taarifa ya Fedha (Balance Sheet)",
      desc: "Mali (Bank & Till Assets) vs Madeni (Liabilities) & Mtaji (Members Funds).",
      icon: PieChart,
      path: `${basePath}/balance-sheet`,
      tag: "MEMBERS FUNDS FOCUS",
    },
    {
      title: "Harakati za Fedha (Cash Flow)",
      desc: "Super simple 3-line cash movement: M-Pesa & Bank Cash In vs Cash Out + Opening/Closing balances.",
      icon: FileText,
      path: `${basePath}/cash-flow`,
      tag: "M-PESA & BANK FLOW",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12 font-sans text-slate-900 dark:text-slate-100">
      {/* Header Banner */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 border border-white/30 px-3 py-1 text-xs font-semibold text-white">
                <ShieldCheck className="h-3.5 w-3.5" />
                POWERED BY TRUSTFLOW
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Chama Governance & Financial Audit Hub
            </h1>
            <p className="max-w-2xl text-sm text-emerald-100">
              Generate 100% transparent member financial statements in Swahili & English. No complicated accounting jargon.
            </p>
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-900 shadow-sm hover:bg-emerald-50 transition"
          >
            <Printer className="h-4 w-4" />
            <span>Print Complete Audit Package</span>
          </button>
        </div>
      </header>

      {/* Financial Statement Hub Grid */}
      <div className="grid md:grid-cols-2 gap-5">
        {reportCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link
              key={idx}
              to={card.path}
              className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all hover:border-emerald-500 hover:shadow-md"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="inline-block rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 tracking-wider">
                  {card.tag}
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 group-hover:scale-110 transition">
                  <Icon className="h-5 w-5" />
                </div>
              </div>

              <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition flex items-center justify-between">
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