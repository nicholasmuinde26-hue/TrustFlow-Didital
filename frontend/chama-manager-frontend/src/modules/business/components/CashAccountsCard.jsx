import React from "react";
import { Landmark, Smartphone, Wallet } from "lucide-react";

const labels = { cash: "Cash", bank: "Bank", till: "M-Pesa Till", paybill: "M-Pesa Paybill", mpesa: "M-Pesa" };
const money = (value) => `KES ${Number(value ?? 0).toLocaleString()}`;

export function CashAccountsCard({ accounts = [] }) {
  const getIcon = (channel) => channel === "bank"
    ? <Landmark size={16} className="text-violet-600 dark:text-violet-400" />
    : channel === "mpesa" || channel === "till" || channel === "paybill"
      ? <Smartphone size={16} className="text-emerald-600 dark:text-emerald-400" />
      : <Wallet size={16} className="text-amber-600 dark:text-amber-400" />;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">Cash & Payment Channels</h2>
      <div className="space-y-3">
        {accounts.length === 0 ? <p className="text-sm text-slate-500">No payment channels configured.</p> : accounts.map((account) => {
          const channel = account.channel || account.type || "cash";
          return <div key={account._id || account.id || channel} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 dark:border-slate-800/60 dark:bg-slate-950/50">
            <div className="flex items-center gap-3"><div className="rounded-lg bg-white p-2 shadow-xs dark:bg-slate-900">{getIcon(channel)}</div><div><p className="text-xs font-bold text-slate-900 dark:text-white">{account.name || labels[channel] || channel}</p><p className="text-[11px] font-mono text-slate-400">{account.accountNumber || "Transaction channel"}</p></div></div>
            <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">{account.balance === undefined ? "—" : money(account.balance)}</p>
          </div>;
        })}
      </div>
    </div>
  );
}
