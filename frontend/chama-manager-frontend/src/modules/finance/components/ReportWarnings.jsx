import React from "react";
import { AlertTriangle } from "lucide-react";

// Shows whatever the server found wrong with a report (unbalanced ledger, pending
// transactions, stored balances that differ from the ledger). Renders nothing when clean.
export default function ReportWarnings({ warnings = [] }) {
  if (!Array.isArray(warnings) || warnings.length === 0) return null;
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 print:hidden">
      <div className="mb-1.5 flex items-center gap-2 font-extrabold uppercase tracking-wider">
        <AlertTriangle size={14} /> Check these figures
      </div>
      <ul className="list-disc space-y-1 pl-5 font-medium">
        {warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </div>
  );
}
