export default function AccountCard({
  account,
}) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">

      <div className="flex items-center justify-between">

        <div>

          <h3 className="font-semibold">
            {account.name}
          </h3>

          <p className="text-sm text-slate-500">
            {account.account_code}
          </p>

        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">
          {account.account_type}
        </span>

      </div>

      <div className="mt-6">

        <p className="text-sm text-slate-500">
          Current Balance
        </p>

        <h2 className="mt-2 text-3xl font-bold">
          {account.currency} {Number(account.current_balance ?? 0).toLocaleString()}
        </h2>

      </div>

    </div>
  );
}
