import React, { useEffect, useMemo, useRef } from "react";
import { CheckCircle2, Circle, Clock, Gift, Smartphone, Trophy } from "lucide-react";

import { DAY_MS, Ring, useTicker } from "@/modules/finance/lib/proKit";

// ============================================================
// MGR TRACKER
//
// Three views of the same round data the page already loads, so
// nothing here needs a new endpoint:
//   1. Rotation timeline : every round in order, who receives it,
//      which are paid out, which one is live, which is still ahead.
//   2. Round lifecycle   : where the live round is between
//      "collecting" and "reconciled".
//   3. My turn           : the signed-in member's position, how many
//      rounds until they receive, and what they owe this round.
// ============================================================

const money = (v) => `KES ${Number(v || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

const DONE = ["paid", "reconciled", "received", "completed"];

// Order a round moves through. Statuses outside this list (on_hold)
// are shown as a banner, not a step.
const STAGES = [
  { key: "awaiting_confirmation", label: "Confirm position" },
  { key: "collecting", label: "Collecting" },
  { key: "target_reached", label: "Target reached" },
  { key: "eligibility_checking", label: "Eligibility" },
  { key: "payout_proposed", label: "Proposed" },
  { key: "pending_approval", label: "Approval" },
  { key: "approved", label: "Approved" },
  { key: "disbursing", label: "Disbursing" },
  { key: "paid", label: "Paid out" },
  { key: "reconciled", label: "Reconciled" },
  { key: "awaiting_receipt", label: "Recipient confirmation" },
  { key: "received", label: "Received" },
];

const idOf = (v) => String(v?._id || v || "");
const monthOf = (r) =>
  r?.due_date ? new Date(r.due_date).toLocaleDateString("en-KE", { month: "short", year: "2-digit" }) : "—";

export default function MgrTracker({
  rounds = [],
  activeRound,
  policy,
  obligations = [],
  resolveMemberDetails,
  myMembershipId,
  onSelectRound,
  onPay,
}) {
  const now = useTicker(60_000);

  const ordered = useMemo(
    () => [...rounds].sort((a, b) => (a.round_number || 0) - (b.round_number || 0)),
    [rounds]
  );

  const live = ordered.find((r) => !DONE.includes(r.status) && r.status !== "upcoming") || null;
  const paidRounds = ordered.filter((r) => DONE.includes(r.status));
  const paidOut = paidRounds.reduce((s, r) => s + Number(r.collected_amount || r.expected_amount || 0), 0);

  // keep the live round in view on narrow screens
  const liveRef = useRef(null);
  useEffect(() => {
    liveRef.current?.scrollIntoView?.({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [live?._id]);

  // ---- the round being looked at ----
  const round = activeRound || live || ordered[0];
  const expected = Number(round?.expected_amount || 0);
  const collected = Number(round?.collected_amount || 0);
  const pct = expected > 0 ? Math.min(100, Math.round((collected / expected) * 100)) : 0;
  const paidCount = obligations.filter((o) => o.status === "paid").length;
  const due = round?.round_end || round?.due_date ? new Date(round.round_end || round.due_date) : null;
  const daysLeft = due ? Math.ceil((due - now) / DAY_MS) : null;
  const finished = DONE.includes(round?.status);

  let health = { label: "On track", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300", tone: "emerald" };
  if (round?.status === "on_hold") health = { label: "On hold", cls: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300", tone: "rose" };
  else if (finished) health = { label: "Completed", cls: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300", tone: "emerald" };
  else if (daysLeft != null && daysLeft < 0 && pct < 100) health = { label: "Behind", cls: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300", tone: "rose" };
  else if (daysLeft != null && daysLeft <= 5 && pct < 80) health = { label: "At risk", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", tone: "amber" };

  const stageIndex = STAGES.findIndex((s) => s.key === round?.status);

  // ---- my turn ----
  const mine = ordered.find((r) => idOf(r.recipient_id) === String(myMembershipId || ""));
  const myIndex = mine ? ordered.indexOf(mine) : -1;
  const liveIndex = live ? ordered.indexOf(live) : ordered.findIndex((r) => !DONE.includes(r.status));
  const roundsAway = mine && myIndex >= 0 && liveIndex >= 0 ? myIndex - liveIndex : null;
  const myObligation = obligations.find((o) => {
    const m = o.participant_id || o.member_id || o;
    return String(myMembershipId || "") && idOf(m) === String(myMembershipId);
  });
  const myDue = myObligation ? Number(myObligation.expected_amount || myObligation.amount_due || 0) : 0;
  const myPaid = myObligation ? Number(myObligation.paid_amount || myObligation.amount_paid || 0) : 0;
  const myBalance = Math.max(0, myDue - myPaid);
  const penalty = Number(policy?.penalty_rule?.penalty_amount || 0);

  if (ordered.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* ================= rotation timeline ================= */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">Rotation tracker</h3>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {paidRounds.length} of {ordered.length} rounds paid out · {money(paidOut)} given so far
            </p>
          </div>
          <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden>
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${(paidRounds.length / ordered.length) * 100}%` }}
            />
          </div>
        </div>

        <ol className="mt-5 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
          {ordered.map((r) => {
            const done = DONE.includes(r.status);
            const isLive = live && r._id === live._id;
            const isMine = idOf(r.recipient_id) === String(myMembershipId || "");
            const selected = round && r._id === round._id;
            const who = resolveMemberDetails ? resolveMemberDetails(r.recipient_id).name : "Member";
            return (
              <li key={r._id} ref={isLive ? liveRef : undefined} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onSelectRound?.(r._id)}
                  aria-current={selected ? "true" : undefined}
                  className={`flex w-36 flex-col rounded-2xl border p-3 text-left transition ${
                    selected
                      ? "border-slate-900 bg-slate-50 dark:border-emerald-400 dark:bg-slate-800"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-extrabold text-amber-600 dark:text-amber-400">#{r.round_number}</span>
                    {done ? (
                      <CheckCircle2 size={15} className="text-emerald-500" />
                    ) : isLive ? (
                      <span className="relative flex h-3 w-3">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-sky-500" />
                      </span>
                    ) : (
                      <Circle size={15} className="text-slate-300 dark:text-slate-600" />
                    )}
                  </span>
                  <span className="mt-2 truncate text-xs font-extrabold text-slate-900 dark:text-white">{who}</span>
                  <span className="text-[10px] font-semibold text-slate-400">{monthOf(r)}</span>
                  <span className="mt-2 flex items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${
                        done
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : isLive
                            ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {r.status === "received" ? "Received" : done ? "Paid out" : isLive ? "Live" : "Ahead"}
                    </span>
                    {isMine && (
                      <span title="Your turn to receive" className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        <Gift size={9} /> You
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ================= round progress + lifecycle ================= */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-5">
            <Ring value={pct} tone={health.tone}>
              <span className="text-xl font-black leading-none">{pct}%</span>
              <span className="mt-1 text-[10px] font-semibold text-slate-400">collected</span>
            </Ring>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-black text-slate-900 dark:text-white">Round #{round?.round_number}</p>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${health.cls}`}>{health.label}</span>
              </div>
              <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                {money(collected)} <span className="text-slate-400">of {money(expected)}</span>
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <Clock size={11} />
                {finished
                  ? "This round is complete"
                  : daysLeft == null
                    ? "No deadline set"
                    : daysLeft < 0
                      ? `Deadline passed ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} ago`
                      : `${daysLeft} day${daysLeft === 1 ? "" : "s"} to the deadline`}
                {obligations.length > 0 && ` · ${paidCount} of ${obligations.length} members paid`}
              </p>
            </div>
          </div>

          {/* lifecycle stepper */}
          <ol className="mt-6 grid grid-cols-3 gap-y-4 sm:grid-cols-5 xl:grid-cols-9" aria-label="Round lifecycle">
            {STAGES.map((st, i) => {
              const reached = stageIndex >= 0 && i < stageIndex;
              const current = i === stageIndex;
              return (
                <li key={st.key} className="flex flex-col items-center gap-1.5 text-center">
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-black ${
                      reached
                        ? "bg-emerald-500 text-white"
                        : current
                          ? "bg-sky-500 text-white ring-4 ring-sky-100 dark:ring-sky-950"
                          : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                    }`}
                  >
                    {reached ? <CheckCircle2 size={13} /> : i + 1}
                  </span>
                  <span
                    className={`text-[10px] font-bold leading-tight ${
                      current ? "text-slate-900 dark:text-white" : "text-slate-400"
                    }`}
                  >
                    {st.label}
                  </span>
                </li>
              );
            })}
          </ol>
          {round?.status === "on_hold" && (
            <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              This round is on hold. The treasurer needs to resolve it before the payout can continue.
            </p>
          )}
        </div>

        {/* ================= my turn ================= */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
            <Trophy size={15} className="text-amber-500" /> My turn
          </h3>
          {mine ? (
            <>
              <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
                Round #{mine.round_number}
              </p>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {monthOf(mine)} · expected pot {money(mine.expected_amount)}
              </p>
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                {DONE.includes(mine.status)
                  ? "You have already received your payout."
                  : roundsAway === 0
                    ? "It is your turn now."
                    : roundsAway != null && roundsAway > 0
                      ? `${roundsAway} round${roundsAway === 1 ? "" : "s"} until you receive.`
                      : "Waiting for the rotation to reach you."}
              </p>
            </>
          ) : (
            <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">
              You are not in this rotation, so there is no payout for you to track.
            </p>
          )}

          {myObligation && (
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">This round, my share</p>
              <p className="mt-1 font-mono text-sm font-black text-slate-900 dark:text-white">
                {money(myPaid)} <span className="text-[11px] font-bold text-slate-400">of {money(myDue)}</span>
              </p>
              {myBalance > 0 && !finished ? (
                <>
                  <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {money(myBalance)} still to pay{penalty > 0 && daysLeft != null && daysLeft < 0 ? ` · late penalty ${money(penalty)} may apply` : ""}
                  </p>
                  {onPay && (
                    <button
                      type="button"
                      onClick={() => onPay(myObligation)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-emerald-700"
                    >
                      <Smartphone size={13} /> Pay {money(myBalance)}
                    </button>
                  )}
                </>
              ) : (
                <p className="mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">You are paid up for this round.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
