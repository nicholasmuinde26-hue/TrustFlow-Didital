export default function LedgerTable({ entries }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">

      <table className="min-w-full">

        <thead className="bg-slate-100">

          <tr>

            <th className="p-4 text-left">
              Date
            </th>

            <th className="p-4 text-left">
              Account
            </th>

            <th className="p-4 text-left">
              Debit
            </th>

            <th className="p-4 text-left">
              Credit
            </th>

            <th className="p-4 text-left">
              Reference
            </th>

          </tr>

        </thead>

        <tbody>

          {entries.map((entry) => (

            <tr
              key={entry._id}
              className="border-t hover:bg-slate-50"
            >

              <td className="p-4">
                {new Date(
                  entry.createdAt
                ).toLocaleString()}
              </td>

              <td className="p-4">
                {entry.account_name}
              </td>

              <td className="p-4 text-green-700 font-medium">
                {entry.debit ?? "-"}
              </td>

              <td className="p-4 text-red-700 font-medium">
                {entry.credit ?? "-"}
              </td>

              <td className="p-4 font-mono">
                {entry.reference}
              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>
  );
}