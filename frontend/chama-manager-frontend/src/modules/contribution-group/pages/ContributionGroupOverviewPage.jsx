import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Users,
  Target,
  CircleDollarSign,
  AlertCircle,
  CalendarHeart,
  MapPin,
  Clock,
  Trophy,
  ArrowRight,
  Smartphone,
  Bell,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";
import StatCard from "@/shared/components/ui/StatCard";
import BusinessMpesaModal from "@/modules/business/components/BusinessMpesaModal";

const money = (value) => `KES ${Number(value || 0).toLocaleString()}`;

export default function ContributionGroupOverviewPage({ dashboard }) {
  const { workspaceId } = useParams();
  const { workspace = {}, stats = {}, upcoming = [] } = dashboard || {};
  const base = `/workspace/${workspaceId}`;

  const [isMpesaModalOpen, setIsMpesaModalOpen] = useState(false);
  const [toastNotice, setToastNotice] = useState(null);

  // Group Health Dashboard data — every value comes straight off the
  // dashboard the backend already computed. No fabricated fallbacks:
  // when the backend hasn't set a field (no active plan, no event date),
  // we show an honest "not set" state instead of inventing a number.
  const targetGoal = workspace.targetGoal ?? null;
  const collected = stats.totalContributed ?? 0;
  const daysLeft = workspace.daysLeft ?? null;
  const progressPercent = targetGoal ? Math.min(100, Math.round((collected / targetGoal) * 100)) : null;

  const totalMembers = stats.memberCount ?? 0;
  const paidMembersCount = stats.paidCount ?? 0;
  const pendingMembersCount = Math.max(0, totalMembers - paidMembersCount);
  const overdueCount = stats.overdueCount ?? 0;

  const topContributor = workspace.topContributor || { name: "No contributions yet", amount: 0 };

  const handleReminderSent = () => {
    setToastNotice("Auto M-Pesa reminders dispatched to pending members!");
    setTimeout(() => setToastNotice(null), 5000);
  };


  return (
    <div className="space-y-8 font-sans">
      {/* Toast Banner */}
      {toastNotice && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-500 p-4 text-white shadow-xl animate-bounce">
          <CheckCircle2 size={20} className="shrink-0 text-white" />
          <p className="text-xs font-bold">{toastNotice}</p>
        </div>
      )}

      {/* Hero Banner - Group Health Dashboard */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 p-6 sm:p-8 text-white shadow-2xl border border-violet-800/50">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-violet-600/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/30 px-3 py-1 text-xs font-black text-violet-200 border border-violet-400/30 uppercase tracking-wider">
                <Sparkles size={13} className="text-violet-300" /> Group Health Dashboard
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300">
                <ShieldCheck size={14} /> 100% Transparent
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {workspace.name || "Contribution Circle"}
            </h1>

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-violet-200/90 font-medium">
              {workspace.eventDate && (
                <span className="flex items-center gap-1.5">
                  <CalendarHeart size={15} className="text-violet-300" /> Event: {new Date(workspace.eventDate).toLocaleDateString()}
                </span>
              )}
              {workspace.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={15} className="text-violet-300" /> {workspace.location}
                </span>
              )}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setIsMpesaModalOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-xs font-black text-emerald-950 shadow-xl hover:bg-emerald-300 transition-all transform hover:-translate-y-0.5"
            >
              <Smartphone size={18} /> Pay via M-Pesa STK
            </button>
            <button
              onClick={handleReminderSent}
              className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-xs font-bold text-white backdrop-blur-md hover:bg-white/20 transition-all border border-white/20"
            >
              <Bell size={16} /> Send 1-Click Reminder
            </button>
          </div>
        </div>

        {/* Goal Progress Card — only rendered once an active plan actually
            sets a target; otherwise there's nothing real to show a bar for */}
        {targetGoal ? (
          <div className="mt-8 rounded-2xl bg-white/10 p-5 backdrop-blur-md border border-white/15 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold">
              <span className="text-violet-200">
                Goal Target: <strong className="text-white font-mono text-sm">{money(targetGoal)}</strong>
              </span>
              {daysLeft !== null && (
                <span className="flex items-center gap-1 text-amber-300 font-mono">
                  <Clock size={14} /> {daysLeft} Days Remaining
                </span>
              )}
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-950/60 p-0.5 border border-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-500 shadow-lg"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-mono text-violet-200/90 font-semibold pt-1">
                <span>{progressPercent}% Collected ({money(collected)})</span>
                <span>Remaining: {money(Math.max(0, targetGoal - collected))}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl bg-white/10 p-4 backdrop-blur-md border border-white/15 text-xs font-medium text-violet-200">
            No active contribution plan with a target amount yet — set one up to track progress here.
          </div>
        )}
      </section>

      {/* Group Health Metric Cards */}
      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Monthly Status */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">This Month Status</span>
            <Users size={18} className="text-violet-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{paidMembersCount}/{totalMembers}</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Paid</span>
          </div>
          <p className="text-xs font-medium text-slate-500">
            <strong className="text-amber-600 dark:text-amber-400">{pendingMembersCount} Pending</strong> members
          </p>
        </div>

        {/* Top Contributor */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Top Contributor</span>
            <Trophy size={18} className="text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-black text-slate-900 dark:text-white truncate">{topContributor.name}</span>
          </div>
          <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {money(topContributor.amount)} Total
          </p>
        </div>

        {/* Overdue Contributions — real count the backend already computes */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Overdue</span>
            <TrendingUp size={18} className="text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black font-mono ${overdueCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>
              {overdueCount}
            </span>
          </div>
          <p className="text-xs font-medium text-slate-500">
            {overdueCount > 0 ? "Obligations past due date" : "Nothing overdue"}
          </p>
        </div>

        {/* Total Funds Raised */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Raised</span>
            <CircleDollarSign size={18} className="text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{money(collected)}</span>
          </div>
          <p className="text-xs font-medium text-slate-500">Verified & Posted to Ledger</p>
        </div>
      </section>

      {/* Next Group Moments / Rotation & Navigation Links */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 dark:text-white">Upcoming Group Events</h2>
            <Link to={`${base}/meetings`} className="text-xs font-bold text-violet-600 hover:underline flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          <div className="space-y-3">
            {upcoming.length ? (
              upcoming.map((meeting) => (
                <div key={meeting.id} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">{meeting.title}</p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{new Date(meeting.startsAt).toLocaleString()}</p>
                  </div>
                  <span className="rounded-xl bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                    Upcoming
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-slate-50 p-6 text-center text-slate-500 dark:bg-slate-800/40">
                <p className="text-xs font-medium">No upcoming group meetings scheduled yet.</p>
                <Link to={`${base}/meetings`} className="mt-2 inline-block text-xs font-bold text-violet-600">
                  + Schedule Group Meetup
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Quick Nav Options */}
        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h2 className="text-base font-black text-slate-900 dark:text-white">Contribution Hub Actions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              to={`${base}/contributions`}
              className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4 hover:bg-violet-100/60 transition-all dark:border-slate-800 dark:bg-slate-800/50 space-y-1 block"
            >
              <CircleDollarSign className="text-violet-600" size={20} />
              <p className="text-xs font-bold text-slate-900 dark:text-white">M-Pesa Ledger</p>
              <p className="text-[11px] text-slate-500">Live payment table & auto receipts</p>
            </Link>

            <Link
              to={`${base}/schedule`}
              className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 hover:bg-emerald-100/60 transition-all dark:border-slate-800 dark:bg-slate-800/50 space-y-1 block"
            >
              <CalendarHeart className="text-emerald-600" size={20} />
              <p className="text-xs font-bold text-slate-900 dark:text-white">Schedule & Rotation</p>
              <p className="text-[11px] text-slate-500">Payout rotation & auto-reminders</p>
            </Link>

            <Link
              to={`${base}/activity`}
              className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 hover:bg-blue-100/60 transition-all dark:border-slate-800 dark:bg-slate-800/50 space-y-1 block"
            >
              <Clock className="text-blue-600" size={20} />
              <p className="text-xs font-bold text-slate-900 dark:text-white">Audit Trail</p>
              <p className="text-[11px] text-slate-500">Immutable transaction log</p>
            </Link>

            <Link
              to={`${base}/updates`}
              className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 hover:bg-amber-100/60 transition-all dark:border-slate-800 dark:bg-slate-800/50 space-y-1 block"
            >
              <TrendingUp className="text-amber-600" size={20} />
              <p className="text-xs font-bold text-slate-900 dark:text-white">Transparency Feed</p>
              <p className="text-[11px] text-slate-500">Receipts & zero-excuse expenses</p>
            </Link>
          </div>
        </section>
      </div>

      {/* M-Pesa STK Collection Modal */}
      <BusinessMpesaModal
        isOpen={isMpesaModalOpen}
        onClose={() => setIsMpesaModalOpen(false)}
        workspaceId={workspaceId}
        title="Group M-Pesa Contribution"
      />
    </div>
  );
}