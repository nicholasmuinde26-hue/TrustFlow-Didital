import financeService from "./finance.service.js";
import Chama from "../../models/Chama.js";
import ContributionGroup from "../../models/ContributionGroup.js";
import Business from "../../models/Business.js";
import { canAccessWorkspace } from "../chat/chat.permissions.js";
import AppError from "../../utils/AppError.js";
import { postFinanceOperation } from "./financeOperation.service.js";

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
    const summary = await financeService.getSummary(ownerType, workspaceId);

    res.json({ success: true, data: summary });
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

export async function createFinanceOperation(req, res, next) {
  try {
    const { ownerType, workspaceId } = await resolveWorkspace(req);
    const result = await postFinanceOperation({ ownerType, ownerId: workspaceId, userId: req.user._id, ...req.body });
    res.status(201).json({ success: true, message: "Finance operation recorded", data: result });
  } catch (error) { next(error); }
}
