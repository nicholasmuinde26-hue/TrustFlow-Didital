import financeService from "./finance.service.js";
import financeReportsService from "./financeReports.service.js";
import Chama from "../../models/Chama.js";
import ContributionGroup from "../../models/ContributionGroup.js";
import Business from "../../models/Business.js";
import { canAccessWorkspace } from "../chat/chat.permissions.js";
import AppError from "../../utils/AppError.js";
import { postFinanceOperation } from "./financeOperation.service.js";
import { getMyWallet } from "./wallet.service.js";
import { initiateMemberWalletDeposit, initiateMemberWalletWithdrawal, setMemberWalletPin, changeMemberWalletPin } from "./memberWallet.service.js";
import { withdrawFromChamaProfitWallet } from "../chamaAssets/chamaAsset.service.js";
import { checkGlBalance } from "./accounting/glBalance.service.js";
import { getCashDepositStatus, depositCashToBank } from "./cashDeposit.service.js";
import { getContributionsRegister } from "./contributionsRegister.service.js";
import permissionService from "../../services/permission.service.js";
import {
  listBankAccounts,
  createBankAccount,
  updateBankAccount,
  deactivateBankAccount
} from "./bankAccount.service.js";
import {
  requestAdjustment,
  decideAdjustment,
  cancelAdjustment,
  listAdjustments,
  getAdjustment
} from "./adjustment.service.js";
import {
  createSession as createReconciliationSession,
  addLines as addReconciliationLines,
  autoMatch as autoMatchReconciliation,
  matchLine as matchReconciliationLine,
  unmatchLine as unmatchReconciliationLine,
  ignoreLine as ignoreReconciliationLine,
  raiseAdjustmentForLine,
  completeSession as completeReconciliationSession,
  listSessions as listReconciliationSessions,
  getSessionDetail as getReconciliationSessionDetail
} from "./bankReconciliation.service.js";

async function resolveWorkspace(req) {
  const { workspaceId } = req.params;

  const chama = await Chama.exists({ _id: workspaceId });
  const contributionGroup = chama
    ? null
    : await ContributionGroup.exists({ _id: workspaceId });

  if (chama || contributionGroup) {
    const ownerType = chama ? "Chama" : "ContributionGroup";

    const allowed = await canAccessWorkspace(
      req.user._id,
      workspaceId,
      ownerType === "Chama" ? "chama" : "contribution-group"
    );

    if (!allowed) {
      throw new AppError(
        "You are not an active member of this workspace",
        403
      );
    }

    return { ownerType, workspaceId };
  }

  const business = await Business.exists({
    _id: workspaceId,
    created_by: req.user._id,
  });

  if (business) {
    return { ownerType: "Business", workspaceId };
  }

  throw new AppError("Workspace not found", 404);
}

export async function getFinanceSummary(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);

    // requirePermission('finance.summary.view') already ran for this route
    // and attached the effective scope for THIS caller's role - 'all' for
    // chairperson/treasurer/auditor, 'limited' for a plain member (see
    // DEFAULT_ROLE_PERMISSIONS in permission.service.js). A member never
    // gets the chama's real wallet figures here; they get their own
    // position from GET /finance/summary/me instead.
    const scope = req.permissionResult?.scope === "all" ? "all" : "own";

    if (scope !== "all") {
      return res.json({ success: true, data: { scope } });
    }

    const summary = await financeService.getSummary(ownerType, workspaceId);

    res.json({ success: true, data: { ...summary, scope } });
  } catch (error) {
    next(error);
  }
}

export async function getMyFinanceSummary(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);

    if (!req.membership?._id) {
      throw new AppError("Chama membership context is required", 400);
    }

    const summary = await financeService.getMemberSummary(
      ownerType,
      workspaceId,
      req.membership._id
    );

    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
}

// My Wallet — the one rollup of a member's own position: contributions,
// savings (per plan + available-to-withdraw), loan outstanding, a payout
// in flight, and any pending withdrawal request. Every figure here is
// computed by the same service its own page already uses (see
// wallet.service.js); this just gathers them into one response so the
// person doesn't have to visit five pages to see where they stand.
export async function getMyWalletController(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);

    if (!req.membership?._id) {
      throw new AppError("Chama membership context is required", 400);
    }

      const wallet = await getMyWallet(ownerType, workspaceId, req.membership._id, req.user._id);

    res.json({ success: true, data: wallet });
  } catch (error) {
    next(error);
  }
}

export async function depositToMemberWalletController(req, res, next) {
  try {
    const result = await initiateMemberWalletDeposit({ userId: req.user._id, amount: req.body.amount, phoneNumber: req.body.phoneNumber, pin: req.body.pin });
    res.status(202).json({ success: true, message: result.customerMessage, data: result });
  } catch (error) { next(error); }
}

export async function withdrawFromMemberWalletController(req, res, next) {
  try {
    const result = await initiateMemberWalletWithdrawal({ userId: req.user._id, amount: req.body.amount, phoneNumber: req.body.phoneNumber, pin: req.body.pin });
    res.status(202).json({ success: true, message: result.message, data: result });
  } catch (error) { next(error); }
}

export async function setMemberWalletPinController(req, res, next) {
  try {
    const result = await setMemberWalletPin({ userId: req.user._id, pin: req.body.pin });
    res.status(201).json({ success: true, message: "Wallet PIN set", data: result });
  } catch (error) { next(error); }
}

export async function changeMemberWalletPinController(req, res, next) {
  try {
    const result = await changeMemberWalletPin({ userId: req.user._id, currentPin: req.body.currentPin, newPin: req.body.newPin });
    res.json({ success: true, message: "Wallet PIN changed", data: result });
  } catch (error) { next(error); }
}

export async function getFinanceTrend(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    const scope = req.permissionResult?.scope === "all" ? "all" : "own";

    if (scope !== "all") {
      return res.json({ success: true, data: { scope, weeks: [] } });
    }

    const trend = await financeService.getWeeklyTrend(ownerType, workspaceId);

    res.json({ success: true, data: { ...trend, scope } });
  } catch (error) {
    next(error);
  }
}

export async function getFinanceAccounts(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    // Default scope is the chama's own pooled accounts; ?scope=business shows the
    // business & property fund, ?scope=all both.
    const scope = ["business", "all"].includes(String(req.query.scope)) ? String(req.query.scope) : "chama";
    const accounts = await financeService.getAccounts(ownerType, workspaceId, null, scope);

    res.json({ success: true, data: accounts });
  } catch (error) {
    next(error);
  }
}

// Plain members open the Transactions page on their own transactions and may switch to the
// chama-wide book. Set to false to lock members to their own transactions only.
const MEMBERS_MAY_VIEW_CHAMA_TRANSACTIONS = true;

export async function getFinanceTransactions(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);

    // 'all' for officials, 'own' for a plain member (finance.transactions.view).
    const permScope = req.permissionResult?.scope === "all" ? "all" : "own";
    const hasMembership = Boolean(req.membership?._id);

    // Which book: "mine" = the caller's own transactions, "chama" = everyone's.
    // Default: officials see the whole chama, members see their own.
    const defaultView = permScope === "all" || !hasMembership ? "chama" : "mine";
    let view = defaultView;
    if (req.query.view === "mine" && hasMembership) view = "mine";
    if (req.query.view === "chama") view = "chama";

    if (view === "chama" && permScope !== "all" && !MEMBERS_MAY_VIEW_CHAMA_TRANSACTIONS) {
      view = "mine";
    }
    if (view === "mine" && !hasMembership) {
      throw new AppError("Chama membership context is required", 400);
    }

    // The business and property fund is officials-only, whatever the query says.
    const requestedScope = ["business", "all"].includes(String(req.query.scope)) ? String(req.query.scope) : "chama";
    const scope = permScope === "all" ? requestedScope : "chama";

    const transactions = await financeService.getTransactions(
      ownerType,
      workspaceId,
      { scope, membershipId: view === "mine" ? req.membership._id : null }
    );

    res.json({
      success: true,
      data: transactions,
      meta: {
        view,
        default_view: defaultView,
        can_toggle: hasMembership && (permScope === "all" || MEMBERS_MAY_VIEW_CHAMA_TRANSACTIONS),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getGeneralLedger(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    const scope = ["business", "chama"].includes(String(req.query.scope)) ? String(req.query.scope) : "all";
    const { accountId, dateFrom, dateTo } = req.query;
    const ledger = await financeService.getLedger(ownerType, workspaceId, null, scope, {
      accountId: accountId ? String(accountId) : undefined,
      dateFrom: dateFrom ? String(dateFrom) : undefined,
      dateTo: dateTo ? String(dateTo) : undefined,
    });

    res.json({ success: true, data: ledger });
  } catch (error) {
    next(error);
  }
}

export async function getGlBalanceStatus(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    const status = await checkGlBalance(ownerType, workspaceId);

    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
}

export async function getRecentPayments(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    const sinceMs = Number(req.query.sinceMs) || undefined;
    const payments = await financeService.getRecentPayments(
      ownerType,
      workspaceId,
      sinceMs ? { sinceMs } : {}
    );

    res.json({ success: true, data: payments });
  } catch (error) {
    next(error);
  }
}

export async function createFinanceOperation(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    const result = await postFinanceOperation({ ownerType, ownerId: workspaceId, userId: req.user._id, ...req.body });
    res.status(201).json({ success: true, message: "Finance operation recorded", data: result });
  } catch (error) { next(error); }
}

export async function getFinanceReport(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    // `from` / `to` give a window (an income statement for one year);
    // `asAtDate` is the older single-date form and still works on its own.
    const { reportType, mode = "CHAMA", asAtDate, from, to, scope = "chama" } = req.query;

    if (!reportType) {
      throw new AppError("reportType parameter is required", 400);
    }

    // parseReportPeriod inside the service answers a bad date with a 400.
    const reportData = await financeReportsService.getReport(
      ownerType,
      workspaceId,
      reportType.toUpperCase(),
      mode.toUpperCase(),
      { from, to, asAtDate },
      scope
    );

    res.json({ success: true, data: reportData });
  } catch (error) {
    next(error);
  }
}

// Preview (GET) or perform (POST) the one-off move of business income that was posted
// into the pooled chama balance before the business fund existed.
export async function previewBusinessFundSeparationHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    if (ownerType !== "Chama") throw new AppError("Only available for Chama workspaces", 400);
    const { previewSeparation } = await import("./businessFundsSeparation.service.js");
    const plan = await previewSeparation(workspaceId);
    res.json({ success: true, data: { pending: plan.pending, moves: plan.moves, accountsToMark: plan.accountsToMark.length } });
  } catch (error) { next(error); }
}

export async function applyBusinessFundSeparationHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    if (ownerType !== "Chama") throw new AppError("Only available for Chama workspaces", 400);
    const { applySeparation } = await import("./businessFundsSeparation.service.js");
    const result = await applySeparation(workspaceId, req.user._id);
    res.json({ success: true, message: "Business money moved out of the chama balance", data: { moves: result.moves, journalsPosted: result.journalsPosted } });
  } catch (error) { next(error); }
}

// Business & property fund: the balance, income, expenses and profit of chama-owned
// businesses and properties, per asset. Never includes member money.
export async function getBusinessFundsHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    if (ownerType !== "Chama") {
      throw new AppError("Business and property funds are only available for Chama workspaces", 400);
    }
    const { from, to, asAtDate } = req.query;
    const data = await financeReportsService.getBusinessFundsOverview(workspaceId, { from, to, asAtDate });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// CASH DEPOSIT ENFORCEMENT
// ============================================================

export async function getCashDepositStatusHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    const status = await getCashDepositStatus(ownerType, workspaceId);
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
}

export async function depositCashToBankHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    const { bankAccountId, amount, reference, notes } = req.body;

    const result = await depositCashToBank({
      ownerType,
      ownerId: workspaceId,
      userId: req.user._id,
      bankAccountId: bankAccountId || null,
      amount,
      reference,
      notes
    });

    res.status(201).json({ success: true, message: "Cash deposited to bank", data: result });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// BANK ACCOUNTS
// ============================================================

export async function listBankAccountsHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    const includeInactive = req.query.includeInactive === "true";
    const accounts = await listBankAccounts(ownerType, workspaceId, { includeInactive });
    res.json({ success: true, data: accounts });
  } catch (error) {
    next(error);
  }
}

export async function createBankAccountHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    const bankAccount = await createBankAccount({
      ownerType,
      ownerId: workspaceId,
      userId: req.user._id,
      bankName: req.body.bankName,
      accountName: req.body.accountName,
      accountNumber: req.body.accountNumber,
      branch: req.body.branch,
      swiftCode: req.body.swiftCode,
      paybillOrTill: req.body.paybillOrTill,
      currency: req.body.currency,
      isPrimary: req.body.isPrimary,
      notes: req.body.notes
    });
    res.status(201).json({ success: true, message: "Bank account added", data: bankAccount });
  } catch (error) {
    next(error);
  }
}

export async function updateBankAccountHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    const bankAccount = await updateBankAccount({
      ownerType,
      ownerId: workspaceId,
      userId: req.user._id,
      bankAccountId: req.params.bankAccountId,
      updates: req.body
    });
    res.json({ success: true, message: "Bank account updated", data: bankAccount });
  } catch (error) {
    next(error);
  }
}

export async function deactivateBankAccountHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    const bankAccount = await deactivateBankAccount({
      ownerType,
      ownerId: workspaceId,
      userId: req.user._id,
      bankAccountId: req.params.bankAccountId
    });
    res.json({ success: true, message: "Bank account deactivated", data: bankAccount });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// CONTRIBUTIONS REGISTER
// ============================================================
//
// The single source of truth behind the Contributions page: who has
// contributed what, against which plan, and what is still owed. Scope
// aware - 'contributions.view' is 'all' for officials and 'own' for a
// plain member, and the register honours that by narrowing itself to
// the caller's own membership rather than returning a filtered-looking
// page of somebody else's money.
export async function getContributionsRegisterHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);

    const scope = req.permissionResult?.scope === "all" ? "all" : "own";

    if (scope !== "all" && !req.membership?._id) {
      throw new AppError("Chama membership context is required", 400);
    }

    const register = await getContributionsRegister(ownerType, workspaceId, {
      membershipId: scope === "all" ? null : req.membership._id,
      planId: req.query.planId || null,
      status: req.query.status || null,
      method: req.query.method || null,
      from: req.query.from || null,
      to: req.query.to || null,
      limit: req.query.limit,
    });

    res.json({ success: true, data: { ...register, scope } });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// EFFECTIVE PERMISSIONS FOR THE CALLER
// ============================================================
//
// Lets the frontend gate an action on the SAME decision the API will
// make, instead of maintaining its own copy of the role matrix and
// drifting out of sync with it (e.g. offering "record for another
// member" to a chairperson, whose contributions.record grant is
// deliberately 'own' scope and which createPayment then 403s).
//
// Only ever describes the caller's own membership, so it needs no
// permission gate of its own beyond being an active member.
export async function getMyWorkspacePermissions(req, res, next) {
  try {
    const { ownerType } = await resolveWorkspace(req);

    if (!req.membership?._id) {
      return res.json({
        success: true,
        data: { role: null, permissions: {}, owner_type: ownerType },
      });
    }

    const result = await permissionService.getEffectivePermissions(
      req.membership._id
    );

    res.json({ success: true, data: { ...result, owner_type: ownerType } });
  } catch (error) {
    next(error);
  }
}
// ============================================================
// LEDGER ADJUSTMENTS (adjustment-approval workflow)
// ============================================================
//
// A treasurer proposes a manual DR/CR correction; an independent official
// (chairperson/treasurer, never the same person) approves it through the
// existing ApprovalRequest engine before it posts. See adjustment.service.js.

export async function listAdjustmentsHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    const adjustments = await listAdjustments(ownerType, workspaceId, { status: req.query.status || null });
    res.json({ success: true, data: adjustments });
  } catch (error) {
    next(error);
  }
}

export async function getAdjustmentHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    const adjustment = await getAdjustment(ownerType, workspaceId, req.params.adjustmentId);
    res.json({ success: true, data: adjustment });
  } catch (error) {
    next(error);
  }
}

export async function requestAdjustmentHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    if (!req.membership?._id) throw new AppError("Chama membership context is required", 400);

    const { debitAccountId, creditAccountId, amount, currency, reason, reference } = req.body;

    const result = await requestAdjustment({
      ownerType,
      ownerId: workspaceId,
      userId: req.user._id,
      membershipId: req.membership._id,
      debitAccountId,
      creditAccountId,
      amount,
      currency,
      reason,
      reference
    });

    res.status(201).json({ success: true, message: "Adjustment request submitted for approval", data: result.adjustment });
  } catch (error) {
    next(error);
  }
}

export async function decideAdjustmentHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    if (!req.membership?._id) throw new AppError("Chama membership context is required", 400);

    const { decision, comment } = req.body;

    const adjustment = await decideAdjustment({
      ownerType,
      ownerId: workspaceId,
      adjustmentId: req.params.adjustmentId,
      approverMembershipId: req.membership._id,
      decision,
      comment,
      actorUserId: req.user._id
    });

    res.json({ success: true, message: `Adjustment ${adjustment.status}`, data: adjustment });
  } catch (error) {
    next(error);
  }
}

export async function cancelAdjustmentHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    if (!req.membership?._id) throw new AppError("Chama membership context is required", 400);

    const adjustment = await cancelAdjustment({
      ownerType,
      ownerId: workspaceId,
      adjustmentId: req.params.adjustmentId,
      membershipId: req.membership._id,
      userId: req.user._id,
      reason: req.body?.reason
    });

    res.json({ success: true, message: "Adjustment cancelled", data: adjustment });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// BANK RECONCILIATION (generic bank reconciliation)
// ============================================================
//
// Statement-vs-ledger reconciliation sessions against a registered
// ChamaBankAccount. See bankReconciliation.service.js.

export async function listReconciliationSessionsHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    const sessions = await listReconciliationSessions(ownerType, workspaceId, {
      status: req.query.status || null,
      bankAccountId: req.query.bankAccountId || null
    });
    res.json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
}

export async function getReconciliationSessionHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    const result = await getReconciliationSessionDetail(ownerType, workspaceId, req.params.sessionId);
    res.json({ success: true, data: result.session, summary: result.summary });
  } catch (error) {
    next(error);
  }
}

export async function createReconciliationSessionHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    const { bankAccountId, periodStart, periodEnd, openingBalance, closingBalance, notes } = req.body;

    const session = await createReconciliationSession({
      ownerType,
      ownerId: workspaceId,
      userId: req.user._id,
      bankAccountId,
      periodStart,
      periodEnd,
      openingBalance,
      closingBalance,
      notes
    });

    res.status(201).json({ success: true, message: "Reconciliation session started", data: session });
  } catch (error) {
    next(error);
  }
}

export async function addReconciliationLinesHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    const session = await addReconciliationLines({
      ownerType,
      ownerId: workspaceId,
      sessionId: req.params.sessionId,
      lines: req.body.lines
    });
    res.json({ success: true, message: "Statement lines added", data: session });
  } catch (error) {
    next(error);
  }
}

export async function autoMatchReconciliationHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    const { session, matchedCount } = await autoMatchReconciliation({
      ownerType,
      ownerId: workspaceId,
      sessionId: req.params.sessionId
    });
    res.json({ success: true, message: `${matchedCount} line(s) auto-matched`, data: session });
  } catch (error) {
    next(error);
  }
}

export async function matchReconciliationLineHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    if (!req.membership?._id) throw new AppError("Chama membership context is required", 400);

    const session = await matchReconciliationLine({
      ownerType,
      ownerId: workspaceId,
      sessionId: req.params.sessionId,
      lineId: req.params.lineId,
      ledgerEntryId: req.body.ledgerEntryId,
      matchedByMembershipId: req.membership._id,
      userId: req.user._id
    });

    res.json({ success: true, message: "Line matched", data: session });
  } catch (error) {
    next(error);
  }
}

export async function unmatchReconciliationLineHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    const session = await unmatchReconciliationLine({
      ownerType,
      ownerId: workspaceId,
      sessionId: req.params.sessionId,
      lineId: req.params.lineId
    });
    res.json({ success: true, message: "Line unmatched", data: session });
  } catch (error) {
    next(error);
  }
}

export async function ignoreReconciliationLineHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    const session = await ignoreReconciliationLine({
      ownerType,
      ownerId: workspaceId,
      sessionId: req.params.sessionId,
      lineId: req.params.lineId,
      reason: req.body?.reason
    });
    res.json({ success: true, message: "Line ignored", data: session });
  } catch (error) {
    next(error);
  }
}

export async function raiseAdjustmentForLineHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    if (!req.membership?._id) throw new AppError("Chama membership context is required", 400);

    const { contraAccountId, reason } = req.body;

    const result = await raiseAdjustmentForLine({
      ownerType,
      ownerId: workspaceId,
      sessionId: req.params.sessionId,
      lineId: req.params.lineId,
      contraAccountId,
      reason,
      userId: req.user._id,
      membershipId: req.membership._id
    });

    res.status(201).json({ success: true, message: "Adjustment submitted for approval to resolve this line", data: result.session });
  } catch (error) {
    next(error);
  }
}

export async function completeReconciliationSessionHandler(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    if (!req.membership?._id) throw new AppError("Chama membership context is required", 400);

    const session = await completeReconciliationSession({
      ownerType,
      ownerId: workspaceId,
      sessionId: req.params.sessionId,
      membershipId: req.membership._id,
      userId: req.user._id,
      force: Boolean(req.body?.force)
    });

    res.json({ success: true, message: "Reconciliation session completed", data: session });
  } catch (error) {
    next(error);
  }
}

export async function withdrawProfitWalletController(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    if (ownerType !== "Chama" || !req.membership?._id) throw new AppError("Chama membership context is required", 400);
    const phone = String(req.body.phoneNumber || req.user.phone_number || req.user.phone || "").replace(/^\+/, "");
    const entry = await withdrawFromChamaProfitWallet(workspaceId, req.membership._id, phone, req.body.amount);
    res.status(202).json({ success: true, message: "M-Pesa withdrawal submitted", data: { entry } });
  } catch (error) { next(error); }
}
