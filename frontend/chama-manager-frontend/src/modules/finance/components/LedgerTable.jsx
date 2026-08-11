import financeService from "../services/finance.service";

const { safeNumber, formatCurrency } = financeService;

export default function LedgerTable({ entries = [] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-slate-500">No ledger entries to display</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <table className="min-w-full">
        <thead className="bg-slate-100 text-sm dark:bg-slate-800">
          <tr>
            <th className="p-4 text-left font-semibold text-slate-700 dark:text-slate-300">Date</th>
            <th className="p-4 text-left font-semibold text-slate-700 dark:text-slate-300">Account</th>
            <th className="p-4 text-right font-semibold text-slate-700 dark:text-slate-300">Debit</th>
            <th className="p-4 text-right font-semibold text-slate-700 dark:text-slate-300">Credit</th>
            <th className="p-4 text-left font-semibold text-slate-700 dark:text-slate-300">Description</th>
            <th className="p-4 text-left font-semibold text-slate-700 dark:text-slate-300">Reference</th>
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
                className="border-t-slate-200 hover:bg-slate-50 text-sm dark:border-slate-800 dark:hover:bg-slate-800/50"
              >
                <td className="p-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                  {entry.posted_at 
                    ? new Date(entry.posted_at).toLocaleString('en-KE') 
                    : entry.createdAt 
                      ? new Date(entry.createdAt).toLocaleString('en-KE') 
                      : "-"}
                </td>

                <td className="p-4 font-medium text-slate-900 dark:text-white">
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

                <td className="p-4 text-slate-600 dark:text-slate-400">
                  {entry.description ?? "-"}
                </td>

                <td className="p-4 font-mono text-xs text-slate-500">
                  {entry.reference ?? entry.transaction_id ?? "-"}
                </td>
              </tr>
            );
          })}
        </tbody>

        <tfoot className="bg-slate-50 font-bold dark:bg-slate-800">
          <tr>
            <td colSpan={2} className="p-4 text-right">Totals:</td>
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