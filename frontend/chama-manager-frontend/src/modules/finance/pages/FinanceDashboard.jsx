import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import BusinessFundsSeparationNotice from "../components/BusinessFundsSeparationNotice";
import {
  Wallet,
  CircleDollarSign,
  AlertTriangle,
  PlusCircle,
  RefreshCw,
  Bell,
  Landmark,
  Send,
  PiggyBank,
  Users,
  FileText,
  Receipt,
  ScrollText,
  ShieldCheck,
  ShieldAlert,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Smartphone,
  Activity,
  CreditCard,
  Banknote,
} from "lucide-react";
import toast from "react-hot-toast";

import useWorkspace from "@/app/hooks/useWorkspace";
import useFinanceSummary from "../hooks/useFinanceSummary";
import useMyFinanceSummary from "../hooks/useMyFinanceSummary";
import useCashDepositStatus from "../hooks/useCashDepositStatus";
import usePaymentWatcher from "../hooks/usePaymentWatcher";
import useWorkspacePermissions from "../hooks/useworkspacepermissions";
import financeService from "../services/finance.service";
import mgrApi from "@/modules/chama/api/mgr.api";
import savingsShareoutService from "@/modules/chama/services/savingsShareout.service";
import MpesaStkModal from "../components/MpesaStkModal";
import contributionPlanApi from "@/modules/contribution-group/api/contributionPlan.api";
import {
  BalanceHero,
  FinanceNotifications,
  NewContributionsCard,
  TransactionsCta,
  buildContributionAlerts,
} from "../components/MoneyHub";
import Spinner from "@/shared/components/ui/Spinner";
import {
  Card,
  SectionHeading,
  StatusPill,
  Avatar,
  ProgressBar,
  EmptyState,
  money,
  percent,
  timeAgo,
} from "../components/FinanceUi";

// ============================================================
// FINANCE DASHBOARD
// ============================================================
//
// Design principles:
// - One primary financial position
// - Minimal cards
// - Clear hierarchy
// - Actions close to the balance
// - Transactions feel like a real financial ledger
// - Alerts only appear when action is required
// - No invented financial values
// - Members see their own financial position
//
// ============================================================

export default function FinanceDashboard() {
  const routeParams = useParams();
  const workspaceCtx = useWorkspace();

  const workspaceId =
    workspaceCtx?.workspaceId || routeParams?.workspaceId;

  const base = `/workspace/${workspaceId}`;
  const { isBurialChama } = workspaceCtx;

  usePaymentWatcher(workspaceId);

  const {
    summary,
    isLoading: loadingSummary,
    refetch: refetchFinance,
  } = useFinanceSummary(workspaceId);

  const { summary: mySummary } = useMyFinanceSummary(workspaceId);

  const { canForOthers, scopeOf, can, role } =
    useWorkspacePermissions(workspaceId);

  const seesGroupBooks = canForOthers("finance.summary.view");
  const canRecordForOthers = canForOthers("contributions.record");
  // The contribution overview endpoint is treasurer/chairperson only;
  // auditors and secretaries still see group books but not plan controls.
  const canManageContributions = [
    "treasurer",
    "chairperson",
  ].includes(role);
  const canSeeLedger = Boolean(
    scopeOf("finance.transactions.view")
  );

  // GET /finance/cash/status is gated server-side on
  // finance.accounts.view (chairperson/treasurer/auditor only, see
  // finance.routes.js) — a plain member always gets a 403 from it. Only
  // ever pass the hook a real workspaceId once we know the caller
  // actually holds that permission, so it neither fires a request the
  // API will reject nor keeps polling every 60s for nothing. Before
  // permissions have loaded this is false by default, which fails
  // closed (no request) rather than firing one that's likely to 403.
  const canViewCashStatus = can("finance.accounts.view");

  const { status: cashStatus } =
    useCashDepositStatus(canViewCashStatus ? workspaceId : null);

  const [isStkOpen, setIsStkOpen] = useState(false);

  const [register, setRegister] = useState(null);
  const [savings, setSavings] = useState(null);
  const [mgrData, setMgrData] = useState(null);
  const [glStatus, setGlStatus] = useState(null);
  const [trendWeeks, setTrendWeeks] = useState([]);
  // Contribution engine read models: managers get the leadership
  // overview, members get their own calendar.
  const [overview, setOverview] = useState(null);
  const [calendar, setCalendar] = useState(null);

  const [sendingReminders, setSendingReminders] =
    useState(false);

  const [isLoadingPanels, setIsLoadingPanels] =
    useState(true);

  // ============================================================
  // LOAD DASHBOARD DATA
  // ============================================================

  const loadPanels = useCallback(async () => {
    if (!workspaceId) return;

    setIsLoadingPanels(true);

    const [
      registerRes,
      savingsRes,
      mgrRes,
      glRes,
      trendRes,
      overviewRes,
      calendarRes,
    ] = await Promise.allSettled([
      financeService.getContributionsRegister(workspaceId),
      savingsShareoutService.getOverview(workspaceId),
      isBurialChama
        ? Promise.resolve(null)
        : mgrApi.getOverview(workspaceId),
      financeService.getGlBalance(workspaceId),
      financeService.getTrend(workspaceId),
      seesGroupBooks && canManageContributions
        ? contributionPlanApi.getLeadershipOverview(workspaceId)
        : Promise.resolve(null),
      !seesGroupBooks
        ? contributionPlanApi.getMemberCalendar(workspaceId)
        : Promise.resolve(null),
    ]);

    if (registerRes.status === "fulfilled") {
      setRegister(registerRes.value);
    }

    if (savingsRes.status === "fulfilled") {
      setSavings(savingsRes.value);
    }

    if (mgrRes.status === "fulfilled") {
      setMgrData(
        mgrRes.value?.data?.data ?? null
      );
    }

    if (glRes.status === "fulfilled") {
      setGlStatus(glRes.value);
    }

    if (trendRes.status === "fulfilled") {
      setTrendWeeks(
        trendRes.value?.weeks || []
      );
    }

    if (overviewRes.status === "fulfilled") {
      setOverview(overviewRes.value?.data?.data ?? null);
    }

    if (calendarRes.status === "fulfilled") {
      setCalendar(calendarRes.value?.data?.data ?? null);
    }

    setIsLoadingPanels(false);
  }, [workspaceId, isBurialChama, seesGroupBooks, canManageContributions]);

  useEffect(() => {
    loadPanels();
  }, [loadPanels]);

  useEffect(() => {
    const handler = () => {
      loadPanels();
      refetchFinance?.();
    };

    window.addEventListener(
      "finance:updated",
      handler
    );

    return () =>
      window.removeEventListener(
        "finance:updated",
        handler
      );
  }, [loadPanels, refetchFinance]);

  // ============================================================
  // DERIVED DATA
  // ============================================================

  const totals = register?.totals || {};
  const savingsTotals = savings?.totals || {};

  const cashBalance =
    summary?.cash_balance ?? 0;

  const outstandingLoans =
    summary?.outstanding_loans ?? 0;

  const pendingPayouts =
    summary?.pending_payouts ?? 0;

  const weeklyTrend = useMemo(() => {
    const max =
      Math.max(
        ...trendWeeks.map(
          (week) => Number(week.income) || 0
        ),
        0
      ) || 1;

    return trendWeeks.map((week) => ({
      ...week,
      height: `${Math.max(
        5,
        Math.round(
          ((Number(week.income) || 0) / max) *
            100
        )
      )}%`,
    }));
  }, [trendWeeks]);

  const trendChangePct = useMemo(() => {
    if (
      trendWeeks.length < 2 ||
      !trendWeeks[0]?.income
    ) {
      return null;
    }

    const first =
      Number(trendWeeks[0].income) || 0;

    const last =
      Number(
        trendWeeks[trendWeeks.length - 1].income
      ) || 0;

    if (!first) return null;

    return Math.round(
      ((last - first) / first) * 100
    );
  }, [trendWeeks]);

  const mgrPolicy =
    mgrData?.policy || null;

  const mgrRound =
    mgrData?.currentRound || null;

  const mgrParticipants =
    mgrPolicy?.participants || [];

  const mgrRoundNumber =
    mgrRound?.round_number || null;

  const mgrNextRecipient =
    mgrRound?.recipient_membership_id?.user_id
      ?.name ||
    mgrRound?.recipient_name ||
    null;

  const chaseList = useMemo(
    () =>
      (register?.members || [])
        .filter(
          (member) =>
            Number(member.outstanding) > 0
        )
        .slice(0, 5),
    [register]
  );

  const alerts = useMemo(
    () => [
      ...buildFinanceAlerts({ glStatus, cashStatus, totals, base }),
      ...buildContributionAlerts({
        overview,
        calendar,
        base,
        isManager: seesGroupBooks,
      }),
    ],
    [glStatus, cashStatus, totals, base, overview, calendar, seesGroupBooks]
  );

  const contributionPlans = seesGroupBooks
    ? overview?.plans || []
    : calendar?.plans || [];

  const mySavingsBalance = useMemo(() => {
    return (
      (savings?.members || []).find(
        (member) =>
          String(member.membership_id) ===
          String(workspaceCtx.membershipId)
      )?.balance ?? 0
    );
  }, [
    savings,
    workspaceCtx.membershipId,
  ]);

  // ============================================================
  // ACTIONS
  // ============================================================

  const handleSendReminders = async () => {
    setSendingReminders(true);

    try {
      if (mgrRound?._id) {
        await mgrApi.sendReminders(
          mgrRound._id
        );

        toast.success(
          `Reminders sent to ${
            totals.overdue_member_count || 0
          } member${
            totals.overdue_member_count === 1
              ? ""
              : "s"
          }.`
        );
      } else {
        toast.error(
          "No active contribution round to send reminders for."
        );
      }
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          "Could not send reminders right now."
      );
    } finally {
      setSendingReminders(false);
    }
  };

  // ============================================================
  // LOADING
  // ============================================================

  if (
    loadingSummary &&
    !summary &&
    isLoadingPanels
  ) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // ============================================================
  // MEMBER VIEW
  // ============================================================

  if (!seesGroupBooks) {
    return (
      <>
        <MemberFinanceView
          base={base}
          workspaceCtx={workspaceCtx}
          mySummary={mySummary}
          totals={totals}
          mySavingsBalance={mySavingsBalance}
          alerts={alerts}
          contributionPlans={contributionPlans}
          calendar={calendar}
          canRecordForOthers={canRecordForOthers}
          setIsStkOpen={setIsStkOpen}
          refetchFinance={refetchFinance}
          loadPanels={loadPanels}
        />

        <MpesaStkModal
          isOpen={isStkOpen}
          onClose={() => setIsStkOpen(false)}
          chamaId={workspaceId}
          title="Pay your contribution via M-Pesa"
          onSuccess={() => {
            refetchFinance?.();
            loadPanels();
          }}
        />
      </>
    );
  }

  // ============================================================
  // MAIN FINANCE VIEW
  // ============================================================

  return (
    <div className="finance-dashboard space-y-5 pb-14">
      <BusinessFundsSeparationNotice workspaceId={workspaceId} pending={summary?.business_separation_pending} />
      {/* ======================================================
          BALANCE HERO
      ====================================================== */}

      <BalanceHero
        compact
        eyebrow={isBurialChama ? "Welfare & finance" : "Money & contributions"}
        title="Available group balance"
        balance={money(cashBalance)}
        balanceHint="Money currently recorded in the group's financial position."
        reconciled={Boolean(glStatus?.balanced)}
        onRefresh={() => {
          loadPanels();
          refetchFinance?.();
        }}
        refreshing={isLoadingPanels}
        primaryAction={{
          to: canRecordForOthers
            ? `${base}/finance/record-contribution`
            : `${base}/finance/contributions`,
          label: canRecordForOthers
            ? "Record contribution"
            : "Manage contributions",
        }}
        secondaryAction={{
          label: "M-Pesa",
          onClick: () => setIsStkOpen(true),
        }}
        tiles={[
          {
            icon: CircleDollarSign,
            label: "Collected",
            value: money(totals.collected || 0),
            detail: `${totals.contributor_count || 0} member payments`,
          },
          {
            icon: AlertTriangle,
            label: "Outstanding",
            value: money(totals.outstanding || 0),
            detail: `${totals.overdue_member_count || 0} members overdue`,
            danger: Number(totals.overdue_member_count) > 0,
          },
          {
            icon: PiggyBank,
            label: isBurialChama ? "Welfare fund" : "Pooled savings",
            value: money(savingsTotals.total_savings || 0),
            detail: "Held for members",
          },
          {
            icon: Send,
            label: "Committed out",
            value: money(pendingPayouts + outstandingLoans),
            detail: `${money(pendingPayouts)} payouts · ${money(outstandingLoans)} loans`,
          },
        ]}
      />

      {/* ======================================================
          MAIN CONTENT
      ====================================================== */}

      <div className="grid gap-5 lg:grid-cols-12">
        {/* ====================================================
            LEFT COLUMN
        ==================================================== */}

        <div className="space-y-5 lg:col-span-8">
          {/* Collection */}
          <Card className="overflow-hidden p-0">
            <div className="p-5 sm:p-6">
              <SectionHeading
                title="Collection progress"
                subtitle={
                  totals.expected > 0
                    ? `${money(
                        totals.collected
                      )} collected from ${money(
                        totals.expected
                      )} expected`
                    : "No contribution obligations have been raised yet"
                }
                action={
                  <Link
                    to={`${base}/finance/contributions`}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-mint"
                  >
                    View register
                    <ChevronRight size={13} />
                  </Link>
                }
              />

              {totals.expected > 0 ? (
                <div className="mt-5">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-3xl font-black tracking-tight text-slate-950 dark:text-mist">
                        {percent(
                          totals.collection_rate
                        )}
                      </p>

                      <p className="mt-1 text-[11px] font-medium text-slate-400">
                        {totals.contributor_count ||
                          0}{" "}
                        of{" "}
                        {totals.member_count ||
                          0} members have paid
                      </p>
                    </div>

                    <span className="text-right text-[11px] font-bold text-slate-400">
                      {money(
                        totals.outstanding
                      )}{" "}
                      remaining
                    </span>
                  </div>

                  <div className="mt-4">
                    <ProgressBar
                      value={
                        totals.collection_rate
                      }
                      tone={
                        totals.collection_rate >=
                        80
                          ? "emerald"
                          : totals.collection_rate >=
                            40
                          ? "amber"
                          : "rose"
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="py-4">
                  <EmptyState
                    icon={Receipt}
                    title="Nothing to collect yet"
                    description="Create a contribution plan to start raising obligations against members."
                  />
                </div>
              )}
            </div>

            {seesGroupBooks &&
              chaseList.length > 0 && (
                <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-5 dark:border-obsidian-border dark:bg-obsidian-raised/20">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                      Requires attention
                    </p>

                    <Link
                      to={`${base}/finance/contributions`}
                      className="text-[10px] font-bold text-emerald-600 dark:text-mint"
                    >
                      View all
                    </Link>
                  </div>

                  <div className="space-y-1">
                    {chaseList.map(
                      (member) => (
                        <div
                          key={
                            member.membership_id
                          }
                          className="flex items-center justify-between gap-4 rounded-xl px-2 py-2.5 transition hover:bg-white dark:hover:bg-obsidian-card"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar
                              name={
                                member.name
                              }
                              url={
                                member.avatar_url
                              }
                              size={32}
                            />

                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-slate-900 dark:text-mist">
                                {member.name}
                              </p>

                              <p className="text-[10px] font-medium text-slate-400">
                                Last paid{" "}
                                {timeAgo(
                                  member.last_payment_at
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="font-mono text-xs font-black text-rose-500">
                              {money(
                                member.outstanding
                              )}
                            </p>

                            <StatusPill
                              status={
                                member.standing
                              }
                            />
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
          </Card>

          {/* Contributions (newest first) */}
          <NewContributionsCard
            plans={contributionPlans}
            base={base}
            isManager
          />

          {/* Transactions live in the Books pages */}
          <TransactionsCta base={base} isManager />

          {/* Financial products */}
          <Card className="p-6">
            <SectionHeading
              title="Financial products"
              subtitle="Manage each part of the group's money separately"
            />

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <FinanceProduct
                to={`${base}/finance/savings`}
                icon={PiggyBank}
                title={
                  isBurialChama
                    ? "Welfare fund"
                    : "Savings"
                }
                description={
                  savingsTotals.total_savings
                    ? `${money(
                        savingsTotals.total_savings
                      )} pooled`
                    : "No savings recorded"
                }
              />

              {!isBurialChama && (
                <>
                  <FinanceProduct
                    to={`${base}/finance/savings-shareout`}
                    icon={RefreshCw}
                    title="Savings share-out"
                    description={
                      savingsTotals.shared_out_total
                        ? `${money(
                            savingsTotals.shared_out_total
                          )} distributed`
                        : "No share-out yet"
                    }
                  />

                  <FinanceProduct
                    to={`${base}/mgr`}
                    icon={Users}
                    title="Merry-go-round"
                    description={
                      mgrRoundNumber
                        ? `Round ${mgrRoundNumber}${
                            mgrNextRecipient
                              ? ` · next ${mgrNextRecipient}`
                              : ""
                          }`
                        : mgrPolicy
                        ? "Policy configured"
                        : "Not configured"
                    }
                  />

                  <FinanceProduct
                    to={`${base}/chama-contributions`}
                    icon={CircleDollarSign}
                    title="Chama contributions"
                    description="Ad-hoc pooled collections"
                  />
                </>
              )}

              <FinanceProduct
                to={`${base}/finance/payouts`}
                icon={Send}
                title={
                  isBurialChama
                    ? "Benevolent payouts"
                    : "Payouts"
                }
                description={
                  pendingPayouts
                    ? `${money(
                        pendingPayouts
                      )} pending`
                    : "Nothing pending"
                }
              />

              <FinanceProduct
                to={`${base}/finance/bank-accounts`}
                icon={Landmark}
                title="Bank & cash"
                description="Accounts, deposits and cash"
              />
            </div>
          </Card>
        </div>

        {/* ====================================================
            RIGHT COLUMN
        ==================================================== */}

        <div className="space-y-5 lg:col-span-4">
          {/* Notifications */}
          <FinanceNotifications alerts={alerts} />

          {/* Quick actions */}
          <Card className="p-5">
            <div className="mb-4">
              <h2 className="text-sm font-black text-slate-950 dark:text-mist">
                Quick actions
              </h2>

              <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                Common treasury tasks
              </p>
            </div>

            <div className="space-y-2">
              <QuickAction
                icon={Smartphone}
                title="Collect with M-Pesa"
                description="Send an STK payment request"
                onClick={() =>
                  setIsStkOpen(true)
                }
              />

              {seesGroupBooks && (
                <QuickAction
                  icon={Bell}
                  title={
                    sendingReminders
                      ? "Sending reminders..."
                      : "Send payment reminders"
                  }
                  description={
                    totals.overdue_member_count
                      ? `${totals.overdue_member_count} member${
                          totals.overdue_member_count ===
                          1
                            ? ""
                            : "s"
                        } overdue`
                      : "Nobody is overdue"
                  }
                  onClick={
                    handleSendReminders
                  }
                  disabled={sendingReminders}
                />
              )}

              <QuickLink
                to={`${base}/finance/contributions`}
                icon={Receipt}
                title="Contribution register"
                description="Payments and member standing"
              />

              {canSeeLedger && (
                <QuickLink
                  to={`${base}/finance/ledger`}
                  icon={ScrollText}
                  title="General ledger"
                  description="Every accounting posting"
                />
              )}

              <QuickLink
                to={`${base}/reports`}
                icon={FileText}
                title="Financial reports"
                description="Statements and treasury reports"
              />
            </div>
          </Card>

          {/* Income trend */}
          <Card className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-black text-slate-950 dark:text-mist">
                  Collection trend
                </h2>

                <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                  Contribution income
                </p>
              </div>

              {trendChangePct !== null && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${
                    trendChangePct >= 0
                      ? "bg-emerald-50 text-emerald-700 dark:bg-mint-deep dark:text-mint"
                      : "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300"
                  }`}
                >
                  {trendChangePct >= 0 ? (
                    <ArrowUpRight size={11} />
                  ) : (
                    <ArrowDownLeft size={11} />
                  )}

                  {trendChangePct >= 0
                    ? "+"
                    : ""}
                  {trendChangePct}%
                </span>
              )}
            </div>

            {weeklyTrend.length > 0 ? (
              <>
                <div className="mt-6 flex h-36 items-end gap-2 border-b border-slate-100 dark:border-obsidian-border">
                  {weeklyTrend.map(
                    (week) => (
                      <div
                        key={week.label}
                        className="group flex h-full flex-1 flex-col items-center justify-end"
                      >
                        <div
                          className="w-full max-w-[38px] rounded-t-lg bg-emerald-100 transition-all group-hover:bg-emerald-500 dark:bg-mint-deep/60 dark:group-hover:bg-mint"
                          style={{
                            height:
                              week.height,
                          }}
                          title={`${week.label}: ${money(
                            week.income
                          )}`}
                        />

                        <span className="mt-2 text-[9px] font-bold text-slate-400">
                          {week.label}
                        </span>
                      </div>
                    )
                  )}
                </div>

                <div className="mt-3 flex justify-between text-[10px] font-semibold text-slate-400">
                  <span>
                    {money(
                      weeklyTrend[0].income
                    )}
                  </span>

                  <span className="font-bold text-slate-700 dark:text-mist">
                    {money(
                      weeklyTrend[
                        weeklyTrend.length - 1
                      ].income
                    )}
                  </span>
                </div>
              </>
            ) : (
              <div className="py-8 text-center">
                <Activity
                  size={20}
                  className="mx-auto text-slate-300"
                />

                <p className="mt-2 text-[11px] font-medium text-slate-400">
                  Collection history will appear here.
                </p>
              </div>
            )}
          </Card>

          {/* Reconciliation */}
          {glStatus &&
            !glStatus.checkFailed && (
              <Link
                to={`${base}/finance/trial-balance`}
                className="block rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-emerald-300 hover:shadow-sm dark:border-obsidian-border dark:bg-obsidian-card dark:hover:border-mint"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      glStatus.balanced
                        ? "bg-emerald-100 text-emerald-700 dark:bg-mint-deep dark:text-mint"
                        : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                    }`}
                  >
                    {glStatus.balanced ? (
                      <ShieldCheck size={19} />
                    ) : (
                      <ShieldAlert size={19} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black text-slate-900 dark:text-mist">
                        {glStatus.balanced
                          ? "Books are balanced"
                          : "Books need attention"}
                      </p>

                      <ChevronRight
                        size={14}
                        className="shrink-0 text-slate-400"
                      />
                    </div>

                    <p className="mt-1 text-[10px] font-medium text-slate-400">
                      {money(
                        glStatus.totalDebits
                      )}{" "}
                      debits ·{" "}
                      {money(
                        glStatus.totalCredits
                      )}{" "}
                      credits
                    </p>
                  </div>
                </div>
              </Link>
            )}
        </div>
      </div>

      {/* ======================================================
          M-PESA
      ====================================================== */}

      <MpesaStkModal
        isOpen={isStkOpen}
        onClose={() => setIsStkOpen(false)}
        chamaId={workspaceId}
        title="Collect a contribution via M-Pesa"
        onSuccess={() => {
          refetchFinance?.();
          loadPanels();
        }}
      />
    </div>
  );
}

// ============================================================
// MEMBER FINANCE VIEW
// ============================================================

function MemberFinanceView({
  base,
  workspaceCtx,
  mySummary,
  totals,
  mySavingsBalance,
  alerts,
  contributionPlans,
  calendar,
  canRecordForOthers,
  setIsStkOpen,
  refetchFinance,
  loadPanels,
}) {
  const myContributions =
    mySummary?.my_total_contributions ?? 0;

  const myPayments =
    mySummary?.my_payment_count ?? 0;

  const outstanding =
    totals.outstanding ?? 0;

  return (
    <div className="space-y-6 pb-14">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-mint-deep dark:text-mint">
            <Wallet size={17} />
          </div>

          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
            My finance
          </span>
        </div>

        <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-mist">
          My financial position
        </h1>

        <p className="mt-1 text-xs font-medium text-slate-500 dark:text-mist-muted">
          Your contributions, obligations and savings.
        </p>
      </div>

      {/* Main member balance */}
      <BalanceHero
        eyebrow="My finance"
        title="Your total contributions"
        balance={money(myContributions)}
        balanceHint={`${myPayments} payment${myPayments === 1 ? "" : "s"} recorded`}
        primaryAction={{
          to: `${base}/finance/contributions`,
          label: "My contributions",
        }}
        secondaryAction={{
          label: "Pay with M-Pesa",
          onClick: () => setIsStkOpen(true),
        }}
        tiles={[
          {
            icon: AlertTriangle,
            label: "You still owe",
            value: money(calendar?.summary?.outstanding ?? outstanding),
            detail:
              Number(calendar?.summary?.overdue ?? totals.overdue_amount) > 0
                ? `${money(calendar?.summary?.overdue ?? totals.overdue_amount)} overdue`
                : "Nothing overdue",
            danger: Number(calendar?.summary?.overdue ?? totals.overdue_amount) > 0,
          },
          {
            icon: PiggyBank,
            label: "Savings balance",
            value: money(mySavingsBalance),
            detail: "Your savings position",
          },
          {
            icon: CircleDollarSign,
            label: "Paid this year",
            value: money(calendar?.summary?.paid_this_year ?? 0),
            detail:
              Number(calendar?.summary?.advance_held) > 0
                ? `${money(calendar.summary.advance_held)} paid in advance`
                : "Across all contributions",
          },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <FinanceNotifications alerts={alerts} />

          <NewContributionsCard
            plans={contributionPlans}
            base={base}
            emptyHint="Your group has not added any contributions yet."
          />

          <TransactionsCta base={base} />
        </div>

        <div className="lg:col-span-5">
          <Card className="p-5">
            <h2 className="text-sm font-black text-slate-950 dark:text-mist">
              Your finance
            </h2>

            <div className="mt-4 space-y-2">
              <QuickLink
                to={`${base}/finance/wallet`}
                icon={Wallet}
                title="My wallet"
                description="Your complete money position"
              />

              <QuickLink
                to={`${base}/finance/savings`}
                icon={PiggyBank}
                title="Savings"
                description="View your savings"
              />

              <QuickLink
                to={`${base}/finance/contributions`}
                icon={Receipt}
                title="Contributions"
                description="View your contribution history"
              />

              {canRecordForOthers && (
                <QuickLink
                  to={`${base}/finance/record-contribution`}
                  icon={PlusCircle}
                  title="Record contribution"
                  description="Record a member payment"
                />
              )}
            </div>
          </Card>
        </div>
      </div>

      <MpesaStkModal
        isOpen={false}
        onClose={() => {}}
        chamaId={workspaceCtx?.workspaceId}
        title="Pay your contribution via M-Pesa"
        onSuccess={() => {
          refetchFinance?.();
          loadPanels();
        }}
      />
    </div>
  );
}

// ============================================================
// PRIMARY BALANCE SUPPORTING METRIC
// ============================================================

function MiniFinancialMetric({
  label,
  value,
  detail,
  icon: Icon,
  danger = false,
}) {
  return (
    <div className="flex items-center gap-3 px-6 py-4">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          danger
            ? "bg-rose-50 text-rose-500 dark:bg-rose-950/50"
            : "bg-slate-100 text-slate-500 dark:bg-obsidian-raised dark:text-mist-muted"
        }`}
      >
        <Icon size={16} />
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-400">
          {label}
        </p>

        <p
          className={`mt-0.5 truncate font-mono text-sm font-black ${
            danger
              ? "text-rose-500"
              : "text-slate-900 dark:text-mist"
          }`}
        >
          {value}
        </p>

        <p className="mt-0.5 truncate text-[9px] font-medium text-slate-400">
          {detail}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// FINANCE ALERTS (data only, rendered by FinanceNotifications)
// ============================================================

export function buildFinanceAlerts({
  glStatus,
  cashStatus,
  totals,
  base,
}) {
  const alerts = [];

  if (
    glStatus &&
    glStatus.balanced === false
  ) {
    alerts.push({
      tone: "rose",
      icon: ShieldAlert,
      title: "Books need reconciliation",
      detail: `There is a ${money(
        glStatus.difference
      )} difference between debits and credits.`,
      action: "Review",
      to: `${base}/finance/trial-balance`,
    });
  }

  if (cashStatus?.is_overdue) {
    alerts.push({
      tone: "rose",
      icon: Clock,
      title: "Cash deposit overdue",
      detail: `${money(
        cashStatus.cash_balance
      )} is still held as cash outside the deposit window.`,
      action: "Deposit",
      to: `${base}/finance/bank-accounts`,
    });
  } else if (
    cashStatus?.cash_balance > 0
  ) {
    alerts.push({
      tone: "amber",
      icon: Landmark,
      title: `${money(
        cashStatus.cash_balance
      )} held as cash`,
      detail: cashStatus.hours_remaining
        ? `Bank within approximately ${Math.round(
            cashStatus.hours_remaining
          )} hours.`
        : "Bank within the configured deposit window.",
      action: "Deposit",
      to: `${base}/finance/bank-accounts`,
    });
  }

  if (
    Number(totals.overdue_member_count) > 0
  ) {
    alerts.push({
      tone: "amber",
      icon: AlertTriangle,
      title: `${
        totals.overdue_member_count
      } member${
        totals.overdue_member_count === 1
          ? ""
          : "s"
      } overdue`,
      detail: `${money(
        totals.overdue_amount
      )} is past its due date.`,
      action: "Review",
      to: `${base}/finance/contributions`,
    });
  }

  return alerts.map((alert, index) => ({
    ...alert,
    id: `fin-${index}`,
  }));
}

// ============================================================
// FINANCIAL PRODUCT
// ============================================================

function FinanceProduct({
  to,
  icon: Icon,
  title,
  description,
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 transition hover:border-emerald-200 hover:bg-emerald-50/40 dark:border-obsidian-border dark:bg-obsidian-raised/30 dark:hover:border-mint/30 dark:hover:bg-obsidian-raised"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm dark:bg-obsidian-card dark:text-mist-muted">
        <Icon size={16} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-slate-900 dark:text-mist">
          {title}
        </p>

        <p className="mt-0.5 truncate text-[10px] font-medium text-slate-400">
          {description}
        </p>
      </div>

      <ChevronRight
        size={14}
        className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-500"
      />
    </Link>
  );
}

// ============================================================
// QUICK ACTION
// ============================================================

function QuickAction({
  icon: Icon,
  title,
  description,
  onClick,
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 text-left transition hover:border-emerald-200 hover:bg-emerald-50/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-obsidian-border dark:bg-obsidian-raised/30 dark:hover:border-mint/30 dark:hover:bg-obsidian-raised"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm dark:bg-obsidian-card dark:text-mint">
        <Icon size={16} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-slate-900 dark:text-mist">
          {title}
        </p>

        <p className="mt-0.5 truncate text-[10px] font-medium text-slate-400">
          {description}
        </p>
      </div>

      <ChevronRight
        size={14}
        className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5"
      />
    </button>
  );
}

// ============================================================
// QUICK LINK
// ============================================================

function QuickLink({
  to,
  icon: Icon,
  title,
  description,
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 transition hover:border-slate-200 hover:bg-white dark:border-obsidian-border dark:bg-obsidian-raised/30 dark:hover:bg-obsidian-card"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm dark:bg-obsidian-card dark:text-mist-muted">
        <Icon size={16} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-slate-900 dark:text-mist">
          {title}
        </p>

        <p className="mt-0.5 truncate text-[10px] font-medium text-slate-400">
          {description}
        </p>
      </div>

      <ChevronRight
        size={14}
        className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5"
      />
    </Link>
  );
}
