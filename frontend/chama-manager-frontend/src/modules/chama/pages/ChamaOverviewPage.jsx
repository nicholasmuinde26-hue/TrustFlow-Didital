import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Landmark,
  Users,
  WalletCards,
  AlertTriangle,
  CalendarDays,
  Smartphone,
  PiggyBank,
  HandCoins,
  Receipt,
} from "lucide-react";

import useWorkspace from "../../../app/hooks/useWorkspace";
import MpesaStkModal from "../../finance/components/MpesaStkModal";
import StatCard from "../../../shared/components/ui/StatCard";
import useFinanceSummary from "../../finance/hooks/useFinanceSummary";
import useLedger from "../../finance/hooks/useLedger";
import financeService from "../../finance/services/finance.service";

const { formatCurrency } = financeService;
const money = (value) => `KES ${Number(value || 0).toLocaleString()}`;

export default function ChamaOverviewPage({ dashboard = {} }) {
  const { workspaceId: paramId } = useParams();
  const workspaceCtx = useWorkspace();
  const workspaceId = paramId || workspaceCtx?.workspaceId;

  const [isStkOpen, setIsStkOpen] = useState(false);

  // Safe destructuring with fallbacks
  const workspace = dashboard?.workspace || workspaceCtx?.currentWorkspace || {};
  const stats = dashboard?.stats || {};
  const upcoming = dashboard?.upcoming || [];

  // Real numbers straight from the accounting ledger — cash/savings/loan
  // balances live on FinancialAccount rows, not the generic contribution
  // count used for `stats` above.
  const { summary: financeSummary } = useFinanceSummary(workspaceId);
  const { entries: ledgerEntries } = useLedger(workspaceId, { limit: 5 });
  const recentLedgerEntries = (ledgerEntries || []).slice(0, 5);

  const base = `/workspace/${workspaceId}`;

  return (
    <div className="mx-auto max-w-7xl space-y-7 font-sans">
      <section className="rounded-3xl bg-gradient-to-r from-emerald-700 to-teal-600 p-7 text-white shadow-xl">
        <p className="text-sm font-semibold tracking-wide text-emerald-100">
          CHAMA OVERVIEW
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          {workspace?.name || "Chama Workspace"}
        </h1>
        <p className="mt-2 text-emerald-100">
          Build shared savings and keep the group’s finances healthy.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setIsStkOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 font-bold text-emerald-800 shadow-sm hover:bg-emerald-50 transition-colors"
          >
            <Smartphone size={18} />
            Pay via M-Pesa STK
          </button>
          <Link
            className="rounded-xl border border-white/40 bg-white/10 px-4 py-2.5 font-semibold text-white hover:bg-white/20 transition-colors"
            to={`${base}/finance/record-contribution`}
          >
            Record contribution
          </Link>
          <Link
            className="rounded-xl border border-white/40 px-4 py-2.5 font-semibold text-white hover:bg-white/20 transition-colors"
            to={`${base}/finance`}
          >
            Open finance
          </Link>
          <Link className="rounded-xl border border-white/40 px-4 py-2.5 font-semibold text-white hover:bg-white/20 transition-colors" to={`${base}/mgr`}>
            Merry-Go-Round
          </Link>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Members"
          value={stats?.memberCount ?? 0}
          description="Active chama members"
          icon={Users}
          color="emerald"
        />
        <StatCard
          title="Total Contributions"
          value={money(financeSummary?.total_contributions ?? stats?.totalContributed)}
          description="Confirmed payments (ledger)"
          icon={WalletCards}
          color="violet"
        />
        <StatCard
          title="Savings Balance"
          value={money(financeSummary?.savings_balance)}
          description="Held in member savings"
          icon={PiggyBank}
          color="info"
        />
        <StatCard
          title="Cash Balance"
          value={money(financeSummary?.cash_balance)}
          description="Cash, bank & M-Pesa clearing"
          icon={Landmark}
          color="success"
        />
        <StatCard
          title="Outstanding Loans"
          value={money(financeSummary?.outstanding_loans)}
          description="Loan principal not yet repaid"
          icon={HandCoins}
          color="warning"
        />
        <StatCard
          title="Overdue"
          value={stats?.overdueCount ?? 0}
          description="Contributions to follow up"
          icon={AlertTriangle}
          color="amber"
        />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <CalendarDays size={19} /> Upcoming meetings
        </h2>
        <div className="mt-4 space-y-3">
          {upcoming.length ? (
            upcoming.map((meeting) => (
              <div
                key={meeting.id || meeting._id}
                className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800"
              >
                <p className="font-medium text-slate-900 dark:text-white">
                  {meeting.title}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {new Date(meeting.startsAt || meeting.date).toLocaleString()}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No upcoming meetings scheduled.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <Receipt size={19} /> Recent ledger activity
          </h2>
          <Link
            className="text-sm font-semibold text-primary hover:underline"
            to={`${base}/finance/ledger`}
          >
            View full ledger
          </Link>
        </div>
        <div className="mt-4 space-y-3">
          {recentLedgerEntries.length ? (
            recentLedgerEntries.map((entry, idx) => {
              const isCredit = Number(entry.credit) > 0;
              const amount = isCredit ? entry.credit : entry.debit;
              return (
                <div
                  key={entry._id || entry.id || idx}
                  className="flex items-center justify-between rounded-xl bg-slate-50 p-4 dark:bg-slate-800"
                >
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {entry.description || entry.account_name || "Ledger entry"}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {entry.account_name}
                      {(entry.posted_at || entry.createdAt) &&
                        ` · ${new Date(
                          entry.posted_at || entry.createdAt
                        ).toLocaleDateString()}`}
                    </p>
                  </div>
                  <p
                    className={`font-semibold ${
                      isCredit ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {isCredit ? "+" : "-"}
                    {formatCurrency(amount)}
                  </p>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No ledger activity yet.
            </p>
          )}
        </div>
      </section>

      <MpesaStkModal
        isOpen={isStkOpen}
        onClose={() => setIsStkOpen(false)}
        chamaId={workspaceId}
        title="Deposit to Savings via M-Pesa"
      />
    </div>
  );
}