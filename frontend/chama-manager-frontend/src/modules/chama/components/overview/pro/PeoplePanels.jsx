import { Link } from "react-router-dom";
import {
  Activity, AlertTriangle, CalendarClock, Coins, CheckCircle2, ChevronRight, CircleDashed, ClipboardList, FileClock, Flag, History, Medal, ShieldAlert,
  ShieldCheck, UserCheck, UserPlus, Users, Vote, XCircle,
} from "lucide-react";
import clsx from "clsx";

import { formatWhen, money } from "../../../utils/overview";
import { TARGET_TRUST, plural, relativeDay, toneByPct } from "../../../utils/overviewPro";
import { Chip, LinkRow, Meter, Metric, Nudge, Panel, SectionHead, TONE, cardCls, tone } from "./ProParts";

const humanize = (s = "") =>
  String(s).replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim().replace(/^./, (c) => c.toUpperCase()) || "Activity";

/* ==========================================================================
 * 3. MEMBER PULSE - people health
 * ========================================================================== */

export function MemberPulse({ base, pulse, roles, kycPct, meeting, loading }) {
  const kycTone = kycPct == null ? "slate" : toneByPct(kycPct, 90, 70);
  const attendanceTone = meeting.attendanceRate == null ? "slate" : toneByPct(meeting.attendanceRate, 75, 55);

  return (
    <section aria-label="Member pulse" className="space-y-6">
      <SectionHead
        title="People"
        description="Who is active, who is behind, and whether every official seat is filled."
        action={<Link to={`${base}/members`} className="inline-flex items-center gap-1 text-sm font-semibold text-violet-700 hover:underline dark:text-mint">All members <ChevronRight size={15} aria-hidden="true" /></Link>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* 16 */}
        <div className={clsx(cardCls, "p-5")}>
          <Metric
            label="Active vs inactive" value={loading ? "…" : <>{pulse.active}<span className="text-sm font-semibold text-slate-400"> active</span></>}
            context={pulse.inactive > 0 ? `${pulse.inactive} inactive or suspended` : "Everyone is active"} tone={pulse.inactive > 0 ? "amber" : "emerald"}
          />
          <Meter value={pulse.total ? (pulse.active / pulse.total) * 100 : 0} tone={pulse.inactive > 0 ? "amber" : "emerald"} label="Active members" className="mt-3" />
        </div>

        {/* 21 */}
        <div className={clsx(cardCls, "p-5")}>
          {kycPct != null ? (
            <>
              <Metric
                label="KYC completion" value={`${Math.round(kycPct)}%`} tone={kycTone}
                context={pulse.kycUnverified.length > 0 ? `${plural(pulse.kycUnverified.length, "member")} missing ID` : kycPct >= 90 ? "Strong coverage" : "Below the 90% target"}
              />
              <Meter value={kycPct} tone={kycTone} label="KYC completion" className="mt-3" />
            </>
          ) : (
            <Nudge icon={UserCheck} title="KYC not measured yet" hint="Generate a trust report to see KYC coverage." to={`${base}/trust-score`} cta="Generate" />
          )}
        </div>

        {/* 22 */}
        <div className={clsx(cardCls, "p-5")}>
          {meeting.attendance ? (
            <>
              <Metric
                label="Attendance rate" value={`${meeting.attendanceRate}%`} tone={attendanceTone}
                context={`Last meeting ${meeting.attendance.attended}/${meeting.attendance.total} attended`}
              />
              <Meter value={meeting.attendanceRate} tone={attendanceTone} label="Attendance" className="mt-3" />
            </>
          ) : (
            <Nudge
              icon={CalendarClock}
              title={meeting.last ? `Last meeting ${meeting.daysSinceLast} days ago` : "No meeting recorded"}
              hint={meeting.next ? `Next ${relativeDay(meeting.next.startsAt)}. Record attendance there.` : "Schedule one to start tracking attendance."}
              to={`${base}/meetings`} cta={meeting.next ? "Open meetings" : "Schedule now"}
            />
          )}
        </div>

        {/* 19 */}
        <div className={clsx(cardCls, "p-5")}>
          <Metric
            label="New this month" value={pulse.newThisMonth.length}
            context={pulse.newThisMonth.length ? `${plural(pulse.newThisMonth.length, "member")} joined · needs onboarding` : "No new joiners yet"}
            tone={pulse.newThisMonth.length ? "violet" : undefined}
          />
          <Link to={`${base}/members`} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-violet-700 hover:underline dark:text-mint">
            <UserPlus size={13} aria-hidden="true" /> {pulse.newThisMonth.length ? "Onboard them" : "Invite a member"}
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 17 */}
        <Panel icon={Medal} title="Top contributors" eyebrow="This cycle">
          {pulse.top.length ? (
            <ol className="space-y-2.5">
              {pulse.top.map((m, i) => (
                <li key={m.id} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-extrabold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-bold">{m.name}</span>
                  <span className="text-xs font-extrabold tabular-nums">{money(m.paid)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <Nudge icon={Medal} title="No payments yet this cycle" hint="Top contributors appear as members pay." to={`${base}/contributions`} cta="Send reminders" />
          )}
        </Panel>

        {/* 18 */}
        <Panel icon={AlertTriangle} title="At-risk members" eyebrow="Late or unpaid"
          action={pulse.atRisk.length ? <Chip tone="amber">{pulse.atRisk.length}</Chip> : null}>
          {pulse.atRisk.length ? (
            <ul className="space-y-2.5">
              {pulse.atRisk.slice(0, 3).map((m) => (
                <li key={m.id} className="flex items-center gap-3">
                  <span className={clsx("h-6 w-1 shrink-0 rounded-full", TONE.amber.bar)} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-xs font-bold">{m.name}</span>
                  <span className="text-xs font-extrabold tabular-nums text-amber-600 dark:text-amber-400">{money(m.balance)}</span>
                </li>
              ))}
              {pulse.atRisk.length > 3 ? <li className="text-[11px] text-slate-500">+{pulse.atRisk.length - 3} more</li> : null}
            </ul>
          ) : (
            <Nudge icon={CheckCircle2} tone="emerald" title="Nobody is behind" hint="All members are paid up for this cycle." />
          )}
        </Panel>

        {/* 20 */}
        <Panel icon={Users} title="Role coverage" eyebrow="Officials"
          action={roles.complete ? <Chip tone="emerald" dot>Complete</Chip> : <Chip tone="amber" dot>{roles.missing.length} vacant</Chip>}>
          <ul className="space-y-2.5">
            {roles.roles.map((r) => (
              <li key={r.key} className="flex items-center gap-3">
                {r.filled ? <CheckCircle2 size={15} className={TONE.emerald.text} aria-hidden="true" /> : <XCircle size={15} className={TONE.rose.text} aria-hidden="true" />}
                <span className="min-w-0 flex-1 text-xs font-bold">{r.label}</span>
                {r.filled ? (
                  <span className="max-w-[9rem] truncate text-[11px] text-slate-500 dark:text-mist-muted">{r.holder}</span>
                ) : (
                  <Link to={`${base}/members`} className="text-[11px] font-bold text-rose-600 hover:underline dark:text-rose-400">Assign now</Link>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </section>
  );
}

/* ==========================================================================
 * 4. ACTIVITY - timeline, expenses and audit preview as separate pieces so
 *    each tab can place them where they fit.
 * ========================================================================== */

export function TimelinePanel({ base, activity, loans, limit = 6 }) {
  // One merged timeline: money movements and loan requests.
  const timeline = [
    ...activity.map((a) => ({
      id: `t-${a.id}`, at: a.at, direction: a.direction, status: a.status,
      text: `${a.categoryLabel} · ${money(a.amount)}`, sub: a.title,
    })),
    ...(loans?.pending || []).map((l) => ({
      id: `l-${l.id || l._id}`, at: l.created_at || l.createdAt || l.applied_at, direction: null, status: "Pending",
      text: `${l.member_name || "A member"} requested a loan of ${money(l.amount)}`, sub: l.purpose || "Awaiting review",
    })),
  ].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0)).slice(0, limit);

  return (
    <Panel icon={Activity} title="Recent activity" eyebrow="Payments and requests as they happen"
      action={<Link to={`${base}/finance/transactions`} className="text-xs font-semibold text-violet-700 hover:underline dark:text-mint">All transactions</Link>}>
      {timeline.length ? (
        <ol className="relative space-y-5 border-l border-slate-200 pl-6 dark:border-obsidian-border">
          {timeline.map((e) => (
            <li key={e.id} className="relative">
              <span className={clsx("absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-obsidian-card", e.status === "Failed" ? TONE.rose.dot : e.status === "Pending" ? TONE.amber.dot : e.direction === "out" ? "bg-slate-400" : TONE.emerald.dot)} aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-900 dark:text-mist">{e.text}</p>
              <p className="mt-0.5 flex gap-2 text-xs text-slate-500 dark:text-mist-muted">
                <span className="truncate">{e.sub}</span>
                <span className="shrink-0">{formatWhen(e.at)}</span>
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <Nudge icon={Activity} title="Quiet so far" hint="Record the first payment and it shows up here instantly." to={`${base}/finance/record-contribution`} cta="Record payment" />
      )}
    </Panel>
  );
}

export function ExpensesPanel({ base, activity }) {
  const expenses = activity.filter((a) => a.direction === "out").slice(0, 4);
  return (
    <Panel icon={Coins} title="Recent expenses" eyebrow="Money that left the chama">
      {expenses.length ? (
        <ul className="divide-y divide-slate-100 dark:divide-obsidian-border">
          {expenses.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{e.categoryLabel}</p>
                <p className="text-xs text-slate-500 dark:text-mist-muted">{formatWhen(e.at)}</p>
              </div>
              <span className="text-sm font-extrabold tabular-nums">{money(e.amount)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Nudge icon={Coins} title="No expenses in recent activity" hint="Welfare payouts, loan disbursements and fees show here." to={`${base}/finance/payouts`} cta="Create payout" />
      )}
    </Panel>
  );
}

export function AuditPanel({ base, audit, canView = true }) {
  const logs = audit.data?.logs || [];
  return (
    <Panel icon={History} title="Audit log" eyebrow="The last 5 actions by officials"
      action={<Link to={`${base}/trust-timeline`} className="text-xs font-semibold text-violet-700 hover:underline dark:text-mint">Full audit trail</Link>}>
      {!canView ? (
        <Nudge icon={ShieldAlert} title="Audit log is restricted" hint="Only the treasurer or auditor can open the raw audit log. The trust timeline shows the same record to every member." to={`${base}/trust-timeline`} cta="Open trust timeline" />
      ) : audit.error ? (
        <Nudge icon={ShieldAlert} tone="amber" title="Couldn't load the audit trail" hint="Try again shortly." />
      ) : logs.length ? (
        <ul className="divide-y divide-slate-100 dark:divide-obsidian-border">
          {logs.slice(0, 5).map((l) => (
            <li key={l._id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{humanize(l.action)}</p>
                <p className="truncate text-xs text-slate-500 dark:text-mist-muted">
                  {l.actorUserId?.name || (l.isSystemGenerated ? "System" : "Unknown")}{l.resourceType ? ` · ${humanize(l.resourceType)}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-slate-400">{formatWhen(l.createdAt)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Nudge icon={History} title="No audit entries yet" hint="Every action by an official is logged here with who and when." />
      )}
    </Panel>
  );
}

/* ==========================================================================
 * Right-rail cards for the Summary tab
 * ========================================================================== */

/** The merged priority list: what to do next, most urgent first. */
export function AttentionCard({ base, items, limit = 5 }) {
  const shown = items.slice(0, limit);
  const rest = items.length - shown.length;
  const worst = items.some((i) => i.tone === "rose") ? "rose" : items.length ? "amber" : "emerald";
  return (
    <Panel
      icon={items.length ? Flag : ShieldCheck} title={items.length ? "Needs your attention" : "All clear"}
      eyebrow={items.length ? `${plural(items.length, "item")} · most urgent first` : "Nothing is waiting on you"}
      action={items.length ? <Chip tone={worst} dot>{items.length}</Chip> : null}
    >
      {shown.length ? (
        <ul className="space-y-2">
          {shown.map((i) => (
            <li key={i.key}><LinkRow to={i.to} tone={i.tone} icon={i.icon || (i.tone === "rose" ? ShieldAlert : AlertTriangle)} title={i.title} detail={i.detail} /></li>
          ))}
          {rest > 0 ? (
            <li className="pt-1 text-center">
              <Link to="?section=governance" className="text-xs font-bold text-violet-700 hover:underline dark:text-mint">+{rest} more in Governance</Link>
            </li>
          ) : null}
        </ul>
      ) : (
        <Nudge icon={CheckCircle2} tone="emerald" title="Approvals, risks and alerts are all clear" hint="Meetings, KYC, roles and lending are in a healthy range." />
      )}
    </Panel>
  );
}

export function MeetingCard({ base, meeting }) {
  return (
    <Panel icon={CalendarClock} title="Next meeting">
      {meeting.next ? (
        <>
          <Metric
            label={meeting.next.title || "Members meeting"}
            value={meeting.daysToNext === 0 ? "Today" : meeting.daysToNext === 1 ? "Tomorrow" : `In ${meeting.daysToNext} days`}
            tone={meeting.daysToNext <= 2 ? "amber" : "emerald"}
            context={formatWhen(meeting.next.startsAt)}
          />
          {meeting.agendaPending ? (
            <Link to={`${base}/meetings`} className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-xs font-bold text-amber-800 hover:underline dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
              <FileClock size={14} aria-hidden="true" /> Agenda draft pending
              <ChevronRight size={13} className="ml-auto" aria-hidden="true" />
            </Link>
          ) : null}
        </>
      ) : (
        <Nudge
          icon={CalendarClock} tone={meeting.daysSinceLast > 30 ? "rose" : "amber"}
          title={meeting.daysSinceLast != null ? `Last meeting ${meeting.daysSinceLast} days ago` : "No meeting scheduled"}
          hint="Regular meetings keep governance scores healthy." to={`${base}/meetings`} cta="Schedule now"
        />
      )}
    </Panel>
  );
}

/* ==========================================================================
 * 5. GOVERNANCE & RISK - the pro SACCO part
 * ========================================================================== */

export function GovernancePanel({ base, todos, trust, trustExplain, onExplainTrust, compliance, risks, meeting, polls }) {
  const trustTone = toneByPct(trust?.score, 80, 60);
  const openPoll = (polls || [])[0];

  const comps = [
    ["Repayment", trustExplain.comps.find((c) => c.key === "repayment")],
    ["KYC", trustExplain.comps.find((c) => c.key === "kyc")],
    ["Accountability", trustExplain.comps.find((c) => c.key === "officialAccountability")],
  ];

  return (
    <section aria-label="Governance and risk" className="space-y-6">
      <SectionHead title="Governance" description="Trust, compliance and the decisions waiting on officials." />

      <div className="grid gap-4 xl:grid-cols-3">
        {/* 29 + 33 */}
        <div className="space-y-4">
          <Panel icon={ShieldCheck} title="Trust Center score" eyebrow="Explainable">
            {trust?.score != null ? (
              <>
                <div className="flex items-end justify-between gap-3">
                  <Metric label={trust.grade ? `Grade ${trust.grade}` : "Score"} value={<>{trust.score}<span className="text-sm font-semibold text-slate-400"> / 100</span></>} tone={trustTone}
                    context={trustExplain.gap > 0 ? `${trustExplain.gap} points to reach ${TARGET_TRUST}` : `Above the ${TARGET_TRUST} target`} />
                  <button type="button" onClick={onExplainTrust} className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-violet-700 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-violet-500 dark:text-mint dark:hover:bg-obsidian-raised">
                    Why {trust.score}?
                  </button>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2">
                  {comps.map(([label, c]) => (
                    <div key={label} className="rounded-xl bg-slate-50 px-2.5 py-2 dark:bg-obsidian-raised/50">
                      <dt className="text-[10px] font-semibold text-slate-500 dark:text-mist-muted">{label}</dt>
                      <dd className={clsx("mt-0.5 text-sm font-extrabold tabular-nums", tone(c?.tone).text)}>{c?.hasData ? `${c.score}%` : "—"}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <Nudge icon={ShieldCheck} title="No trust score yet" hint="Generate your first report to unlock a bank-ready score." to={`${base}/trust-score`} cta="Generate" />
            )}
          </Panel>

          <Panel icon={Vote} title="Voting status">
            {openPoll ? (
              <Link to={`${base}/polls`} className="block rounded-xl transition hover:opacity-90">
                <p className="truncate text-xs font-bold">{openPoll.title || openPoll.question || "Open vote"}</p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-mist-muted">
                  <b className="text-slate-900 dark:text-mist">{openPoll.totalVotesCast ?? 0}/{openPoll.eligibleCountSnapshot || "?"}</b> voted
                  {polls.length > 1 ? ` · +${polls.length - 1} more open` : ""}
                </p>
                <Meter value={openPoll.eligibleCountSnapshot ? ((openPoll.totalVotesCast ?? 0) / openPoll.eligibleCountSnapshot) * 100 : 0} tone="emerald" label="Turnout" className="mt-2" />
              </Link>
            ) : (
              <Nudge icon={Vote} title="No vote running" hint="Put big decisions to a member vote." to={`${base}/polls`} cta="Start a vote" />
            )}
          </Panel>
        </div>

        {/* 28 + 32 */}
        <div className="space-y-4">
          <Panel icon={ClipboardList} title="Governance to-do" eyebrow="Do these next"
            action={todos.length ? <Chip tone="violet">{todos.length}</Chip> : null}>
            {todos.length ? (
              <ul className="space-y-2">
                {todos.map((t) => <li key={t.key}><LinkRow to={t.to} tone="violet" title={t.title} detail={t.detail} /></li>)}
              </ul>
            ) : (
              <Nudge icon={CheckCircle2} tone="emerald" title="Governance is up to date" hint="No approvals, meetings or reconciliations pending." />
            )}
          </Panel>

          <Panel icon={CalendarClock} title="Meeting countdown">
            {meeting.next ? (
              <>
                <Metric
                  label={meeting.next.title || "Next meeting"}
                  value={meeting.daysToNext === 0 ? "Today" : meeting.daysToNext === 1 ? "Tomorrow" : `In ${meeting.daysToNext} days`}
                  tone={meeting.daysToNext <= 2 ? "amber" : "emerald"}
                  context={formatWhen(meeting.next.startsAt)}
                />
                {meeting.agendaPending ? (
                  <Link to={`${base}/meetings`} className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs font-bold text-amber-800 hover:underline dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
                    <FileClock size={14} aria-hidden="true" /> Agenda draft pending
                    <ChevronRight size={13} className="ml-auto" aria-hidden="true" />
                  </Link>
                ) : null}
              </>
            ) : (
              <Nudge
                icon={CalendarClock} tone={meeting.daysSinceLast > 30 ? "rose" : "amber"}
                title={meeting.daysSinceLast != null ? `Last meeting ${meeting.daysSinceLast} days ago` : "No meeting scheduled"}
                hint="Regular meetings keep governance scores healthy." to={`${base}/meetings`} cta="Schedule now"
              />
            )}
          </Panel>
        </div>

        {/* 30 + 31 */}
        <div className="space-y-4">
          <Panel icon={CheckCircle2} title="Compliance checklist"
            action={<Chip tone={compliance.tone} dot>{compliance.label}</Chip>}>
            <ul className="space-y-2.5">
              {compliance.checks.map((c) => (
                <li key={c.key}>
                  <Link to={`${base}/${c.to}`} className="flex items-center gap-2.5 text-xs hover:underline">
                    {c.ok === null ? <CircleDashed size={15} className="shrink-0 text-slate-400" aria-hidden="true" /> : c.ok ? <CheckCircle2 size={15} className={clsx("shrink-0", TONE.emerald.text)} aria-hidden="true" /> : <XCircle size={15} className={clsx("shrink-0", TONE.rose.text)} aria-hidden="true" />}
                    <span className={clsx("min-w-0 flex-1 font-semibold", c.ok === false && "text-rose-700 dark:text-rose-300")}>{c.label}</span>
                    {c.ok === null ? <span className="shrink-0 text-[10px] font-semibold text-slate-400">Not measured</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel icon={Flag} title="Risk flags" action={risks.length ? <Chip tone={risks.some((r) => r.tone === "rose") ? "rose" : "amber"}>{risks.length}</Chip> : null}>
            {risks.length ? (
              <ul className="space-y-2">
                {risks.slice(0, 5).map((r) => (
                  <li key={r.key}>
                    <LinkRow to={r.to} tone={r.tone} icon={r.tone === "rose" ? ShieldAlert : AlertTriangle} title={r.title} detail={`${r.detail} · ${r.cta}`} />
                  </li>
                ))}
              </ul>
            ) : (
              <Nudge icon={ShieldCheck} tone="emerald" title="No risk flags" hint="Meetings, KYC, roles and lending are all in a healthy range." />
            )}
          </Panel>
        </div>
      </div>
    </section>
  );
}