const formatKES = (value) => {
  const num = Number(value ?? 0);
  return new Intl.NumberFormat('en-KE', { 
    style: 'currency', 
    currency: 'KES', 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

export default function CashFlowCard({ inflow, outflow, summary }) {
  const cashIn = inflow ?? summary?.cash_in ?? 0;
  const cashOut = outflow ?? summary?.cash_out ?? 0;
  const totalTx = summary?.total_transactions ?? 0;
  const loans = summary?.outstanding_loans ?? 0;

  return (
    <div className="rounded-2xl border bg-white p-6">
      <h2 className="text-xl font-semibold">Cash Flow</h2>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <p className="text-slate-500">Cash In</p>
          <p className="text-2xl font-bold text-green-600">{formatKES(cashIn)}</p>
        </div>

        <div>
          <p className="text-slate-500">Cash Out</p>
          <p className="text-2xl font-bold text-red-600">{formatKES(cashOut)}</p>
        </div>
      </div>

      {summary && (
        <div className="mt-6 grid gap-6 md:grid-cols-2 border-t pt-4">
          <div>
            <p className="text-slate-500">Posted Transactions</p>
            <p className="text-2xl font-bold">{Number(totalTx).toLocaleString()}</p>
          </div>

          <div>
            <p className="text-slate-500">Outstanding Loans</p>
            <p className="text-2xl font-bold text-red-600">{formatKES(loans)}</p>
          </div>
        </div>
      )}
    </div>
  );
}