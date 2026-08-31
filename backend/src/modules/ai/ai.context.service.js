import mongoose from "mongoose";

import Chama from "../../models/Chama.js";
import Business from "../../models/Business.js";
import ContributionGroup from "../../models/ContributionGroup.js";

import { getWorkspaceDashboard } from "../workspaces/workspaceDashboard.service.js";
import financeService from "../finance/finance.service.js";
import loanDashboardService from "../loans/Loandashboard.service.js";
import { getSummary as getBusinessSummary } from "../business/business.service.js";
import AppError from "../../utils/AppError.js";

const toNumber = (val) => {
  if (val === null || val === undefined) return 0;
  if (typeof val === "object" && typeof val.toString === "function") {
    const n = Number(val.toString());
    return Number.isFinite(n) ? n : 0;
  }
  return Number(val) || 0;
};

/**
 * ============================================================
 * AI CONTEXT BUILDER
 * ============================================================
 *
 * Pulls together everything the in-house insight/suggestion/chat
 * engines need to reason about ONE workspace (chama, business, or
 * contribution group), reusing the same services the rest of the
 * app already trusts for numbers (dashboard, finance, loans).
 *
 * This never calls out to any third-party AI API — it just shapes
 * real, current data into a compact object the rule-based engines
 * can read.
 * ============================================================
 */
export async function buildAiContext({ workspaceId, userId }) {
  if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
    throw new AppError("Invalid workspace ID", 400);
  }

  const dashboard = await getWorkspaceDashboard({ workspaceId, userId });

  const context = {
    workspaceType: dashboard.type, // 'chama' | 'contribution-group' | 'business'
    workspaceId: String(workspaceId),
    workspaceName: dashboard.workspace?.name || "your workspace",
    role: dashboard.workspace?.role || "member",
    memberCount: dashboard.stats?.memberCount ?? null,
    activePlans: dashboard.stats?.activePlans ?? null,
    overdueCount: dashboard.stats?.overdueCount ?? 0,
    totalContributed: dashboard.stats?.totalContributed ?? 0,
    paidCount: dashboard.stats?.paidCount ?? null,
    targetGoal: dashboard.workspace?.targetGoal ?? null,
    daysLeft: dashboard.workspace?.daysLeft ?? null,
    topContributor: dashboard.workspace?.topContributor ?? null,
    upcomingMeetings: dashboard.upcoming ?? [],
    finance: null,
    loanHealth: null,
    business: null,
  };

  if (dashboard.type === "business") {
    const summary = await getBusinessSummary(workspaceId, { _id: userId });
    context.business = {
      cashIn: toNumber(summary?.dashboard?.cashIn),
      cashOut: toNumber(summary?.dashboard?.cashOut),
      netCash: toNumber(summary?.dashboard?.netCash),
      accounts: (summary?.accounts || []).map((a) => ({
        name: a.name,
        balance: toNumber(a.balance),
      })),
      recentSalesCount: (summary?.recentSales || []).length,
    };
    return context;
  }

  const ownerType = dashboard.type === "chama" ? "Chama" : "ContributionGroup";

  try {
    const finance = await financeService.getSummary(ownerType, workspaceId);
    context.finance = {
      cashBalance: toNumber(finance.cash_balance),
      savingsBalance: toNumber(finance.savings_balance),
      totalContributions: toNumber(finance.total_contributions),
      outstandingLoans: toNumber(finance.outstanding_loans),
      pendingPayouts: toNumber(finance.pending_payouts),
      totalTransactions: finance.total_transactions ?? 0,
    };
  } catch {
    context.finance = null;
  }

  if (dashboard.type === "chama") {
    try {
      const chama = await Chama.findById(workspaceId).lean();
      if (chama) {
        const health = await loanDashboardService.getLoanHealth({ chama });
        context.loanHealth = health;
      }
    } catch {
      context.loanHealth = null;
    }
  }

  return context;
}

export async function resolveWorkspaceLabel(workspaceId) {
  const [chama, group, business] = await Promise.all([
    Chama.exists({ _id: workspaceId }),
    ContributionGroup.exists({ _id: workspaceId }),
    Business.exists({ _id: workspaceId }),
  ]);
  if (chama) return "chama";
  if (group) return "contribution-group";
  if (business) return "business";
  return null;
}

export default { buildAiContext, resolveWorkspaceLabel };
