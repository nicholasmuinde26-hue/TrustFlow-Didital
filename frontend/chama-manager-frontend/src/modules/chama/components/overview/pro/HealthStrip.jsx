import { useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, CalendarDays, CheckCircle2, ChevronRight, CircleAlert, Info, ShieldCheck, Users, Wallet, XCircle } from "lucide-react";
import clsx from "clsx";

import { Modal } from "@/modules/finance/lib/proKit";
import { money } from "../../../utils/overview";
import { HEALTH_WEIGHTS, TARGET_TRUST, plural, toneByPct } from "../../../utils/overviewPro";
import { Chip, Meter, Metric, cardCls, initialsOf, tone } from "./ProParts";

/* -------------------------------------------------------------------------- */
/* Health ring                                                                */
/* -------------------------------------------------------------------------- */

function ScoreRing({ value, t, size = 112, stroke = 10 }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={value == null ? "Health score not available" : `Health score ${v} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-100 dark:stroke-obsidian-raised" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          stroke={tone(t).hex} strokeDasharray={c} strokeDashoffset={c * (1 - (value == null ? 0 : v) / 100)}
          className="transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold tabular-nums tracking-tight">{value ?? "—"}</span>
        <span className="text-[10px] font-semibold text-slate-400">/ 100</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* "Why this score?" modals                                                   */
/* -------------------------------------------------------------------------- */

export function HealthExplainModal({ open, onClose, health, base }) {
  return (
    <Modal open={open} onClose={onClose} wide title="How the health score is built" subtitle="Four signals, weighted. A signal with no data is left out and the rest are re-weighted.">
      <ul className="space-y-4">
        {health.parts.map((p) => (
          <li key={p.key}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-bold text-slate-800 dark:text-mist">
                {p.label} <span className="text-xs font-medium text-slate-400">· {Math.round(HEALTH_WEIGHTS[p.key] * 100)}% weight</span>
              </p>
              <p className={clsx("text-sm font-extrabold tabular-nums", tone(p.tone).text)}>{p.hasData ? `${p.value}%` : "Not tracked yet"}</p>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-mist-muted">{p.hint}</p>
            <Meter value={p.hasData ? p.value : 0} tone={p.tone} label={p.label} className="mt-2" height="h-2" />
            {!p.hasData ? (
              <p className="mt-1.5 text-[11px] font-semibold text-violet-700 dark:text-mint">
                {p.key === "attendance" ? "Record attendance at your next meeting to start tracking this." : "This appears once the underlying data exists."}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-5 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600 dark:bg-obsidian-raised dark:text-mist-muted">
        Currently based on {health.signalsUsed} of {health.signalsTotal} signals. The score is computed from live figures on this page, so it moves as members pay and loans are repaid.
      </p>
      <Link to={`${base}/trust-score`} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-violet-700 hover:underline dark:text-mint">
        See the separate public Trust Score <ChevronRight size={13} />
      </Link>
    </Modal>
  );
}

export function TrustExplainModal({ open, onClose, explain, base }) {
  const { score, grade, gap, comps, lagging } = explain;
  return (
    <Modal open={open} onClose={onClose} wide title={score == null ? "Trust score not generated yet" : `Trust score ${score}${grade ? ` · Grade ${grade}` : ""}`}
      subtitle={score == null ? "Generate your first report to see what drives it." : gap > 0 ? `${gap} points to reach ${TARGET_TRUST}. Here is where they come from.` : `You are above the ${TARGET_TRUST} target. Keep these steady.`}>
      <ul className="space-y-3.5">
        {comps.map((c) => (
          <li key={c.key}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-bold text-slate-800 dark:text-mist">{c.label}</p>
              <p className={clsx("text-sm font-extrabold tabular-nums", tone(c.tone).text)}>{c.hasData ? `${c.score}/100` : "No data yet"}</p>
            </div>
            <Meter value={c.hasData ? c.score : 0} tone={c.tone} label={c.label} className="mt-1.5" height="h-2" />
          </li>
        ))}
      </ul>

      {lagging.length ? (
        <div className="mt-5">
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{`How to get to ${TARGET_TRUST}`}</p>
          <ol className="mt-2 space-y-2">
            {lagging.slice(0, 3).map((c, i) => (
              <li key={c.key} className="flex gap-3 rounded-xl border border-slate-200 p-3 dark:border-obsidian-border">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-extrabold text-violet-700 dark:bg-violet-950/50 dark:text-mint">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-mist">
                    {c.label} <span className="font-medium text-slate-400">{c.hasData ? `· now ${c.score}` : "· no data"}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-mist-muted">{c.fix}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <Link to={`${base}/trust-score`} className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-violet-700 hover:underline dark:text-mint">
        Open the full trust report <ChevronRight size={13} />
      </Link>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero strip                                                                 */
/* -------------------------------------------------------------------------- */

export default function HealthStrip({
  base, workspace, verified, established, members, summary, treasury, health, collection, unpaid, compliance, trust, onExplainTrust,
}) {
  const [healthOpen, setHealthOpen] = useState(false);

  const ComplianceIcon = compliance.tone === "emerald" ? CheckCircle2 : compliance.tone === "rose" ? XCircle : CircleAlert;
  const since = established ? new Date(established).toLocaleDateString("en-KE", { month: "short", year: "numeric" }) : null;
  const trustTone = toneByPct(trust?.score, 80, 60);
  const collectTone = collection.rate == null ? "slate" : toneByPct(collection.rate, 80, 50);
  const remaining = Math.max(0, collection.expected - collection.paid);

  return (
    <section aria-label="Chama health at a glance" className="space-y-3">
      <div className={clsx(cardCls, "overflow-hidden")}>
        {/* 1 + 7: identity and compliance */}
        <div className="flex flex-col gap-4 border-b border-slate-100 p-4 dark:border-obsidian-border sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-center gap-3.5">
            {workspace?.logo_url || workspace?.logo ? (
              <img src={workspace.logo_url || workspace.logo} alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-sm font-extrabold text-white dark:bg-mint dark:text-mint-strong">
                {initialsOf(workspace?.name)}
              </span>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-extrabold tracking-tight">{workspace?.name || "Your Chama"}</h2>
                {verified ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 dark:text-sky-400">
                    <BadgeCheck size={15} aria-hidden="true" /> Verified
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-mist-muted">
                <CalendarDays size={12} aria-hidden="true" />
                {since ? `Established ${since}` : "Established date not recorded"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={compliance.tone} dot>
              <ComplianceIcon size={12} aria-hidden="true" />
              {compliance.label}{compliance.passPct != null ? ` · ${compliance.passPct}%` : ""}
            </Chip>
            <button
              type="button" onClick={onExplainTrust}
              className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-violet-500", tone(trustTone).chip)}
              aria-label="Explain trust score"
            >
              <ShieldCheck size={12} aria-hidden="true" />
              {trust?.score != null ? `Trust ${trust.score}${trust.grade ? ` · ${trust.grade}` : ""}` : "Trust: generate report"}
              <Info size={11} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* 5: health score + 4 sub-scores */}
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,17rem)] lg:gap-8">
          <button
            type="button" onClick={() => setHealthOpen(true)}
            className="flex items-center gap-4 rounded-2xl text-left transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-violet-500"
            aria-label="Explain health score"
          >
            <ScoreRing value={health.score} t={health.tone} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-mist-muted">Health score</p>
              <p className={clsx("mt-1 text-lg font-extrabold", tone(health.tone).text)}>{health.label}</p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 dark:text-mint">
                Why this score <Info size={11} aria-hidden="true" />
              </p>
            </div>
          </button>

          <ul className="grid content-center gap-x-6 gap-y-4 sm:grid-cols-2">
            {health.parts.map((p) => (
              <li key={p.key}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-semibold text-slate-600 dark:text-mist-muted">{p.label}</span>
                  {p.hasData ? (
                    <span className={clsx("font-extrabold tabular-nums", tone(p.tone).text)}>{p.value}%</span>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-400">Not tracked</span>
                  )}
                </div>
                <Meter value={p.hasData ? p.value : 0} tone={p.tone} label={p.label} className="mt-1.5" />
              </li>
            ))}
          </ul>

          {/* 6: collection rate this month */}
          <div className={clsx("rounded-2xl border p-4", tone(collectTone).soft)}>
            <Metric
              label="Collection rate this cycle"
              value={collection.rate == null ? "—" : `${Math.round(collection.rate)}%`}
              tone={collectTone}
              context={
                collection.hasData
                  ? `${collection.counts.paid} of ${collection.members.length} paid · ${money(remaining)} remaining to goal`
                  : "No contribution plan running yet"
              }
            />
            {collection.hasData ? (
              <Meter value={collection.rate} tone={collectTone} label="Collection progress" className="mt-3" />
            ) : (
              <Link to={`${base}/contributions`} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-violet-700 hover:underline dark:text-mint">
                Create a contribution plan <ChevronRight size={13} />
              </Link>
            )}
            {unpaid > 0 ? <p className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-mist-muted">{plural(unpaid, "member")} still to pay</p> : null}
          </div>
        </div>

        {/* 2, 3, 4: members, fund, treasury */}
        <dl className="grid grid-cols-1 divide-y divide-slate-100 border-t border-slate-100 dark:divide-obsidian-border dark:border-obsidian-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="p-5 sm:px-6">
            <Metric
              label="Members"
              value={
                <span className="inline-flex items-baseline gap-1.5">
                  <Users size={15} className="self-center text-slate-400" aria-hidden="true" />
                  {members.active}<span className="text-sm font-semibold text-slate-400">/ {members.total}</span>
                </span>
              }
              context={
                <>
                  active of total
                  {members.pending > 0 ? (
                    <> · <Link to={`${base}/members`} className="font-bold text-amber-600 hover:underline dark:text-amber-400">{members.pending} pending</Link></>
                  ) : null}
                </>
              }
            />
          </div>
          <div className="p-5 sm:px-6">
            <Metric label="Total fund value" value={money(summary?.total_contributions)} context="Pooled since inception" />
          </div>
          <div className="p-5 sm:px-6">
            <Metric
              label="Current treasury"
              value={<span className="inline-flex items-center gap-1.5"><Wallet size={15} className="text-slate-400" aria-hidden="true" />{money(treasury.total)}</span>}
              context={
                treasury.classified
                  ? [treasury.mpesa > 0 && `M-Pesa ${money(treasury.mpesa)}`, treasury.bank > 0 && `Bank ${money(treasury.bank)}`, treasury.petty > 0 && `Petty ${money(treasury.petty)}`].filter(Boolean).join(" · ")
                  : "Cash and bank ledger position"
              }
            />
          </div>
        </dl>
      </div>

      <HealthExplainModal open={healthOpen} onClose={() => setHealthOpen(false)} health={health} base={base} />
    </section>
  );
}

