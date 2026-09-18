import financeService from "./finance.service.js";
import financeReportsService from "./financeReports.service.js";
import Chama from "../../models/Chama.js";
import ContributionGroup from "../../models/ContributionGroup.js";
import Business from "../../models/Business.js";
import { canAccessWorkspace } from "../chat/chat.permissions.js";
import AppError from "../../utils/AppError.js";
import { postFinanceOperation } from "./financeOperation.service.js";
import { checkGlBalance } from "./accounting/glBalance.service.js";
import { getCashDepositStatus, depositCashToBank } from "./cashDeposit.service.js";
import {
  listBankAccounts,
  createBankAccount,
  updateBankAccount,
  deactivateBankAccount
} from "./bankAccount.service.js";

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
    const accounts = await financeService.getAccounts(ownerType, workspaceId);

    res.json({ success: true, data: accounts });
  } catch (error) {
    next(error);
  }
}

export async function getFinanceTransactions(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    const transactions = await financeService.getTransactions(
      ownerType,
      workspaceId
    );

    res.json({ success: true, data: transactions });
  } catch (error) {
    next(error);
  }
}

export async function getGeneralLedger(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    const ledger = await financeService.getLedger(ownerType, workspaceId);

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
    const { reportType, mode = "CHAMA", asAtDate } = req.query;

    if (!reportType) {
      throw new AppError("reportType parameter is required", 400);
    }

    const reportData = await financeReportsService.getReport(
      ownerType,
      workspaceId,
      reportType.toUpperCase(),
      mode.toUpperCase(),
      asAtDate
    );

    res.json({ success: true, data: reportData });
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