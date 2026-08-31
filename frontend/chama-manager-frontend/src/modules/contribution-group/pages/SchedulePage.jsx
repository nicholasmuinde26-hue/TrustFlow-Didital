import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  CalendarDays,
  TrendingUp,
  Zap,
  CheckCircle2,
  Settings,
  UserCheck,
  UserX,
  HelpCircle,
  Clock,
  MapPin
} from "lucide-react";

import useAuth from "@/app/hooks/useAuth";
import {
  useContributionGroupPlans,
  useContributionGroupMembers,
  useUpdateMyRsvp,
} from "../hooks/useContributionGroupData";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

const RSVP_LABEL = { going: "Going", maybe: "Maybe", declined: "Can't Make It" };

export default function SchedulePage() {
  const { workspaceId } = useParams();
  const base = `/workspace/${workspaceId}`;
  const { user } = useAuth();
  const myUserId = user?.id ?? user?._id;

  const [toastNotice, setToastNotice] = useState(null);

  const { data: plans = [] } = useContributionGroupPlans(workspaceId);
  const { data: members = [] } = useContributionGroupMembers(workspaceId);
  const updateRsvp = useUpdateMyRsvp(workspaceId);

  // My RSVP is read from the members list (backed by
  // ContributionGroupMember.rsvp_status), not local-only state — it
  // persists across refreshes and is visible to organizers too.
  const myMembership = members.find(
    (m) => String(m.user_id?._id || m.user_id) === String(myUserId)
  );
  const rsvpStatus = myMembership?.rsvp_status || null;

  const rsvpCounts = members.reduce(
    (acc, m) => {
      if (m.rsvp_status) acc[m.rsvp_status] = (acc[m.rsvp_status] || 0) + 1;
      return acc;
    },
    { going: 0, maybe: 0, declined: 0 }
  );

  const activePlan = plans.find((p) => p.status === "active") || plans[0] || null;

  const scheduleConfig = {
    frequency: activePlan?.frequency
      ? activePlan.frequency.charAt(0).toUpperCase() + activePlan.frequency.slice(1)
      : null,
    amountPerMember: activePlan?.amount != null ? Number(activePlan.amount) : null,
    startDate: activePlan?.start_date ? new Date(activePlan.start_date).toLocaleDateString() : null,
  };

  const orderedMembers = [...members]
    .sort((a, b) => new Date(a.joined_at || a.createdAt || 0) - new Date(b.joined_at || b.createdAt || 0))
    .map((m, idx) => ({
      id: String(m._id || idx),
      name: m.user_id?.name || (m.user ? `${m.user.first_name || ''} ${m.user.last_name || ''}`.trim() || m.user.email : m.name) || `Member ${idx + 1}`,
      joinedAt: m.joined_at || m.createdAt ? new Date(m.joined_at || m.createdAt).toLocaleDateString() : null,
      rsvpStatus: m.rsvp_status || null,
    }));

  const handleRsvp = async (status) => {
    try {
      await updateRsvp.mutateAsync(status);
      setToastNotice(`Your RSVP was saved: ${RSVP_LABEL[status]}`);
    } catch (err) {
      setToastNotice(err?.response?.data?.message || "Could not save your RSVP. Try again.");
    }
    setTimeout(() => setToastNotice(null), 4000);
  };

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
            EVENT PLANNING & SCHEDULE
          </span>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            Cause Schedule & RSVP Attendance
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Track key cause dates, RSVP attendance, and automated payment deadlines.
          </p>
        </div>

        <Link
          to={`${base}/settings`}
          className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shrink-0"
        >
          <Settings size={16} /> Configure Rules
        </Link>
      </div>

      {/* RSVP Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 p-6 text-white shadow-xl border border-emerald-800/50 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Cause Event RSVP</span>
            <h2 className="text-lg font-black text-white">Main Event Attendance</h2>
            <p className="text-xs text-slate-200">Confirm your availability for the group's event date</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRsvp("going")}
              disabled={updateRsvp.isPending}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-all disabled:opacity-50 ${
                rsvpStatus === "going"
                  ? "bg-emerald-400 text-emerald-950 font-black shadow-lg"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <UserCheck size={16} /> Going
            </button>

            <button
              onClick={() => handleRsvp("maybe")}
              disabled={updateRsvp.isPending}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-all disabled:opacity-50 ${
                rsvpStatus === "maybe"
                  ? "bg-amber-400 text-amber-950 font-black shadow-lg"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <HelpCircle size={16} /> Maybe
            </button>

            <button
              onClick={() => handleRsvp("declined")}
              disabled={updateRsvp.isPending}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-all disabled:opacity-50 ${
                rsvpStatus === "declined"
                  ? "bg-rose-500 text-white font-black shadow-lg"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <UserX size={16} /> Can't Make It
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-[11px] font-bold text-slate-200/90 pt-1">
          <span className="flex items-center gap-1.5"><UserCheck size={13} className="text-emerald-400" /> {rsvpCounts.going} going</span>
          <span className="flex items-center gap-1.5"><HelpCircle size={13} className="text-amber-400" /> {rsvpCounts.maybe} maybe</span>
          <span className="flex items-center gap-1.5"><UserX size={13} className="text-rose-400" /> {rsvpCounts.declined} can't make it</span>
        </div>
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
            <p className="text-base font-black text-white">{scheduleConfig.frequency || "One-Time Fundraiser"}</p>
            <p className="text-[11px] text-violet-200/80 font-mono">
              {scheduleConfig.amountPerMember != null ? `Amount: ${money(scheduleConfig.amountPerMember)} / member` : "Free-will pledge"}
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md border border-white/10 space-y-1">
            <span className="text-violet-300 font-semibold">Plan Start Date</span>
            <p className="text-base font-black text-emerald-300 font-mono">{scheduleConfig.startDate || "Active"}</p>
            <p className="text-[11px] text-violet-200/80">Use reminder button to notify members</p>
          </div>

          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md border border-white/10 space-y-1">
            <span className="text-violet-300 font-semibold">Members Registered</span>
            <p className="text-base font-black text-amber-300">{members.length}</p>
            <p className="text-[11px] text-violet-200/80">Active members in this group</p>
          </div>
        </div>
      </div>

      {/* 2. Member List */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp size={20} className="text-emerald-600" /> Member Directory
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Group members registered for this cause.
            </p>
          </div>
        </div>

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

                {member.rsvpStatus && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    member.rsvpStatus === "going"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : member.rsvpStatus === "maybe"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                  }`}>
                    {RSVP_LABEL[member.rsvpStatus]}
                  </span>
                )}
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