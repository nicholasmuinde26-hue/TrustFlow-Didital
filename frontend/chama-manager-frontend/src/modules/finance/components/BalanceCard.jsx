export default function BalanceCard({
  title,
  amount,
}) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">

      <p className="text-sm text-slate-500">
        {title}
      </p>

      <h2 className="mt-3 text-3xl font-bold">
        KES {Number(amount).toLocaleString()}
      </h2>

    </div>
  );
}