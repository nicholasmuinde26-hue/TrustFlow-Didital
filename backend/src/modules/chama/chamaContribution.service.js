import crypto from "node:crypto";
import mongoose from "mongoose";

import AppError from "../../utils/AppError.js";
import ChamaContribution from "../../models/ChamaContribution.js";
import ChamaMembership from "../../models/ChamaMembership.js";
import ApprovalRequest from "../../models/ApprovalRequest.js";
import ContributionPayment from "../../models/ContributionPayment.js";
import FinancialAccount from "../../models/FinancialAccount.js";

import paymentService from "../../payment/payment.service.js";
import accountingService from "../finance/accounting/accounting.service.js";
import approvalService from "../approval/approval.service.js";
import { accountCodeForContribution } from "../finance/accounting/rules/chamaContribution.rule.js";
import { PAYMENT_PROVIDER } from "../../payment/payment.constants.js";
import { toDecimal } from "../../shared/decimal.js";

// Chairperson, Treasurer, Secretary - same "officials" set used elsewhere
// for chama-wide management actions (see officialRoles in
// modules/chama/chamaOperations.service.js).
const OFFICIAL_ROLES = ["chairperson", "treasurer", "secretary"];

const assertOfficial = (membership) => {
  if (!OFFICIAL_ROLES.includes(membership.role)) {
    throw new AppError(
      "Only the chairperson, treasurer, or secretary can perform this action",
      403
    );
  }
};

const generateUniqueReference = (displayRef) => {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${displayRef}-${ts}-${rand}`.slice(0, 100);
};

const withBalance = async (contribution) => {
  const doc = contribution.toObject ? contribution.toObject() : contribution;
  let balance = doc.collected_amount ? doc.collected_amount.toString() : "0";

  if (doc.account_code) {
    const account = await FinancialAccount.findOne({
      owner_type: "Chama",
      owner_id: doc.chama_id,
      account_code: doc.account_code,
    }).lean();

    if (account) {
      balance = account.current_balance ? account.current_balance.toString() : "0";
    }
  }

  return { ...doc, balance };
};

// ---------------------------------------------------------
// CREATE (any active member may propose one)
// ---------------------------------------------------------
export const createContribution = async ({ chamaId, membership, data }) => {
  if (!data?.title) throw new AppError("A title is required", 400);

  if (data.beneficiary_membership_id) {
    const beneficiary = await ChamaMembership.findOne({
      _id: data.beneficiary_membership_id,
      chama_id: chamaId,
      status: "active",
    });
    if (!beneficiary) throw new AppError("Beneficiary must be an active member of this chama", 400);
  }

  if (data.target_amount !== undefined && data.target_amount !== null) {
    const target = Number(data.target_amount);
    if (!Number.isFinite(target) || target <= 0) {
      throw new AppError("Target amount must be a positive number", 400);
    }
  }

  const contribution = await ChamaContribution.create({
    chama_id: chamaId,
    title: data.title,
    purpose: data.purpose || "other",
    description: data.description || null,
    beneficiary_membership_id: data.beneficiary_membership_id || null,
    target_amount: data.target_amount || null,
    deadline: data.deadline || null,
    created_by: membership._id,
    status: "pending_approval",
  });

  return contribution;
};

// ---------------------------------------------------------
// LIST / GET
// ---------------------------------------------------------
export const listContributions = async (chamaId, { status } = {}) => {
  const filter = { chama_id: chamaId };
  if (status) filter.status = status;

  const contributions = await ChamaContribution.find(filter)
    .sort({ createdAt: -1 })
    .populate("created_by", "user_id role")
    .populate("beneficiary_membership_id", "user_id role");

  return Promise.all(contributions.map(withBalance));
};

export const getContribution = async (chamaId, contributionId) => {
  const contribution = await ChamaContribution.findOne({ _id: contributionId, chama_id: chamaId })
    .populate("created_by", "user_id role")
    .populate("beneficiary_membership_id", "user_id role");

  if (!contribution) throw new AppError("Contribution not found", 404);

  const [withBal, payments] = await Promise.all([
    withBalance(contribution),
    ContributionPayment.find({ "metadata.chama_contribution_id": String(contributionId) })
      .sort({ createdAt: -1 })
      .populate("participant_id", "user_id"),
  ]);

  return { ...withBal, payments };
};

// ---------------------------------------------------------
// APPROVE / REJECT (officials only)
// ---------------------------------------------------------
export const approveContribution = async ({ chamaId, contributionId, approverMembership }) => {
  assertOfficial(approverMembership);

  const contribution = await ChamaContribution.findOne({ _id: contributionId, chama_id: chamaId });
  if (!contribution) throw new AppError("Contribution not found", 404);
  if (contribution.status !== "pending_approval") {
    throw new AppError(`Cannot approve a contribution that is ${contribution.status}`, 409);
  }

  const accountCode = accountCodeForContribution(contribution._id);

  // Create the dedicated fund account up-front so it shows up (with a zero
  // balance) as soon as the contribution goes live, rather than waiting for
  // the first payment. chamaContribution.rule.js also find-or-creates it
  // defensively, so this is safe to do twice.
  let account = await FinancialAccount.findOne({
    owner_type: "Chama",
    owner_id: chamaId,
    account_code: accountCode,
  });

  if (!account) {
    account = await FinancialAccount.create({
      owner_type: "Chama",
      owner_id: chamaId,
      name: `Contribution Fund — ${contribution.title}`.slice(0, 100),
      account_code: accountCode,
      account_type: "liability",
      normal_balance: "credit",
      account_category: "welfare",
      description: `Ad-hoc chama contribution fund for "${contribution.title}"`.slice(0, 500),
      created_by: approverMembership.user_id,
    });
  }

  contribution.status = "active";
  contribution.reviewed_by = approverMembership._id;
  contribution.reviewed_at = new Date();
  contribution.account_code = accountCode;
  contribution.financial_account_id = account._id;
  await contribution.save();

  return contribution;
};

export const rejectContribution = async ({ chamaId, contributionId, approverMembership, reason }) => {
  assertOfficial(approverMembership);

  const contribution = await ChamaContribution.findOne({ _id: contributionId, chama_id: chamaId });
  if (!contribution) throw new AppError("Contribution not found", 404);
  if (contribution.status !== "pending_approval") {
    throw new AppError(`Cannot reject a contribution that is ${contribution.status}`, 409);
  }

  contribution.status = "rejected";
  contribution.reviewed_by = approverMembership._id;
  contribution.reviewed_at = new Date();
  contribution.rejection_reason = reason || null;
  await contribution.save();

  return contribution;
};

// ---------------------------------------------------------
// CHIP IN (any active member, free-form amount)
// ---------------------------------------------------------
export const contribute = async ({ chamaId, contributionId, membership, amount, phoneNumber }) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new AppError("Amount must be a positive number of KES", 400);
  if (!phoneNumber) throw new AppError("M-Pesa phone number is required", 400);

  const contribution = await ChamaContribution.findOne({ _id: contributionId, chama_id: chamaId });
  if (!contribution) throw new AppError("Contribution not found", 404);
  if (contribution.status !== "active") {
    throw new AppError("This contribution is not currently accepting payments", 409);
  }

  const accountCode = contribution.account_code || accountCodeForContribution(contribution._id);
  const reference = generateUniqueReference(`CHAMA-CC-${accountCode}`);

  const result = await paymentService.initiate({
    amount: value,
    currency: "KES",
    type: "chama_contribution",
    chamaId,
    participantId: membership._id,
    participantType: "ChamaMembership",
    phoneNumber,
    actorId: membership.user_id,
    provider: PAYMENT_PROVIDER.MPESA,
    reference,
    displayReference: "CHAMA-CC",
    description: `Contribution to "${contribution.title}"`,
    metadata: {
      productType: "chama_contribution",
      chamaId,
      chama_contribution_id: String(contribution._id),
      account_code: accountCode,
      contribution_title: contribution.title,
      payment_method: "mpesa",
    },
  });

  return { intent: { _id: result.paymentIntentId }, stk: result.providerResponse };
};

// Officials recording an already-settled cash chip-in on a member's behalf -
// mirrors markMgrObligationPaid in chamaFinance.service.js (cash provider
// settles synchronously through the same payment pipeline).
export const recordCashContribution = async ({ chamaId, contributionId, actorMembership, memberId, amount }) => {
  assertOfficial(actorMembership);

  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new AppError("Amount must be a positive number of KES", 400);

  const contribution = await ChamaContribution.findOne({ _id: contributionId, chama_id: chamaId });
  if (!contribution) throw new AppError("Contribution not found", 404);
  if (contribution.status !== "active") {
    throw new AppError("This contribution is not currently accepting payments", 409);
  }

  const member = await ChamaMembership.findOne({ _id: memberId, chama_id: chamaId, status: "active" });
  if (!member) throw new AppError("Active member not found in this chama", 404);

  const accountCode = contribution.account_code || accountCodeForContribution(contribution._id);
  const reference = generateUniqueReference(`CHAMA-CC-${accountCode}`);

  const result = await paymentService.initiate({
    amount: value,
    currency: "KES",
    type: "chama_contribution",
    chamaId,
    participantId: member._id,
    participantType: "ChamaMembership",
    actorId: actorMembership.user_id,
    provider: PAYMENT_PROVIDER.CASH,
    reference,
    displayReference: "CHAMA-CC",
    description: `Cash contribution to "${contribution.title}" recorded on behalf of member`,
    metadata: {
      productType: "chama_contribution",
      chamaId,
      chama_contribution_id: String(contribution._id),
      account_code: accountCode,
      contribution_title: contribution.title,
      payment_method: "cash",
      recordedBy: actorMembership.user_id,
    },
  });

  return result;
};

// Called by financeEngine right after the ledger posts for a
// CHAMA_CONTRIBUTION_PAYMENT event. Keeps the cached collected_amount in
// sync with the real ledger balance. `accountCode` (parsed from the payment
// reference by the finance engine) is the reliable fallback if
// `chamaContributionId` is missing/stale for any reason.
export const recordPaymentPosted = async ({ chamaContributionId, accountCode, amount }) => {
  let contribution = null;

  if (chamaContributionId && mongoose.isValidObjectId(chamaContributionId)) {
    contribution = await ChamaContribution.findById(chamaContributionId);
  }

  if (!contribution && accountCode) {
    contribution = await ChamaContribution.findOne({ account_code: accountCode });
  }

  if (!contribution) return null;

  contribution.collected_amount = mongoose.Types.Decimal128.fromString(
    toDecimal(contribution.collected_amount).plus(toDecimal(amount)).toFixed(2)
  );

  if (!contribution.account_code) {
    contribution.account_code = accountCode || accountCodeForContribution(contribution._id);
  }

  await contribution.save();
  return contribution;
};

// ---------------------------------------------------------
// CLOSE COLLECTION (officials only)
// ---------------------------------------------------------
export const closeCollection = async ({ chamaId, contributionId, actorMembership }) => {
  assertOfficial(actorMembership);

  const contribution = await ChamaContribution.findOne({ _id: contributionId, chama_id: chamaId });
  if (!contribution) throw new AppError("Contribution not found", 404);
  if (contribution.status !== "active") {
    throw new AppError(`Cannot close a contribution that is ${contribution.status}`, 409);
  }

  contribution.status = "closed";
  contribution.closed_at = new Date();
  contribution.closed_by = actorMembership._id;
  await contribution.save();

  return contribution;
};

// ---------------------------------------------------------
// PROPOSE PAYOUT (officials only) - creates a multi-role ApprovalRequest,
// same separation-of-duties pattern used for MGR payouts and loans.
// ---------------------------------------------------------
export const proposePayout = async ({
  chamaId,
  contributionId,
  actorMembership,
  disbursementMethod = "mpesa",
  phoneNumber,
  notes = "",
}) => {
  assertOfficial(actorMembership);

  const contribution = await ChamaContribution.findOne({ _id: contributionId, chama_id: chamaId }).populate(
    "beneficiary_membership_id",
    "user_id"
  );
  if (!contribution) throw new AppError("Contribution not found", 404);
  if (contribution.status !== "closed") {
    throw new AppError("Close the collection window before proposing a payout", 409);
  }

  const amount = Number(toDecimal(contribution.collected_amount).toFixed(2));
  if (!(amount > 0)) throw new AppError("This contribution has not collected anything yet", 409);

  const approvalRequest = await approvalService.createRequest({
    chamaId,
    resourceType: "CHAMA_CONTRIBUTION_PAYOUT",
    resourceId: contribution._id,
    action: "DISBURSE",
    title: `Payout for "${contribution.title}"`,
    description: `Disbursement of KES ${amount.toLocaleString()} via ${disbursementMethod.toUpperCase()}`,
    amount,
    initiatedByMembershipId: actorMembership._id,
    requiredApprovals: 2,
    eligibleRoles: OFFICIAL_ROLES,
    allowInitiatorApproval: false,
  });

  contribution.status = "payout_pending";
  contribution.approval_request_id = approvalRequest._id;
  contribution.disbursement = {
    method: disbursementMethod,
    phone_number: phoneNumber || null,
    notes,
    requested_by: actorMembership._id,
    requested_at: new Date(),
  };
  await contribution.save();

  return { contribution, approvalRequest };
};

// ---------------------------------------------------------
// DISBURSE (officials only, once the ApprovalRequest is approved)
// ---------------------------------------------------------
export const disburse = async ({ chamaId, contributionId, actorMembership }) => {
  assertOfficial(actorMembership);

  const contribution = await ChamaContribution.findOne({ _id: contributionId, chama_id: chamaId });
  if (!contribution) throw new AppError("Contribution not found", 404);
  if (contribution.status !== "payout_pending") {
    throw new AppError(`Cannot disburse a contribution that is ${contribution.status}`, 409);
  }
  if (!contribution.approval_request_id) {
    throw new AppError("No payout approval request found for this contribution", 409);
  }

  const approvalRequest = await ApprovalRequest.findById(contribution.approval_request_id);
  if (!approvalRequest || approvalRequest.status !== "approved") {
    throw new AppError("This payout has not yet received the required sign-offs", 403);
  }

  const amount = Number(toDecimal(contribution.collected_amount).toFixed(2));

  await accountingService.post({
    referenceType: "CHAMA_CONTRIB_PAYOUT_SETTLEMENT",
    owner_type: "Chama",
    owner_id: chamaId,
    chamaId,
    amount,
    currency: "KES",
    description: `Payout disbursed for "${contribution.title}"`,
    source_type: "ChamaContribution",
    reference: generateUniqueReference("CHAMA-CC-PAYOUT"),
    disbursement_method: contribution.disbursement?.method || "cash",
    created_by: actorMembership.user_id,
    metadata: {
      account_code: contribution.account_code,
      disbursement_method: contribution.disbursement?.method || "cash",
    },
  });

  contribution.status = "completed";
  contribution.disbursed_at = new Date();
  contribution.disbursed_by = actorMembership._id;
  contribution.disbursed_amount = mongoose.Types.Decimal128.fromString(amount.toFixed(2));
  contribution.disbursement_reference = generateUniqueReference("CHAMA-CC-REF");
  await contribution.save();

  return contribution;
};

// ---------------------------------------------------------
// CANCEL (officials only, before anything has been collected)
// ---------------------------------------------------------
export const cancelContribution = async ({ chamaId, contributionId, actorMembership, reason }) => {
  assertOfficial(actorMembership);

  const contribution = await ChamaContribution.findOne({ _id: contributionId, chama_id: chamaId });
  if (!contribution) throw new AppError("Contribution not found", 404);
  if (!["pending_approval", "active"].includes(contribution.status)) {
    throw new AppError(`Cannot cancel a contribution that is ${contribution.status}`, 409);
  }
  if (toDecimal(contribution.collected_amount).greaterThan(0)) {
    throw new AppError("Cannot cancel a contribution that has already collected money - close it and propose a payout instead", 409);
  }

  contribution.status = "cancelled";
  contribution.cancelled_at = new Date();
  contribution.cancelled_by = actorMembership._id;
  contribution.cancel_reason = reason || null;
  await contribution.save();

  return contribution;
};

export default {
  createContribution,
  listContributions,
  getContribution,
  approveContribution,
  rejectContribution,
  contribute,
  recordCashContribution,
  recordPaymentPosted,
  closeCollection,
  proposePayout,
  disburse,
  cancelContribution,
};