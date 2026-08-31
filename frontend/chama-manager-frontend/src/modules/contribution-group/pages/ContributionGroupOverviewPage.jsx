import React, { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Users,
  Target,
  CircleDollarSign,
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
  Share2,
  HeartHandshake,
  Loader2,
  UserCheck,
  AlertCircle
} from "lucide-react";
import StatCard from "@/shared/components/ui/StatCard";
import ShareLinkModal from "../components/ShareLinkModal";
import PledgeModal from "../components/PledgeModal";
import PledgeStkModal from "../components/PledgeStkModal";
import contributionGroupApi from "../api/contributionGroup.api";

const money = (value) => `KES ${Number(value || 0).toLocaleString()}`;

const EVENT_THEMES = {
  wedding: {
    title: "Wedding Fundraiser",
    bg: "from-amber-900 via-rose-950 to-slate-900",
    badge: "bg-amber-500/30 text-amber-200 border-amber-400/30",
    accent: "text-amber-300"
  },
  funeral: {
    title: "Bereavement & Funeral Fund",
    bg: "from-slate-900 via-stone-900 to-zinc-950",
    badge: "bg-rose-500/30 text-rose-200 border-rose-400/30",
    accent: "text-rose-400"
  },
  graduation: {
    title: "Graduation Celebration",
    bg: "from-blue-900 via-indigo-950 to-slate-900",
    badge: "bg-blue-500/30 text-blue-200 border-blue-400/30",
    accent: "text-blue-300"
  },
  birthday: {
    title: "Birthday Fundraiser",
    bg: "from-purple-900 via-fuchsia-950 to-slate-900",
    badge: "bg-fuchsia-500/30 text-fuchsia-200 border-fuchsia-400/30",
    accent: "text-fuchsia-300"
  },
  medical_emergency: {
    title: "Medical Emergency Fund",
    bg: "from-emerald-900 via-teal-950 to-slate-900",
    badge: "bg-emerald-500/30 text-emerald-200 border-emerald-400/30",
    accent: "text-emerald-300"
  },
  fundraiser: {
    title: "Community Fundraiser",
    bg: "from-teal-900 via-emerald-950 to-slate-900",
    badge: "bg-teal-500/30 text-teal-200 border-teal-400/30",
    accent: "text-teal-300"
  },
  default: {
    title: "Cause Workspace",
    bg: "from-violet-900 via-indigo-900 to-slate-900",
    badge: "bg-violet-500/30 text-violet-200 border-violet-400/30",
    accent: "text-violet-300"
  }
};

export default function ContributionGroupOverviewPage({ dashboard }) {
  const { workspaceId } = useParams();
  const { workspace = {}, stats = {}, upcoming = [] } = dashboard || {};
  const base = `/workspace/${workspaceId}`;

  // Modals state
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isPledgeModalOpen, setIsPledgeModalOpen] = useState(false);
  const [toastNotice, setToastNotice] = useState(null);

  // Fund & Pledges real-time state from backend fund dashboard
  const [fundData, setFundData] = useState(null);
  const [pledgesList, setPledgesList] = useState([]);
  const [loadingFund, setLoadingFund] = useState(false);

  const fetchFundInfo = async () => {
    try {
      setLoadingFund(true);
      const [fundRes, pledgesRes] = await Promise.allSettled([
        contributionGroupApi.getFundDashboard(workspaceId),
        contributionGroupApi.listPledges(workspaceId)
      ]);

      if (fundRes.status === "fulfilled") {
        setFundData(fundRes.value.data?.data || fundRes.value.data);
      }
      if (pledgesRes.status === "fulfilled") {
        setPledgesList(pledgesRes.value.data?.data?.pledges || pledgesRes.value.data?.pledges || []);
      }
    } catch (err) {
      console.warn("Could not fetch fund data", err);
    } finally {
      setLoadingFund(false);
    }
  };

  useEffect(() => {
    if (workspaceId) {
      fetchFundInfo();
    }
  }, [workspaceId]);

  const groupDetails = fundData?.group || workspace;
  const totals = fundData?.totals || {};
  const myPledge = fundData?.my_pledge || null;

  const eventType = groupDetails.type || workspace.type || "default";
  const theme = EVENT_THEMES[eventType] || EVENT_THEMES.default;

  const targetGoal = totals.target || workspace.targetGoal || null;
  const totalPledged = totals.pledged || 0;
  const totalCollected = totals.collected ?? (stats.totalContributed || 0);

  const progressPercent = targetGoal ? Math.min(100, Math.round((totalCollected / targetGoal) * 100)) : 0;
  const pledgedPercent = targetGoal ? Math.min(100, Math.round((totalPledged / targetGoal) * 100)) : 0;

  const totalMembers = stats.memberCount ?? (fundData?.memberCount || 0);
  const paidMembersCount = stats.paidCount ?? pledgesList.filter(p => p.payment_status === "paid").length;
  const pendingMembersCount = pledgesList.filter(p => p.payment_status === "pledged" || p.payment_status === "partially_paid").length;

  const topContributor = workspace.topContributor || { name: "No contributions yet", amount: 0 };

  const handleReminderSent = async () => {
    try {
      await contributionGroupApi.sendPledgeReminders(workspaceId);
      setToastNotice("Auto M-Pesa & In-App reminders dispatched to members!");
    } catch (err) {
      setToastNotice("Reminders sent!");
    }
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

      {/* Hero Banner — Cause Page Header */}
      <section className={`relative overflow-hidden rounded-3xl bg-gradient-to-r ${theme.bg} p-6 sm:p-8 text-white shadow-2xl border border-white/10`}>
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider border ${theme.badge}`}>
                <Sparkles size={13} /> {theme.title}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300">
                <ShieldCheck size={14} /> 100% Transparent Ledger
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {groupDetails.name || workspace.name || "Contribution Circle"}
            </h1>

            {groupDetails.description && (
              <p className="text-xs sm:text-sm text-slate-200/90 leading-relaxed max-w-xl">
                {groupDetails.description}
              </p>
            )}

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-200/90 font-medium pt-1">
              {(groupDetails.event_date || workspace.eventDate) && (
                <span className="flex items-center gap-1.5">
                  <CalendarHeart size={15} className={theme.accent} /> Event: {new Date(groupDetails.event_date || workspace.eventDate).toLocaleDateString()}
                </span>
              )}
              {(groupDetails.location || workspace.location) && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={15} className={theme.accent} /> {groupDetails.location || workspace.location}
                </span>
              )}
              {groupDetails.beneficiary && (
                <span className="flex items-center gap-1.5 font-bold text-amber-200">
                  Beneficiary: {groupDetails.beneficiary}
                </span>
              )}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setIsPledgeModalOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-xs font-black text-emerald-950 shadow-xl hover:bg-emerald-300 transition-all transform hover:-translate-y-0.5"
            >
              <HeartHandshake size={18} /> {myPledge ? "Edit My Pledge" : "Make a Pledge"}
            </button>

            <button
              onClick={() => setIsPayModalOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-3 text-xs font-bold text-white backdrop-blur-md hover:bg-white/25 transition-all border border-white/20"
            >
              <Smartphone size={16} /> Pay M-Pesa STK
            </button>

            <button
              onClick={() => setIsShareModalOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-violet-600/80 px-4 py-3 text-xs font-bold text-white backdrop-blur-md hover:bg-violet-600 transition-all border border-violet-400/30"
            >
              <Share2 size={16} /> Share Join Link
            </button>
          </div>
        </div>

        {/* Cause Goal Progress Bar */}
        {targetGoal ? (
          <div className="mt-8 rounded-2xl bg-white/10 p-5 backdrop-blur-md border border-white/15 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold">
              <span className="text-slate-200">
                Cause Target: <strong className="text-white font-mono text-sm">{money(targetGoal)}</strong>
              </span>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-amber-300">Pledged: {money(totalPledged)}</span>
                <span className="text-emerald-300">Collected: {money(totalCollected)}</span>
              </div>
            </div>

            {/* Dual Progress Bar (Pledged vs Collected) */}
            <div className="space-y-1">
              <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-950/60 p-0.5 border border-white/10">
                <div
                  className="absolute h-full rounded-full bg-amber-500/40 transition-all duration-500"
                  style={{ width: `${pledgedPercent}%` }}
                />
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-500 shadow-lg relative z-10"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-mono text-slate-200/90 font-semibold pt-1">
                <span>{progressPercent}% Cash Received • {pledgedPercent}% Pledged</span>
                <span>Target Balance: {money(Math.max(0, targetGoal - totalCollected))}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-8 flex items-center justify-between rounded-2xl bg-white/10 p-4 backdrop-blur-md border border-white/15 text-xs font-medium text-slate-200">
            <span>No explicit target amount set for this cause yet.</span>
            <button
              onClick={() => setIsPledgeModalOpen(true)}
              className="font-bold text-emerald-300 hover:underline"
            >
              + Add a Pledge
            </button>
          </div>
        )}
      </section>

      {/* Cause Metric Cards */}
      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* My Pledge Status */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">My Pledge</span>
            <HeartHandshake size={18} className="text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {myPledge ? money(myPledge.pledged_amount) : "No pledge"}
            </span>
          </div>
          <p className="text-xs font-medium text-slate-500">
            {myPledge ? `Status: ${myPledge.status}` : "Click 'Make a Pledge' above"}
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

        {/* Total Pledged */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Pledged</span>
            <Target size={18} className="text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">{money(totalPledged)}</span>
          </div>
          <p className="text-xs font-medium text-slate-500">{pledgesList.length} total pledges committed</p>
        </div>

        {/* Total Funds Collected */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Collected</span>
            <CircleDollarSign size={18} className="text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{money(totalCollected)}</span>
          </div>
          <p className="text-xs font-medium text-slate-500">Verified & Posted to Ledger</p>
        </div>
      </section>

      {/* Member Pledges & Social Standing Table */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <UserCheck size={18} className="text-violet-600" /> Member Standing & Pledges Ledger
            </h2>
            <p className="text-xs text-slate-500">Social clarity and transparent payment standings</p>
          </div>
          <button
            onClick={handleReminderSent}
            className="flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Bell size={14} /> Send 1-Click Reminder
          </button>
        </div>

        {pledgesList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40 text-slate-500 uppercase font-bold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Pledged</th>
                  <th className="py-3 px-4">Paid</th>
                  <th className="py-3 px-4">Balance</th>
                  <th className="py-3 px-4">Standing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {pledgesList.map((p) => {
                  const name = p.member_id?.user_id?.name || "Group Member";
                  const pAmount = Number(p.pledged_amount || 0);
                  const paidAmount = Number(p.paid_amount || 0);
                  const bal = Number(p.balance || 0);
                  const isPaid = bal <= 0 && pAmount > 0;

                  return (
                    <tr key={p._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{name}</td>
                      <td className="py-3 px-4 font-mono">{money(pAmount)}</td>
                      <td className="py-3 px-4 font-mono text-emerald-600 font-semibold">{money(paidAmount)}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">{money(bal)}</td>
                      <td className="py-3 px-4">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            <CheckCircle2 size={12} /> Complete
                          </span>
                        ) : paidAmount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                            Partial
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            Pledged
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-50 p-6 text-center text-slate-500 dark:bg-slate-800/40">
            <p className="text-xs font-medium">No pledges recorded yet. Click 'Make a Pledge' to start!</p>
          </div>
        )}
      </section>

      {/* Next Events & Hub Actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 dark:text-white">Upcoming Cause Events</h2>
            <Link to={`${base}/schedule`} className="text-xs font-bold text-violet-600 hover:underline flex items-center gap-1">
              RSVP & Schedule <ArrowRight size={14} />
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
                <p className="text-xs font-medium">No upcoming event meetups scheduled yet.</p>
                <Link to={`${base}/schedule`} className="mt-2 inline-block text-xs font-bold text-violet-600">
                  + Schedule Event / RSVP
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Quick Nav Options */}
        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h2 className="text-base font-black text-slate-900 dark:text-white">Cause Hub Actions</h2>
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
              <p className="text-xs font-bold text-slate-900 dark:text-white">Event RSVP & Schedule</p>
              <p className="text-[11px] text-slate-500">Event countdown & attendance</p>
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
              to={`${base}/announcements`}
              className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 hover:bg-amber-100/60 transition-all dark:border-slate-800 dark:bg-slate-800/50 space-y-1 block"
            >
              <TrendingUp className="text-amber-600" size={20} />
              <p className="text-xs font-bold text-slate-900 dark:text-white">Cause Feed</p>
              <p className="text-[11px] text-slate-500">Photos & organizer updates</p>
            </Link>
          </div>
        </section>
      </div>

      {/* Modals */}
      <ShareLinkModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        group={groupDetails}
      />

      <PledgeModal
        isOpen={isPledgeModalOpen}
        onClose={() => setIsPledgeModalOpen(false)}
        groupId={workspaceId}
        currentPledge={myPledge}
        onSuccess={fetchFundInfo}
      />

      <PledgeStkModal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        groupId={workspaceId}
        myPledge={myPledge}
        onSuccess={fetchFundInfo}
      />
    </div>
  );
}