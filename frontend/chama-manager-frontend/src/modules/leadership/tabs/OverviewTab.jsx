import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarCheck,
  CheckCircle2,
  Circle,
  CreditCard,
  HandCoins,
  Inbox,
  Landmark,
  ListChecks,
  LogOut,
  MessageCircle,
  Scale,
  Target,
  UserPlus,
  UsersRound,
  Video,
  Wallet,
} from "lucide-react";

import { hasModule } from "@/modules/workspaces/config/workspaceModules";

import { Button, CopyButton, DeskPanel, MetricCard, money } from "../components/DeskUI";

// ========================================
// OVERVIEW TAB
// ========================================
//
// Three jobs, in this order:
//
//   1. Say what is waiting on the leader right now.
//   2. Put the group's pay-in details one tap from a WhatsApp message, because
//      "what's our paybill again?" is the most common question a treasurer gets.
//   3. Show what is still missing from setup, so settings get finished instead
//      of discovered.
//
// Everything here is read-only. Each row sends the leader to the tab that owns
// the action rather than duplicating it, which is what keeps this page from
// drifting back into a second Command Center.
//
// ========================================

export default function OverviewTab({ data, goToTab, workspace, badges = {}, isTreasurer, isChairperson }) {
  const profile = data?.profile || {};
  const loans = data?.loans || [];
  const goals = data?.goals || [];
  const officials = (data?.officials || []).filter(Boolean);
  const modules = workspace?.modules;
  const groupName = workspace?.name || "our Chama";

  const canSee = {
    loans: hasModule(modules, "loans"),
    meetings: hasModule(modules, "meetings") || hasModule(modules, "polls"),
    exits: isTreasurer || isChairperson,
    businesses: (isTreasurer || isChairperson) && hasModule(modules, "businesses"),
  };

  // ----- 1. What is waiting -----
  const waiting = [
    badges.members > 0 && {
      id: "members",
      icon: UserPlus,
      title: `${badges.members} ${badges.members === 1 ? "person wants" : "people want"} to join`,
      detail: "Approve or decline their requests.",
      cta: "Review requests",
      tab: "members",
    },
    canSee.exits && badges.exits > 0 && {
      id: "exits",
      icon: LogOut,
      title: `${badges.exits} exit ${badges.exits === 1 ? "request" : "requests"} open`,
      detail: "Members asking to leave the group.",
      cta: "Decide",
      tab: "exits",
    },
    canSee.loans && badges.loans > 0 && {
      id: "loans",
      icon: HandCoins,
      title: `${badges.loans} ${badges.loans === 1 ? "loan needs" : "loans need"} a decision`,
      detail: "Eligible or approved, waiting on an official.",
      cta: "Open loans",
      tab: "loans",
    },
    canSee.meetings && badges.meetings > 0 && {
      id: "meetings",
      icon: Video,
      title: `${badges.meetings} ${badges.meetings === 1 ? "meeting is" : "meetings are"} live now`,
      detail: "Check-in is open for members.",
      cta: "Open meetings",
      tab: "meetings",
    },
  ].filter(Boolean);

  // ----- 2. Pay-in details -----
  const shortcode = profile.mpesa_shortcode;
  const reference = profile.mpesa_account_reference;
  const bankLine = profile.bank_name
    ? `${profile.bank_name}${profile.bank_account_name ? `, ${profile.bank_account_name}` : ""}: ${profile.bank_account_number || "account number not set"}`
    : null;

  const paymentMessage = [
    `Pay ${groupName} contributions:`,
    shortcode && `M-Pesa Paybill/Till: ${shortcode}`,
    shortcode && reference && `Account: ${reference}`,
    bankLine && `Bank: ${bankLine}`,
  ]
    .filter(Boolean)
    .join("\n");

  const hasPayIn = Boolean(shortcode || bankLine);

  // ----- 3. Setup checklist -----
  const checklist = [
    { id: "pay", done: Boolean(shortcode), label: "M-Pesa paybill or till added", section: "payments" },
    { id: "bank", done: Boolean(profile.bank_name), label: "Bank account added", section: "payments" },
    { id: "meeting", done: Boolean(profile.meeting_day), label: "Regular meeting day set", section: "rhythm" },
    { id: "officials", done: officials.length >= 3, label: "Chairperson, treasurer and secretary assigned", tab: "members" },
  ];
  const doneCount = checklist.filter((item) => item.done).length;
  const progress = Math.round((doneCount / checklist.length) * 100);

  const quickActions = [
    { id: "members", label: "Add a member", icon: UserPlus, tab: "members", show: true },
    { id: "meetings", label: "Start a meeting", icon: Video, tab: "meetings", show: canSee.meetings },
    { id: "loans", label: "Review loans", icon: HandCoins, tab: "loans", show: canSee.loans },
    { id: "treasury", label: "Treasury", icon: Landmark, tab: "treasury", show: true },
    { id: "businesses", label: "Businesses", icon: BriefcaseBusiness, tab: "businesses", show: canSee.businesses },
  ].filter((action) => action.show);

  const waitingCount =
    (badges.members || 0) +
    (canSee.exits ? badges.exits || 0 : 0) +
    (canSee.loans ? badges.loans || 0 : 0) +
    (canSee.meetings ? badges.meetings || 0 : 0);
  const officialsFilled = Math.min(officials.length, 3);

  return (
    <div className="space-y-6">
      {/* ---------- The four numbers a leader checks first ---------- */}
      <section aria-label="At a glance" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Waiting on you"
          value={waitingCount}
          icon={Inbox}
          tone={waitingCount ? "rose" : "emerald"}
          subtitle={waitingCount ? "Decisions only an official can make" : "You're all caught up"}
        />
        <MetricCard
          title="Setup"
          value={`${progress}%`}
          icon={ListChecks}
          tone={progress === 100 ? "emerald" : "amber"}
          subtitle={`${doneCount} of ${checklist.length} steps done`}
        />
        <MetricCard
          title="Officials in place"
          value={`${officialsFilled} of 3`}
          icon={UsersRound}
          tone={officialsFilled >= 3 ? "emerald" : "amber"}
          subtitle="Chairperson, treasurer, secretary"
          onClick={() => goToTab("members")}
        />
        <MetricCard
          title="Savings goals"
          value={goals.length}
          icon={Target}
          tone="violet"
          subtitle={goals.length ? "Active and being saved towards" : "None yet. Add one under Money"}
          onClick={() => goToTab("treasury")}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-12">
        {/* ================= Main column ================= */}
        <div className="min-w-0 space-y-6 xl:col-span-7">
          {/* ---------- Waiting on you ---------- */}
          <DeskPanel
            icon={Inbox}
            accent={waiting.length ? "rose" : "emerald"}
            title={waiting.length ? "Waiting on you" : "You're all caught up"}
            description={waiting.length ? "Start with whatever is at the top." : "Nothing needs a decision right now."}
            flush
          >
            {waiting.length === 0 ? (
              <div className="mx-6 mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300">
                <CheckCircle2 size={20} aria-hidden="true" />
                No join requests, exit requests or loans are waiting for a decision.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-obsidian-border dark:border-obsidian-border">
                {waiting.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-6 py-4">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1 basis-48">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>
                        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{item.detail}</p>
                      </div>
                      <Button size="sm" onClick={() => goToTab(item.tab)} icon={ArrowRight}>
                        {item.cta}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </DeskPanel>

          {/* ---------- Where members pay ---------- */}
          <DeskPanel
            icon={Wallet}
            title="Where members pay"
            description="The details members need to send contributions."
            flush
            action={
              hasPayIn ? (
                <button
                  type="button"
                  onClick={() => goToTab("governance", "payments")}
                  className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  Edit
                </button>
              ) : null
            }
          >
            {hasPayIn ? (
              <div className="px-6 pb-6 pt-1">
                <div className="grid overflow-hidden rounded-2xl bg-emerald-950 text-white md:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="space-y-5 p-6">
                    {shortcode && (
                      <div>
                        <p className="text-xs font-medium text-emerald-200">M-Pesa Paybill or Till</p>
                        <p className="mt-1 font-mono text-4xl font-bold tracking-wider">{shortcode}</p>
                        {reference && (
                          <p className="mt-2 text-sm text-emerald-100">
                            Account: <span className="font-mono font-semibold">{reference}</span>
                          </p>
                        )}
                      </div>
                    )}
                    {bankLine && (
                      <div className={shortcode ? "border-t border-white/10 pt-4" : ""}>
                        <p className="text-xs font-medium text-emerald-200">Bank</p>
                        <p className="mt-1 break-words font-mono text-sm">{bankLine}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col justify-center gap-2 border-t border-dashed border-white/25 p-5 md:w-56 md:border-l md:border-t-0">
                    <p className="text-xs text-emerald-200">Send to members</p>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(paymentMessage)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      <MessageCircle size={15} aria-hidden="true" />
                      Share on WhatsApp
                    </a>
                    <CopyButton value={paymentMessage} label="Copy message" copiedLabel="Message copied" size="md" variant="onDark" />
                    {shortcode && <CopyButton value={shortcode} label="Copy number" copiedLabel="Number copied" size="md" variant="onDark" />}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-6 mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-dashed border-slate-300 px-5 py-5 dark:border-obsidian-border">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-obsidian-raised">
                    <CreditCard size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">No payment details yet</p>
                    <p className="text-sm text-slate-500">Add a paybill, till or bank account so members know where to send money.</p>
                  </div>
                </div>
                <Button onClick={() => goToTab("governance", "payments")}>Add payment details</Button>
              </div>
            )}
          </DeskPanel>
        </div>

        {/* ================= Side rail ================= */}
        <aside className="min-w-0 space-y-6 xl:col-span-5">
          {/* ---------- Setup progress ---------- */}
          <DeskPanel
            icon={ListChecks}
            accent={progress === 100 ? "emerald" : "amber"}
            title={progress === 100 ? "Setup complete" : "Finish setting up"}
            description={`${doneCount} of ${checklist.length} steps done`}
          >
            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Setup progress"
              className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-obsidian-raised"
            >
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <ul className="mt-4 space-y-1">
              {checklist.map((item) => (
                <li key={item.id}>
                  {item.done ? (
                    <p className="flex items-center gap-3 px-2 py-2 text-sm text-slate-400">
                      <BadgeCheck size={17} className="shrink-0 text-emerald-500" aria-hidden="true" />
                      <span className="line-through">{item.label}</span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => goToTab(item.tab || "governance", item.section)}
                      className="group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm font-medium text-slate-800 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-100 dark:hover:bg-obsidian-raised"
                    >
                      <Circle size={17} className="shrink-0 text-slate-300" aria-hidden="true" />
                      <span className="flex-1">{item.label}</span>
                      <ArrowRight size={14} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </DeskPanel>

          {/* ---------- The group's rules at a glance ---------- */}
          <DeskPanel
            icon={Scale}
            title="How the group runs"
            action={
              <button
                type="button"
                onClick={() => goToTab("governance", "rhythm")}
                className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
              >
                Change
              </button>
            }
          >
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
              <Fact label="Members contribute" value={cap(profile.contribution_cycle || "monthly")} />
              <Fact label="Late payment fine" value={money(profile.fine_amount)} />
              <Fact label="Meets" value={profile.meeting_day || "Flexible"} />
              <Fact label="Extra approval above" value={money(profile.approval_threshold)} />
            </dl>
            {profile.constitution_url && (
              <a
                href={profile.constitution_url}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
              >
                <BadgeCheck size={14} aria-hidden="true" /> Read the group constitution
              </a>
            )}
          </DeskPanel>

          {/* ---------- Jump straight in ---------- */}
          <DeskPanel icon={CalendarCheck} title="Jump straight in">
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => goToTab(action.tab)}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3 text-left text-sm font-semibold text-slate-800 transition hover:border-emerald-300 hover:bg-emerald-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-obsidian-border dark:text-slate-100 dark:hover:bg-emerald-950/20"
                  >
                    <Icon size={16} className="shrink-0 text-emerald-600" aria-hidden="true" />
                    <span className="truncate">{action.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Press <kbd className="rounded border border-slate-200 px-1 text-[10px] font-semibold dark:border-slate-700">Ctrl K</kbd> anywhere on the desk to search every section.
            </p>
          </DeskPanel>
        </aside>
      </div>
    </div>
  );
}

const cap = (text) => String(text).charAt(0).toUpperCase() + String(text).slice(1);

function Fact({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 truncate text-lg font-bold text-slate-900 dark:text-white">{value}</dd>
    </div>
  );
}
