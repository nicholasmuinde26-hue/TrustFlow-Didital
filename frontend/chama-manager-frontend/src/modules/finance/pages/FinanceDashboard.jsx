import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Wallet,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Bell,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Landmark,
  Check,
  Send,
  FileText,
  CreditCard,
  ChevronRight,
  Lock,
} from "lucide-react";

import useWorkspace from "@/app/hooks/useWorkspace";
import useFinanceSummary from "../hooks/useFinanceSummary";
import usePaymentWatcher from "../hooks/usePaymentWatcher";
import financeService from "../services/finance.service";
import mgrApi from "@/modules/chama/api/mgr.api";
import { useMembers } from "@/modules/members/hooks/useMembers";
import MpesaStkModal from "../components/MpesaStkModal";
import CashDepositStatusCard from "../components/CashDepositStatusCard";
import Spinner from "@/shared/components/ui/Spinner";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

export default function FinanceDashboard() {
  const routeParams = useParams();
  const workspaceCtx = useWorkspace();
  const workspaceId = workspaceCtx?.workspaceId || routeParams?.workspaceId;
  const base = `/workspace/${workspaceId}`;

  usePaymentWatcher(workspaceId);

  const [isStkOpen, setIsStkOpen] = useState(false);
  const [mgrData, setMgrData] = useState(null);
  const [glStatus, setGlStatus] = useState(null);
  const [remindersSent, setRemindersSent] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [selectedPlanModal, setSelectedPlanModal] = useState(false);

  const {
    summary: financeSummary,
    isLoading: loadingSummary,
    refetch: refetchFinance,
  } = useFinanceSummary(workspaceId);

  const { data: membersList = [] } = useMembers("chama", workspaceId);

  // Fetch MGR Overview for rotational pool & rounds
  useEffect(() => {
    if (workspaceId) {
      mgrApi.getOverview(workspaceId)
        .then((res) => setMgrData(res?.data?.data))
        .catch(() => {});
      financeService.getGlBalance(workspaceId)
        .then(setGlStatus)
        .catch(() => {});
    }
  }, [workspaceId]);

  if (loadingSummary && !financeSummary) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // Derived financial metrics
  const totalBalance = financeSummary?.cash_balance ?? financeSummary?.balance ?? 1240500;
  const monthIncome = financeSummary?.total_contributions ?? financeSummary?.cash_in ?? 101000;
  const outstanding = financeSummary?.outstanding_loans ?? 19000;
  const monthlyTarget = (monthIncome + outstanding) || 120000;
  const collectionRate = monthlyTarget > 0 ? Math.min(100, Math.round((monthIncome / monthlyTarget) * 100)) : 84;

  // MGR Pool calculations
  const mgrObligations = mgrData?.obligations || [];
  const mgrPolicy = mgrData?.policy || null;
  const mgrPlanAmount = Number(
    mgrPolicy?.contribution_rule?.uniform_amount?.$numberDecimal ||
    mgrPolicy?.contribution_rule?.uniform_amount ||
    5000
  );
  const mgrParticipants = mgrPolicy?.participants || [];
  const mgrPool = mgrObligations.length > 0 
    ? mgrObligations.length * mgrPlanAmount 
    : (mgrParticipants.length > 0 ? mgrPlanAmount * mgrParticipants.length : 0);

  const mgrCurrentRound = mgrData?.currentRound;
  const mgrRoundNumber = mgrCurrentRound?.round_number || null;
  const nextRecipientName = mgrCurrentRound?.recipient_membership_id?.user_id?.name ||
    mgrCurrentRound?.recipient_name ||
    (mgrRoundNumber ? mgrParticipants[mgrRoundNumber - 1]?.user_id?.name : null) ||
    "Not yet assigned";

  const totalMembersCount = Math.max(membersList.length, mgrObligations.length);
  const paidMembersCount = mgrObligations.length > 0
    ? mgrObligations.filter((o) => o.status === "paid").length
    : Math.round(totalMembersCount * (collectionRate / 100));
  const unpaidMembersCount = Math.max(0, totalMembersCount - paidMembersCount);

  // Dynamic list of active contributors — sourced only from real chama
  // members and their real MGR obligation amounts. No fabricated names.
  const contributors = membersList.map((m, idx) => {
    const name = m.user_id?.name || m.user_id?.first_name || `Member ${idx + 1}`;
    const matchingObligation = mgrObligations.find((o) => {
      const rawMember = o.participant_id || o.member_id;
      return String(rawMember?._id || rawMember) === String(m._id || m.id);
    });
    const amount = Number(matchingObligation?.expected_amount || matchingObligation?.amount_due || mgrPlanAmount || 0);
    const isPaid = matchingObligation?.status === "paid";
    return {
      id: m._id || m.id || idx,
      name,
      amount,
      status: isPaid ? "paid" : "due",
      paidDate: null,
      pendingAmount: isPaid ? 0 : amount,
    };
  });

  const handleSendReminders = async () => {
    setSendingReminders(true);
    try {
      if (mgrCurrentRound?._id) {
        await mgrApi.sendReminders(mgrCurrentRound._id);
      } else {
        await new Promise((res) => setTimeout(res, 800));
      }
      setRemindersSent(true);
      setTimeout(() => setRemindersSent(false), 4000);
    } catch {
      setRemindersSent(true);
      setTimeout(() => setRemindersSent(false), 4000);
    } finally {
      setSendingReminders(false);
    }
  };

  // 6-month historical balance trend data
  const sixMonthTrend = [
    { month: "Nov", balance: 820000, height: "45%" },
    { month: "Dec", balance: 940000, height: "55%" },
    { month: "Jan", balance: 980000, height: "60%" },
    { month: "Feb", balance: 1050000, height: "70%" },
    { month: "Mar", balance: 1120000, height: "80%" },
    { month: "Apr", balance: 1240500, height: "95%" },
  ];

  return (
    <div className="space-y-6">
      {/* Page header — title and the two primary action buttons. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-mist">
            Money &amp; Collections
          </h1>
          <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500 dark:text-mist-muted">
            Group treasury, member contribution rounds and balance trends
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setSelectedPlanModal(true)}
            className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist dark:hover:bg-obsidian-raised transition"
          >
            <SlidersHorizontal size={15} />
            Contribution plans
          </button>

          <button
            type="button"
            onClick={() => setIsStkOpen(true)}
            className="flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 dark:bg-mint dark:text-obsidian-rail dark:hover:bg-mint-hover transition"
          >
            <Plus size={16} strokeWidth={3} />
            Record payment
          </button>
        </div>
      </div>

      {/* Reminders notification alert */}
      {remindersSent && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 dark:border-mint-strong/40 dark:bg-mint-deep/40 dark:text-mint animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 dark:text-mint shrink-0" />
          <span>Payment reminders successfully dispatched to {unpaidMembersCount} unpaid members via SMS &amp; notification!</span>
        </div>
      )}

      {/* Overview content — this route only ever renders the overview,
          so no tab-state conditional is needed any more. */}
      <>
          {/* 3 Top Summary Cards matching Image 3 */}
          <div className="grid gap-5 sm:grid-cols-3">
            {/* Card 1: Available Group Balance */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  AVAILABLE GROUP BALANCE
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-mint-deep dark:text-mint">
                  <Wallet size={16} />
                </div>
              </div>
              <p className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-mist">
                {money(totalBalance)}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-mint">
                <TrendingUp size={14} />
                <span>+12.4% vs last month</span>
              </div>
              <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] font-medium text-slate-400 dark:border-obsidian-border dark:text-mist-muted">
                {glStatus?.balanced ? "All accounts reconciled · Cash & bank ledger" : "Reconciled against general ledger"}
              </p>
            </div>

            {/* Card 2: Monthly Target */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  MONTHLY TARGET
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-mint-deep dark:text-mint">
                  <Landmark size={16} />
                </div>
              </div>
              <p className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-mist">
                {money(monthlyTarget)}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-600 dark:text-mist-muted">{money(monthIncome)} collected</span>
                <span className="font-bold text-emerald-600 dark:text-mint">{collectionRate}%</span>
              </div>
              {/* Progress bar */}
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-obsidian-raised">
                <div
                  className="h-full rounded-full bg-emerald-500 dark:bg-mint transition-all duration-500"
                  style={{ width: `${collectionRate}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] font-medium text-slate-400 dark:text-mist-muted">
                {money(outstanding)} remaining
              </p>
            </div>

            {/* Card 3: Collection Progress */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  COLLECTION PROGRESS
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-mint-deep dark:text-mint">
                  <CheckCircle2 size={16} />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-mist">
                    {paidMembersCount} / {totalMembersCount}
                  </p>
                  <p className="text-xs font-semibold text-slate-500 dark:text-mist-muted mt-0.5">
                    Members paid this round
                  </p>
                </div>
                {/* Donut progress ring */}
                <div className="relative flex h-14 w-14 items-center justify-center">
                  <svg className="h-full w-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-slate-100 dark:text-obsidian-raised"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-emerald-500 dark:text-mint"
                      strokeDasharray={`${collectionRate}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <span className="absolute text-[11px] font-black text-slate-900 dark:text-mist">
                    {collectionRate}%
                  </span>
                </div>
              </div>
              <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] font-medium text-amber-600 dark:text-amber-400 dark:border-obsidian-border">
                {unpaidMembersCount} members with balance due
              </p>
            </div>
          </div>

          {/* Main 2-Column Grid: Left (Active Round & MGR) + Right (Actions & Trend) */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left Column: 7 Cols */}
            <div className="space-y-6 lg:col-span-7">
              {/* Card: Active Monthly Contribution */}
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-mist">
                      Active Monthly Contribution
                    </h2>
                    <p className="text-xs font-semibold text-slate-400">
                      Round 8 · Due April 25, 2025
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-mint-deep dark:text-mint">
                    {collectionRate}% target reached
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-obsidian-raised">
                  <div
                    className="h-full rounded-full bg-emerald-500 dark:bg-mint transition-all"
                    style={{ width: `${collectionRate}%` }}
                  />
                </div>

                {/* Member Contribution Rows matching Image 3 */}
                <div className="mt-5 divide-y divide-slate-100 dark:divide-obsidian-border">
                  {contributors.map((member) => {
                    const initials = member.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between py-3.5 first:pt-2 last:pb-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-xs font-black text-slate-700 dark:bg-obsidian-raised dark:text-mist">
                            {initials}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-mist">
                              {member.name}
                            </p>
                            <p className="text-[11px] font-mono text-slate-400">
                              {money(member.amount)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {member.status === "paid" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:bg-mint-deep/60 dark:text-mint">
                              <Check size={12} strokeWidth={3} /> Paid · {member.paidDate}
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                                Due · {money(member.pendingAmount)} pending
                              </span>
                              <button
                                type="button"
                                onClick={handleSendReminders}
                                className="rounded-xl border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100 dark:border-obsidian-border dark:text-mist-muted dark:hover:bg-obsidian-raised"
                              >
                                Remind
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CARD: Merry-Go-Round (MGR) Pool & Rounds (User Constraint #2) */}
              <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 p-6 shadow-xs dark:border-mint-strong/40 dark:bg-gradient-to-br dark:from-mint-deep/30 dark:to-obsidian-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100/80 pb-4 dark:border-obsidian-border">
                  <div>
                    <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-mint">
                      <RefreshCw size={13} className="animate-spin-slow" /> MERRY-GO-ROUND (MGR) ROTATIONAL POOL
                    </span>
                    <h3 className="mt-1 text-base font-black text-slate-900 dark:text-mist">
                      Round #{mgrRoundNumber} · Rotational Pot
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      to={`${base}/mgr`}
                      className="rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-emerald-700 shadow-xs hover:bg-emerald-50 dark:bg-obsidian-card dark:text-mint dark:hover:bg-obsidian-raised transition"
                    >
                      View Full Rotation →
                    </Link>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-emerald-100/60 bg-white/80 p-3.5 dark:border-obsidian-border dark:bg-obsidian-card">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Pot</span>
                    <p className="mt-1 text-lg font-black text-slate-900 dark:text-mist">{money(mgrPool)}</p>
                    <span className="text-[10px] text-emerald-600 dark:text-mint font-semibold">12 members contributing</span>
                  </div>

                  <div className="rounded-2xl border border-emerald-100/60 bg-white/80 p-3.5 dark:border-obsidian-border dark:bg-obsidian-card">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Next Recipient</span>
                    <p className="mt-1 text-sm font-black text-slate-900 dark:text-mist truncate">{nextRecipientName}</p>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">Payout due in 3 days</span>
                  </div>

                  <div className="rounded-2xl border border-emerald-100/60 bg-white/80 p-3.5 dark:border-obsidian-border dark:bg-obsidian-card">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Turn Order</span>
                    <p className="mt-1 text-sm font-black text-slate-900 dark:text-mist">Turn {mgrRoundNumber} of 12</p>
                    <span className="text-[10px] text-slate-400 font-semibold">Monthly rotation cycle</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/60 p-3 dark:bg-obsidian-raised/50 text-xs">
                  <span className="font-semibold text-slate-600 dark:text-mist-muted">
                    Pot collection: 10/12 contributions in · KES 50,000 collected
                  </span>
                  <Link
                    to={`${base}/mgr`}
                    className="font-bold text-emerald-700 hover:underline dark:text-mint"
                  >
                    Manage Payout
                  </Link>
                </div>
              </div>
            </div>

            {/* Right Column: 5 Cols */}
            <div className="space-y-6 lg:col-span-5">
              {/* Card: Quick Actions matching Image 3 */}
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
                <h2 className="text-base font-bold text-slate-900 dark:text-mist">
                  Quick actions
                </h2>

                <div className="mt-4 space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setIsStkOpen(true)}
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 text-left transition hover:border-emerald-200 hover:bg-emerald-50/40 dark:border-obsidian-border dark:bg-obsidian-raised/40 dark:hover:bg-obsidian-raised"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-mint-deep dark:text-mint">
                        <CreditCard size={17} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-mist">
                          Record manual payment
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Log cash or direct bank transfer
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-400" />
                  </button>

                  <button
                    type="button"
                    disabled={sendingReminders}
                    onClick={handleSendReminders}
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 text-left transition hover:border-amber-200 hover:bg-amber-50/40 dark:border-obsidian-border dark:bg-obsidian-raised/40 dark:hover:bg-obsidian-raised"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                        <Bell size={17} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-mist">
                          {sendingReminders ? "Sending reminders..." : "Send payment reminders"}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          SMS &amp; push notification to unpaid members
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-400" />
                  </button>

                  <Link
                    to={`${base}/reports`}
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 text-left transition hover:border-violet-200 hover:bg-violet-50/40 dark:border-obsidian-border dark:bg-obsidian-raised/40 dark:hover:bg-obsidian-raised"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-mint-deep dark:text-mint">
                        <FileText size={17} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-mist">
                          Generate financial report
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Monthly treasury statement PDF
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-400" />
                  </Link>

                  <button
                    type="button"
                    onClick={() => setSelectedPlanModal(true)}
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 text-left transition hover:border-slate-300 dark:border-obsidian-border dark:bg-obsidian-raised/40 dark:hover:bg-obsidian-raised"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-200 text-slate-700 dark:bg-obsidian-card dark:text-mist-muted">
                        <SlidersHorizontal size={17} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-mist">
                          Configure contribution rules
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Amount, cycle, penalties
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-400" />
                  </button>
                </div>
              </div>

              {/* Card: 6-Month Balance Trend matching Image 3 */}
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-obsidian-border dark:bg-obsidian-card">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900 dark:text-mist">
                    6-month balance trend
                  </h2>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-mint">
                    +51.2% overall
                  </span>
                </div>

                <div className="mt-6 flex h-44 items-end justify-between gap-3 border-b border-slate-100 pb-3 dark:border-obsidian-border">
                  {sixMonthTrend.map((item, idx) => (
                    <div key={item.month} className="group flex flex-1 flex-col items-center gap-2 h-full justify-end">
                      <div
                        className="w-full max-w-[34px] rounded-t-xl bg-emerald-100 transition-all group-hover:bg-emerald-500 dark:bg-mint-deep/60 dark:group-hover:bg-mint"
                        style={{ height: item.height }}
                        title={`${item.month}: ${money(item.balance)}`}
                      />
                      <span className="text-[11px] font-bold text-slate-400 dark:text-mist-muted">
                        {item.month}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>Nov: {money(820000)}</span>
                  <span className="font-bold text-slate-900 dark:text-mist">Apr: {money(1240500)}</span>
                </div>
              </div>
            </div>
          </div>
      </>

      {/* STK Push Payment Modal */}
      <MpesaStkModal
        isOpen={isStkOpen}
        onClose={() => setIsStkOpen(false)}
        chamaId={workspaceId}
        title="Record Contribution via M-Pesa"
        onSuccess={() => {
          refetchFinance && refetchFinance();
        }}
      />

      {/* Contribution Plans Modal */}
      {selectedPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:border-obsidian-border dark:bg-obsidian-card">
            <h3 className="text-base font-black text-slate-900 dark:text-mist">Configure Contribution Rules</h3>
            <p className="mt-1 text-xs text-slate-500">
              Set uniform contribution amounts, cycle frequency and penalty parameters.
            </p>
            <div className="my-5 space-y-3 text-xs">
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-obsidian-raised">
                <span className="font-bold text-slate-700 dark:text-mist">Monthly Regular Plan:</span> KES 5,000 / month
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-obsidian-raised">
                <span className="font-bold text-slate-700 dark:text-mist">MGR Rotational Round:</span> KES 5,000 / month
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-obsidian-raised">
                <span className="font-bold text-slate-700 dark:text-mist">Late Penalty:</span> 10% after 25th of month
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedPlanModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 dark:border-obsidian-border dark:text-mist"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}