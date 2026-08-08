export default function CashFlowCard({
  summary,
}) {
  return (
    <div className="rounded-2xl border bg-white p-6">

      <h2 className="text-xl font-semibold">
        Cash Flow
      </h2>

      <div className="mt-6 grid gap-6 md:grid-cols-2">

        <div>

          <p className="text-slate-500">
            Posted Transactions
          </p>

          <p className="text-2xl font-bold text-green-600">
            {Number(summary?.total_transactions ?? 0).toLocaleString()}
          </p>

        </div>

        <div>

          <p className="text-slate-500">
            Outstanding Loans
          </p>

          <p className="text-2xl font-bold text-red-600">
            KES {Number(summary?.outstanding_loans ?? 0).toLocaleString()}
          </p>

        </div>

      </div>

    </div>
  );
}
