import mongoose from "mongoose";

import Withdrawal from "../../models/Withdrawal.js";
import WithdrawalPolicy from "../../models/Withdrawalpolicy.js";
import ChamaMembership from "../../models/ChamaMembership.js";
import ChamaLoan from "../../models/ChamaLoan.js";
import FinancialAccount from "../../models/FinancialAccount.js";

import AppError from "../../utils/AppError.js";
import accountingService from "../finance/accounting/accounting.service.js";
import financeAccountService from "../finance/financeAccount.service.js";
import approvalService from "../approval/approval.service.js";
import domainEventEmitter from "../../services/domainEvent.emitter.js";

import { evaluatePolicyAction } from "../policyEngine/services/policyEngine.service.js";
import { ACTION_TYPES } from "../policyEngine/constants/policyEngine.constants.js";
import { OPEN_LOAN_STATUSES } from "../loans/Loan.constants.js";

import { getMemberSavingsBalance } from "../savingsShareout/savingsShareout.service.js";
import { creditMemberWallet } from "../finance/memberWallet.service.js";

import {
    toDecimal,
    isMoneyPositive,
    isMoneyGreaterThan
} from "../../shared/decimal.js";

// ============================================================
// WITHDRAWAL SERVICE
// ============================================================
//
// Business orchestration layer for member withdrawals — mirrors
// payout.service.js's structure and division of responsibilities.
//
// Responsibilities:
//
// ✓ Balance / eligibility checks
// ✓ Policy engine evaluation (auto-approve / require-approval / auto-reject)
// ✓ ApprovalRequest creation + sign-off syncing
// ✓ Reservation (FinancialAccount.reserveFunds/releaseFunds)
// ✓ Withdrawal lifecycle state
//
// DOES NOT:
//
// ✗ Create journals directly (accountingService owns that)
// ✗ Resolve ledger accounts
// ✗ Decide the underlying rules (WithdrawalPolicy owns that)
//
// ============================================================

const OWNER_TYPE = "Chama";
const DISBURSEMENT_METHODS = ["cash", "bank", "mpesa", "wallet"];

const canUseTransactions = () => {
    const topology = mongoose.connection?.client?.topology;
    const topologyType = topology?.description?.type;
    return topologyType === "ReplicaSetWithPrimary" || topologyType === "Sharded";
};

const RECIPIENT_POPULATE = {
    path: "member_id",
    select: "role status user_id",
    populate: { path: "user_id", select: "name phone" }
};

const money = (value) => Number(value?.toString?.() ?? value ?? 0);

// ============================================================
// SELF-HEAL: ensure the withdrawal chart of accounts exists
// ============================================================
//
// WITHDRAWAL_CLEARING (and the rest of the standard chart) is provisioned
// per-chama by FinancialAccount.bootstrapSystemAccounts — normally at
// chama creation time. A chama created before WITHDRAWAL_CLEARING was
// added to that list never got one, so the first WITHDRAWAL_OBLIGATION /
// WITHDRAWAL_SETTLEMENT / WITHDRAWAL_CANCELLATION posting for it fails
// with "Financial account 'WITHDRAWAL_CLEARING' not found." Same pattern
// already used defensively in savingsPayment.rule.js and friends:
// bootstrapSystemAccounts only creates what's missing, so this is a
// no-op for any chama whose chart is already complete.
const ensureWithdrawalAccounts = async (chamaId, actorId = null) => {
    await FinancialAccount.bootstrapSystemAccounts({
        owner_type: OWNER_TYPE,
        owner_id: chamaId,
        created_by: actorId
    });
};

const getMemberName = async (membershipId) => {
    const membership = await ChamaMembership.findById(membershipId).populate("user_id", "name");
    return membership?.user_id?.name || "A member";
};

// ============================================================
// LOAD THE ACTIVE POLICY FOR A SAVINGS PLAN
// ============================================================
//
// A policy scoped to this exact contribution_plan_id wins; otherwise the
// chama-wide default (contribution_plan_id: null) is used; otherwise
// there is no configured policy at all, and requestWithdrawal falls back
// to a safe built-in default (see buildDefaultDecision below).
//
const getActivePolicy = async (chamaId, contributionPlanId) => {
    const scoped = await WithdrawalPolicy.findOne({
        chama_id: chamaId,
        contribution_plan_id: contributionPlanId,
        status: "active"
    }).sort({ version: -1 });

    const defaultPolicy = await WithdrawalPolicy.findOne({
        chama_id: chamaId,
        contribution_plan_id: null,
        status: "active"
    }).sort({ version: -1 });

    if (!scoped) return defaultPolicy;
    if (defaultPolicy) {
        const scopedTypes = new Set((scoped.eligibility_conditions || []).map((condition) => condition.type));
        scoped.eligibility_conditions = [
            ...(defaultPolicy.eligibility_conditions || []).filter((condition) => !scopedTypes.has(condition.type)),
            ...(scoped.eligibility_conditions || []),
        ];
    }
    return scoped;
};

// ============================================================
// BUILD POLICY-ENGINE CONTEXT FOR A REQUEST
// ============================================================

const buildEvaluationContext = async ({ chamaId, membership, contributionPlanId, requestedAmount, savingsBalance }) => {
    const [overdueLoanCount, lastRequest, periodWindowDays] = await Promise.all([
        ChamaLoan.countDocuments({
            chama_id: chamaId,
            membership_id: membership._id,
            status: { $in: OPEN_LOAN_STATUSES },
            due_date: { $lt: new Date() }
        }).catch(() => 0),
        Withdrawal.findOne({
            chama_id: chamaId,
            member_id: membership._id,
            contribution_plan_id: contributionPlanId
        }).sort({ createdAt: -1 }),
        30 // default rolling window used for amountInPeriod below when a policy doesn't specify one
    ]);

    const daysSinceLastRequest = lastRequest
        ? (Date.now() - lastRequest.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        : null;

    const periodStart = new Date(Date.now() - periodWindowDays * 24 * 60 * 60 * 1000);
    const amountInPeriodAgg = await Withdrawal.aggregate([
        {
            $match: {
                chama_id: new mongoose.Types.ObjectId(chamaId),
                member_id: new mongoose.Types.ObjectId(membership._id),
                contribution_plan_id: new mongoose.Types.ObjectId(contributionPlanId),
                status: { $in: ["approved", "paid"] },
                createdAt: { $gte: periodStart }
            }
        },
        { $group: { _id: null, total: { $sum: { $toDecimal: "$amount" } } } }
    ]);

    return {
        chamaId: String(chamaId),
        membership,
        savingsBalance: money(savingsBalance),
        requestedAmount: money(requestedAmount),
        amountInPeriod: money(amountInPeriodAgg[0]?.total ?? 0),
        daysSinceLastRequest,
        overdueLoanCount
    };
};

// A chama that hasn't configured a WithdrawalPolicy yet still gets a safe
// default rather than either "anything goes" or "nothing works": require
// manual approval from a chairperson or treasurer, same floor as Payout.
const buildDefaultDecision = () => ({
    action: ACTION_TYPES.REQUIRE_APPROVAL,
    params: {},
    passed: true,
    reasons: []
});

// ============================================================
// REQUEST WITHDRAWAL
// ============================================================

export const requestWithdrawal = async ({
    chamaId,
    contributionPlanId,
    memberId,
    requestedByMembershipId,
    amount,
    reason = "",
    actorUserId
}) => {
    if (!contributionPlanId) throw new AppError("A savings plan is required", 400);
    if (!memberId) throw new AppError("A member is required", 400);

    const value = toDecimal(amount);
    if (!isMoneyPositive(value)) throw new AppError("Amount must be greater than zero", 400);

    const membership = await ChamaMembership.findOne({ _id: memberId, chama_id: chamaId });
    if (!membership) throw new AppError("Member not found in this Chama", 404);
    if (membership.status !== "active") throw new AppError("Only active members can request a withdrawal", 400);

    // Any request the member already has open (pending or approved-but-
    // unpaid) counts against their balance too — getMemberSavingsBalance
    // only excludes 'approved'/'paid' committed withdrawals, so a second
    // simultaneous pending request must be checked against those open
    // ones explicitly here.
    const [savingsBalance, openRequests] = await Promise.all([
        getMemberSavingsBalance(chamaId, contributionPlanId, memberId),
        Withdrawal.find({
            chama_id: chamaId,
            contribution_plan_id: contributionPlanId,
            member_id: memberId,
            status: "pending"
        }).select("amount")
    ]);

    const alreadyPending = openRequests.reduce(
        (sum, w) => sum + money(w.amount),
        0
    );

    const available = money(savingsBalance) - alreadyPending;

    if (money(value) > available) {
        throw new AppError(
            `Requested amount exceeds available savings balance (KES ${available.toFixed(2)} available, KES ${money(value).toFixed(2)} requested)`,
            400
        );
    }

    const policy = await getActivePolicy(chamaId, contributionPlanId);

    const context = await buildEvaluationContext({
        chamaId,
        membership,
        contributionPlanId,
        requestedAmount: value,
        savingsBalance
    });

    const decision = policy
        ? await evaluatePolicyAction({
              conditions: policy.eligibility_conditions,
              actionSpec: policy.action_spec,
              context
          })
        : buildDefaultDecision();

    if (decision.action === ACTION_TYPES.AUTO_REJECT) {
        throw new AppError(
            `Withdrawal request does not meet policy requirements: ${decision.reasons.join("; ") || "ineligible"}`,
            422
        );
    }

    const withdrawal = await Withdrawal.create({
        chama_id: chamaId,
        contribution_plan_id: contributionPlanId,
        member_id: memberId,
        requested_by: requestedByMembershipId,
        reason,
        amount: value.toFixed(2),
        currency: "KES",
        status: "pending",
        policy_id: policy?._id || null,
        policy_decision: {
            action: decision.action,
            passed: decision.passed,
            reasons: decision.reasons
        }
    });

    const eventPayload = {
        chamaId: String(chamaId),
        withdrawalId: String(withdrawal._id),
        membershipId: String(memberId),
        memberName: await getMemberName(memberId),
        amount: money(value)
    };

    let approvalRequest = null;

    if (decision.action === ACTION_TYPES.AUTO_APPROVE) {
        const approved = await approveInternal({ withdrawal, approvedByMembershipId: requestedByMembershipId, actorUserId, autoApproved: true });
        domainEventEmitter.emitWithdrawalApproved(eventPayload);
        return { withdrawal: approved, approvalRequest: null };
    }

    // REQUIRE_APPROVAL / FLAG_FOR_REVIEW both fall through to a real
    // ApprovalRequest — FLAG_FOR_REVIEW doesn't auto-act, it just means
    // the request carries advisory flags for the approver to see (surfaced
    // via policy_decision.reasons on the Withdrawal document itself).
    const approvalRule = policy?.approval_rule || {};

    try {
        approvalRequest = await approvalService.createRequest({
            chamaId,
            resourceType: "WITHDRAWAL",
            resourceId: withdrawal._id,
            action: "WITHDRAWAL_DISBURSEMENT",
            title: `Member withdrawal request`,
            description: `Withdrawal of KES ${money(value).toFixed(2)} requested against savings plan ${contributionPlanId}.${reason ? ` Reason: ${reason}` : ""}`,
            amount: value.toFixed(2),
            initiatedByMembershipId: requestedByMembershipId,
            requiredApprovals: approvalRule.required_approvals || 1,
            eligibleRoles: approvalRule.eligible_roles || ["chairperson", "treasurer"],
            // A member must never be able to approve their own withdrawal —
            // this is never overridable, unlike other ApprovalRequest callers.
            allowInitiatorApproval: false,
            permissionKey: "withdrawals.approve",
            metadata: { member_id: String(memberId), contribution_plan_id: String(contributionPlanId), amount: money(value) }
        });
    } catch (error) {
        // The Withdrawal document above already persisted. If attaching its
        // ApprovalRequest fails partway, don't leave an orphaned 'pending'
        // withdrawal behind with no approval_request_id — decideWithdrawal
        // would have no request to submit a sign-off against, and the
        // requester would have a withdrawal stuck forever with no way to
        // resolve it. Compensate by removing it and surface the real error.
        await Withdrawal.deleteOne({ _id: withdrawal._id }).catch(() => null);
        throw error;
    }

    withdrawal.approval_request_id = approvalRequest._id;
    await withdrawal.save();

    domainEventEmitter.emitWithdrawalRequested(eventPayload);

    return { withdrawal, approvalRequest };
};

// ============================================================
// APPROVE / REJECT (human sign-off path)
// ============================================================
//
// Wraps approvalService.submitSignoff and keeps the Withdrawal document's
// own status in sync with the resulting ApprovalRequest — same pattern
// member.service.js#completeMemberExit relies on, just decoupled so this
// module owns its own resourceId space.
//
export const decideWithdrawal = async ({ chamaId, withdrawalId, approverMembershipId, decision, comment = "", actorUserId = null }) => {
    if (!["approved", "rejected"].includes(decision)) {
        throw new AppError("Decision must be 'approved' or 'rejected'", 400);
    }

    const withdrawal = await Withdrawal.findOne({ _id: withdrawalId, chama_id: chamaId });
    if (!withdrawal) throw new AppError("Withdrawal not found", 404);
    if (withdrawal.status !== "pending") {
        throw new AppError(`Cannot decide on a withdrawal with status '${withdrawal.status}'`, 400);
    }

    if (!withdrawal.approval_request_id) {
        // Self-heal: a withdrawal can only reach 'pending' with no
        // approval_request_id if request creation was interrupted between
        // creating the Withdrawal and attaching its ApprovalRequest —
        // requestWithdrawal's compensating delete (above) stops this
        // happening for new requests, but an already-affected record still
        // needs a way forward rather than being stuck with no request to
        // sign off on. Attach the missing ApprovalRequest now, evaluated
        // against the same policy (if any) the withdrawal was originally
        // decided under, and carry on as normal.
        const backfillPolicy = withdrawal.policy_id
            ? await WithdrawalPolicy.findById(withdrawal.policy_id)
            : await getActivePolicy(chamaId, withdrawal.contribution_plan_id);
        const backfillRule = backfillPolicy?.approval_rule || {};

        const backfilledRequest = await approvalService.createRequest({
            chamaId,
            resourceType: "WITHDRAWAL",
            resourceId: withdrawal._id,
            action: "WITHDRAWAL_DISBURSEMENT",
            title: `Member withdrawal request`,
            description: `Withdrawal of KES ${money(withdrawal.amount).toFixed(2)} requested against savings plan ${withdrawal.contribution_plan_id}.${withdrawal.reason ? ` Reason: ${withdrawal.reason}` : ""}`,
            amount: withdrawal.amount,
            initiatedByMembershipId: withdrawal.requested_by,
            requiredApprovals: backfillRule.required_approvals || 1,
            eligibleRoles: backfillRule.eligible_roles || ["chairperson", "treasurer"],
            allowInitiatorApproval: false,
            permissionKey: "withdrawals.approve",
            metadata: {
                member_id: String(withdrawal.member_id),
                contribution_plan_id: String(withdrawal.contribution_plan_id),
                amount: money(withdrawal.amount),
                backfilled: true
            }
        });

        withdrawal.approval_request_id = backfilledRequest._id;
        await withdrawal.save();
    }

    const request = await approvalService.submitSignoff({
        requestId: withdrawal.approval_request_id,
        approverMembershipId,
        status: decision,
        comment
    });

    if (request.status === "rejected") {
        withdrawal.status = "rejected";
        withdrawal.rejected_at = new Date();
        withdrawal.rejection_reason = comment || null;
        await withdrawal.save();

        domainEventEmitter.emitWithdrawalRejected({
            chamaId: String(chamaId),
            withdrawalId: String(withdrawal._id),
            membershipId: String(withdrawal.member_id),
            memberName: await getMemberName(withdrawal.member_id),
            amount: money(withdrawal.amount)
        });

        return withdrawal;
    }

    if (request.status === "approved") {
        const approved = await approveInternal({ withdrawal, approvedByMembershipId: approverMembershipId, actorUserId, autoApproved: false });

        domainEventEmitter.emitWithdrawalApproved({
            chamaId: String(chamaId),
            withdrawalId: String(withdrawal._id),
            membershipId: String(withdrawal.member_id),
            memberName: await getMemberName(withdrawal.member_id),
            amount: money(withdrawal.amount)
        });

        return approved;
    }

    // Still pending — more sign-offs required (required_approvals > 1).
    return withdrawal;
};

// ============================================================
// INTERNAL: FLIP TO APPROVED — RESERVE THEN POST THE OBLIGATION
// ============================================================
//
// This is the "reserve" step the lifecycle was missing. reserveFunds()
// is an atomic, conditional update ($expr-guarded — see
// financeAccount.service.js) so two concurrent approvals racing to
// commit against the same MEMBER_SAVINGS balance can't both succeed
// beyond what's actually available. Once the obligation is posted the
// reservation is released immediately — the ledger's own current_balance
// now carries the commitment permanently, so nothing is left "reserved"
// in the interim except the width of this one transaction.
//
const approveInternal = async ({ withdrawal, approvedByMembershipId, actorUserId = null, autoApproved = false }) => {
    const ownsSession = true;
    const session = await mongoose.startSession();

    try {
        if (canUseTransactions()) session.startTransaction();

        await ensureWithdrawalAccounts(withdrawal.chama_id, actorUserId || approvedByMembershipId);

        const savingsAccount = await financeAccountService.getAccount({
            code: "MEMBER_SAVINGS",
            owner_type: OWNER_TYPE,
            owner_id: withdrawal.chama_id,
            session
        });

        await financeAccountService.reserveFunds({
            accountId: savingsAccount._id,
            amount: withdrawal.amount,
            session
        });

        const obligation = await accountingService.post(
            {
                referenceType: "WITHDRAWAL_OBLIGATION",
                owner_type: OWNER_TYPE,
                owner_id: withdrawal.chama_id,
                member: withdrawal.member_id,
                amount: withdrawal.amount,
                currency: withdrawal.currency,
                source_type: "Withdrawal",
                source_id: withdrawal._id,
                description: `Withdrawal approved for member ${withdrawal.member_id}`,
                created_by: actorUserId || approvedByMembershipId,
                posted_by: actorUserId || approvedByMembershipId
            },
            session
        );

        // The obligation entry has now permanently reduced MEMBER_SAVINGS'
        // current_balance — the temporary reservation has done its job of
        // blocking a concurrent racer and can be released.
        await financeAccountService.releaseFunds({
            accountId: savingsAccount._id,
            amount: withdrawal.amount,
            session
        });

        withdrawal.status = "approved";
        withdrawal.approved_at = new Date();
        withdrawal.obligation_transaction_id = obligation.transactionId;
        withdrawal.reservation = {
            account_id: savingsAccount._id,
            reserved_at: new Date(),
            released_at: new Date()
        };

        await withdrawal.save({ session });

        if (ownsSession && session.inTransaction()) {
            await session.commitTransaction();
        }

        return withdrawal;
    } catch (error) {
        if (ownsSession && session.inTransaction()) {
            await session.abortTransaction();
        }
        throw error;
    } finally {
        if (ownsSession) await session.endSession();
    }
};

// ============================================================
// SETTLE (MARK PAID) — TREASURER DISBURSES
// ============================================================

export const settleWithdrawal = async ({ chamaId, withdrawalId, disbursement_method, external_reference = null, actorUserId }) => {
    if (!DISBURSEMENT_METHODS.includes(disbursement_method)) {
        throw new AppError("Disbursement method must be cash, bank, mpesa or wallet", 400);
    }

    const withdrawal = await Withdrawal.findOne({ _id: withdrawalId, chama_id: chamaId });
    if (!withdrawal) throw new AppError("Withdrawal not found", 404);

    if (withdrawal.status !== "approved") {
        throw new AppError(
            withdrawal.status === "pending"
                ? "This withdrawal must be approved before it can be paid"
                : `Cannot settle withdrawal. Current status: ${withdrawal.status}`,
            400
        );
    }

    await ensureWithdrawalAccounts(chamaId, actorUserId);

    const settlement = await accountingService.post({
        referenceType: "WITHDRAWAL_SETTLEMENT",
        owner_type: OWNER_TYPE,
        owner_id: chamaId,
        member: withdrawal.member_id,
        amount: withdrawal.amount,
        currency: withdrawal.currency,
        source_type: "Withdrawal",
        source_id: withdrawal._id,
        disbursement_method: disbursement_method === "wallet" ? "mpesa" : disbursement_method,
        description: `Withdrawal settled via ${disbursement_method}`,
        metadata: { disbursement_method, external_reference, wallet_destination: disbursement_method === "wallet" },
        created_by: actorUserId,
        posted_by: actorUserId
    });

    if (disbursement_method === "wallet") {
        const recipient = await ChamaMembership.findById(withdrawal.member_id).select("user_id").lean();
        await creditMemberWallet({ userId: recipient?.user_id, amount: withdrawal.amount, sourceType: "Withdrawal", sourceId: withdrawal._id, createdBy: actorUserId, externalReference });
    }

    withdrawal.status = "paid";
    withdrawal.paid_at = new Date();
    withdrawal.disbursement_method = disbursement_method;
    withdrawal.external_reference = external_reference;
    withdrawal.financial_transaction_id = settlement.transactionId;

    await withdrawal.save();

    return withdrawal;
};

// ============================================================
// CANCEL — before disbursement, from 'pending' or 'approved'
// ============================================================

export const cancelWithdrawal = async ({ chamaId, withdrawalId, reason = "", actorMembershipId, actorRole, actorUserId }) => {
    const withdrawal = await Withdrawal.findOne({ _id: withdrawalId, chama_id: chamaId });
    if (!withdrawal) throw new AppError("Withdrawal not found", 404);

    if (!["pending", "approved"].includes(withdrawal.status)) {
        throw new AppError(`Cannot cancel withdrawal. Current status: ${withdrawal.status}`, 400);
    }

    const isOwnRequest = [String(withdrawal.requested_by), String(withdrawal.member_id)].includes(String(actorMembershipId));
    const isOfficer = ["treasurer", "chairperson"].includes(actorRole);

    if (withdrawal.status === "approved") {
        // The obligation is already posted (a real ledger liability) —
        // only an officer can unwind it, never the member themselves.
        if (!isOfficer) {
            throw new AppError("Only an officer may cancel an already-approved withdrawal.", 403);
        }

        // Reverse the obligation that was already posted at approval time.
        await ensureWithdrawalAccounts(chamaId, actorUserId);

        await accountingService.post({
            referenceType: "WITHDRAWAL_CANCELLATION",
            owner_type: OWNER_TYPE,
            owner_id: chamaId,
            member: withdrawal.member_id,
            amount: withdrawal.amount,
            currency: withdrawal.currency,
            source_type: "Withdrawal",
            source_id: withdrawal._id,
            description: `Withdrawal cancelled before disbursement`,
            created_by: actorUserId,
            posted_by: actorUserId
        });
    } else {
        if (!isOwnRequest && !isOfficer) {
            throw new AppError("Only the requester or an officer may cancel this request.", 403);
        }
        if (withdrawal.approval_request_id) {
            await approvalService.cancelRequest(withdrawal.approval_request_id, actorMembershipId, reason).catch(() => null);
        }
    }

    withdrawal.status = "cancelled";
    withdrawal.cancelled_at = new Date();
    withdrawal.cancellation_reason = reason || null;
    await withdrawal.save();

    return withdrawal;
};

// ============================================================
// READS
// ============================================================

export const listWithdrawals = async ({ chamaId, memberId = null, status = null }) => {
    const query = { chama_id: chamaId };
    if (memberId) query.member_id = memberId;
    if (status) query.status = status;

    return Withdrawal.find(query).populate(RECIPIENT_POPULATE).sort({ createdAt: -1 });
};

export const getWithdrawalById = async (chamaId, withdrawalId) => {
    const withdrawal = await Withdrawal.findOne({ _id: withdrawalId, chama_id: chamaId }).populate(RECIPIENT_POPULATE);
    if (!withdrawal) throw new AppError("Withdrawal not found", 404);
    return withdrawal;
};
