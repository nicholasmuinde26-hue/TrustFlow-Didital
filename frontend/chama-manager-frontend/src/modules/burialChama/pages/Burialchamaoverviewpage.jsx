import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet,
  PiggyBank,
  ArrowDownLeft,
  ArrowUpRight,
  HeartPulse,
  UserPlus,
  Users,
  AlertTriangle,
  Calendar,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Tent,
  Megaphone,
} from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";
import useAuth from "@/app/hooks/useAuth";
import MpesaStkModal from "@/modules/finance/components/MpesaStkModal";
import useFinanceSummary from "@/modules/finance/hooks/useFinanceSummary";
import useLedger from "@/modules/finance/hooks/useLedger";
import api from "@/app/services/api";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

const CASE_STATUS_STYLES = {
  reported: { icon: Clock, color: "bg-amber-100 text-amber-700", label: "Reported" },
  under_review: { icon: AlertTriangle, color: "bg-blue-100 text-blue-700", label: "Under Review" },
  verified: { icon: CheckCircle2, color: "bg-emerald-100 text-emerald-700", label: "Verified" },
  approved: { icon: CheckCircle2, color: "bg-emerald-100 text-emerald-700", label: "Approved" },
  rejected: { icon: XCircle, color: "bg-rose-100 text-rose-700", label: "Rejected" },
  closed: { icon: CheckCircle2, color: "bg-slate-100 text-slate-600", label: "Closed" },
};

const OPEN_CASE_STATUSES = ["reported", "under_review", "verified", "approved"];

export default function BurialChamaOverviewPage({ dashboard = {} }) {
  const { workspaceId: paramId } = useParams();
  const workspaceCtx = useWorkspace();
  const { user } = useAuth();
  const workspaceId = paramId || workspaceCtx?.workspaceId;

  const [isStkOpen, setIsStkOpen] = useState(false);

  const workspace = dashboard?.workspace || workspaceCtx?.currentWorkspace || {};
  const stats = dashboard?.stats || {};
  const { summary: financeSummary } = useFinanceSummary(workspaceId);
  const { entries: ledgerEntries } = useLedger(workspaceId, { limit: 6 });

  // Real burial-case data — same endpoint BurialCasesPage uses. If it 403s
  // for a non-official member, fall back to an empty list rather than
  // breaking the overview.
  const { data: burialCases } = useQuery({
    queryKey: ["burial-cases", workspaceId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/burial-chama/chama/${workspaceId}/cases`);
      return response.data.data;
    },
    enabled: !!workspaceId,
    retry: false,
  });

  const { data: beneficiaries } = useQuery({
    queryKey: ["beneficiaries", workspaceId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/burial-chama/chama/${workspaceId}/beneficiaries`);
      return response.data.data;
    },
    enabled: !!workspaceId,
    retry: false,
  });

  const cases = Array.isArray(burialCases) ? burialCases : [];
  const beneficiaryList = Array.isArray(beneficiaries) ? beneficiaries : [];

  const openCases = cases.filter((c) => OPEN_CASE_STATUSES.includes(c.status));
  const pendingReviewCases = cases.filter((c) => c.status === "reported" || c.status === "under_review");

  const userName = user?.first_name || user?.name?.split(" ")[0] || "User";
  const base = `/workspace/${workspaceId}`;

  const welfareFundBalance = financeSummary?.savings_balance ?? financeSummary?.cash_balance ?? 0;
  const monthContributions = financeSummary?.total_contributions ?? financeSummary?.cash_in ?? 0;
  const outstandingDues = financeSummary?.outstanding_loans ?? 0;
  const memberCount = stats?.memberCount ?? 0;

  const totalInflow = financeSummary?.cash_in ?? monthContributions;
  const totalOutflow = financeSummary?.cash_out ?? (financeSummary?.pending_payouts || 0);
  const netFlow = totalInflow - totalOutflow;
  const totalFlow = totalInflow + totalOutflow;
  const inflowDashoffset = totalFlow > 0 ? 238.7 * (1 - totalInflow / totalFlow) : 238.7;

  const targetCollection = monthContributions + outstandingDues;
  const collectionRateNum =
    targetCollection > 0 ? Number(((monthContributions / targetCollection) * 100).toFixed(1)) : 0;
  const collectionDashoffset = 238.7 * (1 - collectionRateNum / 100);

  const failedCount = financeSummary?.failed_transactions ?? 0;
  const unpaidCount = stats?.overdueCount ?? 0;
  const pendingPayoutsCount = financeSummary?.pending_payouts ? 1 : 0;

  const currentDateStr = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight sm:text-3xl text-slate-900 dark:text-white">
            Hello there!, {userName} <span className="inline-block animate-bounce">👋</span>
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Here's your burial chama's welfare fund and case overview
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 animate-pulse" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {workspace?.name || "Burial Chama"}
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            <Calendar size={14} className="text-slate-400" />
            <span>{currentDateStr}</span>
          </div>
        </div>
      </div>

      {/* 5 KPI Stat Cards — burial-relevant */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="group rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              WELFARE FUND
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <PiggyBank size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">{money(welfareFundBalance)}</p>
          <div className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <span>Available for payouts</span>
          </div>
        </div>

        <div className="group rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              THIS MONTH CONTRIBUTIONS
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
              <ArrowDownLeft size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">{money(monthContributions)}</p>
          <div className="mt-2 flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-400">
            <span>Member dues collected</span>
          </div>
        </div>

        <div className="group rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              ACTIVE BURIAL CASES
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
              <HeartPulse size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">{openCases.length}</p>
          <div className="mt-2 flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400">
            <span>{pendingReviewCases.length} awaiting review</span>
          </div>
        </div>

        <div className="group rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              BENEFICIARIES ON FILE
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400">
              <UserPlus size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">{beneficiaryList.length}</p>
          <div className="mt-2 flex items-center gap-1 text-xs font-bold text-violet-600 dark:text-violet-400">
            <span>Registered next of kin</span>
          </div>
        </div>

        <div className="group rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              ACTIVE MEMBERS
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <Users size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">{memberCount}</p>
          <div className="mt-2 flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
            <span>{money(outstandingDues)} in unpaid dues</span>
          </div>
        </div>
      </div>

      {/* Middle Grid: Recent Burial Cases & Money Flow */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Recent Burial Cases */}
        <div className="lg:col-span-5 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Recent Burial Cases</h2>
            <Link to={`${base}/burial-cases`} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
              View all <ChevronRight size={14} />
            </Link>
          </div>

          <div className="space-y-3">
            {cases.length > 0 ? (
              cases.slice(0, 5).map((c) => {
                const config = CASE_STATUS_STYLES[c.status] || CASE_STATUS_STYLES.reported;
                const Icon = config.icon;
                return (
                  <div key={c._id} className="flex items-center justify-between rounded-2xl bg-slate-50/70 p-3.5 dark:bg-slate-800/40">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                        <HeartPulse size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          {c.deceased?.first_name} {c.deceased?.last_name}
                        </p>
                        <p className="text-[11px] text-slate-400">{c.case_type?.replace(/_/g, " ")}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${config.color}`}>
                      <Icon size={10} /> {config.label}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">No burial cases reported yet.</p>
            )}
          </div>
        </div>

        {/* Money Flow */}
        <div className="lg:col-span-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Money Flow (This Month)</h2>

          <div className="my-3 flex items-center justify-center relative">
            <svg className="h-44 w-44 transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="38" stroke="#e2e8f0" strokeWidth="12" fill="none" className="dark:stroke-slate-800" />
              <circle cx="50" cy="50" r="38" stroke="#10b981" strokeWidth="12" fill="none" strokeDasharray="238.7" strokeDashoffset={inflowDashoffset} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">NET FLOW</span>
              <span className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{money(netFlow)}</span>
            </div>
          </div>

          <div className="space-y-2 text-xs font-semibold">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Total Inflow</span>
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">{money(totalInflow)} <ArrowDownLeft size={14} className="text-emerald-600" /></span>
            </div>
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" />Total Outflow (Payouts)</span>
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">{money(totalOutflow)} <ArrowUpRight size={14} className="text-rose-500" /></span>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between font-extrabold">
              <span className="text-slate-700 dark:text-slate-300">Net Flow</span>
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">{money(netFlow)} <ArrowDownLeft size={14} /></span>
            </div>
          </div>
        </div>

        {/* Action Center */}
        <div className="lg:col-span-3 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white text-xs">⚡</span>
                Action Center
              </h2>
              <ChevronRight size={16} className="text-slate-400" />
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400"><HeartPulse size={16} /></div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{pendingReviewCases.length} case(s) awaiting review</p>
                  <Link to={`${base}/burial-cases`} className="text-[11px] text-slate-500 dark:text-slate-400 hover:underline">Review burial cases</Link>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"><AlertTriangle size={16} /></div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{unpaidCount} members with unpaid dues</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Send reminders</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"><Clock size={16} /></div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{pendingPayoutsCount} payout awaits approval</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Chair approval needed</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400"><XCircle size={16} /></div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{failedCount} payments failed</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Review M-Pesa reconciliation</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Beneficiary Coverage, Collection Performance, Income Streams */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Beneficiary Coverage */}
        <div className="lg:col-span-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400">
              <ShieldCheck size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Beneficiary Coverage</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Keep next-of-kin records current</p>
            </div>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{beneficiaryList.length}</span>
            <span className="text-xs font-semibold text-slate-500">beneficiaries registered across {memberCount || "—"} members</span>
          </div>

          <Link
            to={`${base}/beneficiaries`}
            className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400"
          >
            Manage beneficiaries <ChevronRight size={14} />
          </Link>
        </div>

        {/* Collection Performance */}
        <div className="lg:col-span-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Collection Performance</h2>

          <div className="my-4 flex items-center justify-center relative">
            <svg className="h-36 w-36 transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="38" stroke="#e2e8f0" strokeWidth="10" fill="none" className="dark:stroke-slate-800" />
              <circle cx="50" cy="50" r="38" stroke="#10b981" strokeWidth="10" fill="none" strokeDasharray="238.7" strokeDashoffset={collectionDashoffset} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{collectionRateNum}%</span>
              <span className="text-[11px] font-bold text-slate-400">of target</span>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Expected</span><span className="font-bold text-slate-900 dark:text-white">{money(targetCollection)}</span></div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Collected</span><span className="font-bold text-slate-900 dark:text-white">{money(monthContributions)}</span></div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Outstanding</span><span className="font-bold text-rose-600">{money(outstandingDues)}</span></div>
          </div>
        </div>

        {/* Income Streams — ties into the Equipment Hire / Harambee pages */}
        <div className="lg:col-span-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Grow the Welfare Fund</h2>

          <div className="space-y-3">
            <Link to={`${base}/equipment-hire`} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"><Tent size={16} /></div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Equipment & Tent Hire</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Hire out tents, chairs & cooking gear</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-400" />
            </Link>

            <Link to={`${base}/fundraising`} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400"><Megaphone size={16} /></div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Harambee & Fundraising</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Top up cases beyond the standard payout</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-400" />
            </Link>

            <Link to={`${base}/loans`} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400"><Wallet size={16} /></div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Emergency Loans</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Lend surplus funds to members at interest</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-400" />
            </Link>
          </div>
        </div>
      </div>

      <MpesaStkModal isOpen={isStkOpen} onClose={() => setIsStkOpen(false)} chamaId={workspaceId} title="Deposit to Welfare Fund via M-Pesa" />
    </div>
  );
}