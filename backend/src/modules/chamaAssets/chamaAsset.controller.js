import {
  listChamaAssets,
  requestAsset,
  approveAsset,
  rejectAsset,
  recordIncome,
  recordExpense,
  getAssetExpenseBreakdown,
  listAssetTransactions,
  listUnverifiedAssetIncome,
  manuallyVerifyAssetIncome,
  requestInvestmentProposal,
  decideInvestmentProposal,
  completeInvestmentAcquisition,
  listInvestmentProposals,
  fundChamaBusiness,
  createProfitDistribution,
  respondToProfitDistribution,
  listProfitDistributions,
  recalculateAssetOwnership,
  setAssetOwnershipOverride,
  unlockAssetOwnership,
  assignAssetManager,
  setAssetOperationalStatus,
  recordAssetValuation,
  getAssetProgress,
  flagAssetTransactionDiscrepancy,
  decideAssetTransactionDiscrepancy,
  listAssetTransactionDiscrepancies,
} from "./chamaAsset.service.js";
import { listChamaBusinessWorkspaces } from "./chamaBusinessWorkspaces.service.js";
import WorkspaceRequest from "../../models/WorkspaceRequest.js";
import { BUSINESS_CATEGORIES } from "../../models/Business.js";
import ChamaAsset from "../../models/ChamaAsset.js";
import AppError from "../../utils/AppError.js";

// POST /chamas/:chamaId/assets/:assetId/ownership/recalculate
// Non-destructive — recomputes each active member's basis-point share
// from their lifetime completed contributions. Refuses (409, via the
// service) if the split is currently manually locked.
export const recalculateAssetOwnershipController = async (req, res, next) => {
  try {
    const { chamaId, assetId } = req.params;
    const asset = await recalculateAssetOwnership(chamaId, assetId);
    return res.status(200).json({ success: true, message: "Ownership recalculated from contribution history", data: { asset } });
  } catch (error) {
    next(error);
  }
};

// POST /chamas/:chamaId/assets/:assetId/ownership/override
// Body: { splits: [{ member_id, percentage }] } — must cover every
// active member and total 100%. Gated by requireLeadershipStepUp, same
// tier as registering the asset in the first place.
export const setAssetOwnershipOverrideController = async (req, res, next) => {
  try {
    const { chamaId, assetId } = req.params;
    const { splits } = req.body;
    const asset = await setAssetOwnershipOverride(chamaId, assetId, splits);
    return res.status(200).json({ success: true, message: "Ownership split set", data: { asset } });
  } catch (error) {
    next(error);
  }
};

// POST /chamas/:chamaId/assets/:assetId/ownership/unlock
export const unlockAssetOwnershipController = async (req, res, next) => {
  try {
    const { chamaId, assetId } = req.params;
    const asset = await unlockAssetOwnership(chamaId, assetId);
    return res.status(200).json({ success: true, message: "Ownership unlocked — recalculate to resume automatic splitting", data: { asset } });
  } catch (error) {
    next(error);
  }
};

// POST /chamas/:chamaId/assets/:assetId/manager
// Body: { manager_type: "member"|"external"|"unassigned", manager_id?,
// external_name?, external_contact?, notes? }
export const assignAssetManagerController = async (req, res, next) => {
  try {
    const { chamaId, assetId } = req.params;
    const { manager_type, manager_id, external_name, external_contact, notes } = req.body;
    const asset = await assignAssetManager(chamaId, assetId, {
      managerType: manager_type,
      managerId: manager_id,
      externalName: external_name,
      externalContact: external_contact,
      notes,
    });
    return res.status(200).json({ success: true, message: "Manager assigned", data: { asset } });
  } catch (error) {
    next(error);
  }
};

// PATCH /chamas/:chamaId/assets/:assetId/operational-status
// Reachable by the treasurer/chairperson OR whoever is currently
// assigned as this specific asset's manager — a rotating project lead
// who holds no chama office still needs to be able to mark "leased out"
// or "under maintenance" without going through a leader every time.
export const setAssetOperationalStatusController = async (req, res, next) => {
  try {
    const { chamaId, assetId } = req.params;
    const { operational_status } = req.body;

    const isLeader = ["treasurer", "chairperson"].includes(req.membership.role);
    if (!isLeader) {
      const asset = await ChamaAsset.findOne({ _id: assetId, chama_id: chamaId }).select("management");
      if (!asset) throw new AppError("Chama asset not found", 404);
      const isAssignedManager = asset.management?.manager_type === "member" && String(asset.management.manager_id) === String(req.user._id);
      if (!isAssignedManager) throw new AppError("Only the treasurer, chairperson, or this asset's assigned manager can update its status", 403);
    }

    const asset = await setAssetOperationalStatus(chamaId, assetId, operational_status);
    return res.status(200).json({ success: true, message: "Status updated", data: { asset } });
  } catch (error) {
    next(error);
  }
};

// GET /chamas/:chamaId/assets
// The dashboard's source of truth for whether to show the Assets & Income
// panel at all — an empty array means "hide it, show the CTA instead".
export const listChamaAssetsController = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const includePending = req.query.includePending === "true";
    const assets = await listChamaAssets(chamaId, { includePending });
    return res.status(200).json({ success: true, data: { assets } });
  } catch (error) {
    next(error);
  }
};

// POST /chamas/:chamaId/assets/request
// Gated by requireChamaTreasurerOrChairperson + requireLeadershipStepUp —
// see chamaAsset.routes.js. Creates a 'pending_approval' asset; does NOT
// go live until the other official (chairperson or treasurer) signs off.
export const requestChamaAssetController = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const { asset_type, name, description, income_pattern, expected_monthly_income, acquisition, management, documents, business_id } = req.body;

    if (!asset_type || !name) {
      return res.status(400).json({ success: false, message: "asset_type and name are required" });
    }

    const asset = await requestAsset(chamaId, req.user._id, {
      asset_type,
      name,
      description,
      income_pattern,
      expected_monthly_income,
      acquisition,
      management,
      documents,
      business_id,
    });

    return res.status(201).json({
      success: true,
      message: "Asset registration requested — awaiting the second official's sign-off",
      data: { asset },
    });
  } catch (error) {
    next(error);
  }
};

// POST /chamas/:chamaId/assets/:assetId/approve
export const approveChamaAssetController = async (req, res, next) => {
  try {
    const { chamaId, assetId } = req.params;

    // req.membership.role is set by requireChamaTreasurerOrChairperson —
    // only those two roles reach this handler in the first place.
    const asset = await approveAsset(chamaId, assetId, {
      userId: req.user._id,
      role: req.membership.role,
      membershipId: req.membership._id,
    });

    return res.status(200).json({
      success: true,
      message: asset.status === "active" ? "Asset is now active" : "Signature recorded — awaiting the other official",
      data: { asset },
    });
  } catch (error) {
    next(error);
  }
};

// POST /chamas/:chamaId/assets/:assetId/reject
export const rejectChamaAssetController = async (req, res, next) => {
  try {
    const { chamaId, assetId } = req.params;
    const asset = await rejectAsset(chamaId, assetId, req.membership._id, req.body?.reason);
    return res.status(200).json({ success: true, data: { asset } });
  } catch (error) {
    next(error);
  }
};

export const requestChamaBusinessWorkspaceController = async (req, res, next) => {
  try {
    const { name, description = "", category = "retail", location = "", requestedCapital = 0 } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Business name is required" });
    if (!BUSINESS_CATEGORIES.includes(category)) return res.status(400).json({ success: false, message: "Choose a valid business category" });
    const capital = Number(requestedCapital);
    if (!Number.isFinite(capital) || capital < 0) return res.status(400).json({ success: false, message: "Requested capital must be zero or greater" });

    const trimmedName = name.trim();
    const duplicate = await WorkspaceRequest.findOne({
      entityType: "business",
      ownerType: "chama",
      chamaId: req.chama._id,
      name: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
      status: { $in: ["PENDING", "UNDER_REVIEW"] },
    }).select("requestNumber");
    if (duplicate) {
      return res.status(409).json({ success: false, message: `A request for this business is already awaiting review (${duplicate.requestNumber})` });
    }

    // The CHAMA will own the approved business. The requesting officer is
    // recorded only as requestedBy / requestedByRole - their details are
    // deliberately NOT put in the chairperson slot, which is what used to make
    // the officer the owner on approval.
    const request = await WorkspaceRequest.create({
      requestedBy: req.user._id,
      entityType: "business",
      ownerType: "chama",
      chamaId: req.chama._id,
      requestedByRole: ["chairperson", "treasurer"].includes(req.membership?.role) ? req.membership.role : "",
      name: trimmedName,
      description: String(description).trim(),
      category,
      requestedCapital: capital,
      details: { location: String(location).trim(), purpose: "Chama-owned business workspace" },
      applicantNotes: "Business workspace requested by Chama leadership.",
    });

    return res.status(201).json({ success: true, data: { request }, message: "Business workspace request sent to Platform Administration" });
  } catch (error) {
    next(error);
  }
};

export const listChamaBusinessWorkspaceRequestsController = async (req, res, next) => {
  try {
    const requests = await WorkspaceRequest.find({ chamaId: req.chama._id, ownerType: "chama", entityType: "business" })
      .select("requestNumber name description category requestedCapital businessWorkspaceSettings requestedByRole status adminNotes rejectionReason createdEntityId createdAt updatedAt")
      .sort({ createdAt: -1 });
    return res.json({ success: true, data: { requests } });
  } catch (error) { next(error); }
};

export const recordChamaAssetExpenseController = async (req, res, next) => {
  try {
    const { amount, collectionMethod, description, category } = req.body;
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) return res.status(400).json({ success: false, message: "A positive amount is required" });
    const result = await recordExpense(req.params.chamaId, req.params.assetId, { amount: Number(amount), collectionMethod, description, category, recordedBy: req.user._id });
    return res.status(201).json({ success: true, data: result });
  } catch (error) { next(error); }
};

// GET /chamas/:chamaId/assets/:assetId/expenses/breakdown
export const getAssetExpenseBreakdownController = async (req, res, next) => {
  try {
    const breakdown = await getAssetExpenseBreakdown(req.params.chamaId, req.params.assetId);
    return res.status(200).json({ success: true, data: { breakdown } });
  } catch (error) { next(error); }
};

// GET /chamas/:chamaId/assets/reconciliation/unverified — every
// manager-reported M-Pesa income entry still waiting on a matching
// Safaricom confirmation, across all of this chama's assets. This is
// the "flagged, not silently accepted" queue leadership works from.
export const listUnverifiedAssetIncomeController = async (req, res, next) => {
  try {
    const entries = await listUnverifiedAssetIncome(req.params.chamaId);
    return res.status(200).json({ success: true, data: { entries } });
  } catch (error) { next(error); }
};

// POST /chamas/:chamaId/assets/reconciliation/:transactionId/verify — a
// leader independently found the matching receipt (e.g. in the M-Pesa
// statement) and closes the flag by hand.
export const manuallyVerifyAssetIncomeController = async (req, res, next) => {
  try {
    const { mpesaReceiptNumber } = req.body;
    const entry = await manuallyVerifyAssetIncome(req.params.chamaId, req.params.transactionId, mpesaReceiptNumber, req.user._id);
    return res.status(200).json({ success: true, message: "Entry verified", data: { entry } });
  } catch (error) { next(error); }
};

export const fundChamaBusinessController = async (req, res, next) => {
  try {
    const funding = await fundChamaBusiness(req.params.chamaId, req.params.assetId, {
      ...req.body, recordedBy: req.user._id,
    });
    return res.status(201).json({ success: true, data: { funding } });
  } catch (error) { next(error); }
};

export const listProfitDistributionsController = async (req, res, next) => {
  try {
    const distributions = await listProfitDistributions(req.params.chamaId, req.membership._id);
    return res.json({ success: true, data: { distributions } });
  } catch (error) { next(error); }
};

export const createProfitDistributionController = async (req, res, next) => {
  try {
    const distribution = await createProfitDistribution(req.params.chamaId, {
      assetId: req.params.assetId, recipients: req.body.recipients,
      scheduledAt: req.body.scheduledAt, createdBy: req.user._id,
    });
    return res.status(201).json({ success: true, data: { distribution } });
  } catch (error) { next(error); }
};

export const respondProfitDistributionController = async (req, res, next) => {
  try {
    const distribution = await respondToProfitDistribution(req.params.chamaId, req.params.distributionId, req.membership._id, req.body.response);
    return res.json({ success: true, data: { distribution } });
  } catch (error) { next(error); }
};

export const listChamaAssetTransactionsController = async (req, res, next) => {
  try {
    const transactions = await listAssetTransactions(req.params.chamaId, req.params.assetId);
    return res.status(200).json({ success: true, data: { transactions } });
  } catch (error) { next(error); }
};

export const createInvestmentProposalController = async (req, res, next) => {
  try {
    const { title, description, asset_type, proposal, documents } = req.body;
    if (!title || !asset_type || !proposal || !Number.isFinite(Number(proposal.purchase_price))) return res.status(400).json({ success: false, message: "title, asset_type, and purchase_price are required" });
    const result = await requestInvestmentProposal(req.params.chamaId, req.user._id, { title, description, asset_type, proposal, documents });
    return res.status(201).json({ success: true, data: { proposal: result } });
  } catch (error) { next(error); }
};

export const listInvestmentProposalsController = async (req, res, next) => {
  try {
    const proposals = await listInvestmentProposals(req.params.chamaId);
    return res.status(200).json({ success: true, data: { proposals } });
  } catch (error) { next(error); }
};

export const decideInvestmentProposalController = async (req, res, next) => {
  try {
    const decision = req.body?.decision;
    if (!["approved", "rejected"].includes(decision)) return res.status(400).json({ success: false, message: "decision must be approved or rejected" });
    const result = await decideInvestmentProposal(req.params.chamaId, req.params.proposalId, req.membership._id, decision, req.body?.comment || "");
    return res.status(200).json({ success: true, data: result });
  } catch (error) { next(error); }
};

export const completeInvestmentAcquisitionController = async (req, res, next) => {
  try {
    const { collectionMethod, settlementReference } = req.body || {};
    const result = await completeInvestmentAcquisition(req.params.chamaId, req.params.proposalId, {
      collectionMethod,
      settlementReference,
      recordedBy: req.user._id,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) { next(error); }
};

// GET /chamas/:chamaId/assets/:assetId/progress
// Read-only, every-member view — see chamaAsset.service.js#getAssetProgress
// for why this is deliberately NOT gated the way the money-movement
// endpoints above are.
export const getAssetProgressController = async (req, res, next) => {
  try {
    const progress = await getAssetProgress(req.params.chamaId, req.params.assetId);
    return res.status(200).json({ success: true, data: progress });
  } catch (error) { next(error); }
};

// POST /chamas/:chamaId/assets/:assetId/valuation
export const recordAssetValuationController = async (req, res, next) => {
  try {
    const { amount, note, as_of } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "A positive valuation amount is required" });
    }
    const entry = await recordAssetValuation(req.params.chamaId, req.params.assetId, { amount, note, asOf: as_of, recordedBy: req.user._id });
    return res.status(201).json({ success: true, message: "Valuation recorded", data: { entry } });
  } catch (error) { next(error); }
};

// POST /chamas/:chamaId/assets/:assetId/transactions/:transactionId/flag
// Any active member — see chamaAsset.service.js#flagAssetTransactionDiscrepancy
// for why this deliberately is NOT leadership-gated at the route level.
export const flagAssetTransactionDiscrepancyController = async (req, res, next) => {
  try {
    const { chamaId, assetId, transactionId } = req.params;
    const entry = await flagAssetTransactionDiscrepancy(chamaId, assetId, transactionId, {
      raisedByMembershipId: req.membership._id,
      reason: req.body?.reason,
    });
    return res.status(201).json({ success: true, message: "Discrepancy flagged and sent to leadership for review", data: { entry } });
  } catch (error) { next(error); }
};

// POST /chamas/:chamaId/assets/:assetId/transactions/:transactionId/flag/decision
// Body: { decision: "approved" | "rejected", comment? }. Role eligibility,
// self-approval prevention, etc. are all enforced inside approvalService —
// same engine, same guarantees, as every other multi-signatory decision.
export const decideAssetTransactionDiscrepancyController = async (req, res, next) => {
  try {
    const { chamaId, transactionId } = req.params;
    const { decision, comment } = req.body;
    const entry = await decideAssetTransactionDiscrepancy(chamaId, transactionId, req.membership._id, decision, comment || "");
    return res.status(200).json({ success: true, data: { entry } });
  } catch (error) { next(error); }
};

// GET /chamas/:chamaId/assets/discrepancies
export const listAssetTransactionDiscrepanciesController = async (req, res, next) => {
  try {
    const AUDIT_ACCESS_ROLES = ["chairperson", "treasurer", "secretary", "auditor"];
    const entries = await listAssetTransactionDiscrepancies(req.params.chamaId, {
      viewerMembershipId: req.membership._id,
      viewerCanSeeAll: AUDIT_ACCESS_ROLES.includes(req.membership.role),
    });
    return res.status(200).json({ success: true, data: { entries } });
  } catch (error) { next(error); }
};

// POST /chamas/:chamaId/assets/:assetId/income
// Records real income through the accounting engine and pushes a live
// update to every member's dashboard via the chama's socket room.
export const recordChamaAssetIncomeController = async (req, res, next) => {
  try {
    const { chamaId, assetId } = req.params;
    const { amount, collectionMethod, description, mpesaReceiptNumber } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "A positive amount is required" });
    }

    const result = await recordIncome(chamaId, assetId, {
      amount,
      collectionMethod,
      description,
      mpesaReceiptNumber,
      recordedBy: req.user._id,
    });

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

import { getPortfolioDashboard } from "./portfolioDashboard.service.js";

// GET /chamas/:chamaId/assets/portfolio-dashboard
export const getPortfolioDashboardController = async (req, res, next) => {
  try {
    const data = await getPortfolioDashboard(req.params.chamaId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// GET /chamas/:chamaId/assets/business-workspaces
// Chama-owned business workspaces with their current manager, for the Leadership Desk.
export const listChamaBusinessWorkspacesController = async (req, res, next) => {
  try {
    const workspaces = await listChamaBusinessWorkspaces(req.chama._id);
    return res.json({ success: true, data: { workspaces } });
  } catch (error) { next(error); }
};
