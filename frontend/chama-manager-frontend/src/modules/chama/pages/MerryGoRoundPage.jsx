import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Plus,
  Users,
  Settings,
  ChevronRight,
} from "lucide-react";
import useWorkspace from "@/app/hooks/useWorkspace";
import chamaApi from "../api/chama.api";

const money = (val) => `KES ${Number(val || 0).toLocaleString()}`;

export default function MerryGoRoundPage() {
  const { workspaceId: routeWorkspaceId } = useParams();
  const workspace = useWorkspace();
  const chamaId = routeWorkspaceId || workspace.workspaceId;

  const [overview, setOverview] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = async () => {
    try {
      const { data } = await chamaApi.getMgr(chamaId);
      setOverview(data.data);
    } catch {
      /* Graceful fallback */
    }
  };

  useEffect(() => {
    if (chamaId) load();
  }, [chamaId]);

  // Dynamic values directly from backend overview
  const mgrPlanAmount = Number(overview?.plan?.amount?.$numberDecimal || overview?.plan?.amount || 0);
  const memberList = overview?.members || [];
  const obligationList = overview?.obligations || [];
  const paidObligations = obligationList.filter(o => o.obligation?.status === "paid");

  const totalMembers = memberList.length;
  const expectedPool = mgrPlanAmount * totalMembers;
  const totalCollected = paidObligations.length * mgrPlanAmount;
  const totalOutstanding = Math.max(0, expectedPool - totalCollected);
  const collectionPct = expectedPool > 0 ? Math.round((totalCollected / expectedPool) * 100) : 0;

  // Active recipient from backend
  const currentRecipient = overview?.currentRecipient || memberList[0];
  const recipientName = currentRecipient?.user_id?.name || currentRecipient?.name || "No Recipient Assigned";

  // Timeline strictly built from backend membership and obligation states
  const timelineItems = memberList.map((m, idx) => {
    const ob = obligationList.find(o => String(o.member_id) === String(m._id));
    const isPaid = ob?.obligation?.status === "paid";
    const isCurrent = !isPaid && idx === 0;
    return {
      num: String(idx + 1).padStart(2, "0"),
      name: m.user_id?.name || m.name || `Member ${idx + 1}`,
      isPaid,
      isCurrent,
    };
  });

  const currentDateStr = new Date().toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Merry-Go-Round (MGR)
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Manage rotations, rounds and payouts
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={() => setNotice({ text: "Create Round settings updated." })} className="flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-amber-600 transition">
            <Plus size={16} /> Create Round
          </button>
          <button className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition">
            <Users size={16} className="text-slate-400" /> Manage Members
          </button>
          <button className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition">
            <Settings size={16} className="text-slate-400" /> Configure Rules
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-2xl bg-amber-50 p-4 border border-amber-200 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {notice.text}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Box: Highlighted Current Round Box */}
        <div className="lg:col-span-5 rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50/50 via-white to-amber-50/30 p-6 shadow-xs dark:border-amber-900/50 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              CURRENT ROUND
            </span>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white mt-1">
              {overview?.round ? `Round #${overview.round.number || '1'}` : 'Round Rotation'}
            </h2>

            <div className="mt-6 space-y-3.5 text-xs font-semibold">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Contribution</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">{money(mgrPlanAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Members</span>
                <span className="font-bold text-slate-900 dark:text-white">{totalMembers}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Expected Pool</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">{money(expectedPool)}</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-amber-100 dark:border-slate-800 space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-600 dark:text-slate-400">Collection Progress</span>
                <span className="text-amber-600 font-mono">{collectionPct}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-amber-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${collectionPct}%` }} />
              </div>
              <p className="text-[11px] font-medium text-slate-400">
                {money(totalCollected)} of {money(expectedPool)}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-7 grid gap-6 sm:grid-cols-2">
          {/* Current Recipient Card */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col items-center text-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Current Recipient
            </span>

            <div className="my-3 flex flex-col items-center">
              <div className="h-20 w-20 rounded-full bg-amber-100 border-4 border-amber-200 flex items-center justify-center font-black text-xl text-amber-700 overflow-hidden shadow-sm">
                {recipientName.split(" ").map(n => n[0]).join("")}
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white mt-2">
                {recipientName}
              </h3>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                {money(expectedPool)}
              </p>
              <span className="mt-2 rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                ROUND / {totalMembers}
              </span>
            </div>
          </div>

          {/* Round Timeline Card */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
              Round Timeline
            </h3>

            <div className="space-y-2.5 text-xs font-semibold">
              {timelineItems.length > 0 ? (
                timelineItems.map((item) => (
                  <div key={item.num} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-400 font-bold">{item.num}</span>
                      <span className="text-slate-900 dark:text-white font-bold">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.isPaid && (
                        <>
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Paid</span>
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Received</span>
                        </>
                      )}
                      {item.isCurrent && (
                        <>
                          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">Current</span>
                          <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-300">Processing</span>
                        </>
                      )}
                      {!item.isPaid && !item.isCurrent && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">Upcoming</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 text-center py-6">No merry-go-round rotation members defined yet.</p>
              )}
            </div>

            <div className="mt-3 pt-2 text-right border-t border-slate-100 dark:border-slate-800">
              <Link to={`/workspace/${chamaId}/mgr`} className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400">
                View Full Rotation <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Round Summary Footer Cards */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-4">
          Round Summary
        </h3>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-[11px] text-slate-400 font-bold">Total Collected</span>
            <p className="text-xl font-black text-slate-900 dark:text-white font-mono mt-1">{money(totalCollected)}</p>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 font-bold">Outstanding</span>
            <p className="text-xl font-black text-rose-500 font-mono mt-1">{money(totalOutstanding)}</p>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 font-bold">Expected Payout</span>
            <p className="text-xl font-black text-slate-900 dark:text-white font-mono mt-1">{money(expectedPool)}</p>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 font-bold">Estimated Payout Date</span>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{currentDateStr}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
