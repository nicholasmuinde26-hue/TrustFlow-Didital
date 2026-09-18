import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Banknote, CheckCircle2, Clock3, Landmark, MessageSquare, Receipt, ShieldAlert, UserRound, Wallet } from 'lucide-react';
import adminService from '../services/admin.service';
import inquiryService from '@/app/services/inquiry.service';
import Spinner from '@/shared/components/ui/Spinner';

const money = (value) => `KES ${Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;

function WorkspaceHero({ eyebrow, title, description, actionTo, actionLabel }) {
  return <section className="rounded-3xl bg-gradient-to-r from-slate-950 via-indigo-950 to-violet-900 p-8 text-white shadow-xl"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">{eyebrow}</p><h1 className="mt-2 text-3xl font-black tracking-tight">{title}</h1><p className="mt-2 text-sm leading-6 text-indigo-100">{description}</p>{actionTo && <Link to={actionTo} className="mt-5 inline-flex rounded-xl bg-white px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-indigo-50">{actionLabel}</Link>}</div></section>;
}

function Metric({ label, value, icon: Icon, tone = 'indigo' }) {
  const tones = { indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300', emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', rose: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' };
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-500">{label}</span><span className={`rounded-xl p-2 ${tones[tone]}`}><Icon size={17}/></span></div><p className="mt-4 text-2xl font-black text-slate-950 dark:text-white">{value}</p></div>;
}

export function FinanceWorkspacePage() {
  const [overview, setOverview] = useState(null);
  useEffect(() => { adminService.getExecutiveOverview().then(setOverview).catch(() => setOverview({})); }, []);
  if (!overview) return <Spinner />;
  return <div className="space-y-7"><WorkspaceHero eyebrow="Finance workspace" title="Treasury & reconciliation" description="Start with money movement, payment matching, ledger health, and approvals across the platform." actionTo="/admin/directory" actionLabel="Inspect workspaces"/><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Money processed" value={money(overview.moneyProcessed)} icon={Banknote} tone="emerald"/><Metric label="Posted transactions" value={overview.transactions ?? 0} icon={Receipt}/><Metric label="Payment match rate" value={overview.verifiedTransactionPercent == null ? '—' : `${overview.verifiedTransactionPercent}%`} icon={CheckCircle2} tone="emerald"/><Metric label="Unbalanced ledgers" value={overview.unbalancedLedgers ?? 0} icon={AlertTriangle} tone="rose"/></section><section className="grid gap-5 lg:grid-cols-2"><ActionCard title="Reconciliation attention" detail={`${overview.riskAlerts ?? 0} unresolved financial risk signals need review, including overdue obligations, unmatched payments, and ledger exceptions.`} icon={Landmark} to="/admin/directory" label="Open financial workspaces"/><ActionCard title="Pending approvals" detail={`${overview.pendingApprovals ?? 0} approval requests are awaiting a decision.`} icon={Clock3} to="/admin/activity" label="Review audit trail"/></section></div>;
}

export function SupportWorkspacePage() {
  const [data, setData] = useState(null);
  useEffect(() => { Promise.all([inquiryService.getAdminInquiryStats(), inquiryService.listAdminInquiries({ status: 'open', limit: 5 })]).then(([stats, queue]) => setData({ stats, queue: queue.inquiries || [] })).catch(() => setData({ stats: {}, queue: [] })); }, []);
  if (!data) return <Spinner />;
  return <div className="space-y-7"><WorkspaceHero eyebrow="Support workspace" title="Ticket queue" description="Begin with members and workspaces needing a response. Triage active reports, own the conversation, and keep resolution moving." actionTo="/admin/inquiries" actionLabel="Open full queue"/><section className="grid gap-4 sm:grid-cols-3"><Metric label="Open tickets" value={data.stats.openCount ?? 0} icon={MessageSquare} tone="rose"/><Metric label="In progress" value={data.stats.inProgressCount ?? 0} icon={Clock3} tone="amber"/><Metric label="Resolved" value={data.stats.resolvedCount ?? 0} icon={CheckCircle2} tone="emerald"/></section><section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800"><div><h2 className="font-black text-slate-950 dark:text-white">Open queue</h2><p className="mt-1 text-xs text-slate-500">The newest unresolved member and workspace reports.</p></div><Link to="/admin/inquiries" className="text-xs font-bold text-indigo-600">View all</Link></div><div className="divide-y divide-slate-100 dark:divide-slate-800">{data.queue.length ? data.queue.map((ticket) => <Link key={ticket._id} to="/admin/inquiries" className="block p-5 hover:bg-slate-50 dark:hover:bg-slate-800/60"><p className="font-bold text-slate-900 dark:text-white">{ticket.subject || 'Support request'}</p><p className="mt-1 text-xs text-slate-500">{ticket.category?.replaceAll('_', ' ')} · {ticket.workspaceType || 'platform'} · {ticket.priority || 'normal'} priority</p></Link>) : <div className="p-8 text-center text-sm text-slate-500">No open tickets.</div>}</div></section></div>;
}

export function ComplianceWorkspacePage() {
  const [overview, setOverview] = useState(null);
  useEffect(() => { adminService.getExecutiveOverview().then(setOverview).catch(() => setOverview({})); }, []);
  if (!overview) return <Spinner />;
  return <div className="space-y-7"><WorkspaceHero eyebrow="Compliance workspace" title="Controls & evidence review" description="Review cross-platform exceptions, immutable administrative evidence, and risk telemetry before they become incidents." actionTo="/admin/activity" actionLabel="Open audit trail"/><section className="grid gap-4 sm:grid-cols-3"><Metric label="Financial risk signals" value={overview.riskAlerts ?? 0} icon={ShieldAlert} tone="rose"/><Metric label="Unbalanced ledgers" value={overview.unbalancedLedgers ?? 0} icon={Wallet} tone="amber"/><Metric label="Pending approvals" value={overview.pendingApprovals ?? 0} icon={UserRound}/></section><ActionCard title="Security telemetry" detail="Review scored fraud and authentication signals alongside their explanations and controls." icon={ShieldAlert} to="/admin/security" label="Open Security Center"/></div>;
}

function ActionCard({ title, detail, icon: Icon, to, label }) { return <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"><Icon className="text-indigo-600" size={22}/><h2 className="mt-4 font-black text-slate-950 dark:text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p><Link to={to} className="mt-5 inline-flex text-xs font-bold text-indigo-600 hover:text-indigo-700">{label} →</Link></div>; }
