import React from "react";
import { BarChart3 } from "lucide-react";

export default function ReportsPage() {
  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-black text-slate-900 dark:text-white">Business Intelligence Reports</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <BarChart3 size={32} className="mx-auto text-violet-600 mb-2" />
        <p className="font-bold text-slate-900 dark:text-white">P&L and Balance Sheet Summaries Ready</p>
        <p className="text-xs text-slate-400 mt-1">Export tax-ready reports to PDF or Excel anytime.</p>
      </div>
    </div>
  );
}