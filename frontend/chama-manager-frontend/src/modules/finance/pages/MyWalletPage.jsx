import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Wallet,
  PiggyBank,
  Receipt,
  Landmark,
  Send,
  ArrowDownLeft,
  Clock,
  RefreshCw,
  Info,
} from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";
import useMyWallet from "../hooks/useMyWallet";
import financeService from "../services/finance.service";
import Spinner from "@/shared/components/ui/Spinner";
import {
  Card,
  SectionHeading,
  StatCard,
  StatusPill,
  EmptyState,
  money,
  timeAgo,
} from "../components/FinanceUi";
import WalletHero from "../components/wallet/WalletHero";
import WalletActionSheet from "../components/wallet/WalletActionSheet";
import WalletPinSheet from "../components/wallet/WalletPinSheet";
import WalletActivity from "../components/wallet/WalletActivity";
import { HIDE_STORAGE_KEY, readStored, writeStored } from "../components/wallet/walletFormat";

// ============================================================
// MY WALLET
// ============================================================
//
// Top: the member's PERSONAL wallet — money that belongs to them, not the
// chama. They can add money and withdraw to M-Pesa at any time, and chama
// disbursements the treasurer sends "to wallet" land here.
//
// Below: their position inside this chama (contributions, savings, loans,
// pending requests). Savings are NOT in the wallet: they are withdrawn by
// request and, once approved, the treasurer pays them to the wallet or
// directly to M-Pesa. Every figure is read from GET /finance/wallet.
// ============================================================

export default function MyWalletPage() {
  const routeParams = useParams();
  const workspaceCtx = useWorkspace();
  const workspaceId = workspaceCtx?.workspaceId || routeParams?.workspaceId;
  const base = `/workspace/${workspaceId}`;

  const { wallet, loading, refetch } = useMyWallet(workspaceId);
  const [sheet, setSheet] = useState(null); // "deposit" | "withdraw" | "pin-setup" | "pin-change"
  const [hidden, setHidden] = useState(() => readStored(HIDE_STORAGE_KEY) === "1");
  const [profitAmount, setProfitAmount] = useState("");
  const [profitPhone, setProfitPhone] = useState("");
  const [profitMessage, setProfitMessage] = useState("");
  const [withdrawingProfit, setWithdrawingProfit] = useState(false);

  const toggleHidden = () => {
    const next = !hidden;
    setHidden(next);
    writeStored(HIDE_STORAGE_KEY, next ? "1" : "0");
  };

  if (loading && !wallet) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!wallet) {
    return (
      <EmptyState
        icon={Wallet}
        title="Wallet unavailable"
        description="Couldn't load your wallet right now — try again in a moment."
      />
    );
  }

  const isFull = wallet.scope === "full";
  const memberWallet = wallet.member_wallet || {};
  const entries = memberWallet.entries || [];
  const pendingCount = entries.filter((entry) => entry.status === "pending").length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-900 dark:text-mist">Wallet</h1>
        <button
          type="button"
          onClick={refetch}
          className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-obsidian-border dark:text-mist-muted"
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

      <WalletHero
        wallet={memberWallet}
        hidden={hidden}
        pendingCount={pendingCount}
        onToggleHidden={toggleHidden}
        onDeposit={() => setSheet("deposit")}
        onWithdraw={() => setSheet("withdraw")}
        onSetupPin={() => setSheet("pin-setup")}
        onChangePin={() => setSheet("pin-change")}
      />

      <WalletActivity entries={entries} />

      {(sheet === "deposit" || sheet === "withdraw") && (
        <WalletActionSheet
          mode={sheet}
          workspaceId={workspaceId}
          available={Number(memberWallet.available_balance || 0)}
          onClose={() => setSheet(null)}
          onDone={refetch}
        />
      )}
      {(sheet === "pin-setup" || sheet === "pin-change") && (
        <WalletPinSheet
          mode={sheet === "pin-change" ? "change" : "setup"}
          workspaceId={workspaceId}
          onClose={() => setSheet(null)}
          onDone={refetch}
        />
      )}

      {/* ---------------- In this chama ---------------- */}
      <div className="pt-2">
        <SectionHeading
          title="In this chama"
          subtitle="Your contributions, savings and loans — separate from your personal wallet"
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="My contributions"
            value={money(wallet.contributions.total)}
            icon={Receipt}
            tone="emerald"
            footnote={`${wallet.contributions.payment_count} payment${wallet.contributions.payment_count === 1 ? "" : "s"}`}
          />

          {isFull && (
            <>
              <StatCard
                label="My savings"
                value={money(wallet.savings.total_balance)}
                icon={PiggyBank}
                tone="indigo"
                footnote={`${money(wallet.savings.total_available_to_withdraw)} available to withdraw`}
              />
              <StatCard
                label="Loan outstanding"
                value={money(wallet.loan.outstanding_total)}
                icon={Landmark}
                tone={wallet.loan.outstanding_total > 0 ? "amber" : "slate"}
                footnote={wallet.loan.active_loan ? `Status: ${wallet.loan.active_loan.status}` : "No active loan"}
              />
              <StatCard
                label="Pending withdrawal"
                value={money(wallet.withdrawals.total_pending)}
                icon={ArrowDownLeft}
                tone={wallet.withdrawals.total_pending > 0 ? "amber" : "slate"}
                footnote={`${wallet.withdrawals.items.length} request${wallet.withdrawals.items.length === 1 ? "" : "s"} pending`}
              />
            </>
          )}
        </div>
      </div>

      {!isFull && (
        <Card className="p-4">
          <p className="text-[11px] font-semibold text-slate-400">
            Savings, loans, payouts and withdrawals aren't tracked for this
            workspace type — only your contributions are shown above.
          </p>
        </Card>
      )}

      {isFull && (
        <>
          <Card className="flex items-start gap-3 border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <Info size={16} className="mt-0.5 shrink-0 text-emerald-700" />
            <p className="text-xs leading-relaxed text-emerald-900 dark:text-emerald-200">
              Savings stay with the chama until you request a withdrawal. Once it's approved, the treasurer sends it to
              your wallet above or straight to your M-Pesa.
            </p>
          </Card>

          {wallet.business_profit_wallet && (
            <Card className="p-5">
              <SectionHeading title="Business profit wallet" subtitle="Accepted Chama business distributions, withdrawable without further Chama approval" />
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-2xl font-black text-emerald-700 dark:text-mint">{money(wallet.business_profit_wallet.balance)}</p>
                  <p className="text-[11px] text-slate-500">Available to withdraw via M-Pesa</p>
                </div>
                <form className="flex flex-wrap items-end gap-2" onSubmit={async (event) => {
                  event.preventDefault();
                  setWithdrawingProfit(true); setProfitMessage("");
                  try {
                    await financeService.withdrawProfitWallet(workspaceId, { amount: Number(profitAmount), phoneNumber: profitPhone });
                    setProfitMessage("Withdrawal submitted. Your balance updates when M-Pesa confirms it.");
                    setProfitAmount("");
                    await refetch();
                  } catch (error) {
                    setProfitMessage(error.response?.data?.message || "Could not submit withdrawal.");
                  } finally { setWithdrawingProfit(false); }
                }}>
                  <label className="grid gap-1 text-[11px] text-slate-500">Amount (KES)<input className="h-9 w-32 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-obsidian-border dark:bg-obsidian-raised" type="number" min="1" step="1" max={Math.floor(wallet.business_profit_wallet.balance)} required value={profitAmount} onChange={(event) => setProfitAmount(event.target.value)} /></label>
                  <label className="grid gap-1 text-[11px] text-slate-500">M-Pesa number<input className="h-9 w-40 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-obsidian-border dark:bg-obsidian-raised" placeholder="2547XXXXXXXX" required value={profitPhone} onChange={(event) => setProfitPhone(event.target.value)} /></label>
                  <button className="flex h-9 items-center gap-1.5 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white disabled:opacity-50" disabled={withdrawingProfit || wallet.business_profit_wallet.balance < 1}><Send size={13} />Withdraw</button>
                </form>
              </div>
              {profitMessage && <p role="status" className="mt-3 text-xs text-slate-600 dark:text-mist-muted">{profitMessage}</p>}
              {wallet.business_profit_wallet.entries?.length > 0 && <div className="mt-4 divide-y divide-slate-100 dark:divide-obsidian-border">{wallet.business_profit_wallet.entries.slice(0, 6).map((entry) => <div key={entry._id} className="flex justify-between py-2 text-xs"><span className="capitalize">{entry.type.replaceAll("_", " ")} · {entry.status}</span><span className="tabular-nums">{money(entry.amount)}</span></div>)}</div>}
            </Card>
          )}

          <Card className="p-5">
            <SectionHeading
              title="Savings by plan"
              subtitle="What you can request to withdraw, per savings plan"
              action={
                <Link
                  to={`${base}/finance/withdrawals/new`}
                  className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-emerald-700"
                >
                  <Send size={12} />
                  Request withdrawal
                </Link>
              }
            />

            {wallet.savings.plans.length === 0 ? (
              <EmptyState icon={PiggyBank} title="No savings plan yet" description="This chama hasn't set up a free-will savings plan." />
            ) : (
              <div className="space-y-2">
                {wallet.savings.plans.map((plan) => (
                  <div key={plan.plan_id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-obsidian-border dark:bg-obsidian-raised/40">
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-mist">{plan.plan_name}</p>
                      <p className="text-[11px] text-slate-400">
                        Balance {money(plan.balance)}
                        {plan.pending_withdrawal > 0 ? ` · ${money(plan.pending_withdrawal)} pending withdrawal` : ""}
                      </p>
                    </div>
                    <p className="text-sm font-black text-emerald-700 dark:text-mint">{money(plan.available_to_withdraw)} available</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {wallet.pending_payout && (
            <Card className="p-5">
              <SectionHeading title="Payout in progress" />
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-obsidian-border dark:bg-obsidian-raised/40">
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-mist">{money(wallet.pending_payout.amount)}</p>
                  <p className="text-[11px] text-slate-400">Awaiting disbursement</p>
                </div>
                <StatusPill status={wallet.pending_payout.status} />
              </div>
            </Card>
          )}

          {wallet.withdrawals.items.length > 0 && (
            <Card className="p-5">
              <SectionHeading title="Your pending withdrawal requests" />
              <div className="space-y-2">
                {wallet.withdrawals.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-obsidian-border dark:bg-obsidian-raised/40">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900 dark:text-mist">
                        {money(item.amount)}
                        {item.reason ? ` · ${item.reason}` : ""}
                      </p>
                      <p className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock size={11} />
                        {timeAgo(item.requested_at)}
                      </p>
                    </div>
                    <StatusPill status="pending" />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      <Card className="p-5">
        <SectionHeading title="Contribution payments" subtitle="Your latest payments into the chama" />
        {wallet.contributions.recent_activity.length === 0 ? (
          <EmptyState icon={Receipt} title="No payments yet" />
        ) : (
          <div className="space-y-2">
            {wallet.contributions.recent_activity.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-obsidian-border dark:bg-obsidian-raised/40">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-900 dark:text-mist">{money(p.amount)}</p>
                  <p className="text-[11px] text-slate-400">{p.method || "—"} {p.reference ? `· ${p.reference}` : ""}</p>
                </div>
                <div className="text-right">
                  <StatusPill status={p.status} />
                  <p className="mt-1 text-[10px] text-slate-400">{timeAgo(p.paid_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
