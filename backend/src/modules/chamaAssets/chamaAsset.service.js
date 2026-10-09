import mongoose from "mongoose";
import ChamaAsset from "../../models/ChamaAsset.js";
import accountingService from "../finance/accounting/accounting.service.js";
import { getIO } from "../realtime/socketServer.js";
import AppError from "../../utils/AppError.js";
import ChamaMembership from "../../models/ChamaMembership.js";
import ContributionPayment from "../../models/ContributionPayment.js";
import ChamaProfile from "../../models/ChamaProfile.js";
import AssetTransaction from "../../models/AssetTransaction.js";
import InvestmentProposal from "../../models/InvestmentProposal.js";
import Business from "../../models/Business.js";
import FinancialAccount from "../../models/FinancialAccount.js";
import ChamaBusinessFunding from "../../models/ChamaBusinessFunding.js";
import ChamaAssetDistribution from "../../models/ChamaAssetDistribution.js";
import ChamaProfitWalletEntry from "../../models/ChamaProfitWalletEntry.js";
import FinancialTransaction from "../../models/FinancialTransaction.js";
import mpesaService from "../../payment/providers/mpesa/mpesa.service.js";
import notificationService from "../../services/notification.service.js";
import approvalService from "../approval/approval.service.js";
import C2bPayment from "../../models/C2bPayment.js";
import AssetLease from "../../models/AssetLease.js";
import Chama from "../../models/Chama.js";
import { isModuleEnabled } from "../../constants/workspaceModules.constants.js";
import { closeReportPeriodForHandover, isSameManager } from "./assetManagerReport.service.js";
import { generateUniqueAssetPaymentCode } from "../../utils/assetPaymentCode.js";

// Self-healing, mirrors bootstrapSystemAccounts()'s "create if missing"
// pattern — called wherever an asset becomes able to receive money, so
// no asset is ever stuck without a payable reference code.
export async function ensureAssetPaymentRefCode(asset) {
  if (asset.payment_ref_code) return asset;
  asset.payment_ref_code = await generateUniqueAssetPaymentCode();
  await asset.save();
  return asset;
}

const emitToChama = (chamaId, event, payload) => {
  try {
    getIO().to(`chama:${chamaId}`).emit(event, payload);
  } catch (error) {
    // Non-fatal — mirrors business.service.js: Socket.IO may not be up
    // (tests/scripts), REST responses and dashboard polling remain the
    // fallback either way.
    console.warn(`[chamaAsset.service] Failed to emit ${event}:`, error.message);
  }
};

async function investmentApprovalCount(chamaId) {
  const profile = await ChamaProfile.findOne({ chama_id: chamaId }).select("required_payout_approvals").lean();
  return Math.max(1, Math.min(3, Number(profile?.required_payout_approvals) || 2));
}

// ============================================================
// LIST — what the dashboard reads to decide whether to show the
// Assets & Income panel at all.
// ============================================================
export async function listChamaAssets(chamaId, { includePending = false } = {}) {
  const statusFilter = includePending
    ? { $in: ["active", "pending_approval"] }
    : "active";

  return ChamaAsset.find({ chama_id: chamaId, status: statusFilter })
    .populate("operations_ref.business_id", "name category")
    .sort({ createdAt: -1 });
}

// ============================================================
// REGISTER AT CREATION — founding members are implicitly approving
// it by creating the chama around it, so this goes straight to
// 'active' and its income account is provisioned immediately.
// ============================================================
export async function registerAssetAtCreation(chamaId, userId, payload, session = null) {
  const [asset] = await ChamaAsset.create(
    [
      {
        chama_id: chamaId,
        asset_type: payload.asset_type,
        name: payload.name,
        description: payload.description || "",
        income_pattern: payload.income_pattern || "irregular",
        expected_monthly_income: payload.expected_monthly_income || null,
        status: "active",
        requested_by: userId,
        activated_at: new Date(),
      },
    ],
    session ? { session } : {}
  );
  // Not inside the create() session-batch above since generation itself
  // needs to read the collection to check uniqueness; harmless to do
  // just after, before this function returns.
  await ensureAssetPaymentRefCode(asset);
  return asset;
}

// ============================================================
// REQUEST — a chama that acquires a business/property later. This
// does NOT go straight to active; requireLeadershipStepUp already
// confirmed the requester is the treasurer or chairperson, but a
// single official still can't unilaterally declare a new chama
// asset — see approveAsset() below for the second signature.
// ============================================================
export async function requestAsset(chamaId, userId, payload) {
  const membership = await ChamaMembership.findOne({ chama_id: chamaId, user_id: userId, status: "active" });
  if (!membership) throw new AppError("Active chama membership required", 403);
  const asset = await ChamaAsset.create({
    chama_id: chamaId,
    asset_type: payload.asset_type,
    name: payload.name,
    description: payload.description || "",
    income_pattern: payload.income_pattern || "irregular",
    expected_monthly_income: payload.expected_monthly_income || null,
    acquisition: payload.acquisition || {},
    management: payload.management || {},
    documents: payload.documents || [],
    operations_ref: { business_id: payload.business_id || null },
    status: "pending_approval",
    requested_by: userId,
  });

  const linkedBusiness = payload.business_id
    ? await Business.findOne({ _id: payload.business_id, owner_type: "chama", owner_id: chamaId })
    : null;
  if (payload.business_id && !linkedBusiness) {
    await ChamaAsset.deleteOne({ _id: asset._id });
    throw new AppError("Business must belong to this chama", 400);
  }

  try {
    const approval = await approvalService.createRequest({
      chamaId, resourceType: "INVESTMENT", resourceId: asset._id,
      action: "REGISTER_ASSET", title: `Register asset: ${asset.name}`,
      description: asset.description, amount: asset.acquisition?.purchase_price || null,
      initiatedByMembershipId: membership._id, requiredApprovals: await investmentApprovalCount(chamaId),
      eligibleRoles: ["chairperson", "secretary", "treasurer"],
      allowInitiatorApproval: false, permissionKey: "finance.invest",
      metadata: { resource_kind: "CHAMA_ASSET", asset_id: String(asset._id) },
    });
    asset.approval_request_id = approval._id;
    await asset.save();
  } catch (error) {
    await ChamaAsset.deleteOne({ _id: asset._id });
    throw error;
  }
  if (linkedBusiness) {
    linkedBusiness.chama_asset_id = asset._id;
    await linkedBusiness.save();
  }

  emitToChama(chamaId, "chama_asset:requested", {
    assetId: asset._id,
    name: asset.name,
    asset_type: asset.asset_type,
  });

  return asset;
}

// ============================================================
// APPROVE — the generic approval engine applies the chama's configured
// eligible roles, threshold, and separation-of-duties rules.
// ============================================================
export async function approveAsset(chamaId, assetId, approver) {
  const asset = await ChamaAsset.findOne({ _id: assetId, chama_id: chamaId });
  if (!asset) throw new AppError("Chama asset not found", 404);
  if (asset.status !== "pending_approval") {
    throw new AppError(`Asset is '${asset.status}', not pending approval`, 400);
  }

  if (!asset.approval_request_id) throw new AppError("Asset approval request is missing", 409);
  const approval = await approvalService.submitSignoff({
    requestId: asset.approval_request_id,
    approverMembershipId: approver.membershipId,
    status: "approved",
  });
  if (approval.status === "approved") {
    asset.status = "active";
    asset.activated_at = new Date();
    await asset.save();
    await ensureAssetPaymentRefCode(asset);
  } else if (approval.status === "rejected") {
    asset.status = "rejected";
    await asset.save();
  }

  emitToChama(chamaId, "chama_asset:updated", {
    assetId: asset._id,
    status: asset.status,
  });

  return asset;
}

export async function rejectAsset(chamaId, assetId, membershipId, reason) {
  const asset = await ChamaAsset.findOne({ _id: assetId, chama_id: chamaId, status: "pending_approval" });
  if (!asset) throw new AppError("Pending chama asset not found", 404);
  if (asset.approval_request_id) await approvalService.submitSignoff({ requestId: asset.approval_request_id, approverMembershipId: membershipId, status: "rejected", comment: reason || "" });
  asset.status = "rejected";
  asset.rejection_reason = reason || "";
  await asset.save();

  emitToChama(chamaId, "chama_asset:updated", { assetId: asset._id, status: "rejected" });
  return asset;
}

// ============================================================
// OWNERSHIP — each active member's % stake in THIS asset (basis
// points; 10000 = 100.00%). Defaults to proportional-to-lifetime-
// contribution; leadership can lock in a manual, negotiated split
// instead. See ChamaAsset.js `ownership` for why this lives per-asset
// rather than being assumed equal to the whole chama.
// ============================================================

// Largest-remainder rounding: allocate each member's floor share, then
// hand out the few leftover basis points (from truncation) to whoever's
// fractional remainder was biggest, one each, until the total is
// exactly 10000. Naive independent rounding of each share can drift a
// point or two once you sum them — this never does.
function allocateBasisPointsByShare(entries) {
  const raw = entries.map(({ member_id, weight }) => {
    const exact = weight * 10000;
    const floor = Math.floor(exact);
    return { member_id, basis_points: floor, remainder: exact - floor };
  });
  const allocated = raw.reduce((sum, r) => sum + r.basis_points, 0);
  let toDistribute = 10000 - allocated;
  raw.sort((a, b) => b.remainder - a.remainder);
  return raw.map((r, i) => ({
    member_id: r.member_id,
    basis_points: r.basis_points + (i < toDistribute ? 1 : 0),
  }));
}

export async function computeContributionProportionalSplit(chamaId) {
  const members = await ChamaMembership.find({ chama_id: chamaId, status: "active" }).select("_id");
  if (!members.length) throw new AppError("Chama has no active members to split ownership between", 400);

  const totals = await ContributionPayment.aggregate([
    { $match: { owner_type: "Chama", owner_id: new mongoose.Types.ObjectId(chamaId), participant_type: "ChamaMembership", status: "completed" } },
    { $group: { _id: "$participant_id", total: { $sum: "$amount" } } },
  ]);
  const totalsMap = new Map(totals.map((t) => [String(t._id), Number(t.total?.toString?.() ?? t.total ?? 0)]));
  const grandTotal = [...totalsMap.values()].reduce((sum, v) => sum + v, 0);

  // No recorded contribution history yet (e.g. a brand-new chama) — fall
  // back to an equal split rather than dividing by zero.
  if (grandTotal <= 0) {
    return allocateBasisPointsByShare(members.map((m) => ({ member_id: m._id, weight: 1 / members.length })));
  }
  return allocateBasisPointsByShare(
    members.map((m) => ({ member_id: m._id, weight: (totalsMap.get(String(m._id)) || 0) / grandTotal }))
  );
}

export async function recalculateAssetOwnership(chamaId, assetId) {
  const asset = await ChamaAsset.findOne({ _id: assetId, chama_id: chamaId });
  if (!asset) throw new AppError("Chama asset not found", 404);
  if (asset.ownership?.locked) {
    throw new AppError("Ownership was manually set for this asset — clear the override before recalculating", 409);
  }
  const splits = await computeContributionProportionalSplit(chamaId);
  asset.ownership = { basis: "contribution_proportional", splits, locked: false, last_recalculated_at: new Date() };
  await asset.save();
  emitToChama(chamaId, "chama_asset:ownership_updated", { assetId: asset._id, basis: "contribution_proportional" });
  return asset;
}

// splits: [{ member_id, percentage }] — percentage as a human number
// (e.g. 37.5), not basis points; converted here. Every active chama
// member must be accounted for (a 0% share is fine and explicit) so
// there's never an ambiguous "who owns the rest" gap.
export async function setAssetOwnershipOverride(chamaId, assetId, splits) {
  const asset = await ChamaAsset.findOne({ _id: assetId, chama_id: chamaId });
  if (!asset) throw new AppError("Chama asset not found", 404);
  if (!Array.isArray(splits) || !splits.length) throw new AppError("Provide at least one ownership share", 400);

  const activeMembers = await ChamaMembership.find({ chama_id: chamaId, status: "active" }).select("_id");
  const activeIds = new Set(activeMembers.map((m) => String(m._id)));
  const seen = new Set();
  const normalized = splits.map((s) => {
    const memberId = String(s.member_id || "");
    if (!activeIds.has(memberId)) throw new AppError("Every entry must be an active chama member", 400);
    if (seen.has(memberId)) throw new AppError("Each member can appear only once in the split", 400);
    seen.add(memberId);
    const basisPoints = Math.round(Number(s.percentage) * 100);
    if (!Number.isFinite(basisPoints) || basisPoints < 0) throw new AppError("Each share must be a non-negative percentage", 400);
    return { member_id: s.member_id, basis_points: basisPoints };
  });
  if (seen.size !== activeMembers.length) throw new AppError("Every active chama member must appear in the split (0% is fine)", 400);
  const total = normalized.reduce((sum, s) => sum + s.basis_points, 0);
  if (total !== 10000) throw new AppError(`Ownership shares must total 100% (got ${(total / 100).toFixed(2)}%)`, 400);

  asset.ownership = { basis: "manual", splits: normalized, locked: true, last_recalculated_at: new Date() };
  await asset.save();
  emitToChama(chamaId, "chama_asset:ownership_updated", { assetId: asset._id, basis: "manual" });
  return asset;
}

// Unlocks a manual override so the next recalculate call can take over
// again — a deliberate separate step so recalculation never silently
// discards a negotiated split by accident.
export async function unlockAssetOwnership(chamaId, assetId) {
  const asset = await ChamaAsset.findOneAndUpdate(
    { _id: assetId, chama_id: chamaId },
    { $set: { "ownership.locked": false } },
    { returnDocument: 'after' }
  );
  if (!asset) throw new AppError("Chama asset not found", 404);
  return asset;
}

// ============================================================
// MANAGER / CARETAKER — who's responsible for day-to-day running of
// the asset. Deliberately separate from ownership: the chama owns it,
// this person just reports on and operates it. Can be an existing
// member OR a named external party with no account at all (e.g. a
// local farmer a plot is lent to for a season).
// ============================================================
export async function assignAssetManager(chamaId, assetId, { managerType, managerId, externalName, externalContact, notes }) {
  if (!["member", "external", "unassigned"].includes(managerType)) {
    throw new AppError("manager_type must be member, external, or unassigned", 400);
  }
  const asset = await ChamaAsset.findOne({ _id: assetId, chama_id: chamaId });
  if (!asset) throw new AppError("Chama asset not found", 404);

  // Snapshot whoever was responsible before this call into
  // management_history — the record a manager-performance lookup and
  // every past reporting period's manager_snapshot depend on. Skipped
  // only when there was never anyone assigned (nothing to snapshot).
  const previous = asset.management?.toObject?.() ?? asset.management ?? {};
  const changed = !isSameManager(previous, { manager_type: managerType, manager_id: managerId, external_name: externalName });
  const now = new Date();
  // Re-saving the SAME person (e.g. just editing notes) is not a
  // handover — no history row, no reset of assigned_at, no report cut-off.
  if (changed && previous.manager_type && previous.manager_type !== "unassigned") {
    asset.management_history.push({ ...previous, ended_at: now });
  }

  if (managerType === "member") {
    if (!managerId) throw new AppError("managerId is required when manager_type is member", 400);
    const membership = await ChamaMembership.findOne({ chama_id: chamaId, user_id: managerId, status: "active" });
    if (!membership) throw new AppError("Manager must be an active member of this chama", 400);
    asset.management = { manager_type: "member", manager_id: managerId, external_name: "", external_contact: "", assigned_at: changed ? now : previous.assigned_at || now, notes: notes || "" };
  } else if (managerType === "external") {
    if (!String(externalName || "").trim()) throw new AppError("externalName is required for an external caretaker", 400);
    asset.management = { manager_type: "external", manager_id: null, external_name: externalName.trim(), external_contact: (externalContact || "").trim(), assigned_at: changed ? now : previous.assigned_at || now, notes: notes || "" };
  } else {
    asset.management = { manager_type: "unassigned", manager_id: null, external_name: "", external_contact: "", assigned_at: null, notes: notes || "" };
  }

  // A real caretaker (member or external) now exists to be accountable
  // to — switch the periodic-report loop on automatically so nobody has
  // to remember to opt an asset in separately. Left untouched once a
  // chama has explicitly turned it off for this asset (checked via the
  // `manager_reporting` sub-doc already existing with enabled: false
  // set by hand — there is currently no separate toggle endpoint, so in
  // practice this only ever turns it on).
  if (managerType !== "unassigned") {
    asset.manager_reporting = { ...(asset.manager_reporting?.toObject?.() ?? asset.manager_reporting ?? {}), enabled: true };
  }

  await asset.save();
  // Cut the in-progress report period off at the handover so it stays
  // with the outgoing manager — see assetManagerReport.service.js.
  if (changed) await closeReportPeriodForHandover(chamaId, asset._id, now);
  emitToChama(chamaId, "chama_asset:updated", { assetId: asset._id, management: asset.management });
  return asset;
}

// ============================================================
// OPERATIONAL STATUS — idle / leased_out / occupied / under_maintenance
// / for_sale. Separate axis from lifecycle `status`; the manager
// updates this as ground reality changes, without touching the
// approval-gated lifecycle field.
// ============================================================
export async function setAssetOperationalStatus(chamaId, assetId, operationalStatus) {
  const VALID = ["idle", "leased_out", "occupied", "under_maintenance", "for_sale"];
  if (!VALID.includes(operationalStatus)) throw new AppError(`operational_status must be one of: ${VALID.join(", ")}`, 400);
  const asset = await ChamaAsset.findOneAndUpdate(
    { _id: assetId, chama_id: chamaId, status: "active" },
    { $set: { operational_status: operationalStatus } },
    { returnDocument: 'after' }
  );
  if (!asset) throw new AppError("Active chama asset not found", 404);
  emitToChama(chamaId, "chama_asset:updated", { assetId: asset._id, operational_status: operationalStatus });
  return asset;
}

// ============================================================
// RECORD INCOME — the whole point. Posts through the SAME
// double-entry accounting engine contributions/loans use, then
// pushes a live event to every member currently on the chama's
// dashboard so the figure updates without a refresh.
// ============================================================
export async function recordIncome(chamaId, assetId, { amount, collectionMethod, description, recordedBy, sourceBusinessTransactionId, mpesaReceiptNumber, leaseId, leasePeriodId, reconciliationStatus }) {
  const asset = await ChamaAsset.findOne({ _id: assetId, chama_id: chamaId, status: "active" });
  if (!asset) throw new AppError("Active chama asset not found", 404);

  if (sourceBusinessTransactionId) {
    const prior = await AssetTransaction.findOne({ asset_id: assetId, source_business_transaction_id: sourceBusinessTransactionId, type: "income" });
    if (prior) return { success: true, duplicate: true, transactionId: prior.financial_transaction_id, journalId: prior.journal_id };
  }

  const method = collectionMethod || "cash";

  // ============================================================
  // RECONCILIATION — "trust me, I collected it" is not good enough for
  // an M-Pesa collection. `reconciliationStatus` lets an internal caller
  // (the C2B webhook handler, which already has Safaricom's own
  // confirmation in hand) assert "verified" directly; everyone else
  // (a manager typing in a figure) gets checked against C2bPayment.
  // ============================================================
  let finalReconciliationStatus = "not_applicable";
  let matchedC2b = null;
  if (method === "mpesa") {
    if (reconciliationStatus === "verified") {
      finalReconciliationStatus = "verified";
    } else if (mpesaReceiptNumber) {
      matchedC2b = await C2bPayment.findOne({ mpesa_receipt_number: mpesaReceiptNumber });
      const receiptAmount = matchedC2b ? Number(matchedC2b.amount?.toString?.() ?? matchedC2b.amount) : null;
      const alreadyClaimedByOther = matchedC2b?.matched_asset_id && String(matchedC2b.matched_asset_id) !== String(asset._id);
      finalReconciliationStatus = matchedC2b && receiptAmount === Number(amount) && !alreadyClaimedByOther ? "verified" : "unverified";
    } else {
      // Manager reported an M-Pesa collection with no receipt to check
      // against — recorded, but flagged, never silently taken on trust.
      finalReconciliationStatus = "unverified";
    }
  }

  const session = mongoose.connection?.client?.topology ? await mongoose.startSession() : null;

  try {
    const result = await accountingService.post(
      {
        referenceType: "CHAMA_ASSET_INCOME_POSTING",
        transactionType: "chama_asset_income",
        source_type: sourceBusinessTransactionId ? "BusinessTransaction" : "ChamaAsset",
        source_id: sourceBusinessTransactionId || asset._id,
        owner_type: "Chama",
        owner_id: chamaId,
        assetId: asset._id,
        assetName: asset.name,
        sourceBusinessTransactionId,
        amount,
        collectionMethod: method,
        description: description || `Income — ${asset.name}`,
        recordedBy,
        created_by: recordedBy,
        reconciliationStatus: finalReconciliationStatus,
        mpesaReceiptNumber: method === "mpesa" ? mpesaReceiptNumber || null : null,
        leaseId: leaseId || null,
        leasePeriodId: leasePeriodId || null,
      },
      session
    );

    if (matchedC2b && finalReconciliationStatus === "verified") {
      matchedC2b.matched_asset_id = asset._id;
      matchedC2b.matched_chama_id = chamaId;
      if (matchedC2b.match_status === "unmatched") {
        matchedC2b.match_status = "manually_matched";
        matchedC2b.reconciled_by = recordedBy || null;
        matchedC2b.reconciled_at = new Date();
      }
      await matchedC2b.save();
    }

    // Live push — this is the piece that makes the dashboard update the
    // instant the treasurer records the figure, not on next page load.
    emitToChama(chamaId, "finance:asset_income", {
      assetId: asset._id,
      assetName: asset.name,
      amount,
      reconciliationStatus: finalReconciliationStatus,
      recordedAt: new Date(),
    });
    if (finalReconciliationStatus === "unverified") {
      // A distinct event so a leadership review queue can subscribe
      // separately from the routine "income recorded" dashboard tick.
      emitToChama(chamaId, "finance:asset_income_unverified", {
        assetId: asset._id,
        assetName: asset.name,
        amount,
        recordedAt: new Date(),
      });
    }

    return { ...result, reconciliationStatus: finalReconciliationStatus };
  } finally {
    if (session) session.endSession();
  }
}

// ============================================================
// M-PESA INCOME FROM THE REAL C2B WEBHOOK — called by
// modules/mpesaC2b/c2bReconciliation.service.js when a genuine Safaricom
// confirmation's BillRefNumber matches an asset's payment_ref_code.
// If a manager already logged this exact collection manually (and it's
// sitting 'unverified'), this just confirms that entry rather than
// posting the income a second time. Otherwise it books the income
// itself, straight to 'verified' — Safaricom's own confirmation IS the
// verification, no manager entry required.
// ============================================================
export async function recordVerifiedAssetIncomeFromC2b(chamaId, assetId, { amount, mpesaReceiptNumber, description }) {
  const amountValue = Number(amount);
  const pending = await AssetTransaction.findOne({
    chama_id: chamaId,
    asset_id: assetId,
    type: "income",
    reconciliation_status: "unverified",
    amount: amountValue,
    mpesa_receipt_number: null,
    occurred_at: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
  }).sort({ occurred_at: -1 });

  if (pending) {
    pending.reconciliation_status = "verified";
    pending.mpesa_receipt_number = mpesaReceiptNumber;
    await pending.save();
    return { success: true, matchedExisting: true, transactionId: pending.financial_transaction_id, journalId: pending.journal_id };
  }

  return recordIncome(chamaId, assetId, {
    amount: amountValue,
    collectionMethod: "mpesa",
    description: description || "Rent/lease payment received via M-Pesa",
    recordedBy: null,
    mpesaReceiptNumber,
    reconciliationStatus: "verified",
  });
}

// ============================================================
// RECONCILIATION QUEUE — every manager-reported M-Pesa income entry
// still waiting on a matching Safaricom confirmation, per chama.
// ============================================================
export async function listUnverifiedAssetIncome(chamaId) {
  return AssetTransaction.find({ chama_id: chamaId, type: "income", reconciliation_status: "unverified" })
    .populate("asset_id", "name")
    .sort({ occurred_at: -1 });
}

// Leadership manually confirms an entry once they've independently
// found the matching receipt (e.g. in the M-Pesa statement) — does NOT
// re-post the income, just closes the flag.
export async function manuallyVerifyAssetIncome(chamaId, assetTransactionId, mpesaReceiptNumber, verifiedBy) {
  const entry = await AssetTransaction.findOne({ _id: assetTransactionId, chama_id: chamaId, type: "income" });
  if (!entry) throw new AppError("Asset income entry not found", 404);
  if (entry.reconciliation_status !== "unverified") throw new AppError("This entry is not awaiting verification", 409);
  entry.reconciliation_status = "verified";
  entry.mpesa_receipt_number = mpesaReceiptNumber || entry.mpesa_receipt_number;
  await entry.save();
  emitToChama(chamaId, "chama_asset:updated", { assetId: entry.asset_id, verifiedIncome: entry._id });
  return entry;
}

export async function listAssetTransactions(chamaId, assetId) {
  const asset = await ChamaAsset.findOne({ _id: assetId, chama_id: chamaId });
  if (!asset) throw new AppError("Chama asset not found", 404);
  return AssetTransaction.find({ chama_id: chamaId, asset_id: assetId })
    .populate("financial_transaction_id")
    .populate("journal_id")
    .populate("ledger_entry_ids")
    .sort({ occurred_at: -1 });
}

export async function requestInvestmentProposal(chamaId, userId, data) {
  const membership = await ChamaMembership.findOne({ chama_id: chamaId, user_id: userId, status: "active" });
  if (!membership) throw new AppError("Active chama membership required", 403);
  const proposal = await InvestmentProposal.create({ chama_id: chamaId, ...data, proposed_by: userId, status: "under_review" });
  try {
    const approval = await approvalService.createRequest({
      chamaId, resourceType: "INVESTMENT", resourceId: proposal._id,
      action: "ACQUIRE_ASSET", title: `Investment proposal: ${proposal.title}`,
      description: proposal.description, amount: proposal.proposal.purchase_price,
      initiatedByMembershipId: membership._id, requiredApprovals: await investmentApprovalCount(chamaId),
      eligibleRoles: ["chairperson", "secretary", "treasurer"], allowInitiatorApproval: false,
      permissionKey: "finance.invest", metadata: { resource_kind: "INVESTMENT_PROPOSAL" },
    });
    proposal.approval_request_id = approval._id;
    await proposal.save();
  } catch (error) { await InvestmentProposal.deleteOne({ _id: proposal._id }); throw error; }
  return proposal;
}

export async function listInvestmentProposals(chamaId) {
  return InvestmentProposal.find({ chama_id: chamaId, status: { $in: ["under_review", "approved"] } })
    .populate("approval_request_id")
    .sort({ createdAt: -1 });
}

export async function decideInvestmentProposal(chamaId, proposalId, membershipId, decision, comment = "") {
  const proposal = await InvestmentProposal.findOne({ _id: proposalId, chama_id: chamaId, status: "under_review" });
  if (!proposal) throw new AppError("Investment proposal not found or not under review", 404);
  const currentApproval = await approvalService.getRequestById(proposal.approval_request_id);
  const approval = ["approved", "rejected"].includes(currentApproval?.status)
    ? currentApproval
    : await approvalService.submitSignoff({ requestId: proposal.approval_request_id, approverMembershipId: membershipId, status: decision, comment });
  if (approval.status === "rejected") { proposal.status = "rejected"; proposal.rejection_reason = comment; await proposal.save(); return { proposal, asset: null }; }
  if (approval.status !== "approved") return { proposal, asset: null };
  proposal.status = "approved";
  await proposal.save();
  return { proposal, asset: null };
}

export async function completeInvestmentAcquisition(chamaId, proposalId, { collectionMethod, settlementReference, recordedBy }) {
  const proposal = await InvestmentProposal.findOne({ _id: proposalId, chama_id: chamaId });
  if (!proposal) throw new AppError("Approved investment proposal not found", 404);
  const settlementRef = String(settlementReference || "").trim();
  if (!settlementRef) throw new AppError("A settlement reference is required", 400);
  if (!["cash", "bank", "mpesa"].includes(collectionMethod)) throw new AppError("collectionMethod must be cash, bank, or mpesa", 400);
  if (proposal.status === "acquired") {
    if (proposal.acquisition_settlement?.reference !== settlementRef) throw new AppError("This acquisition was already recorded with a different settlement reference", 409);
    return { proposal, asset: await ChamaAsset.findById(proposal.resulting_asset_id) };
  }
  if (proposal.status !== "approved") throw new AppError("Investment proposal must be approved before acquisition", 400);
  return activateFromProposal(proposal, { collectionMethod, settlementReference: settlementRef, recordedBy });
}

export async function activateFromProposal(proposal, { collectionMethod = "bank", settlementReference, recordedBy } = {}) {
  if (!settlementReference) throw new AppError("Acquisition must be recorded after settlement", 400);
  let asset = proposal.resulting_asset_id ? await ChamaAsset.findById(proposal.resulting_asset_id) : null;
  if (!asset) {
    asset = await ChamaAsset.create({
      chama_id: proposal.chama_id, investment_proposal_id: proposal._id,
      asset_type: proposal.asset_type, name: proposal.title, description: proposal.description,
      expected_monthly_income: proposal.proposal.expected_monthly_income,
      acquisition: { method: "purchase", acquisition_date: new Date(), purchase_price: proposal.proposal.purchase_price, acquisition_costs: proposal.proposal.acquisition_costs, funding_source: proposal.proposal.funding_source },
      status: "draft", requested_by: proposal.proposed_by, approval_request_id: proposal.approval_request_id,
    });
    proposal.resulting_asset_id = asset._id;
    await proposal.save();
  }
  if (["business", "property"].includes(proposal.asset_type) && !asset.operations_ref?.business_id) {
    const business = await Business.create({
      name: asset.name,
      category: proposal.asset_type === "property" ? "rental" : "other",
      owner_type: "chama",
      owner_id: proposal.chama_id,
      chama_asset_id: asset._id,
      created_by: proposal.proposed_by,
    });
    asset.operations_ref = { business_id: business._id };
    await asset.save();
  }
  const purchaseAmount = Number(proposal.proposal.purchase_price || 0) + Number(proposal.proposal.acquisition_costs || 0);
  if (purchaseAmount <= 0) throw new AppError("A positive acquisition amount is required to record settlement", 400);
  let purchase = await AssetTransaction.findOne({ asset_id: asset._id, type: "purchase" });
  if (!purchase) {
    await recordAssetPosting(asset, {
      amount: purchaseAmount,
      collectionMethod,
      recordedBy,
      description: `Acquisition - ${asset.name}`,
      referenceType: "CHAMA_ASSET_PURCHASE_POSTING",
      reference: `ASSET-ACQ-${proposal._id}`,
      externalReference: settlementReference,
    });
    purchase = await AssetTransaction.findOne({ asset_id: asset._id, type: "purchase" });
  }
  asset.status = "active";
  asset.activated_at = new Date();
  await asset.save();
  await ensureAssetPaymentRefCode(asset);
  proposal.acquisition_settlement = {
    reference: settlementReference,
    payment_method: collectionMethod,
    financial_transaction_id: purchase?.financial_transaction_id || null,
    recorded_by: recordedBy,
    recorded_at: new Date(),
  };
  proposal.status = "acquired";
  await proposal.save();
  return asset;
}

async function recordAssetPosting(asset, { amount, collectionMethod = "cash", recordedBy, description, referenceType, reference, externalReference, sourceBusinessTransactionId, category }) {
  const transactionTypes = {
    CHAMA_ASSET_PURCHASE_POSTING: "chama_asset_acquisition",
    CHAMA_ASSET_EXPENSE_POSTING: "chama_asset_expense",
  };
  const result = await accountingService.post({
    referenceType,
    transactionType: transactionTypes[referenceType],
    source_type: sourceBusinessTransactionId ? "BusinessTransaction" : "ChamaAsset",
    source_id: sourceBusinessTransactionId || asset._id,
    owner_type: "Chama",
    owner_id: asset.chama_id,
    chama: asset.chama_id,
    assetId: asset._id,
    assetName: asset.name,
    sourceBusinessTransactionId,
    amount,
    collectionMethod,
    recordedBy,
    created_by: recordedBy,
    description,
    reference,
    externalReference,
    category,
  });
  return result;
}

const EXPENSE_CATEGORIES = ["repairs_maintenance", "land_rates_taxes", "insurance", "utilities", "inputs_seeds", "licenses_permits", "management_fee", "other"];

export async function recordExpense(chamaId, assetId, { amount, collectionMethod, description, recordedBy, sourceBusinessTransactionId, category }) {
  const asset = await ChamaAsset.findOne({ _id: assetId, chama_id: chamaId, status: "active" });
  if (!asset) throw new AppError("Active chama asset not found", 404);
  if (sourceBusinessTransactionId) {
    const prior = await AssetTransaction.findOne({ asset_id: assetId, source_business_transaction_id: sourceBusinessTransactionId, type: "expense" });
    if (prior) return { success: true, duplicate: true, transactionId: prior.financial_transaction_id, journalId: prior.journal_id };
  }
  const normalizedCategory = EXPENSE_CATEGORIES.includes(category) ? category : "other";
  return recordAssetPosting(asset, { amount, collectionMethod, description: description || `Expense — ${asset.name}`, recordedBy, sourceBusinessTransactionId, referenceType: "CHAMA_ASSET_EXPENSE_POSTING", category: normalizedCategory });
}

// Per-category breakdown for an asset — "KES 40,000 in expenses" becomes
// repairs vs land rates vs inputs instead of one opaque total.
export async function getAssetExpenseBreakdown(chamaId, assetId) {
  const asset = await ChamaAsset.findOne({ _id: assetId, chama_id: chamaId });
  if (!asset) throw new AppError("Chama asset not found", 404);
  const rows = await AssetTransaction.aggregate([
    { $match: { chama_id: new mongoose.Types.ObjectId(chamaId), asset_id: asset._id, type: "expense" } },
    { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);
  return rows.map((r) => ({ category: r._id || "other", total: r.total, count: r.count }));
}


// ============================================================
// VALUATION — a point-in-time opinion of what the asset is worth right
// now (bank appraisal, comparable sales, a member's estimate). NOT a
// cash event, so — unlike income/expense/purchase — this posts nothing
// to the accounting ledger; it is purely a logged AssetTransaction plus
// a refreshed `current_valuation` cache, giving the members' timeline
// an appreciation trail alongside the cash-flow one.
// ============================================================
export async function recordAssetValuation(chamaId, assetId, { amount, note, recordedBy, asOf }) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new AppError("A positive valuation amount is required", 400);
  const asset = await ChamaAsset.findOne({ _id: assetId, chama_id: chamaId, status: "active" });
  if (!asset) throw new AppError("Active chama asset not found", 404);

  const occurredAt = asOf ? new Date(asOf) : new Date();
  if (!Number.isFinite(occurredAt.getTime())) throw new AppError("Invalid valuation date", 400);

  const entry = await AssetTransaction.create({
    chama_id: chamaId,
    asset_id: asset._id,
    type: "valuation",
    amount: value,
    description: note || `Valuation update — ${asset.name}`,
    valuation_note: note || "",
    performed_by: recordedBy || null,
    occurred_at: occurredAt,
  });

  // Only refresh the denormalized "current" figure if this is the most
  // recent valuation on record — a backfilled older appraisal shouldn't
  // clobber a newer one just because it was entered later.
  if (!asset.current_valuation?.as_of || occurredAt >= new Date(asset.current_valuation.as_of)) {
    asset.current_valuation = { amount: value, as_of: occurredAt, note: note || "", recorded_by: recordedBy || null };
    await asset.save();
  }

  emitToChama(chamaId, "chama_asset:valuation_recorded", { assetId: asset._id, amount: value, asOf: occurredAt });
  return entry;
}

// ============================================================
// PROGRESS DASHBOARD — the one-screen answer to "how is this asset
// doing", built for EVERY member (co-owners, not customers) to see by
// default, not just leadership. Distinct from the money-movement forms
// in this module, which stay leadership-gated: this endpoint only
// reads, and reading what the chama owns is not a control surface.
//
//   - income vs. target for the current calendar period
//   - occupancy/lease status (ground-truth `operational_status` plus a
//     roll-up of every active lease's outstanding balance)
//   - a running ROI since acquisition (income to date ÷ original cost)
//   - a chronological timeline: acquisition, then every valuation
//     update on record — appreciation, not just cash flow.
// ============================================================
export async function getAssetProgress(chamaId, assetId) {
  const asset = await ChamaAsset.findOne({ _id: assetId, chama_id: chamaId })
    .populate("management.manager_id", "name")
    .lean();
  if (!asset) throw new AppError("Chama asset not found", 404);

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [periodIncomeRows, purchaseRows, valuationRows, leases] = await Promise.all([
    AssetTransaction.aggregate([
      { $match: { chama_id: new mongoose.Types.ObjectId(chamaId), asset_id: asset._id, type: "income", reconciliation_status: { $ne: "unverified" }, occurred_at: { $gte: periodStart } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    AssetTransaction.find({ chama_id: chamaId, asset_id: asset._id, type: "purchase" }).sort({ occurred_at: 1 }).lean(),
    AssetTransaction.find({ chama_id: chamaId, asset_id: asset._id, type: "valuation" }).sort({ occurred_at: 1 }).lean(),
    AssetLease.find({ chama_id: chamaId, asset_id: asset._id })
      .populate("lessee.member_id", "name")
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  // ---- Income vs. target this period ----
  const periodIncome = periodIncomeRows[0]?.total || 0;
  const periodTarget = asset.income_pattern === "constant" || asset.income_pattern === "irregular"
    ? Number(asset.expected_monthly_income || 0)
    : Number(asset.expected_monthly_income || 0); // seasonal/none assets still get a rough monthly-equivalent line if one was set
  const periodProgressPct = periodTarget > 0 ? Math.round((periodIncome / periodTarget) * 1000) / 10 : null;

  // ---- Occupancy / lease status ----
  const activeLeases = leases.filter((lease) => lease.status === "active");
  const leaseSummaries = activeLeases.map((lease) => {
    const outstanding = (lease.periods || []).reduce((sum, period) => {
      if (["fulfilled", "waived"].includes(period.status)) return sum;
      const shortfall = Math.max(0, Number(period.expected_cash_amount || 0) - Number(period.received_cash_amount || 0));
      return sum + shortfall;
    }, 0);
    const overduePeriods = (lease.periods || []).filter((period) => period.status === "overdue").length;
    return {
      leaseId: lease._id,
      lesseeType: lease.lessee?.lessee_type,
      lesseeName: lease.lessee?.lessee_type === "member" ? lease.lessee?.member_id?.name || "Member" : lease.lessee?.external_name || "External party",
      arrangementType: lease.arrangement_type,
      outstandingCash: outstanding,
      overduePeriods,
    };
  });
  const totalOutstandingBalance = leaseSummaries.reduce((sum, l) => sum + l.outstandingCash, 0);

  // ---- ROI since acquisition ----
  const purchasePaid = purchaseRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const costBasis = purchasePaid > 0
    ? purchasePaid
    : Number(asset.acquisition?.purchase_price || 0) + Number(asset.acquisition?.acquisition_costs || 0);
  const totalIncomeToDate = Number(asset.book_value?.total_income || 0);
  const roiPct = costBasis > 0 ? Math.round((totalIncomeToDate / costBasis) * 1000) / 10 : null;

  // ---- Timeline: acquisition, then every valuation on record ----
  const timeline = [];
  const acquisitionDate = asset.acquisition?.acquisition_date || asset.activated_at || asset.createdAt;
  if (acquisitionDate) {
    timeline.push({
      type: "acquisition",
      date: acquisitionDate,
      amount: costBasis || null,
      label: `Acquired${asset.acquisition?.method && asset.acquisition.method !== "other" ? ` (${String(asset.acquisition.method).replaceAll("_", " ")})` : ""}`,
    });
  }
  for (const row of valuationRows) {
    timeline.push({ type: "valuation", date: row.occurred_at, amount: row.amount, label: row.valuation_note || row.description || "Valuation update" });
  }
  timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
  const firstValue = costBasis || null;
  const latestValue = asset.current_valuation?.amount ?? (valuationRows.length ? valuationRows[valuationRows.length - 1].amount : firstValue);
  const appreciationPct = firstValue > 0 && latestValue != null ? Math.round(((latestValue - firstValue) / firstValue) * 1000) / 10 : null;

  return {
    asset: {
      _id: asset._id,
      name: asset.name,
      asset_type: asset.asset_type,
      status: asset.status,
      operational_status: asset.operational_status,
      income_pattern: asset.income_pattern,
      management: asset.management,
    },
    incomeVsTarget: {
      periodLabel: now.toLocaleString("en-KE", { month: "long", year: "numeric" }),
      target: periodTarget,
      actual: periodIncome,
      progressPct: periodProgressPct,
    },
    occupancy: {
      operationalStatus: asset.operational_status,
      activeLeaseCount: activeLeases.length,
      leases: leaseSummaries,
      outstandingBalance: totalOutstandingBalance,
    },
    roi: {
      costBasis,
      totalIncomeToDate,
      roiPct,
    },
    valuation: {
      current: asset.current_valuation?.amount ?? null,
      asOf: asset.current_valuation?.as_of ?? null,
      appreciationPct,
    },
    timeline,
  };
}

// ============================================================
// MEMBER-RAISED DISCREPANCY FLAG — any active member can flag an
// income or expense entry they think is wrong. Routed through the SAME
// multi-signatory ApprovalRequest engine as registering an asset or
// deciding an investment proposal (resource_type 'ASSET_DISCREPANCY'),
// not a lighter-weight side channel — a caretaker's honesty is exactly
// the kind of thing that deserves the separation-of-duties guarantee
// that engine already gives everything else (the flagger can never
// also be the one who clears their own flag; leadership signs off the
// same way they would on a risky Leadership Desk action).
// ============================================================
export async function flagAssetTransactionDiscrepancy(chamaId, assetId, transactionId, { raisedByMembershipId, reason }) {
  if (!String(reason || "").trim()) throw new AppError("Explain what looks wrong with this entry", 400);
  const asset = await ChamaAsset.findOne({ _id: assetId, chama_id: chamaId });
  if (!asset) throw new AppError("Chama asset not found", 404);
  const entry = await AssetTransaction.findOne({ _id: transactionId, chama_id: chamaId, asset_id: assetId });
  if (!entry) throw new AppError("Asset transaction not found", 404);
  if (!["income", "expense"].includes(entry.type)) throw new AppError("Only income and expense entries can be flagged", 400);
  if (entry.flag_status === "flagged") throw new AppError("This entry already has an open discrepancy under review", 409);
  if (entry.flag_status === "confirmed") throw new AppError("Leadership already confirmed a discrepancy on this entry", 409);

  const approval = await approvalService.createRequest({
    chamaId,
    resourceType: "ASSET_DISCREPANCY",
    resourceId: entry._id,
    action: "REVIEW_DISCREPANCY",
    title: `Discrepancy flagged — ${asset.name} (${entry.type} of KES ${Number(entry.amount).toLocaleString("en-KE")})`,
    description: reason.trim(),
    amount: entry.amount,
    initiatedByMembershipId: raisedByMembershipId,
    requiredApprovals: await investmentApprovalCount(chamaId),
    eligibleRoles: ["chairperson", "secretary", "treasurer"],
    allowInitiatorApproval: false,
    permissionKey: "finance.review",
    metadata: { resource_kind: "ASSET_TRANSACTION_DISCREPANCY", asset_id: String(asset._id), transaction_id: String(entry._id) },
  });

  entry.flag_status = "flagged";
  entry.flag_request_id = approval._id;
  await entry.save();

  // The flag itself is already saved — a notification hiccup must not turn it into a 500.
  try {
    const leaders = await ChamaMembership.find({ chama_id: chamaId, status: "active", role: { $in: ["chairperson", "treasurer", "secretary"] }, _id: { $ne: raisedByMembershipId } }).select("_id");
    if (leaders.length) {
      await notificationService.sendBulkNotification({
        chamaId,
        recipientMembershipIds: leaders.map((l) => l._id),
        notificationType: "ASSET_TRANSACTION_DISCREPANCY_FLAGGED",
        title: `A member flagged a possible discrepancy — ${asset.name}`,
        message: reason.trim(),
        metadata: { assetId: String(asset._id), transactionId: String(entry._id), approvalRequestId: String(approval._id) },
        relatedEntityType: "ASSET_DISCREPANCY",
        relatedEntityId: approval._id,
        priority: "high",
        requiresAction: true,
        sentBy: null,
      });
    }
  } catch (error) {
    console.error("[chamaAsset.service] discrepancy notification failed:", error.message);
  }

  emitToChama(chamaId, "chama_asset:discrepancy_flagged", { assetId: asset._id, transactionId: entry._id });
  return entry;
}

// approved = leadership confirms something was actually wrong;
// rejected = reviewed and dismissed, nothing wrong found. Mirrors the
// approve/reject vocabulary decideInvestmentProposal already uses.
export async function decideAssetTransactionDiscrepancy(chamaId, transactionId, membershipId, decision, comment = "") {
  if (!["approved", "rejected"].includes(decision)) throw new AppError("decision must be approved or rejected", 400);
  const entry = await AssetTransaction.findOne({ _id: transactionId, chama_id: chamaId, flag_status: "flagged" });
  if (!entry) throw new AppError("No open discrepancy flag found on this entry", 404);
  if (!entry.flag_request_id) throw new AppError("This flag is missing its approval request", 409);

  // Separation of duties on the OTHER side too: whoever recorded the
  // entry being questioned can't be the one who rules on it. (The
  // approval engine already stops the flagger from clearing their own flag.)
  const reviewer = await ChamaMembership.findById(membershipId).select("user_id");
  if (reviewer && entry.performed_by && String(reviewer.user_id) === String(entry.performed_by)) {
    throw new AppError("You recorded this entry, so another leader needs to review the flag against it", 403);
  }

  let approval;
  try {
    approval = await approvalService.submitSignoff({ requestId: entry.flag_request_id, approverMembershipId: membershipId, status: decision, comment });
  } catch (error) {
    // approvalService throws plain Errors for rule violations (not eligible,
    // self-approval, already resolved) — surface them as a client error, not a 500.
    throw error instanceof AppError ? error : new AppError(error.message, 403);
  }

  if (approval.status === "approved") entry.flag_status = "confirmed";
  else if (approval.status === "rejected") entry.flag_status = "dismissed";
  // else: still short of the required signoffs — stays 'flagged'.
  await entry.save();

  emitToChama(chamaId, "chama_asset:discrepancy_updated", { assetId: entry.asset_id, transactionId: entry._id, flagStatus: entry.flag_status });
  return entry;
}

// Any member sees flags they personally raised; leadership (chairperson/
// treasurer/secretary/auditor) sees every open-or-resolved flag in the
// chama — same visibility split as the Dispute module.
export async function listAssetTransactionDiscrepancies(chamaId, { viewerMembershipId, viewerCanSeeAll, assetId } = {}) {
  // $in rather than $ne: entries recorded before flag_status existed have no
  // value at all, and $ne would treat every one of them as "flagged".
  const query = { chama_id: chamaId, flag_status: { $in: ["flagged", "confirmed", "dismissed"] } };
  if (assetId) query.asset_id = assetId;
  const entries = await AssetTransaction.find(query)
    .populate("asset_id", "name")
    .populate({ path: "flag_request_id", populate: [{ path: "initiated_by", populate: { path: "user_id", select: "name" } }, { path: "approvals.approver_id", populate: { path: "user_id", select: "name" } }] })
    .sort({ occurred_at: -1 });
  if (viewerCanSeeAll) return entries;
  return entries.filter((entry) => String(entry.flag_request_id?.initiated_by?._id || entry.flag_request_id?.initiated_by) === String(viewerMembershipId));
}

export async function fundChamaBusiness(chamaId, assetId, { amount, collectionMethod = "bank", externalReference = "", recordedBy }) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new AppError("Funding amount must be greater than zero", 400);
  if (!["cash", "bank", "mpesa"].includes(collectionMethod)) throw new AppError("Choose cash, bank, or M-Pesa as the source account", 400);

  const asset = await ChamaAsset.findOne({ _id: assetId, chama_id: chamaId, status: "active" });
  if (!asset?.operations_ref?.business_id) throw new AppError("An active Chama-owned business workspace is required", 400);
  const business = await Business.findOne({ _id: asset.operations_ref.business_id, owner_type: "chama", owner_id: chamaId, chama_asset_id: asset._id });
  if (!business) throw new AppError("The business workspace is not linked to this Chama asset", 409);

  const reference = String(externalReference || "").trim();
  if (reference) {
    const existing = await ChamaBusinessFunding.findOne({ chama_id: chamaId, asset_id: asset._id, external_reference: reference, status: "posted" });
    if (existing) return existing;
  }

  const cashCode = { cash: "CASH", bank: "BANK", mpesa: "MPESA_CLEARING" }[collectionMethod];
  let cash = await FinancialAccount.findOne({ owner_type: "Chama", owner_id: chamaId, account_code: cashCode });
  if (!cash) {
    await FinancialAccount.bootstrapSystemAccounts({ owner_type: "Chama", owner_id: chamaId, created_by: recordedBy });
    cash = await FinancialAccount.findOne({ owner_type: "Chama", owner_id: chamaId, account_code: cashCode });
  }
  if (!cash || Number(cash.current_balance?.toString?.() || 0) < value) throw new AppError(`Insufficient ${collectionMethod} balance in the Chama treasury`, 400);

  const session = mongoose.connection?.client?.topology?.description?.type && ["ReplicaSetWithPrimary", "Sharded"].includes(mongoose.connection.client.topology.description.type)
    ? await mongoose.startSession()
    : null;
  const useTransaction = Boolean(session);
  let funding;
  try {
    if (useTransaction) session.startTransaction();
    [funding] = await ChamaBusinessFunding.create([{
      chama_id: chamaId,
      asset_id: asset._id,
      business_id: business._id,
      amount: mongoose.Types.Decimal128.fromString(value.toFixed(2)),
      source_account: collectionMethod,
      external_reference: reference,
      created_by: recordedBy,
    }], useTransaction ? { session } : {});

    const source = { source_type: "ChamaBusinessFunding", source_id: funding._id, amount: value, currency: business.currency || "KES", recordedBy, created_by: recordedBy, description: `Working capital allocated to ${business.name}${reference ? ` (${reference})` : ""}` };
    const chamaPosting = await accountingService.post({
      ...source,
      referenceType: "CHAMA_BUSINESS_FUNDING_POSTING",
      transactionType: "chama_business_funding",
      owner_type: "Chama",
      owner_id: chamaId,
      assetId: asset._id,
      assetName: asset.name,
      collectionMethod,
    }, session);
    const businessPosting = await accountingService.post({
      ...source,
      referenceType: "BUSINESS_CAPITAL_FUNDING_POSTING",
      transactionType: "business_capital_funding",
      owner_type: "Business",
      owner_id: business._id,
    }, session);

    funding.chama_transaction_id = chamaPosting.transactionId;
    funding.business_transaction_id = businessPosting.transactionId;
    funding.status = "posted";
    await funding.save(useTransaction ? { session } : {});
    if (useTransaction) await session.commitTransaction();

    emitToChama(chamaId, "finance:business_funded", { assetId: asset._id, businessId: business._id, amount: value, fundedAt: funding.updatedAt });
    return funding;
  } catch (error) {
    if (useTransaction && session.inTransaction()) await session.abortTransaction();
    if (funding && !useTransaction) {
      funding.status = "failed";
      funding.failure_reason = error.message;
      await funding.save().catch(() => null);
    }
    throw error;
  } finally {
    if (session) await session.endSession();
  }
}

const toMoney = (value) => Number(value?.toString?.() ?? value ?? 0);
const normalizeKenyanPhone = (value) => {
  let phone = String(value || "").trim().replace(/[\s\-()]/g, "");
  if (phone.startsWith("+254")) phone = phone.slice(1);
  if (phone.startsWith("07") || phone.startsWith("01")) phone = `254${phone.slice(1)}`;
  return phone;
};

async function postProfitLedger({ chamaId, assetId, amount, sourceType, sourceId, referenceType, createdBy, description }) {
  const transactionType = referenceType === "CHAMA_PROFIT_WALLET_CREDIT_POSTING"
    ? "chama_profit_wallet_credit"
    : referenceType === "CHAMA_PROFIT_WALLET_WITHDRAWAL_POSTING"
      ? "chama_profit_wallet_withdrawal"
      : "chama_profit_distribution";
  const existing = await FinancialTransaction.findOne({ owner_type: "Chama", owner_id: chamaId, source_type: sourceType, source_id: sourceId, transaction_type: transactionType });
  if (existing) return existing;
  const result = await accountingService.post({
    referenceType, transactionType, source_type: sourceType, source_id: sourceId,
    owner_type: "Chama", owner_id: chamaId, chama: chamaId, assetId,
    amount, currency: "KES", created_by: createdBy || null, recordedBy: createdBy || null,
    description,
  });
  await AssetTransaction.create({
    chama_id: chamaId, asset_id: assetId, type: "distribution", amount,
    description, financial_transaction_id: result.transactionId, journal_id: result.journalId,
    ledger_entry_ids: (result.ledgerEntries || []).map((entry) => entry._id), performed_by: createdBy || null,
  });
  return result;
}

export async function listProfitDistributions(chamaId, membershipId) {
  return ChamaAssetDistribution.find({ chama_id: chamaId, "recipients.member_id": membershipId })
    .populate("asset_id", "name")
    .populate({ path: "recipients.member_id", select: "user_id", populate: { path: "user_id", select: "name" } })
    .sort({ createdAt: -1 });
}

export async function createProfitDistribution(chamaId, { assetId, recipients, scheduledAt, createdBy }) {
  const asset = await ChamaAsset.findOne({ _id: assetId, chama_id: chamaId, status: "active" });
  if (!asset) throw new AppError("Active Chama asset not found", 404);
  if (!Array.isArray(recipients) || !recipients.length) throw new AppError("Add at least one member allocation", 400);
  const activeMembers = await ChamaMembership.find({ chama_id: chamaId, status: "active" }).select("_id user_id").populate("user_id", "phone phone_number");
  const ids = new Set(activeMembers.map((m) => String(m._id)));
  const supplied = new Set();
  let total = 0;
  const normalized = recipients.map((row) => {
    const memberId = String(row.member_id || "");
    const member = activeMembers.find((m) => String(m._id) === memberId);
    const amount = Number(row.amount);
    if (!ids.has(memberId) || supplied.has(memberId)) throw new AppError("Each active Chama member must appear exactly once", 400);
    if (!Number.isFinite(amount) || amount <= 0) throw new AppError("Every member allocation must be greater than zero", 400);
    if (!["wallet", "mpesa"].includes(row.method)) throw new AppError("Choose wallet or M-Pesa for every member", 400);
    if (row.method === "mpesa" && !Number.isInteger(amount)) throw new AppError("M-Pesa allocations must be whole KES amounts", 400);
    supplied.add(memberId);
    total += amount;
    return {
      member_id: member._id,
      amount: mongoose.Types.Decimal128.fromString(amount.toFixed(2)),
      method: row.method,
      phone_number: row.method === "mpesa" ? normalizeKenyanPhone(row.phone_number || member.user_id?.phone_number || member.user_id?.phone) : null,
    };
  });
  if (supplied.size !== activeMembers.length) throw new AppError("Allocations must include every active Chama member", 400);
  if (normalized.some((r) => r.method === "mpesa" && !/^254[17]\d{8}$/.test(r.phone_number))) throw new AppError("Enter a valid Kenyan M-Pesa number", 400);

  const ledger = await AssetTransaction.aggregate([
    { $match: { chama_id: new mongoose.Types.ObjectId(chamaId), asset_id: asset._id, type: { $in: ["income", "expense", "purchase", "funding"] } } },
    { $group: { _id: "$type", total: { $sum: "$amount" } } },
  ]);
  const totals = Object.fromEntries(ledger.map((r) => [r._id, Number(r.total || 0)]));
  const committed = await ChamaAssetDistribution.find({ asset_id: asset._id, status: { $in: ["awaiting_acceptance", "scheduled", "processing", "completed", "failed"] } }).select("total_amount status recipients");
  const reserved = committed.reduce((sum, d) => {
    if (d.status !== "failed") return sum + toMoney(d.total_amount);
    return sum + d.recipients.reduce((recipientTotal, recipient) => recipientTotal + (["paid", "processing"].includes(recipient.payout_status) ? toMoney(recipient.amount) : 0), 0);
  }, 0);
  const available = Math.max(0, totals.income - totals.expense - totals.purchase - totals.funding - reserved);
  if (total > available + 0.001) throw new AppError(`Distribution exceeds available recorded profit (KES ${available.toFixed(2)})`, 400);
  const when = new Date(scheduledAt);
  if (!Number.isFinite(when.getTime()) || when <= new Date()) throw new AppError("Choose a future payout date", 400);
  const distribution = await ChamaAssetDistribution.create({ chama_id: chamaId, asset_id: asset._id, recipients: normalized, total_amount: mongoose.Types.Decimal128.fromString(total.toFixed(2)), scheduled_at: when, created_by: createdBy });
  await notificationService.sendBulkNotification({
    chamaId,
    recipientMembershipIds: activeMembers.map((member) => member._id),
    notificationType: "BUSINESS_PROFIT_DISTRIBUTION_ACCEPTANCE",
    title: "Business profit distribution needs your response",
    message: `The treasurer proposed a KES ${total.toLocaleString("en-KE", { minimumFractionDigits: 2 })} profit distribution from ${asset.name}. Every active member must accept before payment can be scheduled.`,
    metadata: { distributionId: String(distribution._id), assetId: String(asset._id), amount: total },
    relatedEntityType: "CHAMA_ASSET_DISTRIBUTION",
    relatedEntityId: distribution._id,
    priority: "high",
    requiresAction: true,
    sentBy: createdBy,
  });
  return distribution;
}

export async function respondToProfitDistribution(chamaId, distributionId, membershipId, response) {
  if (!["accepted", "rejected"].includes(response)) throw new AppError("Response must be accepted or rejected", 400);
  const distribution = await ChamaAssetDistribution.findOne({ _id: distributionId, chama_id: chamaId });
  if (!distribution) throw new AppError("Profit distribution not found", 404);
  if (distribution.status !== "awaiting_acceptance") throw new AppError("This distribution is no longer accepting responses", 409);
  const recipient = distribution.recipients.find((r) => String(r.member_id) === String(membershipId));
  if (!recipient) throw new AppError("You are not included in this distribution", 403);
  if (recipient.response !== "pending") throw new AppError("Your response has already been recorded", 409);
  recipient.response = response;
  recipient.responded_at = new Date();
  if (response === "rejected") distribution.status = "rejected";
  else if (distribution.recipients.every((r) => r.response === "accepted")) distribution.status = "scheduled";
  await distribution.save();
  return distribution;
}

export async function sweepDueProfitDistributions() {
  const due = await ChamaAssetDistribution.find({ status: "scheduled", scheduled_at: { $lte: new Date() } }).limit(25);
  for (const distribution of due) {
    const chama = await Chama.findById(distribution.chama_id).select("chama_type workspace_config").lean();
    if (!chama || !isModuleEnabled(chama, "assets")) {
      await ChamaAssetDistribution.updateOne({ _id: distribution._id }, { $set: { status: "scheduled" } });
      continue;
    }

    const claimed = await ChamaAssetDistribution.updateOne({ _id: distribution._id, status: "scheduled" }, { $set: { status: "processing" } });
    if (!claimed.modifiedCount) continue;
    const asset = await ChamaAsset.findById(distribution.asset_id).select("name");
    let failed = false;
    for (const recipient of distribution.recipients) {
      if (recipient.payout_status === "paid") continue;
      try {
        if (recipient.method === "wallet") {
          let entry = await ChamaProfitWalletEntry.findOne({ distribution_id: distribution._id, member_id: recipient.member_id, type: "credit" });
          if (!entry) entry = await ChamaProfitWalletEntry.create({ chama_id: distribution.chama_id, member_id: recipient.member_id, distribution_id: distribution._id, amount: recipient.amount, type: "credit", status: "pending", description: "Approved business profit distribution" });
          await postProfitLedger({ chamaId: distribution.chama_id, assetId: distribution.asset_id, amount: toMoney(recipient.amount), sourceType: "ChamaProfitWalletEntry", sourceId: entry._id, referenceType: "CHAMA_PROFIT_WALLET_CREDIT_POSTING", createdBy: distribution.created_by, description: `Profit wallet credit from ${asset.name}` });
          entry.status = "completed";
          await entry.save();
          recipient.payout_status = "paid";
        } else {
          if (recipient.mpesa_conversation_id) continue;
          const response = await mpesaService.initiateB2cPayment({ amount: toMoney(recipient.amount), phoneNumber: recipient.phone_number, remarks: "Chama business profit share", occasion: String(distribution._id), commandId: "BusinessPayment" });
          recipient.mpesa_conversation_id = response.conversationId;
          recipient.payout_status = "processing";
        }
      } catch (error) {
        failed = true;
        recipient.payout_status = "failed";
      }
    }
    distribution.status = distribution.recipients.every((r) => r.payout_status === "paid") ? "completed" : failed ? "failed" : "processing";
    await distribution.save();
  }
}

export async function reconcileProfitDistributionB2c(result) {
  const conversationId = result?.Result?.ConversationID;
  if (!conversationId) return false;
  const distribution = await ChamaAssetDistribution.findOne({ "recipients.mpesa_conversation_id": conversationId });
  if (distribution) {
    const recipient = distribution.recipients.find((r) => r.mpesa_conversation_id === conversationId);
    if (Number(result?.Result?.ResultCode) === 0) {
      await postProfitLedger({ chamaId: distribution.chama_id, assetId: distribution.asset_id, amount: toMoney(recipient.amount), sourceType: "ChamaAssetDistributionRecipient", sourceId: recipient._id, referenceType: "CHAMA_PROFIT_DISTRIBUTION_POSTING", createdBy: distribution.created_by, description: `Business profit paid by M-Pesa from ${distribution.asset_id}` });
      recipient.payout_status = "paid";
    }
    else recipient.payout_status = "failed";
    await distribution.save();
    if (distribution.recipients.every((r) => r.payout_status === "paid")) {
      distribution.status = "completed";
      await distribution.save();
    } else if (distribution.recipients.some((r) => r.payout_status === "failed")) {
      distribution.status = "failed";
      await distribution.save();
    }
  }
  const walletEntry = await ChamaProfitWalletEntry.findOne({ mpesa_conversation_id: conversationId, type: "withdrawal" });
  if (walletEntry) {
    const succeeded = Number(result?.Result?.ResultCode) === 0;
    if (succeeded) {
      const distribution = await ChamaAssetDistribution.findById(walletEntry.distribution_id).select("asset_id created_by");
      await postProfitLedger({ chamaId: walletEntry.chama_id, assetId: distribution.asset_id, amount: toMoney(walletEntry.amount), sourceType: "ChamaProfitWalletEntry", sourceId: walletEntry._id, referenceType: "CHAMA_PROFIT_WALLET_WITHDRAWAL_POSTING", description: "Member M-Pesa profit wallet withdrawal" });
    }
    walletEntry.status = succeeded ? "completed" : "failed";
    walletEntry.mpesa_receipt = result?.Result?.ResultParameters?.ResultParameter?.find((p) => p.Key === "TransactionReceipt")?.Value || null;
    await walletEntry.save();
    return true;
  }
  return Boolean(distribution);
}

export async function getChamaProfitWallet(chamaId, membershipId) {
  const entries = await ChamaProfitWalletEntry.find({ chama_id: chamaId, member_id: membershipId }).sort({ createdAt: -1 });
  const balance = entries.reduce((sum, entry) => {
    if (entry.status === "failed") return sum;
    const amount = toMoney(entry.amount);
    return sum + (entry.type === "credit" ? amount : -amount);
  }, 0);
  return { balance: Math.max(0, Number(balance.toFixed(2))), currency: "KES", entries };
}

export async function withdrawFromChamaProfitWallet(chamaId, membershipId, phoneNumber, amount) {
  const value = Number(amount);
  if (!Number.isInteger(value) || value <= 0) throw new AppError("Withdrawal must be a positive whole KES amount", 400);
  phoneNumber = normalizeKenyanPhone(phoneNumber);
  if (!/^254[17]\d{8}$/.test(phoneNumber)) throw new AppError("Enter a valid Kenyan M-Pesa number", 400);
  const wallet = await getChamaProfitWallet(chamaId, membershipId);
  if (value > wallet.balance) throw new AppError("Withdrawal exceeds your available profit wallet balance", 400);
  const distributionEntry = wallet.entries.find((entry) => entry.type === "credit");
  if (!distributionEntry) throw new AppError("No withdrawable profit balance is available", 400);
  const entry = await ChamaProfitWalletEntry.create({ chama_id: chamaId, member_id: membershipId, distribution_id: distributionEntry.distribution_id, amount: mongoose.Types.Decimal128.fromString(value.toFixed(2)), type: "withdrawal", status: "pending", description: "Member self-service M-Pesa withdrawal" });
  try {
    const response = await mpesaService.initiateB2cPayment({ amount: value, phoneNumber, remarks: "Chama profit wallet withdrawal", occasion: String(entry._id), commandId: "BusinessPayment" });
    entry.mpesa_conversation_id = response.conversationId;
    await entry.save();
    return entry;
  } catch (error) {
    entry.status = "failed";
    await entry.save();
    throw error;
  }
}