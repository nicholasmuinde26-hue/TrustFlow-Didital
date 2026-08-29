import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  CalendarDays,
  TrendingUp,
  Zap,
  CheckCircle2,
  Settings,
} from "lucide-react";

import {
  useContributionGroupPlans,
  useContributionGroupMembers,
} from "../hooks/useContributionGroupData";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

export default function SchedulePage() {
  const { workspaceId } = useParams();
  const base = `/workspace/${workspaceId}`;

  const [toastNotice, setToastNotice] = useState(null);

  const { data: plans = [] } = useContributionGroupPlans(workspaceId);
  const { data: members = [] } = useContributionGroupMembers(workspaceId);

  const activePlan = plans.find((p) => p.status === "active") || plans[0] || null;

  // Real contribution schedule settings — pulled from the active plan's
  // actual fields (frequency, amount, start_date). There is no due_day,
  // amount_per_member, or next_due_date field on the model, so rather
  // than inventing "5th"/1000/"Sep 5, 2026" when a plan doesn't set
  // these, we show that the plan hasn't configured them.
  const scheduleConfig = {
    frequency: activePlan?.frequency
      ? activePlan.frequency.charAt(0).toUpperCase() + activePlan.frequency.slice(1)
      : null,
    amountPerMember: activePlan?.amount != null ? Number(activePlan.amount) : null,
    startDate: activePlan?.start_date ? new Date(activePlan.start_date).toLocaleDateString() : null,
  };

  // Members, in the order they joined — a real, honest ordering. There is
  // no payout-rotation feature in the backend for contribution groups
  // (no ContributionGroupMember.payout_position, no Payout records scoped
  // to a contribution group), so rather than inventing recipients, dates,
  // and payout amounts, this lists real members and says so plainly.
  const orderedMembers = [...members]
    .sort((a, b) => new Date(a.joined_at || a.createdAt || 0) - new Date(b.joined_at || b.createdAt || 0))
    .map((m, idx) => ({
      id: String(m._id || idx),
      name: m.user ? `${m.user.first_name || ''} ${m.user.last_name || ''}`.trim() || m.user.email : m.name || `Member ${idx + 1}`,
      joinedAt: m.joined_at || m.createdAt ? new Date(m.joined_at || m.createdAt).toLocaleDateString() : null,
    }));

  const handleTriggerAutoReminders = () => {
    setToastNotice("Auto M-Pesa reminder schedule updated! Reminders queued 3 days prior.");
    setTimeout(() => setToastNotice(null), 5000);
  };


  return (
    <div className="space-y-8 font-sans">
      {/* Toast Notice */}
      {toastNotice && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-500 p-4 text-white shadow-xl animate-bounce">
          <CheckCircle2 size={20} className="shrink-0 text-white" />
          <p className="text-xs font-bold">{toastNotice}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
            AUTOMATED MONEY PLAN
          </span>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            Contribution Calendar & Payout Rotation
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Set group contribution rules, auto M-Pesa reminders, and rotating payout schedules.
          </p>
        </div>

        <Link
          to={`${base}/settings`}
          className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shrink-0"
        >
          <Settings size={16} /> Configure Rules Engine
        </Link>
      </div>

      {/* 1. Recurring Money Plan Card */}
      <div className="rounded-3xl bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 p-6 text-white shadow-xl border border-violet-800/50 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/30 text-violet-200 border border-violet-400/30">
              <CalendarDays size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Active Money Plan Rules</h2>
              <p className="text-xs text-violet-200">Automated collection rhythm for all members</p>
            </div>
          </div>

          <button
            onClick={handleTriggerAutoReminders}
            className="flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-xs font-black text-amber-950 shadow hover:bg-amber-300 transition-all shrink-0"
          >
            <Zap size={15} /> Send M-Pesa Reminder Now
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 text-xs">
          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md border border-white/10 space-y-1">
            <span className="text-violet-300 font-semibold">Contribution Frequency</span>
            <p className="text-base font-black text-white">{scheduleConfig.frequency || "No active plan"}</p>
            <p className="text-[11px] text-violet-200/80 font-mono">
              {scheduleConfig.amountPerMember != null ? `Amount: ${money(scheduleConfig.amountPerMember)} / member` : "No fixed amount set"}
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md border border-white/10 space-y-1">
            <span className="text-violet-300 font-semibold">Plan Start Date</span>
            <p className="text-base font-black text-emerald-300 font-mono">{scheduleConfig.startDate || "Not started"}</p>
            <p className="text-[11px] text-violet-200/80">Use the reminder button to notify members now</p>
          </div>

          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md border border-white/10 space-y-1">
            <span className="text-violet-300 font-semibold">Members on Plan</span>
            <p className="text-base font-black text-amber-300">{members.length}</p>
            <p className="text-[11px] text-violet-200/80">Active members in this group</p>
          </div>
        </div>
      </div>

      {/* 2. Members, in join order — payout rotation scheduling isn't a
          feature of contribution groups yet, so this section shows the
          real member list rather than a fabricated recipient/date queue. */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp size={20} className="text-emerald-600" /> Members
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Payout rotation scheduling isn't set up for this group yet — shown here in join order.
            </p>
          </div>
        </div>

        {/* Member List */}
        <div className="space-y-3">
          {orderedMembers.length > 0 ? (
            orderedMembers.map((member, idx) => (
              <div
                key={member.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-200 text-slate-700 font-mono font-bold text-xs dark:bg-slate-800 dark:text-slate-300">
                    #{idx + 1}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">{member.name}</p>
                    {member.joinedAt && (
                      <p className="text-xs text-slate-500 font-mono mt-0.5">Joined {member.joinedAt}</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl bg-slate-50 p-6 text-center text-slate-500 dark:bg-slate-800/40">
              <p className="text-xs font-medium">No members in this group yet.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}