import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  CalendarDays,
  Clock,
  TrendingUp,
  UserCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
  Bell,
  Settings,
} from "lucide-react";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

export default function SchedulePage() {
  const { workspaceId } = useParams();
  const base = `/workspace/${workspaceId}`;

  const [toastNotice, setToastNotice] = useState(null);

  // Contribution schedule settings
  const scheduleConfig = {
    frequency: "Monthly",
    dayOfMonth: "5th",
    amountPerMember: 1000,
    nextDueDate: "Sep 5, 2026",
    autoReminderDays: 3,
  };

  // Payout Rotation schedule list
  const rotationList = [
    { round: 1, name: "John Doe", date: "Aug 28, 2026", amount: 20000, status: "next" },
    { round: 2, name: "Mary Smith", date: "Sep 28, 2026", amount: 20000, status: "scheduled" },
    { round: 3, name: "Peter Jones", date: "Oct 28, 2026", amount: 20000, status: "scheduled" },
    { round: 4, name: "Sarah Connor", date: "Nov 28, 2026", amount: 20000, status: "scheduled" },
    { round: 5, name: "Mercy Wambui", date: "Dec 28, 2026", amount: 20000, status: "scheduled" },
  ];

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
            <Zap size={15} /> Auto M-Pesa STK: 3 Days Before
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 text-xs">
          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md border border-white/10 space-y-1">
            <span className="text-violet-300 font-semibold">Contribution Frequency</span>
            <p className="text-base font-black text-white">Every {scheduleConfig.dayOfMonth} of Month</p>
            <p className="text-[11px] text-violet-200/80 font-mono">Amount: {money(scheduleConfig.amountPerMember)} / member</p>
          </div>

          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md border border-white/10 space-y-1">
            <span className="text-violet-300 font-semibold">Next Contribution Date</span>
            <p className="text-base font-black text-emerald-300 font-mono">{scheduleConfig.nextDueDate}</p>
            <p className="text-[11px] text-violet-200/80">STK push triggers automatically</p>
          </div>

          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md border border-white/10 space-y-1">
            <span className="text-violet-300 font-semibold">Automated Reminders</span>
            <p className="text-base font-black text-amber-300">{scheduleConfig.autoReminderDays} Days Before</p>
            <p className="text-[11px] text-violet-200/80">No manual admin messages needed</p>
          </div>
        </div>
      </div>

      {/* 2. Payout Rotation Timeline */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp size={20} className="text-emerald-600" /> Payout Rotation Sequence
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Transparent revolving order for member payouts</p>
          </div>

          <span className="text-xs font-bold text-violet-700 bg-violet-50 dark:bg-violet-950 dark:text-violet-300 px-3 py-1.5 rounded-full border border-violet-200 dark:border-violet-800">
            Current Order: John → Mary → Peter
          </span>
        </div>

        {/* Timeline Sequence List */}
        <div className="space-y-4">
          {rotationList.map((item, idx) => (
            <div
              key={item.round}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl p-4 transition-all ${
                item.status === "next"
                  ? "border-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 shadow-md"
                  : "border border-slate-200/80 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40"
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-mono font-bold text-xs ${
                    item.status === "next"
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                      : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  #{item.round}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black text-slate-900 dark:text-white">{item.name}</p>
                    {item.status === "next" && (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 uppercase tracking-wide">
                        Next Recipient
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">Scheduled Payout: {item.date}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 justify-between sm:justify-end">
                <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                  {money(item.amount)}
                </span>
                {item.status === "next" ? (
                  <span className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow">
                    <UserCheck size={14} /> Ready on {item.date}
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-slate-400 font-mono">Queued</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
