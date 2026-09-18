import {
  CreditCard,
  Landmark,
  ShieldCheck,
  Target,
  UsersRound,
} from "lucide-react";

import { MetricCard, SectionCard, money } from "../components/DeskUI";

// ========================================
// OVERVIEW TAB
// ========================================
//
// The landing view: what needs your attention, and the treasury facts a
// leader is most often asked for in a meeting ("what's our paybill
// again?"). Everything here is read-only — each card routes to the tab
// that owns the action rather than duplicating it, which is what stops
// this page drifting back into a second Command Center.
//
// ========================================

export default function OverviewTab({ data, goToTab }) {
  const profile = data?.profile || {};
  const loans = data?.loans || [];
  const goals = data?.goals || [];

  const pendingLoans = loans.filter(
    (loan) => loan.status === "eligible" || loan.status === "approved"
  ).length;

  const officials = data?.officials || [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Contribution cycle"
          value={(profile.contribution_cycle || "monthly").toUpperCase()}
          icon={Landmark}
          subtitle={`Late fine: ${money(profile.fine_amount)}`}
        />
        <MetricCard
          title="Loans awaiting action"
          value={pendingLoans}
          icon={CreditCard}
          subtitle={pendingLoans ? "Needs an official decision" : "Nothing queued"}
        />
        <MetricCard
          title="Active goals"
          value={goals.length}
          icon={Target}
          subtitle="Group investment targets"
        />
        <MetricCard
          title="Officials assigned"
          value={officials.length}
          icon={UsersRound}
          subtitle="Chairperson, treasurer, secretary"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard
          icon={Landmark}
          title="Treasury & account details"
          description="Where the group's money is collected and held."
          action={
            <button
              type="button"
              onClick={() => goToTab("governance")}
              className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
            >
              Edit in Governance
            </button>
          }
        >
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact
              label="M-Pesa till / paybill"
              value={profile.mpesa_shortcode || "Not configured"}
              mono
            />
            <Fact
              label="Bank account"
              value={
                profile.bank_name
                  ? `${profile.bank_name} — ${profile.bank_account_number || "—"}`
                  : "Not configured"
              }
              mono
            />
            <Fact label="Meeting day" value={profile.meeting_day || "Flexible"} />
            <Fact
              label="Payout approval threshold"
              value={money(profile.approval_threshold)}
            />
          </dl>

          {profile.constitution_url ? (
            <a
              href={profile.constitution_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
            >
              <ShieldCheck size={14} /> View the group constitution
            </a>
          ) : (
            <p className="text-xs text-slate-400">
              No constitution document linked yet.
            </p>
          )}
        </SectionCard>

        <SectionCard
          icon={ShieldCheck}
          title="Where to go next"
          description="The desk's sections, in the order most leaders use them."
        >
          <ul className="space-y-1.5">
            {[
              ["members", "Approve join requests & set roles"],
              ["loans", "Review and disburse loans"],
              ["treasury", "Goals, KYC and oversight"],
              ["governance", "Rules, loan policy, payment details"],
            ].map(([tab, label]) => (
              <li key={tab}>
                <button
                  type="button"
                  onClick={() => goToTab(tab)}
                  className="w-full rounded-xl px-3 py-2.5 text-left text-xs font-bold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800 dark:text-slate-300 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300"
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}

function Fact({ label, value, mono }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd
        className={`mt-1 text-base font-black text-slate-900 dark:text-white ${
          mono ? "font-mono text-sm" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
