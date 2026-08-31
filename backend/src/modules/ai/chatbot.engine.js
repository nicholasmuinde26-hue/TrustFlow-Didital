import { generateInsights } from "./insights.engine.js";
import { generateSuggestions } from "./suggestions.engine.js";

/**
 * ============================================================
 * IN-HOUSE CHATBOT ENGINE
 * ============================================================
 *
 * A deterministic, keyword/intent-matching assistant — not a
 * hosted LLM. Every answer is generated from the workspace's
 * real, current data (via ai.context.service). Nothing here is
 * invented; if we don't have data for something, we say so.
 *
 * How it works: each intent has a list of trigger phrases and a
 * handler that reads the context object and returns a reply. The
 * first intent whose triggers match the message wins; ties are
 * broken by whichever intent has the longest matching phrase.
 * ============================================================
 */

const money = (n) => Number(n || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 });

function normalize(text) {
  return (text || "").toLowerCase().trim();
}

const INTENTS = [
  {
    name: "greeting",
    triggers: ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"],
    handle: (ctx) =>
      `Hi! I'm the assistant for ${ctx.workspaceName}. Ask me about balances, overdue contributions, loans, meetings, or say "insights" for a full rundown.`,
  },
  {
    name: "help",
    triggers: ["help", "what can you do", "what do you do", "commands"],
    handle: () =>
      `I can help with things like:\n• "What's our balance?"\n• "Who's overdue?"\n• "How's the loan book?"\n• "When's the next meeting?"\n• "Give me insights" or "suggestions"\nEverything I answer is pulled from this workspace's live data — I don't guess.`,
  },
  {
    name: "balance",
    triggers: ["balance", "cash balance", "how much cash", "how much money", "funds"],
    handle: (ctx) => {
      if (ctx.finance) {
        return `Cash/bank/M-Pesa balance: KES ${money(ctx.finance.cashBalance)}. Savings balance: KES ${money(
          ctx.finance.savingsBalance
        )}. Outstanding loans: KES ${money(ctx.finance.outstandingLoans)}.`;
      }
      if (ctx.business) {
        return `Net cash: KES ${money(ctx.business.netCash)} (in: KES ${money(ctx.business.cashIn)}, out: KES ${money(
          ctx.business.cashOut
        )}).`;
      }
      return "I don't have finance data for this workspace yet.";
    },
  },
  {
    name: "contributions_total",
    triggers: ["total contributions", "how much has been contributed", "total contributed", "how much raised"],
    handle: (ctx) =>
      ctx.totalContributed
        ? `Total contributed so far: KES ${money(ctx.totalContributed)}${
            ctx.targetGoal ? ` toward a goal of KES ${money(ctx.targetGoal)} (${Math.round((ctx.totalContributed / ctx.targetGoal) * 100)}%).` : "."
          }`
        : "No contributions have been recorded yet.",
  },
  {
    name: "overdue",
    triggers: ["overdue", "who hasn't paid", "who has not paid", "behind on", "arrears", "defaulters", "who's overdue"],
    handle: (ctx) => {
      if (ctx.workspaceType === "business") return "This isn't tracked for a business workspace.";
      if (!ctx.overdueCount) return "Nobody is currently overdue on the active contribution plan. 👍";
      const rate = ctx.memberCount ? Math.round((ctx.overdueCount / ctx.memberCount) * 100) : null;
      return `${ctx.overdueCount} member${ctx.overdueCount === 1 ? " is" : "s are"} currently overdue${
        rate != null ? ` (${rate}% of ${ctx.memberCount} members)` : ""
      }. I can't name individuals here — check the Contributions page for the full list.`;
    },
  },
  {
    name: "loans",
    triggers: ["loan", "loans", "loan book", "portfolio at risk", "defaulted loans"],
    handle: (ctx) => {
      const h = ctx.loanHealth;
      if (!h) return "There's no loan data available for this workspace.";
      return `Loan book: ${h.loan_count} loan(s), KES ${money(h.total_outstanding)} outstanding. Portfolio-at-risk: ${
        h.portfolio_at_risk_percent
      }%. Default rate: ${h.default_rate_percent}%. ${h.awaiting_decision_count} application(s) awaiting a decision.`;
    },
  },
  {
    name: "meeting",
    triggers: ["meeting", "meetings", "next meeting", "when is the meeting", "any meetings"],
    handle: (ctx) => {
      if (!ctx.upcomingMeetings?.length) return "There's no upcoming meeting scheduled right now.";
      const next = ctx.upcomingMeetings[0];
      const when = next.startsAt ? new Date(next.startsAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : "an unspecified time";
      return `Next up: "${next.title || "Untitled meeting"}" on ${when}.`;
    },
  },
  {
    name: "members",
    triggers: ["how many members", "member count", "how many of us", "group size"],
    handle: (ctx) =>
      ctx.memberCount != null ? `There are ${ctx.memberCount} active member(s) in ${ctx.workspaceName}.` : "I don't have a member count for this workspace.",
  },
  {
    name: "top_contributor",
    triggers: ["top contributor", "who has contributed the most", "leaderboard"],
    handle: (ctx) =>
      ctx.topContributor?.name
        ? `${ctx.topContributor.name} is currently the top contributor with KES ${money(ctx.topContributor.amount)}.`
        : "No contribution leaderboard data is available yet.",
  },
  {
    name: "insights",
    triggers: ["insight", "insights", "how are we doing", "give me a summary", "financial summary", "how's it going", "status", "overview"],
    handle: (ctx) => {
      const insights = generateInsights(ctx);
      if (!insights.length) return "Everything looks steady — no notable insights right now.";
      return insights
        .slice(0, 5)
        .map((i) => `• ${i.title}: ${i.message}`)
        .join("\n");
    },
  },
  {
    name: "suggestions",
    triggers: ["suggestion", "suggestions", "what should we do", "recommend", "recommendation", "what should i do", "advice"],
    handle: (ctx) => {
      const suggestions = generateSuggestions(ctx);
      if (!suggestions.length) return "No specific action items right now — things look on track.";
      return suggestions
        .slice(0, 5)
        .map((s) => `• ${s.title}: ${s.message}`)
        .join("\n");
    },
  },
];

const FALLBACK =
  "I'm not sure about that one yet — I can currently help with balances, overdue contributions, loans, meetings, member counts, and general insights/suggestions. Try one of those, or check the relevant page in the sidebar.";

export function respond(message, ctx) {
  const text = normalize(message);
  if (!text) {
    return { reply: FALLBACK, intent: "fallback" };
  }

  let best = null;
  for (const intent of INTENTS) {
    for (const trigger of intent.triggers) {
      if (text.includes(trigger)) {
        if (!best || trigger.length > best.matchLength) {
          best = { intent, matchLength: trigger.length };
        }
      }
    }
  }

  if (!best) {
    return { reply: FALLBACK, intent: "fallback" };
  }

  try {
    const reply = best.intent.handle(ctx);
    return { reply, intent: best.intent.name };
  } catch {
    return { reply: FALLBACK, intent: "fallback" };
  }
}

export default { respond };
