export default function TransactionTable({
  transactions,
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white">

      <table className="min-w-full">

        <thead className="bg-slate-100">

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
              className="border-t"
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