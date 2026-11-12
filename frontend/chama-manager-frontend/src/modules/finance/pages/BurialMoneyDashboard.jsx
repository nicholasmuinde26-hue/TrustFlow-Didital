import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, HeartHandshake, Landmark, Plus, ShieldCheck, Users, Wallet } from 'lucide-react';
import useWorkspace from '@/app/hooks/useWorkspace';
import useFinanceSummary from '../hooks/useFinanceSummary';
import financeService from '../services/finance.service';
import api from '@/app/services/api';
import Card from '@/shared/components/ui/Card/Card';

const money = (amount) => `KES ${Number(amount || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
const OPEN_CASES = new Set(['reported', 'under_review', 'documentation_required', 'verified', 'eligibility_check', 'benefit_calculated', 'committee_review', 'approved', 'payment_authorized', 'disbursement']);

function Metric({ title, value, detail, icon: Icon, tint = 'emerald' }) {
  const tintClasses = {
    emerald: 'bg-emerald-50 text-emerald-700', blue: 'bg-blue-50 text-blue-700',
    rose: 'bg-rose-50 text-rose-700', amber: 'bg-amber-50 text-amber-700'
  };
  return <Card className="flex items-start gap-4 p-5"><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tintClasses[tint]}`}><Icon size={20} /></div><div className="min-w-0"><p className="text-sm font-medium text-slate-500">{title}</p><p className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div></Card>;
}

export default function BurialMoneyDashboard() {
  const { workspaceId: routeId } = useParams();
  const ws = useWorkspace();
  const workspaceId = routeId || ws?.workspaceId;
  const base = `/workspace/${workspaceId}`;
  const workspaceName = ws?.currentWorkspace?.name || ws?.activeWorkspace?.name || 'Your burial chama';
  const { summary, isLoading: summaryLoading } = useFinanceSummary(workspaceId);
  const [register, setRegister] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!workspaceId) return undefined;
    financeService.getContributionsRegister(workspaceId).then((data) => { if (alive) setRegister(data); });
    return () => { alive = false; };
  }, [workspaceId]);

  const { data: cases = [], isError: casesError } = useQuery({
    queryKey: ['burial-cases', workspaceId],
    queryFn: async () => (await api.get(`/burial-chama/chama/${workspaceId}/cases`)).data.data || [],
    enabled: Boolean(workspaceId), retry: false
  });

  const totals = register?.totals || {};
  const poolBalance = summary?.welfare_fund_balance ?? 0;
  const availableForCases = summary?.fund_available_for_cases ?? poolBalance;
  const reserveFloor = summary?.fund_reserve_floor ?? 0;
  const currentMonth = new Date().toLocaleDateString(undefined, { month: 'long' });
  const caseCount = cases.filter((item) => OPEN_CASES.has(item.status)).length;
  const collectionRate = Math.max(0, Math.min(100, Number(totals.collection_rate) || 0));
  const collected = Number(totals.collected_this_month ?? totals.collected ?? 0);
  const expected = Number(totals.expected || 0);
  const outstanding = Number(totals.outstanding || 0);
  const pendingPayout = Number(summary?.pending_payouts || 0);

  return <div className="mx-auto max-w-[1400px] space-y-6 px-1 pb-10 text-slate-900">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"><HeartHandshake size={14} /> Welfare finance</span><h1 className="mt-3 text-3xl font-bold tracking-tight">Welfare fund</h1><p className="mt-1 text-sm text-slate-500">A clear view of member support, collections, and benevolent payments for {workspaceName}.</p></div>
      <div className="flex flex-wrap gap-2"><Link to={`${base}/finance/record-contribution`} className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"><Plus size={16} />Record contribution</Link><Link to={`${base}/finance/payouts`} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"><ArrowUpRight size={16} />Benevolent payouts</Link></div>
    </header>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Welfare finance summary">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800 p-5 text-white shadow-lg shadow-emerald-950/10 sm:col-span-2"><div className="absolute -right-7 -top-12 h-48 w-48 rounded-full bg-white/5" /><div className="relative flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-100">Shared welfare pool</p><p className="mt-3 text-3xl font-bold tracking-tight">{summaryLoading ? 'Loading…' : money(poolBalance)}</p><p className="mt-2 text-sm text-emerald-100">{money(availableForCases)} available above the {money(reserveFloor)} reserve floor</p></div><div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><Wallet size={23} /></div></div><div className="relative mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/15 pt-4 text-xs font-medium text-emerald-100"><span className="inline-flex items-center gap-1.5"><ArrowDownLeft size={14} />{money(collected)} collected this month</span><span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} />{pendingPayout ? `${money(pendingPayout)} pending payout` : 'No pending payouts'}</span></div></div>
      <Metric title={`${currentMonth} collections`} value={money(collected)} detail={expected ? `${money(expected)} expected this period` : 'Member welfare contributions'} icon={ArrowDownLeft} tint="blue" />
      <Metric title="Open support cases" value={casesError ? '—' : caseCount} detail={casesError ? 'Case information unavailable' : `${cases.length} total cases recorded`} icon={HeartHandshake} tint="rose" />
      <Metric title="Contributions outstanding" value={money(outstanding)} detail={`${collectionRate.toFixed(0)}% of expected contributions collected`} icon={Users} tint="amber" />
    </section>

    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6"><div><div className="flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Landmark size={18} /></div><h2 className="text-lg font-semibold">Member welfare contributions</h2></div><p className="mt-2 text-sm text-slate-500">{currentMonth} collection progress</p></div><Link to={`${base}/finance/contributions/register`} className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-900">Open register <ArrowRight size={15} /></Link></div>
        <div className="p-5 sm:p-6"><div className="mb-2 flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-slate-800">{money(collected)} collected</span><span className="text-slate-500">{expected ? `${money(expected)} expected` : 'No active target'}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${expected ? collectionRate : 0}%` }} /></div><div className="mt-2 flex justify-between text-xs text-slate-500"><span>{collectionRate.toFixed(0)}% complete</span><span>{money(outstanding)} outstanding</span></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2"><Link to={`${base}/finance/contributions`} className="group flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/50"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><ArrowDownLeft size={19} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Collection activity</span><span className="mt-0.5 block text-xs text-slate-500">Review member payments and dues</span></span><ArrowRight size={16} className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-700" /></Link><Link to={`${base}/finance/transactions`} className="group flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/50"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Wallet size={19} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Welfare fund activity</span><span className="mt-0.5 block text-xs text-slate-500">View collections, benefits, and fund movements</span></span><ArrowRight size={16} className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-700" /></Link></div>
        </div>
      </Card>

      <div className="space-y-5">
        <Card className="p-5 sm:p-6"><div className="flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-rose-50 text-rose-700"><HeartHandshake size={18} /></div><h2 className="text-lg font-semibold">Member support</h2></div><p className="mt-2 text-sm leading-6 text-slate-500">Track reported bereavements and move approved support through the benevolent payout process.</p><div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 p-4"><div><p className="text-xs font-medium text-slate-500">Cases needing attention</p><p className="mt-1 text-xl font-bold">{casesError ? '—' : caseCount}</p></div><Link to={`${base}/burial-cases`} className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">Review cases <ArrowRight size={15} /></Link></div></Card>
        <Card className="border-emerald-100 bg-emerald-50/60 p-5 sm:p-6"><h2 className="font-semibold text-slate-900">Quick actions</h2><div className="mt-3 space-y-2"><Link to={`${base}/finance/record-contribution`} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:shadow-sm"><span className="inline-flex items-center gap-3"><Plus size={17} className="text-emerald-700" />Record a welfare contribution</span><ArrowRight size={15} className="text-slate-400" /></Link><Link to={`${base}/finance/payouts`} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:shadow-sm"><span className="inline-flex items-center gap-3"><ArrowUpRight size={17} className="text-emerald-700" />Review benevolent payouts</span><ArrowRight size={15} className="text-slate-400" /></Link></div></Card>
      </div>
    </section>
    {!register && <p className="text-center text-xs text-slate-400">Collection details are loading. Figures shown will update when finance data is available.</p>}
  </div>;
}
