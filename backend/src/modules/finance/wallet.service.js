import mongoose from "mongoose";

import Chama from "../../models/Chama.js";
import ChamaMembership from "../../models/ChamaMembership.js";
import ContributionPlan from "../../models/ContributionPlan.js";
import Withdrawal from "../../models/Withdrawal.js";
import Payout from "../../models/Payout.js";

import financeService from "./finance.service.js";
import { getMemberSavingsBalance } from "../savingsShareout/savingsShareout.service.js";
import loanDashboardService from "../loans/Loandashboard.service.js";
import { getChamaProfitWallet } from "../chamaAssets/chamaAsset.service.js";
import { getMemberWallet } from "./memberWallet.service.js";

const money = (value) => {
  const n = Number(value?.toString?.() ?? value ?? 0);
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;
};

// ============================================================
// MY WALLET
// ============================================================
//
// The pieces this rolls up already exist and are each independently
// correct (getMyFinanceSummary for contributions, getMemberSavingsBalance
// for savings, loanDashboardService for loans, Payout/Withdrawal for
// money in flight) — there was just no single place a member could see
// them together. This is read-only and computes nothing new; it calls
// the same functions their owning pages already call.
//
// Scope: contributions work for any workspace type (Chama, Contribution
// Group, Business). Savings / loans / payouts / withdrawals are Chama-
// only concepts in this codebase, so for a non-Chama workspace this
// returns contributions alone with scope: 'contributions_only'.
// ============================================================

export async function getMyWallet(ownerType, workspaceId, membershipId, userId) {
  const contributions = await financeService.getMemberSummary(
    ownerType,
    workspaceId,
    membershipId
  );

  const memberWallet = await getMemberWallet(userId);

  if (ownerType !== "Chama") {
    return {
      scope: "contributions_only",
      contributions,
      savings: null,
      loan: null,
      pending_payout: null,
      withdrawals: null,
      member_wallet: memberWallet,
    };
  }

  const [chama, membership] = await Promise.all([
    Chama.findById(workspaceId),
    ChamaMembership.findById(membershipId),
  ]);

  if (!chama || !membership) {
    // Membership context already validated by the caller (route requires
    // requireChamaMember + req.membership), but guard defensively rather
    // than let a stale id 500 further down.
    return {
      scope: "contributions_only",
      contributions,
      savings: null,
      loan: null,
      pending_payout: null,
      withdrawals: null,
      member_wallet: memberWallet,
    };
  }

  const savingsPlans = await ContributionPlan.find({
    owner_type: "Chama",
    owner_id: workspaceId,
    contribution_type: "free_will",
    status: { $ne: "cancelled" },
  }).select("_id name currency");

  const [planBalances, pendingWithdrawals, loanSummary, pendingPayout] =
    await Promise.all([
      Promise.all(
        savingsPlans.map(async (plan) => {
          const balance = await getMemberSavingsBalance(
            workspaceId,
            plan._id,
            membershipId
          );
          return { plan, balance: money(balance) };
        })
      ),
      Withdrawal.find({
        chama_id: workspaceId,
        member_id: membershipId,
        status: "pending",
      }).select("contribution_plan_id amount reason createdAt"),
      loanDashboardService.getMemberLoanSummary({ chama, membership }),
      Payout.findOne({
        chama_id: workspaceId,
        member_id: membershipId,
        status: { $in: ["pending", "approved"] },
      }),
    ]);
  const profitWallet = await getChamaProfitWallet(workspaceId, membershipId);

  const pendingByPlan = new Map();
  for (const w of pendingWithdrawals) {
    const key = String(w.contribution_plan_id);
    pendingByPlan.set(key, (pendingByPlan.get(key) || 0) + money(w.amount));
  }

  const plans = planBalances.map(({ plan, balance }) => {
    const pending = money(pendingByPlan.get(String(plan._id)) || 0);
    return {
      plan_id: plan._id,
      plan_name: plan.name || "Savings",
      currency: plan.currency || "KES",
      balance,
      pending_withdrawal: pending,
      available_to_withdraw: money(Math.max(0, balance - pending)),
    };
  });

  const savings = {
    total_balance: money(plans.reduce((sum, p) => sum + p.balance, 0)),
    total_available_to_withdraw: money(
      plans.reduce((sum, p) => sum + p.available_to_withdraw, 0)
    ),
    plans,
  };

  const withdrawals = {
    total_pending: money(
      pendingWithdrawals.reduce((sum, w) => sum + money(w.amount), 0)
    ),
    items: pendingWithdrawals.map((w) => ({
      id: w._id,
      contribution_plan_id: w.contribution_plan_id,
      amount: money(w.amount),
      reason: w.reason,
      requested_at: w.createdAt,
    })),
  };

  return {
    scope: "full",
    contributions,
    savings,
    loan: {
      outstanding_total: money(loanSummary.outstanding_total),
      active_loan: loanSummary.active_loan,
    },
    pending_payout: pendingPayout
      ? {
          id: pendingPayout._id,
          amount: money(pendingPayout.amount),
          status: pendingPayout.status,
        }
      : null,
    withdrawals,
    business_profit_wallet: profitWallet,
    member_wallet: memberWallet,
  };
}

export default { getMyWallet };
