const formatKES = (value) => {
  const num = Number(value ?? 0);
  const safe = Number.isFinite(num) ? num : 0;
  return new Intl.NumberFormat('en-KE', { 
    style: 'currency', 
    currency: 'KES', 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(safe);
};

export default function CashFlowCard({ inflow, outflow, summary }) {
  const cashIn = inflow ?? summary?.cash_in ?? 0;
  const cashOut = outflow ?? summary?.cash_out ?? 0;
  const totalTx = summary?.total_transactions ?? 0;
  const loans = summary?.outstanding_loans ?? 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-obsidian-border dark:bg-obsidian-card">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-mist">Cash Flow</h2>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <p className="text-slate-500 dark:text-mist-muted">Cash In</p>
          <p className="text-2xl font-bold text-green-600 dark:text-mint">{formatKES(cashIn)}</p>
        </div>

        <div>
          <p className="text-slate-500 dark:text-mist-muted">Cash Out</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatKES(cashOut)}</p>
        </div>
      </div>

      {summary && (
        <div className="mt-6 grid gap-6 md:grid-cols-2 border-t border-slate-200 pt-4 dark:border-obsidian-border">
          <div>
            <p className="text-slate-500 dark:text-mist-muted">Posted Transactions</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-mist">{Number(totalTx).toLocaleString()}</p>
          </div>

          <div>
            <p className="text-slate-500 dark:text-mist-muted">Outstanding Loans</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatKES(loans)}</p>
          </div>
        </div>
      )}
    </div>
  );
}