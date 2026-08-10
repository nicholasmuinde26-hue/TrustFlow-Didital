const formatKES = (value) => {
  if (value === null || value === undefined) return "-";
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2
  }).format(num);
};

export default function LedgerTable({ entries = [] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-12 text-center">
        <p className="text-slate-500">No ledger entries to display</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
      <table className="min-w-full">
        <thead className="bg-slate-100 text-sm">
          <tr>
            <th className="p-4 text-left font-semibold">Date</th>
            <th className="p-4 text-left font-semibold">Account</th>
            <th className="p-4 text-right font-semibold">Debit</th>
            <th className="p-4 text-right font-semibold">Credit</th>
            <th className="p-4 text-left font-semibold">Reference</th>
          </tr>
        </thead>

        <tbody>
          {entries.map((entry, idx) => (
            <tr key={entry._id ?? entry.id ?? idx} className="border-t hover:bg-slate-50 text-sm">
              <td className="p-4 whitespace-nowrap">
                {entry.createdAt ? new Date(entry.createdAt).toLocaleString('en-KE') : "-"}
              </td>

              <td className="p-4">
                {entry.account_name ?? entry.account?? "-"}
              </td>

              <td className="p-4 text-right font-medium text-green-700">
                {Number(entry.debit) > 0 ? formatKES(entry.debit) : "-"}
              </td>

              <td className="p-4 text-right font-medium text-red-700">
                {Number(entry.credit) > 0 ? formatKES(entry.credit) : "-"}
              </td>

              <td className="p-4 font-mono text-xs">
                {entry.reference ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}