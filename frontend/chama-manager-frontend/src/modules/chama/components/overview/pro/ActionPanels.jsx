import { useId, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell, CalendarDays, CalendarPlus, Check, Coins, Copy, Download, FileText, HandCoins, MessageCircle, Plus, Send, Share2, ShieldCheck, TrendingUp, UserPlus, Users,
} from "lucide-react";
import clsx from "clsx";

import { Modal, smsLink, waLink } from "@/modules/finance/lib/proKit";
import { compact, money } from "../../../utils/overview";
import { plural } from "../../../utils/overviewPro";
import { CashFlowChart } from "../charts";
import { Chip, Metric, Nudge, Panel, SectionHead, TONE, ghostBtn, primaryBtn, tone } from "./ProParts";

/* ==========================================================================
 * 7. UPCOMING & ACTIONS - drives behaviour
 * ========================================================================== */

const KIND_STYLE = {
  meeting: { dot: "bg-violet-500", label: "Meeting" },
  loan: { dot: "bg-amber-500", label: "Loan due" },
  contribution: { dot: "bg-emerald-500", label: "Contributions due" },
  mgr: { dot: "bg-sky-500", label: "Merry-go-round" },
};

function CalendarStrip({ days }) {
  const todayKey = new Date().toDateString();
  return (
    <div>
      <ol className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Next 14 days">
        {days.map((d) => {
          const isToday = d.date.toDateString() === todayKey;
          return (
            <li
              key={d.key}
              className={clsx(
                "flex w-12 shrink-0 flex-col items-center rounded-xl border px-1 py-2 text-center",
                isToday ? "border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30" : "border-slate-200 dark:border-obsidian-border",
              )}
              title={d.events.map((e) => e.label).join(", ") || undefined}
            >
              <span className="text-[9px] font-bold uppercase text-slate-400">{d.date.toLocaleDateString("en-KE", { weekday: "short" })}</span>
              <span className="mt-0.5 text-sm font-extrabold tabular-nums">{d.date.getDate()}</span>
              <span className="mt-1 flex h-2 items-center gap-0.5">
                {d.events.slice(0, 3).map((e, i) => <span key={i} className={clsx("h-1.5 w-1.5 rounded-full", KIND_STYLE[e.kind].dot)} />)}
              </span>
            </li>
          );
        })}
      </ol>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-mist-muted">
        {Object.entries(KIND_STYLE).map(([k, s]) => (
          <li key={k} className="inline-flex items-center gap-1.5"><span className={clsx("h-2 w-2 rounded-full", s.dot)} />{s.label}</li>
        ))}
      </ul>
    </div>
  );
}

export function NudgeModal({ open, onClose, members, groupName, phoneFor }) {
  const [copied, setCopied] = useState(false);
  const textFor = (m) =>
    `Hello ${String(m.name).split(" ")[0]}, a gentle reminder: your ${groupName || "chama"} contribution has ${money(m.balance)} outstanding. Please pay via M-Pesa when you can. Thank you.`;

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(members.map((m) => `${m.name}: ${textFor(m)}`).join("\n\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <Modal open={open} onClose={onClose} wide title="Nudge members who owe" subtitle="One tap opens WhatsApp or SMS with a ready-written reminder.">
      {members.length === 0 ? (
        <Nudge icon={Check} tone="emerald" title="Nobody to nudge" hint="Everyone is paid up this cycle." />
      ) : (
        <>
          <ul className="divide-y divide-slate-100 dark:divide-obsidian-border">
            {members.map((m) => {
              const phone = phoneFor(m);
              return (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{m.name}</p>
                    <p className="text-[11px] text-slate-500">{money(m.balance)} outstanding</p>
                  </div>
                  {phone ? (
                    <span className="flex gap-2">
                      <a className={ghostBtn} target="_blank" rel="noopener noreferrer" href={waLink(phone, textFor(m))}><MessageCircle size={13} /> WhatsApp</a>
                      <a className={ghostBtn} href={smsLink(phone, textFor(m))}>SMS</a>
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">No phone on file</span>
                  )}
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={copyAll} className={clsx(ghostBtn, "mt-3")}>
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy all messages"}
          </button>
        </>
      )}
    </Modal>
  );
}

/** Six one-tap actions in a tidy 2-column grid. The first is the primary action. */
export function QuickActionsCard({ base, recordUrl, recordLabel, showRecord, onNudge, onExport, hasLoans, hasMeetings }) {
  const actions = [
    showRecord && { key: "pay", icon: Plus, label: recordLabel, to: recordUrl, primary: true },
    { key: "remind", icon: Bell, label: "Send reminder", onClick: onNudge },
    hasLoans && { key: "loan", icon: HandCoins, label: "Disburse loan", to: `${base}/loans` },
    { key: "member", icon: UserPlus, label: "Add member", to: `${base}/members` },
    hasMeetings && { key: "meet", icon: CalendarPlus, label: "Schedule meeting", to: `${base}/meetings` },
    { key: "export", icon: Download, label: "Export report", onClick: onExport },
  ].filter(Boolean);

  return (
    <Panel icon={Send} title="Quick actions">
      <div className="grid grid-cols-2 gap-2.5">
        {actions.map((a) => {
          const Icon = a.icon;
          const cls = clsx(
            "inline-flex min-h-11 items-center justify-start gap-2 rounded-xl border px-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-violet-500",
            a.primary
              ? "col-span-2 justify-center border-transparent bg-violet-600 text-white hover:bg-violet-700 dark:bg-mint dark:text-mint-strong dark:hover:bg-mint-hover"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-obsidian-border dark:bg-obsidian-card dark:text-mist dark:hover:bg-obsidian-raised",
          );
          return a.to ? (
            <Link key={a.key} to={a.to} className={cls}><Icon size={15} aria-hidden="true" />{a.label}</Link>
          ) : (
            <button key={a.key} type="button" onClick={a.onClick} className={cls}><Icon size={15} aria-hidden="true" />{a.label}</button>
          );
        })}
      </div>
    </Panel>
  );
}

/** What is due this week, then the next 14 days at a glance. */
export function UpcomingCard({ dueContribs, loanWatch, meeting, calendar, hasLoans }) {
  const meetingThisWeek = meeting.next && meeting.daysToNext != null && meeting.daysToNext <= 7;
  const loanCount = loanWatch.dueThisWeek.length;
  const total = dueContribs + loanCount + (meetingThisWeek ? 1 : 0);

  return (
    <Panel icon={CalendarDays} title="Due this week" eyebrow={total > 0 ? `${plural(total, "item")} coming up` : "Nothing due"}
      action={total > 0 ? <Chip tone="amber">{total}</Chip> : null}>
      <ul className="space-y-3 text-sm">
        <li className="flex items-center justify-between gap-3">
          <span className="text-slate-600 dark:text-mist-muted">Contributions</span>
          <span className={clsx("font-bold tabular-nums", dueContribs > 0 && TONE.amber.text)}>{dueContribs > 0 ? `${dueContribs} due` : "All paid"}</span>
        </li>
        {hasLoans ? (
          <li className="flex items-center justify-between gap-3">
            <span className="text-slate-600 dark:text-mist-muted">Loan repayments</span>
            <span className={clsx("font-bold tabular-nums", loanCount > 0 && TONE.amber.text)}>{loanCount > 0 ? `${loanCount} · ${money(loanWatch.dueThisWeekAmount)}` : "None due"}</span>
          </li>
        ) : null}
        <li className="flex items-center justify-between gap-3">
          <span className="text-slate-600 dark:text-mist-muted">Meeting</span>
          <span className="font-bold">{meetingThisWeek ? (meeting.daysToNext === 0 ? "Today" : `In ${meeting.daysToNext}d`) : "None this week"}</span>
        </li>
      </ul>
      <div className="mt-5 border-t border-slate-100 pt-4 dark:border-obsidian-border">
        <CalendarStrip days={calendar} />
      </div>
    </Panel>
  );
}

/* ==========================================================================
 * 8. CHARTS & INSIGHTS - visual proof
 * ========================================================================== */

function MiniLine({ values, labels, tone: t = "emerald", height = 120, format = compact }) {
  const id = useId();
  if (!values || values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const W = 300;
  const pad = 8;
  const pts = values.map((v, i) => [pad + (i / (values.length - 1)) * (W - pad * 2), height - 22 - ((v - min) / span) * (height - 40)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  const dir = values[values.length - 1] - values[0];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={`Trend from ${format(values[0])} to ${format(values[values.length - 1])}`}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tone(t).hex} stopOpacity="0.22" />
            <stop offset="100%" stopColor={tone(t).hex} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L${last[0]} ${height - 22} L${pts[0][0]} ${height - 22} Z`} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={tone(t).hex} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 3.5 : 2} fill={tone(t).hex} />)}
        {labels?.map((l, i) => (
          <text key={i} x={pts[i][0]} y={height - 6} textAnchor="middle" fontSize="9" className="fill-slate-400">{l}</text>
        ))}
      </svg>
      <p className={clsx("mt-1 text-[11px] font-bold", dir >= 0 ? TONE.emerald.text : TONE.rose.text)}>
        {dir >= 0 ? "Trending up" : "Trending down"} · now {format(values[values.length - 1])}
      </p>
    </div>
  );
}

function GrowthBars({ buckets }) {
  const max = Math.max(...buckets.map((b) => Math.max(b.joined, b.exited)), 1);
  return (
    <div>
      <div className="flex h-24 items-end gap-2" role="img" aria-label="Members joined versus exited over six months">
        {buckets.map((b) => (
          <div key={b.key} className="flex flex-1 items-end justify-center gap-0.5">
            <div className="w-full max-w-[10px] rounded-t bg-emerald-500" style={{ height: `${(b.joined / max) * 100}%`, minHeight: b.joined ? 3 : 0 }} title={`${b.joined} joined`} />
            <div className="w-full max-w-[10px] rounded-t bg-rose-400" style={{ height: `${(b.exited / max) * 100}%`, minHeight: b.exited ? 3 : 0 }} title={`${b.exited} exited`} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">{buckets.map((b) => <span key={b.key} className="flex-1 text-center text-[9px] text-slate-400">{b.label}</span>)}</div>
      <p className="mt-2 flex gap-3 text-[11px] text-slate-500 dark:text-mist-muted">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" />Joined</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-rose-400" />Exited</span>
      </p>
    </div>
  );
}

export function InsightCharts({ base, weeks, growth, trustHistory, meeting }) {
  const trust = [...(trustHistory?.snapshots || [])]
    .filter((s) => s.score != null)
    .sort((a, b) => new Date(a.createdAt || a.generatedAt || 0) - new Date(b.createdAt || b.generatedAt || 0));
  const hasGrowth = growth.some((b) => b.joined || b.exited);

  return (
    <section aria-label="Charts and insights" className="space-y-6">
      <SectionHead title="Trends" description="How contributions, membership and trust are moving." />

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {/* 43 */}
        <Panel icon={TrendingUp} title="Contributions trend" eyebrow={`Weekly income · last ${weeks.length || 0} weeks`}>
          {weeks.length >= 2 ? (
            <MiniLine values={weeks.map((w) => w.income)} labels={weeks.map((w, i) => (i % Math.ceil(weeks.length / 6) === 0 ? String(w.label || "").slice(0, 5) : ""))} />
          ) : (
            <Nudge icon={TrendingUp} title="Not enough weeks yet" hint="The trend line draws itself after two weeks of activity." to={`${base}/finance/record-contribution`} cta="Record payment" />
          )}
        </Panel>

        {/* 44 */}
        <Panel icon={Users} title="Member growth" eyebrow="Joined vs exited · 6 months">
          {hasGrowth ? (
            <GrowthBars buckets={growth} />
          ) : (
            <Nudge icon={Users} title="No joins or exits recorded" hint="Invite members to start the growth curve." to={`${base}/members`} cta="Invite" />
          )}
        </Panel>

        {/* trust trend stands in for the arrears and attendance history we do not store yet */}
        <Panel icon={ShieldCheck} title="Trust score trend" eyebrow="Last reports">
          {trust.length >= 2 ? (
            <MiniLine values={trust.map((s) => s.score)} tone="violet" format={(v) => String(Math.round(v))} />
          ) : (
            <Nudge icon={ShieldCheck} title="One report on record" hint="Generate a report each month to chart your trust trend." to={`${base}/trust-score`} cta="Generate" />
          )}
        </Panel>

        {/* 47 */}
        <Panel icon={Coins} title="Income vs expenses" eyebrow="Weekly" className="lg:col-span-2 xl:col-span-3">
          {weeks.length ? (
            <CashFlowChart weeks={weeks} height={170} />
          ) : (
            <Nudge icon={Coins} title="No cashflow yet" hint="Income and expenses chart once money moves." to={`${base}/finance/record-contribution`} cta="Record payment" />
          )}
        </Panel>
      </div>

      {meeting.attendance == null ? (
        <Nudge
          icon={Users} title="Attendance trend starts at your next meeting"
          hint="Meeting attendance is not recorded yet, so there is nothing to chart. Take attendance at the next meeting."
          to={`${base}/meetings`} cta="Open meetings"
        />
      ) : null}
    </section>
  );
}

/* ==========================================================================
 * 9. ADMIN & CONTROL - officials only
 * ========================================================================== */

export function AdminControl({ base, pulse, shareText, onExport }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const text = shareText;
    if (navigator.share) {
      try { await navigator.share({ title: "Chama health snapshot", text }); return; } catch { /* cancelled, fall through */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(shareText); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ }
  };

  return (
    <section aria-label="Admin and control" className="space-y-6">
      <SectionHead title="Share & export" description="Take the numbers to your bank, committee or WhatsApp group." />

      <div className="grid gap-4 md:grid-cols-3">
        {/* 49 */}
        <Panel icon={UserPlus} title="Pending join requests">
          {pulse.pending > 0 ? (
            <>
              <Metric label="Awaiting approval" value={pulse.pending} tone="amber" context="Review before they lapse" />
              <Link to={`${base}/members`} className={clsx(ghostBtn, "mt-3")}>Review requests</Link>
            </>
          ) : (
            <Nudge icon={UserPlus} title="No pending requests" hint="Share your invite link to grow the group." to={`${base}/members`} cta="Invite" />
          )}
        </Panel>

        {/* 51 */}
        <Panel icon={FileText} title="Export overview PDF" eyebrow="Board report">
          <p className="text-xs text-slate-600 dark:text-mist-muted">A one-page summary for your bank, NGO or committee. Choose “Save as PDF” in the print dialog.</p>
          <button type="button" onClick={onExport} className={clsx(primaryBtn, "mt-3")}><Download size={14} /> Export PDF</button>
        </Panel>

        {/* 52 */}
        <Panel icon={Share2} title="Share snapshot" eyebrow="WhatsApp group">
          <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600 dark:bg-obsidian-raised/60 dark:text-mist-muted">{shareText}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={share} className={primaryBtn}><MessageCircle size={14} /> Share</button>
            <button type="button" onClick={copy} className={ghostBtn}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button>
          </div>
        </Panel>
      </div>
    </section>
  );
}
