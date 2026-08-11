import financeService from "../services/finance.service";

export default function AccountCard({ account }) {
  const balance = financeService.safeNumber(account.current_balance);
  const formattedBalance = financeService.formatCurrency(balance, account.currency);

  // Add color coding for negative balances
  const balanceColor = balance < 0 ? "text-red-600" : "text-slate-900 dark:text-white";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {account.name}
          </h3>
          <p className="text-sm text-slate-500">
            {account.account_code}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {account.account_type}
        </span>
      </div>

      <div className="mt-6">
        <p className="text-sm text-slate-500">Current Balance</p>
        <h2 className={`mt-2 text-3xl font-bold ${balanceColor}`}>
          {formattedBalance}
        </h2>
      </div>

      {account.formatted_balance && (
        <p className="mt-2 text-xs text-slate-400">
          Last updated: {new Date(account.updatedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}