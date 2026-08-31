/**
 * ============================================================
 * IN-HOUSE INSIGHTS ENGINE
 * ============================================================
 *
 * No external AI API involved — this is a deterministic,
 * rule-based analyzer we own outright. It looks at the real
 * numbers for a workspace (contributions, loans, cash) and
 * turns them into plain-language observations, each tagged
 * with a severity so the UI can highlight what matters most.
 *
 * severity: 'good' | 'info' | 'warning' | 'critical'
 * ============================================================
 */

const money = (n) =>
  Number(n || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 });

function pushInsight(list, insight) {
  list.push({ id: `${insight.type}-${list.length}`, ...insight });
}

function contributionInsights(ctx, insights) {
  const { memberCount, overdueCount, paidCount, activePlans, totalContributed } = ctx;

  if (activePlans === 0) {
    pushInsight(insights, {
      type: "contributions",
      severity: "info",
      title: "No active contribution plan",
      message:
        "There isn't an active contribution plan right now, so no one has anything due. Set one up if you want the group collecting regularly again.",
    });
    return;
  }

  if (memberCount && overdueCount > 0) {
    const rate = Math.round((overdueCount / memberCount) * 100);
    pushInsight(insights, {
      type: "contributions",
      severity: rate >= 40 ? "critical" : rate >= 15 ? "warning" : "info",
      title: `${overdueCount} member${overdueCount === 1 ? "" : "s"} behind on contributions`,
      message:
        rate >= 40
          ? `${rate}% of members have an overdue contribution. That's high enough to affect payouts and trust — worth a reminder push or a conversation at the next meeting.`
          : `${overdueCount} of ${memberCount} members (${rate}%) currently have an overdue contribution.`,
    });
  } else if (memberCount && paidCount != null && activePlans > 0) {
    pushInsight(insights, {
      type: "contributions",
      severity: "good",
      title: "Everyone is up to date",
      message: "No members currently have an overdue contribution on the active plan. Nice discipline.",
    });
  }

  if (memberCount && paidCount != null && activePlans > 0) {
    const participation = Math.round((paidCount / memberCount) * 100);
    if (participation < 50) {
      pushInsight(insights, {
        type: "participation",
        severity: "warning",
        title: "Low contribution participation",
        message: `Only ${participation}% of members have made a contribution on the current plan so far.`,
      });
    }
  }

  if (ctx.targetGoal && totalContributed) {
    const progress = Math.min(100, Math.round((totalContributed / ctx.targetGoal) * 100));
    if (progress >= 90 && progress < 100) {
      pushInsight(insights, {
        type: "goal",
        severity: "good",
        title: "Almost at the target",
        message: `You're at ${progress}% of the KES ${money(ctx.targetGoal)} goal — KES ${money(
          ctx.targetGoal - totalContributed
        )} left to go.`,
      });
    } else if (progress >= 100) {
      pushInsight(insights, {
        type: "goal",
        severity: "good",
        title: "Target reached",
        message: `The group has reached its KES ${money(ctx.targetGoal)} goal. Consider deciding what happens next — payout, rollover, or a new target.`,
      });
    }
  }

  if (ctx.daysLeft != null && ctx.daysLeft <= 14 && ctx.targetGoal && totalContributed < ctx.targetGoal) {
    pushInsight(insights, {
      type: "deadline",
      severity: ctx.daysLeft <= 3 ? "critical" : "warning",
      title: `${ctx.daysLeft} day${ctx.daysLeft === 1 ? "" : "s"} left with the goal unmet`,
      message: `KES ${money(
        ctx.targetGoal - totalContributed
      )} is still needed and the event date is close. Consider a final reminder round.`,
    });
  }

  if (ctx.topContributor?.name) {
    pushInsight(insights, {
      type: "recognition",
      severity: "good",
      title: "Top contributor",
      message: `${ctx.topContributor.name} leads contributions with KES ${money(ctx.topContributor.amount)} so far. Worth a shout-out.`,
    });
  }
}

function loanInsights(ctx, insights) {
  const health = ctx.loanHealth;
  if (!health) return;

  if (health.portfolio_at_risk_percent >= 20) {
    pushInsight(insights, {
      type: "loans",
      severity: health.portfolio_at_risk_percent >= 40 ? "critical" : "warning",
      title: "Loan portfolio at risk is elevated",
      message: `${health.portfolio_at_risk_percent}% of outstanding loans are overdue (KES ${money(
        health.overdue
      )} of KES ${money(health.total_outstanding)}). Consider following up with members who have overdue installments before approving new loans.`,
    });
  } else if (health.loan_count > 0) {
    pushInsight(insights, {
      type: "loans",
      severity: "good",
      title: "Loan book looks healthy",
      message: `Portfolio-at-risk is ${health.portfolio_at_risk_percent}% across ${health.loan_count} loan${health.loan_count === 1 ? "" : "s"}.`,
    });
  }

  if (health.loan_to_deposit_ratio_percent >= 80) {
    pushInsight(insights, {
      type: "loans",
      severity: "warning",
      title: "Loan-to-deposit ratio is high",
      message: `${health.loan_to_deposit_ratio_percent}% of member deposits are currently out as loans, leaving less buffer for payouts or emergencies.`,
    });
  }

  if (health.awaiting_decision_count > 0) {
    pushInsight(insights, {
      type: "loans",
      severity: "info",
      title: `${health.awaiting_decision_count} loan application${health.awaiting_decision_count === 1 ? "" : "s"} awaiting a decision`,
      message: "There are pending loan applications that need official approval or rejection.",
    });
  }
}

function cashInsights(ctx, insights) {
  const f = ctx.finance;
  if (f) {
    if (f.cashBalance <= 0 && f.totalContributions > 0) {
      pushInsight(insights, {
        type: "cash",
        severity: "warning",
        title: "Cash balance is at zero",
        message: "The cash/bank/M-Pesa balance is currently at zero despite recorded contributions — worth checking for a pending reconciliation or an unrecorded payout.",
      });
    }
    if (f.pendingPayouts > 0) {
      pushInsight(insights, {
        type: "cash",
        severity: "info",
        title: "Pending payouts sitting in clearing",
        message: `KES ${money(f.pendingPayouts)} is currently marked as pending payout and hasn't been finalized yet.`,
      });
    }
  }

  const b = ctx.business;
  if (b) {
    if (b.netCash < 0) {
      pushInsight(insights, {
        type: "cash",
        severity: "critical",
        title: "Spending more than you're bringing in",
        message: `Net cash is negative (KES ${money(b.netCash)}): cash out (KES ${money(
          b.cashOut
        )}) has exceeded cash in (KES ${money(b.cashIn)}).`,
      });
    } else if (b.cashIn > 0) {
      const margin = Math.round((b.netCash / b.cashIn) * 100);
      pushInsight(insights, {
        type: "cash",
        severity: margin >= 20 ? "good" : "info",
        title: `Net cash margin: ${margin}%`,
        message: `KES ${money(b.netCash)} net (in: KES ${money(b.cashIn)}, out: KES ${money(b.cashOut)}).`,
      });
    } else {
      pushInsight(insights, {
        type: "cash",
        severity: "info",
        title: "No sales recorded yet",
        message: "No cash-in transactions have been recorded for this business yet.",
      });
    }
  }
}

function meetingInsights(ctx, insights) {
  if (!ctx.upcomingMeetings?.length) {
    pushInsight(insights, {
      type: "meetings",
      severity: "info",
      title: "No upcoming meetings scheduled",
      message: "There's nothing on the meeting calendar right now — schedule one if the group is due for a check-in.",
    });
    return;
  }
  const next = ctx.upcomingMeetings[0];
  const when = next.startsAt ? new Date(next.startsAt) : null;
  pushInsight(insights, {
    type: "meetings",
    severity: "info",
    title: `Next meeting: ${next.title || "Untitled meeting"}`,
    message: when
      ? `Scheduled for ${when.toLocaleDateString("en-KE", { weekday: "long", month: "short", day: "numeric" })}.`
      : "A meeting is scheduled.",
  });
}

/**
 * Build the full insights list for a workspace context.
 */
export function generateInsights(ctx) {
  const insights = [];

  if (ctx.workspaceType === "business") {
    cashInsights(ctx, insights);
  } else {
    contributionInsights(ctx, insights);
    loanInsights(ctx, insights);
    cashInsights(ctx, insights);
    meetingInsights(ctx, insights);
  }

  const rank = { critical: 0, warning: 1, info: 2, good: 3 };
  insights.sort((a, b) => rank[a.severity] - rank[b.severity]);

  return insights;
}

export default { generateInsights };
