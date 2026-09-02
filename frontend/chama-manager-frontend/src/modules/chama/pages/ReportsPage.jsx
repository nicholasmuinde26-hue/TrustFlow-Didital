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
  Lock,
  ShieldCheck,
  Building2,
  User,
} from "lucide-react";
import useWorkspace from "@/app/hooks/useWorkspace";

export default function ChamaReportsPage() {
  const { workspaceId } = useParams();
  const workspace = useWorkspace();
  const basePath = `/workspace/${workspaceId}/finance`;
  const [activeTab, setActiveTab] = useState("all");

  const userRole = (
    workspace?.activeWorkspace?.role ||
    workspace?.currentWorkspace?.role ||
    ""
  ).toLowerCase();

  const isOfficial = ["treasurer", "chairperson", "secretary", "admin", "owner"].includes(userRole);

  const reports = [
    // Member-Accessible Reports
    {
      id: "financial-summary",
      title: "Financial Summary",
      desc: "Complete financial overview, operational income, and key financial ratios.",
      category: "financial",
      path: `${basePath}/income-statement`,
      managementOnly: false,
    },
    {
      id: "balance-sheet",
      title: "Balance Sheet",
      desc: "Statement of financial position: Chama Assets, Liabilities and Equity.",
      category: "financial",
      path: `${basePath}/balance-sheet`,
      managementOnly: false,
    },
    {
      id: "cash-flow",
      title: "Cash Flow Statement",
      desc: "Cash movement analysis: Operating, Investing and Financing cash flows.",
      category: "financial",
      path: `${basePath}/cash-flow`,
      managementOnly: false,
    },
    {
      id: "income-statement",
      title: "Income Statement",
      desc: "Revenue from fines, interest on loans, and operational Chama expenses.",
      category: "financial",
      path: `${basePath}/income-statement`,
      managementOnly: false,
    },
    {
      id: "mgr-report",
      title: "MGR Rotation Summary",
      desc: "Merry-Go-Round round rotation payouts, scheduled dates, and cycle status.",
      category: "mgr",
      path: `/workspace/${workspaceId}/mgr`,
      managementOnly: false,
    },
    {
      id: "member-statement",
      title: "My Personal Member Statement",
      desc: "Your personal savings, contribution history, and active loan balances.",
      category: "members",
      path: `/workspace/${workspaceId}/my-chama`,
      managementOnly: false,
    },

    // Management / Officials Only Reports
    {
      id: "contribution-report",
      title: "Member Payment Ledger & Arrears",
      desc: "Individual payments made by each member, collection rate, and arrears breakdown.",
      category: "financial",
      path: `/workspace/${workspaceId}/contributions`,
      managementOnly: true,
    },
    {
      id: "trial-balance",
      title: "Double-Entry Trial Balance",
      desc: "General ledger accounts verification, debit and credit balance proof.",
      category: "financial",
      path: `${basePath}/trial-balance`,
      managementOnly: true,
    },
    {
      id: "audit-ledger",
      title: "General Audit Ledger",
      desc: "Chronological double-entry journal entries and posting audits.",
      category: "financial",
      path: `${basePath}/ledger`,
      managementOnly: true,
    },
    {
      id: "loan-portfolio",
      title: "Loan Portfolio & Risk Report",
      desc: "Full loan portfolio performance, guarantor exposures, risk metrics, and aging.",
      category: "loans",
      path: `/workspace/${workspaceId}/loans`,
      managementOnly: true,
    },
  ];

  const filteredReports = reports.filter((r) => {
    const matchesTab =
      activeTab === "all" ||
      r.category === activeTab ||
      (activeTab === "members_view" && !r.managementOnly) ||
      (activeTab === "management" && r.managementOnly);
    return matchesTab;
  });

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Financial Books & Reports
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Generate financial statements, member books, and official audit ledgers
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isOfficial ? (
            <span className="inline-flex items-center gap-1.5 rounded-2xl bg-indigo-100 px-3.5 py-1.5 text-xs font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              <ShieldCheck size={14} /> Official Management Access
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-100 px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <User size={14} /> Member Access
            </span>
          )}
        </div>
      </div>

      {/* Category Pills Filter Bar */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: "all", label: "All Books" },
            { id: "members_view", label: "Member Statements" },
            ...(isOfficial ? [{ id: "management", label: "Management Ledgers Only" }] : []),
            { id: "financial", label: "Financial" },
            { id: "loans", label: "Loans" },
            { id: "mgr", label: "MGR" },
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
        {filteredReports.map((card) => {
          const isRestricted = card.managementOnly && !isOfficial;

          return (
            <div
              key={card.id}
              className={`group rounded-3xl border bg-white p-6 shadow-xs transition hover:shadow-md dark:bg-slate-900 flex flex-col justify-between ${
                card.managementOnly
                  ? "border-amber-200/80 dark:border-amber-900/40"
                  : "border-slate-200/80 dark:border-slate-800"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`h-3 w-3 rounded-full ${
                      card.managementOnly ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                  />
                  {card.managementOnly ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
                      <Lock size={10} /> Management Only
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Member Visible
                    </span>
                  )}
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                  {card.title}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {card.desc}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                {isRestricted ? (
                  <span className="w-full rounded-2xl bg-slate-100 dark:bg-slate-800 px-4 py-2 text-center text-xs font-bold text-slate-400 flex items-center justify-center gap-1.5">
                    <Lock size={12} /> Official Access Only
                  </span>
                ) : (
                  <Link
                    to={card.path}
                    className={`w-full rounded-2xl px-4 py-2 text-center text-xs font-bold text-white shadow-xs transition ${
                      card.managementOnly
                        ? "bg-amber-600 hover:bg-amber-700"
                        : "bg-indigo-600 hover:bg-indigo-700"
                    }`}
                  >
                    Open Book / Statement
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}