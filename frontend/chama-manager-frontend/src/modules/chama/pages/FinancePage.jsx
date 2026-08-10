import { Link, useParams } from "react-router-dom";
import {
  ArrowRight, Plus, BookOpen, Wallet, CreditCard, Receipt,
  Landmark, BarChart3, TrendingUp, Scale, Activity,
  ArrowLeftRight, PiggyBank, FileText,
} from "lucide-react";

import useFinanceSummary from "@/modules/finance/hooks/useFinanceSummary";
import BalanceCard from "@/modules/finance/components/BalanceCard";
import CashFlowCard from "@/modules/finance/components/CashFlowCard";
import Spinner from "@/shared/components/ui/Spinner";

// Helper to format KES properly
const formatKES = (value) => {
  const num = Number(value ?? 0);
  return new Intl.NumberFormat('en-KE', { 
    style: 'currency', 
    currency: 'KES', 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

const toNumber = (v) => Number(v ?? 0);

export default function FinanceDashboard() {
  const { workspaceId } = useParams();
  const { summary, loading, error } = useFinanceSummary(workspaceId);

  if (loading) return <Spinner />;

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-700">
          Unable to load Finance Dashboard
        </h2>
        <p className="mt-2 text-red-600">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* HEADER */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold">Finance Engine</h1>
          <p className="mt-3 max-w-3xl text-slate-500">
            Double-entry accounting, treasury management, contributions, payouts, 
            savings, financial reporting, and audit-ready records for your workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to={`/workspace/${workspaceId}/finance/record-contribution`}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-white hover:bg-emerald-700"
          >
            <Plus size={18} /> Record Contribution
          </Link>
          <Link
            to={`/workspace/${workspaceId}/finance/payouts/new`}
            className="inline-flex items-center gap-2 rounded-xl border px-5 py-3 hover:bg-slate-100"
          >
            <ArrowLeftRight size={18} /> New Payout
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <section>
        <h2 className="mb-5 text-xl font-semibold">Executive Overview</h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <BalanceCard title="Cash Balance" value={toNumber(summary?.cash_balance)} />
          <BalanceCard title="Contributions" value={toNumber(summary?.total_contributions)} />
          <BalanceCard title="Outstanding Loans" value={toNumber(summary?.outstanding_loans)} />
          <BalanceCard title="Pending Payouts" value={toNumber(summary?.pending_payouts)} />
        </div>
      </section>

      <CashFlowCard
        inflow={toNumber(summary?.cash_in)}
        outflow={toNumber(summary?.cash_out)}
      />

      {/* ACCOUNTING SNAPSHOT */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6">
          <div className="mb-6 flex items-center gap-3">
            <Scale className="text-indigo-600" />
            <h2 className="text-xl font-semibold">Accounting Position</h2>
          </div>
          <div className="space-y-4">
            <SummaryRow label="Assets" value={summary?.assets} />
            <SummaryRow label="Liabilities" value={summary?.liabilities} />
            <SummaryRow label="Equity" value={summary?.equity} />
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6">
          <div className="mb-6 flex items-center gap-3">
            <Activity className="text-emerald-600" />
            <h2 className="text-xl font-semibold">Finance Engine Health</h2>
          </div>
          <div className="space-y-4">
            <MetricRow label="Accounts" value={summary?.accounts} />
            <MetricRow label="Transactions" value={summary?.transactions} />
            <MetricRow label="Ledger Entries" value={summary?.ledger_entries} />
            <MetricRow label="Pending Posts" value={summary?.pending_transactions} />
          </div>
        </div>
      </section>

      {/* OPERATIONS */}
      <DashboardSection
        title="Finance Operations"
        cards={[
          { title: "Record Contribution", icon: Receipt, color: "text-emerald-600", to: `/workspace/${workspaceId}/finance/record-contribution` },
          { title: "Transactions", icon: CreditCard, color: "text-blue-600", to: `/workspace/${workspaceId}/finance/transactions` },
          { title: "General Ledger", icon: BookOpen, color: "text-indigo-600", to: `/workspace/${workspaceId}/finance/ledger` },
          { title: "Chart of Accounts", icon: Wallet, color: "text-orange-600", to: `/workspace/${workspaceId}/finance/accounts` },
          { title: "Payouts", icon: ArrowLeftRight, color: "text-red-600", to: `/workspace/${workspaceId}/finance/payouts` },
          { title: "Savings", icon: PiggyBank, color: "text-pink-600", to: `/workspace/${workspaceId}/finance/savings` },
        ]}
      />

      {/* FINANCIAL STATEMENTS */}
      <DashboardSection
        title="Financial Statements"
        cards={[
          { title: "Trial Balance", icon: Scale, color: "text-indigo-600", to: `/workspace/${workspaceId}/finance/trial-balance` },
          { title: "Balance Sheet", icon: Landmark, color: "text-emerald-600", to: `/workspace/${workspaceId}/finance/balance-sheet` },
          { title: "Income Statement", icon: TrendingUp, color: "text-blue-600", to: `/workspace/${workspaceId}/finance/income-statement` },
          { title: "Cash Flow", icon: BarChart3, color: "text-orange-600", to: `/workspace/${workspaceId}/finance/cash-flow` },
          { title: "Financial Reports", icon: FileText, color: "text-slate-700", to: `/workspace/${workspaceId}/reports` },
        ]}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- */

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-600">{label}</span>
      <strong>{formatKES(value)}</strong>
    </div>
  );
}

function MetricRow({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-600">{label}</span>
      <strong>{toNumber(value).toLocaleString()}</strong>
    </div>
  );
}

function DashboardSection({ title, cards }) {
  return (
    <section>
      <h2 className="mb-5 text-xl font-semibold">{title}</h2>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => <DashboardCard key={card.title} {...card} />)}
      </div>
    </section>
  );
}

function DashboardCard({ icon: Icon, title, color, to }) {
  return (
    <Link
      to={to}
      className="rounded-2xl border bg-white p-6 transition hover:-translate-y-1 hover:shadow-md"
    >
      <Icon className={`mb-4 h-8 w-8 ${color}`} />
      <h3 className="font-semibold">{title}</h3>
      <ArrowRight className="mt-6" size={18} />
    </Link>
  );
}