import financeService from "../services/finance.service";

const { safeNumber, formatCurrency } = financeService;

// Colour-coded so the same product always reads the same way at a glance,
// making it possible to trace a run of payments without confusing e.g. an
// MGR contribution for a plain contribution.
const CATEGORY_STYLES = {
  deposit: "bg-violet-50 text-violet-700 dark:bg-mint-deep/60 dark:text-mint",
  withdrawal: "bg-violet-50 text-violet-700 dark:bg-mint-deep/60 dark:text-mint",
  contribution_payment: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  contribution: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  mgr_contribution: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  chama_contribution_payment: "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300",
  loan_disbursement: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  loan_repayment: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  payout: "bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
};
const DEFAULT_CATEGORY_STYLE = "bg-slate-100 text-slate-600 dark:bg-obsidian-raised dark:text-mist-muted";

function CategoryBadge({ category, label }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${
        CATEGORY_STYLES[category] || DEFAULT_CATEGORY_STYLE
      }`}
    >
      {label || "Other"}
    </span>
  );
}

export default function LedgerTable({ entries = [] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border-slate-200 bg-white p-12 text-center dark:border-obsidian-border dark:bg-obsidian-card">
        <p className="text-slate-500">No ledger entries to display</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border-slate-200 bg-white shadow-sm dark:border-obsidian-border dark:bg-obsidian-card">
      <table className="min-w-full">
        <thead className="bg-slate-100 text-sm dark:bg-obsidian-raised">
          <tr>
            <th className="p-4 text-left font-semibold text-slate-700 dark:text-mist-muted">Date</th>
            <th className="p-4 text-left font-semibold text-slate-700 dark:text-mist-muted">Type</th>
            <th className="p-4 text-left font-semibold text-slate-700 dark:text-mist-muted">Account</th>
            <th className="p-4 text-right font-semibold text-slate-700 dark:text-mist-muted">Debit</th>
            <th className="p-4 text-right font-semibold text-slate-700 dark:text-mist-muted">Credit</th>
            <th className="p-4 text-left font-semibold text-slate-700 dark:text-mist-muted">Description</th>
            <th className="p-4 text-left font-semibold text-slate-700 dark:text-mist-muted">Reference</th>
          </tr>
        </thead>

        <tbody>
          {entries.map((entry, idx) => {
            const debit = safeNumber(entry.debit);
            const credit = safeNumber(entry.credit);
            const hasDebit = debit > 0;
            const hasCredit = credit > 0;

            return (
              <tr 
                key={entry._id ?? entry.id ?? idx} 
                className="border-t-slate-200 hover:bg-slate-50 text-sm dark:border-obsidian-border dark:hover:bg-obsidian-raised/50"
              >
                <td className="p-4 whitespace-nowrap text-slate-600 dark:text-mist-muted">
                  {entry.posted_at 
                    ? new Date(entry.posted_at).toLocaleString('en-KE') 
                    : entry.createdAt 
                      ? new Date(entry.createdAt).toLocaleString('en-KE') 
                      : "-"}
                </td>

                <td className="p-4">
                  <CategoryBadge category={entry.category} label={entry.category_label} />
                </td>

                <td className="p-4 font-medium text-slate-900 dark:text-mist">
                  {entry.account_name ?? entry.account ?? "Unknown Account"}
                </td>

                <td className="p-4 text-right font-semibold">
                  {hasDebit 
                    ? <span className="text-red-600">{formatCurrency(debit)}</span> 
                    : <span className="text-slate-400">-</span>}
                </td>

                <td className="p-4 text-right font-semibold">
                  {hasCredit 
                    ? <span className="text-green-600">{formatCurrency(credit)}</span> 
                    : <span className="text-slate-400">-</span>}
                </td>

                <td className="p-4 text-slate-600 dark:text-mist-muted">
                  {entry.description ?? "-"}
                </td>

                <td className="p-4 font-mono text-xs text-slate-500">
                  {entry.reference ?? entry.transaction_id ?? "-"}
                </td>
              </tr>
            );
          })}
        </tbody>

        <tfoot className="bg-slate-50 font-bold dark:bg-obsidian-raised">
          <tr>
            <td colSpan={3} className="p-4 text-right">Totals:</td>
            <td className="p-4 text-right text-red-600">
              {formatCurrency(entries.reduce((s, e) => s + safeNumber(e.debit), 0))}
            </td>
            <td className="p-4 text-right text-green-600">
              {formatCurrency(entries.reduce((s, e) => s + safeNumber(e.credit), 0))}
            </td>
            <td colSpan={2}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}