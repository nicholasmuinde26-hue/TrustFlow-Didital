/**
 * ============================================================
 * IN-HOUSE SUGGESTIONS ENGINE
 * ============================================================
 *
 * Turns the same rule-based read of the workspace into concrete
 * next actions — things a treasurer, official, or member could
 * actually go and do, each with a suggested link/action route
 * the frontend can use as a shortcut.
 * ============================================================
 */

function push(list, s) {
  list.push({ id: `${s.type}-${list.length}`, priority: s.priority ?? "normal", ...s });
}

export function generateSuggestions(ctx) {
  const suggestions = [];
  const isOfficial = ["admin", "treasurer", "chairperson", "secretary", "owner", "manager"].includes(
    (ctx.role || "").toLowerCase()
  );

  if (ctx.workspaceType !== "business") {
    if (ctx.overdueCount > 0) {
      push(suggestions, {
        type: "reminders",
        priority: "high",
        title: "Send a contribution reminder",
        message: `${ctx.overdueCount} member${ctx.overdueCount === 1 ? " is" : "s are"} overdue. A quick reminder (announcement or chat) tends to recover most of these before the next meeting.`,
        action: { label: "Go to announcements", route: "announcements" },
      });
    }

    if (ctx.activePlans === 0) {
      push(suggestions, {
        type: "plan",
        priority: "high",
        title: "Set up a contribution plan",
        message: "There's no active contribution plan, so contributions can't be tracked or collected right now.",
        action: { label: "Create a plan", route: "contributions" },
      });
    }

    if (!ctx.upcomingMeetings?.length) {
      push(suggestions, {
        type: "meeting",
        priority: "normal",
        title: "Schedule your next meeting",
        message: "Regular check-ins keep contributions and decisions on track.",
        action: { label: "Schedule a meeting", route: "meetings" },
      });
    }

    if (ctx.loanHealth?.awaiting_decision_count > 0 && isOfficial) {
      push(suggestions, {
        type: "loans",
        priority: "high",
        title: "Clear pending loan applications",
        message: `${ctx.loanHealth.awaiting_decision_count} loan application${ctx.loanHealth.awaiting_decision_count === 1 ? "" : "s"} are waiting on a decision.`,
        action: { label: "Review loan book", route: "loans" },
      });
    }

    if (ctx.loanHealth?.portfolio_at_risk_percent >= 20 && isOfficial) {
      push(suggestions, {
        type: "loans",
        priority: "high",
        title: "Follow up on overdue loans",
        message: "Portfolio-at-risk is elevated — reaching out to members with overdue installments now limits further slippage.",
        action: { label: "View loan book", route: "loans" },
      });
    }

    if (ctx.finance?.pendingPayouts > 0 && isOfficial) {
      push(suggestions, {
        type: "payouts",
        priority: "normal",
        title: "Finalize pending payouts",
        message: "There are payouts sitting in clearing that haven't been completed yet.",
        action: { label: "Go to payouts", route: "payouts" },
      });
    }
  } else {
    const b = ctx.business;
    if (b && b.netCash < 0) {
      push(suggestions, {
        type: "cash",
        priority: "high",
        title: "Review recent expenses",
        message: "Cash out has exceeded cash in recently — worth checking which expenses are driving that before it compounds.",
        action: { label: "View transactions", route: "transactions" },
      });
    }
    if (b && b.recentSalesCount === 0) {
      push(suggestions, {
        type: "sales",
        priority: "normal",
        title: "Log your sales",
        message: "No sales are recorded yet, so your cash-flow picture and financial reports will be incomplete until you start logging them.",
        action: { label: "Record a sale", route: "transactions" },
      });
    }
  }

  const rank = { high: 0, normal: 1, low: 2 };
  suggestions.sort((a, b) => rank[a.priority] - rank[b.priority]);

  return suggestions;
}

export default { generateSuggestions };
