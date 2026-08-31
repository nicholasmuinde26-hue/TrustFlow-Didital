import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import useAuth from "@/app/hooks/useAuth";
import {
  Sparkles,
  Users,
  Target,
  Clock,
  CalendarHeart,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  ArrowRight,
  HeartHandshake
} from "lucide-react";
import contributionGroupApi from "../api/contributionGroup.api";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

const EVENT_THEMES = {
  wedding: {
    title: "Wedding Fundraiser",
    bg: "from-amber-900 via-rose-950 to-slate-900",
    badge: "bg-amber-500/20 text-amber-200 border-amber-400/30",
    accent: "text-amber-400"
  },
  funeral: {
    title: "Bereavement & Funeral Fund",
    bg: "from-slate-900 via-stone-900 to-zinc-950",
    badge: "bg-rose-500/20 text-rose-200 border-rose-400/30",
    accent: "text-rose-400"
  },
  graduation: {
    title: "Graduation Celebration",
    bg: "from-blue-900 via-indigo-950 to-slate-900",
    badge: "bg-blue-500/20 text-blue-200 border-blue-400/30",
    accent: "text-blue-400"
  },
  birthday: {
    title: "Birthday Fundraiser",
    bg: "from-purple-900 via-fuchsia-950 to-slate-900",
    badge: "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/30",
    accent: "text-fuchsia-400"
  },
  medical_emergency: {
    title: "Medical Emergency Fund",
    bg: "from-emerald-900 via-teal-950 to-slate-900",
    badge: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
    accent: "text-emerald-400"
  },
  fundraiser: {
    title: "Community Fundraiser",
    bg: "from-teal-900 via-emerald-950 to-slate-900",
    badge: "bg-teal-500/20 text-teal-200 border-teal-400/30",
    accent: "text-teal-400"
  },
  default: {
    title: "Cause Contribution Group",
    bg: "from-violet-900 via-indigo-900 to-slate-900",
    badge: "bg-violet-500/20 text-violet-200 border-violet-400/30",
    accent: "text-violet-300"
  }
};

export default function PublicCausePreviewPage() {
  const { joinCode } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const [pledgeAmount, setPledgeAmount] = useState("");
  const [joining, setJoining] = useState(false);
  const autoContinuedRef = useRef(false);

  useEffect(() => {
    async function fetchPreview() {
      try {
        setLoading(true);
        const res = await contributionGroupApi.getPublicPreview(joinCode);
        setData(res.data?.data || res.data);
      } catch (err) {
        setError(err?.response?.data?.message || err.message || "Failed to load public preview");
      } finally {
        setLoading(false);
      }
    }
    if (joinCode) fetchPreview();
  }, [joinCode]);

  // Does the actual join+pledge call. Shared by the manual "Join" submit
  // and the auto-continue effect below, so both paths behave identically.
  const performJoin = async (amountValue) => {
    setJoining(true);
    setError("");
    try {
      const res = await contributionGroupApi.joinViaCode(joinCode, {
        pledged_amount: amountValue ? Number(amountValue) : 0
      });
      sessionStorage.removeItem("pending_join_code");
      sessionStorage.removeItem("pending_pledge_amount");
      const groupObj = res.data?.data?.group || res.data?.group;
      const groupId = groupObj?._id || groupObj?.id;
      navigate(groupId ? `/workspace/${groupId}` : "/dashboard");
    } catch (err) {
      if (err?.response?.status === 401) {
        // Not logged in — stash the join code + typed pledge and send them
        // to login/register. The auto-continue effect below picks this
        // back up the moment they're authenticated, so a new supporter
        // who followed a shared link doesn't lose their pledge.
        sessionStorage.setItem("pending_join_code", joinCode);
        sessionStorage.setItem("pending_pledge_amount", amountValue || "");
        navigate("/auth/login", { state: { from: { pathname: `/g/${joinCode}` } } });
      } else {
        setError(err?.response?.data?.message || err.message || "Could not join group");
      }
    } finally {
      setJoining(false);
    }
  };

  const handleJoin = (e) => {
    e.preventDefault();
    performJoin(pledgeAmount);
  };

  // Auto-continue after login/register: if this browser has a pending
  // join for THIS exact code and the user is now authenticated, finish
  // the join automatically instead of dropping them on the dashboard.
  useEffect(() => {
    if (authLoading || autoContinuedRef.current || !user) return;
    const pendingCode = sessionStorage.getItem("pending_join_code");
    if (pendingCode && pendingCode === joinCode) {
      autoContinuedRef.current = true;
      const pendingAmount = sessionStorage.getItem("pending_pledge_amount") || "";
      setPledgeAmount(pendingAmount);
      performJoin(pendingAmount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, joinCode]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white font-sans">
        <Loader2 className="animate-spin text-emerald-400" size={32} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-white font-sans text-center">
        <div className="rounded-3xl border border-rose-800/50 bg-rose-950/30 p-8 max-w-md space-y-4">
          <h2 className="text-xl font-black text-rose-300">Cause Not Found</h2>
          <p className="text-xs text-slate-400">{error || "Invalid or expired join link."}</p>
          <Link to="/" className="inline-block rounded-xl bg-white/10 px-5 py-2.5 text-xs font-bold text-white hover:bg-white/20">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const { group = {}, totals = {}, memberCount = 0 } = data;
  const theme = EVENT_THEMES[group.type] || EVENT_THEMES.default;
  const target = totals.target || 0;
  const collected = totals.collected || 0;
  const pledged = totals.pledged || 0;
  const progress = target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 sm:p-8 flex items-center justify-center">
      <div className="w-full max-w-2xl space-y-6">
        {/* Cause Hero Card */}
        <section className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${theme.bg} p-6 sm:p-8 text-white shadow-2xl border border-white/10`}>
          <div className="absolute right-0 top-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-black uppercase tracking-wider border ${theme.badge}`}>
                <Sparkles size={13} /> {theme.title}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300">
                <ShieldCheck size={14} /> M-Pesa Verified Ledger
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              {group.name}
            </h1>

            {group.description && (
              <p className="text-xs sm:text-sm text-slate-200/90 leading-relaxed max-w-xl">
                {group.description}
              </p>
            )}

            {/* Beneficiary & Organizer metadata */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-300 pt-2 border-t border-white/10">
              {group.organizer && (
                <span>
                  Organized by: <strong className="text-white">{group.organizer.name}</strong>
                </span>
              )}
              {group.beneficiary && (
                <span>
                  Beneficiary: <strong className="text-white">{group.beneficiary}</strong>
                </span>
              )}
              {group.event_date && (
                <span className="flex items-center gap-1">
                  <CalendarHeart size={14} className={theme.accent} /> Event: {new Date(group.event_date).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Progress Card */}
        {target > 0 && (
          <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-400 uppercase tracking-wider">Financial Progress</span>
              <span className="font-mono text-emerald-400">{progress}% Target Reached</span>
            </div>

            <div className="space-y-2">
              <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-950 p-0.5 border border-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-500 shadow-lg"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="grid grid-cols-3 text-center gap-2 pt-2">
                <div className="rounded-2xl bg-slate-950 p-3 border border-slate-800">
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Target</span>
                  <span className="font-mono text-xs sm:text-sm font-black text-white">{money(target)}</span>
                </div>
                <div className="rounded-2xl bg-slate-950 p-3 border border-slate-800">
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Pledged</span>
                  <span className="font-mono text-xs sm:text-sm font-black text-amber-300">{money(pledged)}</span>
                </div>
                <div className="rounded-2xl bg-slate-950 p-3 border border-slate-800">
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Collected</span>
                  <span className="font-mono text-xs sm:text-sm font-black text-emerald-400">{money(collected)}</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Pledge & Join Card */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <HeartHandshake className="text-emerald-400" size={20} />
            <h2 className="text-base font-black text-white">Join & Support Cause</h2>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">Pledge Amount (KES) — Optional on Join</label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-xs font-bold text-slate-500">KES</span>
                <input
                  type="number"
                  min="0"
                  value={pledgeAmount}
                  onChange={(e) => setPledgeAmount(e.target.value)}
                  placeholder="e.g. 5,000"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-3 pl-12 pr-4 text-sm font-bold text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={joining}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-sm font-black text-slate-950 shadow-xl hover:bg-emerald-400 transition-all transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              {joining ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  Join Group & Submit Pledge <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="text-[11px] text-center text-slate-500 font-medium">
            Join link code: <span className="font-mono text-slate-400">{group.join_code}</span> • {memberCount} active members in group
          </p>
        </section>
      </div>
    </div>
  );
}
