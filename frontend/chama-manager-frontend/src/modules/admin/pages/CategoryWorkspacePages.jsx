import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock3,
  Landmark,
  MessageSquare,
  Receipt,
  ShieldAlert,
  UserRound,
  Wallet,
} from "lucide-react";
import adminService from "../services/admin.service";
import inquiryService from "@/app/services/inquiry.service";
import { PageHeader, PageSkeleton, Panel, PanelLink, StatTile, adminBtn } from "../components/ui/AdminUi";

const money = (value) => `KES ${Number(value || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

function ActionCard({ title, detail, icon: Icon, to, label }) {
  return (
    <Panel>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-300">
        <Icon size={18} />
      </span>
      <h2 className="mt-4 text-sm font-semibold text-slate-950 dark:text-white">{title}</h2>
      <p className="mt-1.5 text-sm leading-6 text-slate-500 dark:text-slate-400">{detail}</p>
      <div className="mt-4">
        <PanelLink to={to}>{label}</PanelLink>
      </div>
    </Panel>
  );
}

export function FinanceWorkspacePage() {
  const [overview, setOverview] = useState(null);
  useEffect(() => {
    adminService.getExecutiveOverview().then(setOverview).catch(() => setOverview({}));
  }, []);
  if (!overview) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance workspace"
        title="Treasury & reconciliation"
        description="Start with money movement, payment matching, ledger health and approvals across the platform."
        actions={
          <Link to="/admin/directory" className={adminBtn.primary}>
            Inspect workspaces
          </Link>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Money processed" value={money(overview.moneyProcessed)} icon={Banknote} tone="emerald" />
        <StatTile label="Posted transactions" value={overview.transactions ?? 0} icon={Receipt} tone="violet" />
        <StatTile
          label="Payment match rate"
          value={overview.verifiedTransactionPercent == null ? "—" : `${overview.verifiedTransactionPercent}%`}
          icon={CheckCircle2}
          tone="emerald"
        />
        <StatTile label="Unbalanced ledgers" value={overview.unbalancedLedgers ?? 0} icon={AlertTriangle} tone="rose" />
      </section>
      <section className="grid gap-5 lg:grid-cols-2">
        <ActionCard
          title="Reconciliation attention"
          detail={`${overview.riskAlerts ?? 0} unresolved financial risk signals need review, including overdue obligations, unmatched payments and ledger exceptions.`}
          icon={Landmark}
          to="/admin/directory"
          label="Open financial workspaces"
        />
        <ActionCard
          title="Pending approvals"
          detail={`${overview.pendingApprovals ?? 0} approval requests are awaiting a decision.`}
          icon={Clock3}
          to="/admin/activity"
          label="Review audit trail"
        />
      </section>
    </div>
  );
}

export function SupportWorkspacePage() {
  const [data, setData] = useState(null);
  useEffect(() => {
    Promise.all([
      inquiryService.getAdminInquiryStats(),
      inquiryService.listAdminInquiries({ status: "open", limit: 5 }),
    ])
      .then(([stats, queue]) => setData({ stats, queue: queue.inquiries || [] }))
      .catch(() => setData({ stats: {}, queue: [] }));
  }, []);
  if (!data) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support workspace"
        title="Ticket queue"
        description="Begin with members and workspaces needing a response. Triage active reports, own the conversation and keep resolution moving."
        actions={
          <Link to="/admin/inquiries" className={adminBtn.primary}>
            Open full queue
          </Link>
        }
      />
      <section className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Open tickets" value={data.stats.openCount ?? 0} icon={MessageSquare} tone="rose" />
        <StatTile label="In progress" value={data.stats.inProgressCount ?? 0} icon={Clock3} tone="amber" />
        <StatTile label="Resolved" value={data.stats.resolvedCount ?? 0} icon={CheckCircle2} tone="emerald" />
      </section>
      <Panel
        title="Open queue"
        description="The newest unresolved member and workspace reports"
        flush
        action={<PanelLink to="/admin/inquiries">View all</PanelLink>}
      >
        {data.queue.length ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.queue.map((ticket) => (
              <li key={ticket._id}>
                <Link
                  to="/admin/inquiries"
                  className="block px-5 py-3.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <p className="text-[13px] font-semibold text-slate-900 dark:text-white">
                    {ticket.subject || "Support request"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {ticket.category?.replaceAll("_", " ")} · {ticket.workspaceType || "platform"} ·{" "}
                    {ticket.priority || "normal"} priority
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <CheckCircle2 size={22} className="text-emerald-500" />
            <p className="text-sm text-slate-500">No open tickets.</p>
          </div>
        )}
      </Panel>
    </div>
  );
}

export function ComplianceWorkspacePage() {
  const [overview, setOverview] = useState(null);
  useEffect(() => {
    adminService.getExecutiveOverview().then(setOverview).catch(() => setOverview({}));
  }, []);
  if (!overview) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compliance workspace"
        title="Controls & evidence review"
        description="Review cross-platform exceptions, immutable administrative evidence and risk telemetry before they become incidents."
        actions={
          <Link to="/admin/activity" className={adminBtn.primary}>
            Open audit trail
          </Link>
        }
      />
      <section className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Financial risk signals" value={overview.riskAlerts ?? 0} icon={ShieldAlert} tone="rose" />
        <StatTile label="Unbalanced ledgers" value={overview.unbalancedLedgers ?? 0} icon={Wallet} tone="amber" />
        <StatTile label="Pending approvals" value={overview.pendingApprovals ?? 0} icon={UserRound} tone="violet" />
      </section>
      <ActionCard
        title="Security telemetry"
        detail="Review scored fraud and authentication signals alongside their explanations and controls."
        icon={ShieldAlert}
        to="/admin/security"
        label="Open Security Center"
      />
    </div>
  );
}
