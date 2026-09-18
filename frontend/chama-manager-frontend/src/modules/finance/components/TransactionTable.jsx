export default function TransactionTable({
  transactions,
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-obsidian-border dark:bg-obsidian-card">

      <table className="min-w-full">

        <thead className="bg-slate-100 dark:bg-obsidian-raised text-slate-700 dark:text-mist-muted">

          <tr>

            <th className="p-4 text-left">
              Reference
            </th>

            <th className="p-4 text-left">
              Type
            </th>

            <th className="p-4 text-left">
              Amount
            </th>

            <th className="p-4 text-left">
              Status
            </th>

            <th className="p-4 text-left">
              Date
            </th>

          </tr>

        </thead>

        <tbody>

          {transactions.map((transaction) => (

            <tr
              key={transaction._id}
              className="border-t border-slate-200 dark:border-obsidian-border text-slate-700 dark:text-mist"
            >

              <td className="p-4">
                {transaction.reference}
              </td>

              <td className="p-4 capitalize">
                {transaction.transaction_type}
              </td>

              <td className="p-4">
                {transaction.currency}
                {" "}
                {transaction.amount}
              </td>

              <td className="p-4">
                {transaction.status}
              </td>

              <td className="p-4">
                {new Date(
                  transaction.createdAt
                ).toLocaleString()}
              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>
  );
}