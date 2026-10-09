/**
 * ============================================================================
 * LEDGER ADJUSTMENT SERVICE
 * ============================================================================
 *
 * The "adjustment-approval workflow": a treasurer proposes a manual DR/CR
 * correction against two of the workspace's own FinancialAccounts, an
 * independent officer (chairperson/treasurer - never the same person who
 * proposed it) signs off through the existing generic ApprovalRequest
 * engine, and only once approved does this post through the double-entry
 * accounting engine. Nothing here ever mutates a balance directly.
 *
 * Mirrors the pattern in modules/withdrawal/Withdrawal.service.js:
 *  requestX() creates the record + attaches an ApprovalRequest
 *  decideX()  wraps approvalService.submitSignoff and reacts to the result
 * ============================================================================
 */

import LedgerAdjustment from "../../models/LedgerAdjustment.js";
import FinancialAccount from "../../models/FinancialAccount.js";
import ChamaMembership from "../../models/ChamaMembership.js";
import AppError from "../../utils/AppError.js";
import approvalService from "../approval/approval.service.js";
import accountingService from "./accounting/accounting.service.js";
import { createAuditLog, AUDIT_SCOPE_TYPES } from "../../services/audit.service.js";
import { AUDIT_ACTIONS } from "../../constants/audit.constants.js";

const money = (v) => Number(v?.toString ? v.toString() : v);

async function assertAccountBelongsToOwner(accountId, ownerType, ownerId, label) {
  const account = await FinancialAccount.findOne({ _id: accountId, owner_type: ownerType, owner_id: ownerId });
  if (!account) {
    throw new AppError(`${label} account not found for this workspace`, 404);
  }
  return account;
}

/**
 * Create a pending LedgerAdjustment and attach its ApprovalRequest.
 * Only Chama workspaces are supported - ApprovalRequest/ChamaMembership
 * (the approvers) only exist in that context.
 */
export async function requestAdjustment({
  ownerType,
  ownerId,
  userId,
  membershipId,
  debitAccountId,
  creditAccountId,
  amount,
  currency = "KES",
  reason,
  reference = "",
  source = "manual",
  sourceReconciliationId = null,
  sourceReconciliationLineId = null,
  requiredApprovals = 1
}) {
  if (ownerType !== "Chama") {
    throw new AppError("Ledger adjustments are only supported for Chama workspaces", 400);
  }
  if (!debitAccountId || !creditAccountId) {
    throw new AppError("A debit account and a credit account are required", 400);
  }
  if (String(debitAccountId) === String(creditAccountId)) {
    throw new AppError("The debit and credit accounts must be different", 400);
  }
  const value = Number(amount);
  if (!value || value <= 0) {
    throw new AppError("Adjustment amount must be a positive number", 400);
  }
  if (!reason || !reason.trim()) {
    throw new AppError("A reason is required for every ledger adjustment", 400);
  }

  const [debitAccount, creditAccount] = await Promise.all([
    assertAccountBelongsToOwner(debitAccountId, ownerType, ownerId, "Debit"),
    assertAccountBelongsToOwner(creditAccountId, ownerType, ownerId, "Credit")
  ]);

  const adjustment = await LedgerAdjustment.create({
    owner_type: ownerType,
    owner_id: ownerId,
    debit_account_id: debitAccount._id,
    credit_account_id: creditAccount._id,
    amount: value.toFixed(2),
    currency,
    reason: reason.trim(),
    reference: reference?.trim() || "",
    status: "pending",
    source,
    source_reconciliation_id: sourceReconciliationId,
    source_reconciliation_line_id: sourceReconciliationLineId,
    initiated_by: membershipId,
    created_by: userId
  });

  let approvalRequest;
  try {
    approvalRequest = await approvalService.createRequest({
      chamaId: ownerId,
      resourceType: "LEDGER_ADJUSTMENT",
      resourceId: adjustment._id,
      action: "POST_ADJUSTMENT",
      title: "Ledger adjustment",
      description: `DR ${debitAccount.name} / CR ${creditAccount.name}: KES ${value.toFixed(2)}. ${reason.trim()}`,
      amount: value.toFixed(2),
      initiatedByMembershipId: membershipId,
      requiredApprovals,
      eligibleRoles: ["chairperson", "treasurer"],
      // A treasurer must never be able to wave through their own correction.
      allowInitiatorApproval: false,
      permissionKey: "finance.reconcile",
      metadata: {
        debit_account_id: String(debitAccount._id),
        credit_account_id: String(creditAccount._id),
        amount: value
      }
    });
  } catch (error) {
    await LedgerAdjustment.deleteOne({ _id: adjustment._id }).catch(() => null);
    throw error;
  }

  adjustment.approval_request_id = approvalRequest._id;
  await adjustment.save();

  await createAuditLog({
    actorUserId: userId,
    scopeType: AUDIT_SCOPE_TYPES.CHAMA,
    chamaId: ownerId,
    action: AUDIT_ACTIONS.ADJUSTMENT_REQUESTED,
    resourceType: "LedgerAdjustment",
    resourceId: adjustment._id,
    after: { amount: value, reason: adjustment.reason, debit_account: debitAccount.name, credit_account: creditAccount.name }
  }).catch(() => null);

  return { adjustment, approvalRequest };
}

/**
 * Approve or reject a pending adjustment. On approval this posts the
 * journal immediately - there is no separate "settlement" step, unlike a
 * payout/withdrawal, because an adjustment IS the ledger movement itself.
 */
export async function decideAdjustment({ ownerType, ownerId, adjustmentId, approverMembershipId, decision, comment = "", actorUserId }) {
  if (!["approved", "rejected"].includes(decision)) {
    throw new AppError("Decision must be 'approved' or 'rejected'", 400);
  }

  const adjustment = await LedgerAdjustment.findOne({ _id: adjustmentId, owner_type: ownerType, owner_id: ownerId });
  if (!adjustment) throw new AppError("Adjustment not found", 404);
  if (adjustment.status !== "pending") {
    throw new AppError(`Cannot decide on an adjustment with status '${adjustment.status}'`, 400);
  }

  const request = await approvalService.submitSignoff({
    requestId: adjustment.approval_request_id,
    approverMembershipId,
    status: decision,
    comment
  });

  if (request.status === "rejected") {
    adjustment.status = "rejected";
    adjustment.rejected_at = new Date();
    adjustment.rejection_reason = comment || null;
    await adjustment.save();

    await createAuditLog({
      actorUserId,
      scopeType: AUDIT_SCOPE_TYPES.CHAMA,
      chamaId: ownerId,
      action: AUDIT_ACTIONS.ADJUSTMENT_REJECTED,
      resourceType: "LedgerAdjustment",
      resourceId: adjustment._id,
      after: { reason: comment || null }
    }).catch(() => null);

    return adjustment;
  }

  if (request.status === "approved") {
    adjustment.status = "approved";
    await adjustment.save();

    await createAuditLog({
      actorUserId,
      scopeType: AUDIT_SCOPE_TYPES.CHAMA,
      chamaId: ownerId,
      action: AUDIT_ACTIONS.ADJUSTMENT_APPROVED,
      resourceType: "LedgerAdjustment",
      resourceId: adjustment._id
    }).catch(() => null);

    const posting = await accountingService.post({
      referenceType: "LEDGER_ADJUSTMENT_POSTING",
      referenceId: adjustment._id,
      owner_type: ownerType,
      owner_id: ownerId,
      chama: ownerId,
      amount: money(adjustment.amount),
      currency: adjustment.currency,
      description: adjustment.reason,
      debitAccountId: adjustment.debit_account_id,
      creditAccountId: adjustment.credit_account_id,
      created_by: actorUserId
    });

    adjustment.status = "posted";
    adjustment.posted_at = new Date();
    adjustment.journal_id = posting.journalId;
    adjustment.transaction_id = posting.transactionId;
    await adjustment.save();

    await createAuditLog({
      actorUserId,
      scopeType: AUDIT_SCOPE_TYPES.CHAMA,
      chamaId: ownerId,
      action: AUDIT_ACTIONS.ADJUSTMENT_POSTED,
      resourceType: "LedgerAdjustment",
      resourceId: adjustment._id,
      after: { journal_id: String(posting.journalId), transaction_id: String(posting.transactionId) }
    }).catch(() => null);

    return adjustment;
  }

  // Still pending - more sign-offs required (required_approvals > 1).
  return adjustment;
}

export async function cancelAdjustment({ ownerType, ownerId, adjustmentId, membershipId, userId, reason = "" }) {
  const adjustment = await LedgerAdjustment.findOne({ _id: adjustmentId, owner_type: ownerType, owner_id: ownerId });
  if (!adjustment) throw new AppError("Adjustment not found", 404);
  if (adjustment.status !== "pending") {
    throw new AppError(`Cannot cancel an adjustment with status '${adjustment.status}'`, 400);
  }

  const membership = await ChamaMembership.findById(membershipId);
  const isInitiator = String(adjustment.initiated_by) === String(membershipId);
  const isOfficial = ["chairperson", "treasurer"].includes(membership?.role);
  if (!isInitiator && !isOfficial) {
    throw new AppError("Only the initiator, chairperson or treasurer can cancel this adjustment", 403);
  }

  if (adjustment.approval_request_id) {
    await approvalService.cancelRequest(adjustment.approval_request_id, membershipId, reason).catch(() => null);
  }

  adjustment.status = "cancelled";
  adjustment.cancelled_at = new Date();
  await adjustment.save();

  await createAuditLog({
    actorUserId: userId,
    scopeType: AUDIT_SCOPE_TYPES.CHAMA,
    chamaId: ownerId,
    action: AUDIT_ACTIONS.ADJUSTMENT_CANCELLED,
    resourceType: "LedgerAdjustment",
    resourceId: adjustment._id,
    after: { reason: reason || null }
  }).catch(() => null);

  return adjustment;
}

export async function listAdjustments(ownerType, ownerId, { status = null } = {}) {
  const query = { owner_type: ownerType, owner_id: ownerId };
  if (status) query.status = status;
  return LedgerAdjustment.find(query)
    .populate("debit_account_id", "name account_code")
    .populate("credit_account_id", "name account_code")
    .populate("initiated_by")
    .sort({ createdAt: -1 });
}

export async function getAdjustment(ownerType, ownerId, adjustmentId) {
  const adjustment = await LedgerAdjustment.findOne({ _id: adjustmentId, owner_type: ownerType, owner_id: ownerId })
    .populate("debit_account_id", "name account_code")
    .populate("credit_account_id", "name account_code")
    .populate("initiated_by");
  if (!adjustment) throw new AppError("Adjustment not found", 404);
  return adjustment;
}