import { Link } from "react-router-dom";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Banknote, CalendarClock, ChevronRight, Coins, Landmark, Smartphone, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import clsx from "clsx";

import { compact as shortMoney, money, num } from "../../../utils/overview";
import { plural, relativeDay, toneByPct } from "../../../utils/overviewPro";
import { StackedBar } from "../charts";
import { Delta, LinkRow, Meter, Metric, Nudge, Panel, SectionHead, cardCls, tone } from "./ProParts";

/* ==========================================================================
 * 2. FINANCIAL SNAPSHOT - money in one look
 * ========================================================================== */

function Tile({ icon: Icon, t = "slate", children, className }) {
  return (
    <div className={clsx(cardCls, "p-5", className)}>
      <div className="flex items-start gap-3.5">
        {Icon ? (
          <span className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone(t).chip)}>
            <Icon size={17} aria-hidden="true" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

/**
 * `compact` is the Summary-tab version: the four figures that matter most.
 * The full version (Money tab) adds income, expenses, fund split and balances.
 */
export function FinancialSnapshot({ base, collection, flows, summary, treasury, funds, contribDue, loanWatch, unpaid, atRiskMembers, compact = false, onNudge }) {
  const goalTone = collection.rate == null ? "slate" : toneByPct(collection.rate, 80, 50);
  const remaining = Math.max(0, collection.expected - collection.paid);
  const arrearsShare = collection.expected > 0 ? Math.round((collection.balance / collection.expected) * 100) : 0;
  const arrearsTone = collection.balance <= 0 ? "emerald" : arrearsShare > 30 ? "rose" : "amber";

  // Next expected cash in: the contribution due date first, otherwise the
  // soonest loan repayment, otherwise an honest prompt to set one.
  const nextIn = contribDue && collection.balance > 0
    ? { amount: collection.balance, who: plural(unpaid, "member"), when: relativeDay(contribDue) }
    : loanWatch?.dueThisWeek?.length
      ? { amount: loanWatch.dueThisWeekAmount, who: plural(loanWatch.dueThisWeek.length, "member"), when: relativeDay(loanWatch.dueThisWeek[0].due) }
      : null;

  const goal = (
    <Tile key="goal" icon={Wallet} t={goalTone}>
      {collection.hasData ? (
        <>
          <Metric
            label="Goal vs collected"
            value={<>{money(collection.paid)}<span className="text-sm font-semibold text-slate-400"> / {shortMoney(collection.expected)}</span></>}
            tone={goalTone}
            context={`${Math.round(collection.rate || 0)}% of goal · ${money(remaining)} to go`}
          />
          <Meter value={collection.rate} tone={goalTone} label="Collected against goal" className="mt-4" height="h-2" />
        </>
      ) : (
        <Nudge icon={Wallet} title="No collection goal yet" hint="Set a contribution plan to track expected vs collected." to={`${base}/contributions`} cta="Create plan" />
      )}
    </Tile>
  );

  const net = (
    <Tile key="net" icon={flows.net >= 0 ? TrendingUp : TrendingDown} t={flows.net >= 0 ? "emerald" : "rose"}>
      <Metric
        label="Net cashflow"
        value={`${flows.net >= 0 ? "+" : "−"}${money(Math.abs(flows.net))}`}
        tone={flows.net >= 0 ? "emerald" : "rose"}
        context={
          flows.netChange == null
            ? "No earlier period to compare"
            : `${flows.netChange >= 0 ? "+" : "−"}${money(Math.abs(flows.netChange))} vs previous period`
        }
      />
    </Tile>
  );

  const arrears = (
    <Tile key="arrears" icon={AlertTriangle} t={arrearsTone}>
      <Metric
        label="Arrears"
        value={money(collection.balance)}
        tone={arrearsTone}
        context={collection.balance > 0 ? `${plural(atRiskMembers.length, "member")} behind · ${arrearsShare}% of goal` : "Nobody is behind this cycle"}
      />
      {collection.balance > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <Link to={`${base}/contributions`} className="inline-flex items-center gap-1 text-xs font-bold text-violet-700 hover:underline dark:text-mint">
            Fix arrears <ChevronRight size={13} aria-hidden="true" />
          </Link>
          {onNudge ? (
            <button type="button" onClick={onNudge} className="inline-flex items-center gap-1 text-xs font-bold text-violet-700 hover:underline dark:text-mint">
              Send reminders
            </button>
          ) : null}
        </div>
      ) : null}
    </Tile>
  );

  const cashIn = (
    <Tile key="cashin" icon={CalendarClock} t="slate">
      {nextIn ? (
        <Metric label="Next expected cash in" value={money(nextIn.amount)} context={`From ${nextIn.who} · due ${nextIn.when}`} />
      ) : (
        <Nudge icon={CalendarClock} title="No due date set" hint="Add a due date to your contribution plan so cash-in is forecast." to={`${base}/contributions`} cta="Set due date" />
      )}
    </Tile>
  );

  if (compact) {
    return (
      <section aria-label="Financial snapshot" className="space-y-4">
        <SectionHead
          title="Money at a glance"
          action={<Link to={`${base}/finance`} className="inline-flex items-center gap-1 text-sm font-semibold text-violet-700 hover:underline dark:text-mint">Open finance <ChevronRight size={15} aria-hidden="true" /></Link>}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {goal}
          {net}
          {arrears}
          {cashIn}
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Financial snapshot" className="space-y-6">
      <SectionHead
        title="Money"
        description="Collections, cashflow and where the funds sit."
        action={<Link to={`${base}/finance`} className="inline-flex items-center gap-1 text-sm font-semibold text-violet-700 hover:underline dark:text-mint">Open finance <ChevronRight size={15} aria-hidden="true" /></Link>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {goal}

        <Tile icon={ArrowUpRight} t="emerald">
          <Metric label={`Income · last ${flows.weeks || 4} weeks`} value={money(flows.income)} tone="emerald" context={<Delta value={flows.incomeChange} label="vs previous period" />} />
          <p className="mt-3 text-xs text-slate-500 dark:text-mist-muted">Contributions, repayments and interest received.</p>
        </Tile>

        <Tile icon={ArrowDownRight} t="rose">
          <Metric label={`Expenses · last ${flows.weeks || 4} weeks`} value={money(flows.expense)} context={<Delta value={flows.expenseChange} goodWhenUp={false} label="vs previous period" />} />
          <p className="mt-3 text-xs text-slate-500 dark:text-mist-muted">Loans out, payouts, welfare and fees.</p>
        </Tile>

        {net}
        {arrears}
        {cashIn}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel icon={Landmark} title="Where the money sits" eyebrow="Fund breakdown">
          {funds.parts.length ? (
            <StackedBar
              segments={funds.parts.map((p) => ({ key: p.key, label: p.label, value: p.value, color: p.color, display: `${money(p.value)} · ${p.pct}%` }))}
            />
          ) : (
            <Nudge icon={Landmark} title="No balances posted yet" hint="Record your first contribution to see how funds are split." to={`${base}/finance/record-contribution`} cta="Record payment" />
          )}
        </Panel>

        <Panel icon={Smartphone} title="M-Pesa float & bank balance" eyebrow="Live balances"
          action={<Link to={`${base}/finance/accounts`} className="text-xs font-semibold text-violet-700 hover:underline dark:text-mint">Accounts</Link>}>
          {treasury.classified ? (
            <dl className="grid grid-cols-3 gap-4">
              {[
                ["M-Pesa float", treasury.mpesa, Smartphone],
                ["Bank", treasury.bank, Landmark],
                ["Petty cash", treasury.petty, Banknote],
              ].map(([label, value, Icon]) => (
                <div key={label}>
                  <dt className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-mist-muted"><Icon size={12} aria-hidden="true" />{label}</dt>
                  <dd className="mt-1 truncate text-sm font-extrabold tabular-nums">{value > 0 ? money(value) : "—"}</dd>
                </div>
              ))}
              {treasury.other > 0 ? (
                <div className="col-span-3 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-obsidian-border dark:text-mist-muted">
                  Other cash accounts: <b className="text-slate-800 dark:text-mist">{money(treasury.other)}</b>
                </div>
              ) : null}
            </dl>
          ) : (
            <div>
              <p className="text-2xl font-extrabold tabular-nums">{money(treasury.total)}</p>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-mist-muted">
                Total cash and bank position. Name your accounts “M-Pesa”, “Bank” and “Petty cash” to see them split here.
              </p>
            </div>
          )}
        </Panel>
      </div>
    </section>
  );
}

/* ==========================================================================
 * 6. LOANS & LENDING HEALTH
 * ========================================================================== */

export function LoansPanel({ base, loans, loanWatch, ltf, summary, loading }) {
  if (loading) return null;

  if (!loans) {
    return (
      <Panel icon={Coins} title="Loans & lending" eyebrow="Core chama business">
        <Nudge icon={Coins} title="Loan data unavailable" hint="Loan figures are visible to authorised officials." to={`${base}/loans`} cta="Open loan book" />
      </Panel>
    );
  }

  const repayTone = loans.repayment == null ? "slate" : toneByPct(loans.repayment, 90, 75);
  const outstanding = num(summary?.outstanding_loans) || loans.outstanding;

  return (
    <Panel
      icon={Coins} title="Loans & lending" eyebrow="Core chama business"
      action={<Link to={`${base}/loans`} className="text-xs font-semibold text-violet-700 hover:underline dark:text-mint">Loan book</Link>}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {/* 34 */}
        <Metric
          label="Active loans" value={loanWatch.activeCount || loans.count}
          context={`${money(outstanding)} outstanding`}
        />
        <Metric
          label="Repayment rate" value={loans.repayment == null ? "—" : `${loans.repayment}%`} tone={repayTone}
          context={loans.allCurrent ? "All loans current" : "Some instalments overdue"}
        />
        {/* 38 */}
        <div>
          <Metric
            label="Loan-to-fund ratio" value={ltf.ratio == null ? "—" : `${ltf.ratio}%`} tone={ltf.tone}
            context={`${ltf.zone}${ltf.ratio != null ? " · lent out vs funds held" : ""}`}
          />
          {ltf.ratio != null ? <Meter value={ltf.ratio} tone={ltf.tone} label="Loan to fund ratio" className="mt-2" /> : null}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {/* 36 */}
        {loanWatch.defaultedCount > 0 ? (
          <LinkRow
            to={`${base}/loans`} tone="rose" icon={AlertTriangle}
            title={`${plural(loanWatch.defaultedCount, "loan")} overdue${loanWatch.worstDaysOverdue ? ` · worst ${loanWatch.worstDaysOverdue} days` : ""}`}
            detail="Follow up before it hits repayment and trust"
          />
        ) : (
          <Nudge icon={Coins} tone="emerald" title="No defaulted loans" hint="Every active loan is within its repayment terms." />
        )}

        {/* 35 */}
        {loanWatch.dueThisWeek.length > 0 ? (
          <LinkRow
            to={`${base}/loans`} tone="amber" icon={CalendarClock}
            title={`${money(loanWatch.dueThisWeekAmount)} repayments due this week`}
            detail={`From ${plural(loanWatch.dueThisWeek.length, "member")}, next ${relativeDay(loanWatch.dueThisWeek[0].due)}`}
          />
        ) : null}

        {loans.awaiting > 0 ? (
          <LinkRow
            to={`${base}/loans`} tone="violet" icon={Coins}
            title={`${plural(loans.awaiting, "application")} awaiting your decision`}
            detail={loans.pending?.[0] ? `${loans.pending[0].member_name || "Member"} · ${money(loans.pending[0].amount)}` : "Open the loan book"}
          />
        ) : null}
      </div>
    </Panel>
  );
}
