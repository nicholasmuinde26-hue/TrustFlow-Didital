import React from "react";
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { kes } from "./walletFormat";

export default function WalletHero({ wallet, hidden, onToggleHidden, onDeposit, onWithdraw, onSetupPin, onChangePin, pendingCount }) {
  const available = Number(wallet?.available_balance || 0);
  const sending = Number(wallet?.reserved_balance || 0);
  const pinSet = Boolean(wallet?.pin_set);
  const lockedUntil = wallet?.pin_locked_until ? new Date(wallet.pin_locked_until) : null;
  const locked = lockedUntil && lockedUntil > new Date();

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-800 to-slate-900 p-6 text-white shadow-lg">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-emerald-300/10 blur-2xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-100/80">My wallet</p>
          <p className="mt-2 text-4xl font-black tabular-nums tracking-tight sm:text-5xl">
            {hidden ? "KES ••••••" : kes(available)}
          </p>
          <p className="mt-1.5 text-xs font-medium text-emerald-100/80">
            Available to withdraw anytime
            {sending > 0 && !hidden ? ` · ${kes(sending)} on its way to M-Pesa` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleHidden}
          aria-label={hidden ? "Show balance" : "Hide balance"}
          className="rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20"
        >
          {hidden ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
      </div>

      <div className="relative mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={pinSet ? onDeposit : onSetupPin}
          disabled={locked}
          className="flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-emerald-800 shadow-sm transition hover:bg-emerald-50 disabled:opacity-50"
        >
          <ArrowDownLeft size={16} /> Add money
        </button>
        <button
          type="button"
          onClick={pinSet ? onWithdraw : onSetupPin}
          disabled={locked || (pinSet && available < 1)}
          className="flex items-center justify-center gap-2 rounded-2xl bg-white/15 px-4 py-3 text-sm font-extrabold text-white ring-1 ring-white/30 transition hover:bg-white/25 disabled:opacity-50"
        >
          <ArrowUpRight size={16} /> Withdraw
        </button>
      </div>

      <div className="relative mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-emerald-100/80">
        <span className="flex items-center gap-1.5">
          <ShieldCheck size={13} />
          {pinSet ? "Protected by your wallet PIN" : "Set a PIN to start using your wallet"}
          {pendingCount > 0 ? ` · ${pendingCount} processing` : ""}
        </span>
        {pinSet && (
          <button type="button" onClick={onChangePin} className="flex items-center gap-1 underline-offset-2 hover:underline">
            <Lock size={11} /> Change PIN
          </button>
        )}
      </div>

      {locked && (
        <p className="relative mt-3 rounded-xl bg-red-500/20 px-3 py-2 text-[11px] font-semibold">
          Too many wrong PIN attempts. Wallet actions unlock at {lockedUntil.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}.
        </p>
      )}
    </div>
  );
}
