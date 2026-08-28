import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  FileText,
  PieChart,
  Scale,
  TrendingUp,
  Plus,
  Clock,
  ChevronRight,
  Download,
} from "lucide-react";

export default function ChamaReportsPage() {
  const { workspaceId } = useParams();
  const basePath = `/workspace/${workspaceId}/finance`;
  const [activeTab, setActiveTab] = useState("all");

  const reports = [
    {
      id: "financial-summary",
      title: "Financial Summary",
      desc: "Complete financial overview and key financial ratios.",
      category: "financial",
      path: `${basePath}/income-statement`,
    },
    {
      id: "contribution-report",
      title: "Contribution Report",
      desc: "Member contributions analysis, collection rate and arrears.",
      category: "financial",
      path: `/workspace/${workspaceId}/contributions`,
    },
    {
      id: "loan-portfolio",
      title: "Loan Portfolio Report",
      desc: "Loans performance, risk metrics, interest earned and aging.",
      category: "loans",
      path: `/workspace/${workspaceId}/loans`,
    },
    {
      id: "mgr-report",
      title: "MGR Report",
      desc: "Merry-Go-Round performance, round rotation payouts and history.",
      category: "mgr",
      path: `/workspace/${workspaceId}/mgr`,
    },
    {
      id: "member-activity",
      title: "Member Activity Report",
      desc: "Member participation, meeting attendance and transaction trends.",
      category: "members",
      path: `/workspace/${workspaceId}/contributions`,
    },
    {
      id: "balance-sheet",
      title: "Balance Sheet",
      desc: "Statement of financial position: Assets, Liabilities and Equity.",
      category: "financial",
      path: `${basePath}/balance-sheet`,
    },
    {
      id: "trial-balance",
      title: "Trial Balance",
      desc: "Account balances summary, debit and credit ledger verification.",
      category: "financial",
      path: `${basePath}/trial-balance`,
    },
    {
      id: "cash-flow",
      title: "Cash Flow Statement",
      desc: "Cash movement analysis: Operating, Investing and Financing flows.",
      category: "financial",
      path: `${basePath}/cash-flow`,
    },
  ];

  const filteredReports = reports.filter(r => activeTab === "all" || r.category === activeTab);

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Reports
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Generate insights for better decisions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition">
            <Clock size={16} className="text-slate-400" /> Schedule Report
          </button>
          <button className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition">
            <Plus size={16} /> Custom Report
          </button>
        </div>
      </div>

      {/* Category Pills Filter Bar */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: "all", label: "All Reports" },
            { id: "financial", label: "Financial" },
            { id: "members", label: "Members" },
            { id: "loans", label: "Loans" },
            { id: "mgr", label: "MGR" },
            { id: "compliance", label: "Compliance" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filteredReports.map((card) => (
          <div
            key={card.id}
            className="group rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="h-3 w-3 rounded-full bg-indigo-500" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{card.category}</span>
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                {card.title}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {card.desc}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <Link
                to={card.path}
                className="w-full rounded-2xl bg-indigo-600 px-4 py-2 text-center text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition"
              >
                Generate
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}