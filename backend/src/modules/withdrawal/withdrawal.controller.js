import {
    requestWithdrawal,
    decideWithdrawal,
    settleWithdrawal,
    cancelWithdrawal,
    listWithdrawals,
    getWithdrawalById
} from "./Withdrawal.service.js";

import {
    createWithdrawalPolicy,
    updateWithdrawalPolicy,
    activateWithdrawalPolicy,
    archiveWithdrawalPolicy,
    listWithdrawalPolicies,
    getWithdrawalPolicyById
} from "./withdrawalpolicy.service.js";

// ========================================
// LIST WITHDRAWALS FOR A CHAMA
// ========================================
//
// Officials see everyone's; a plain member only ever sees their own —
// mirrors how finance.controller.js narrows contributions/summary by
// scope rather than trusting the client to only ask for its own data.
// ========================================

export const listWithdrawalsController = async (req, res, next) => {
    try {
        const isOfficial = ["treasurer", "chairperson", "secretary", "auditor"].includes(req.membership?.role);
        const memberId = isOfficial ? (req.query.memberId || null) : req.membership._id;

        const withdrawals = await listWithdrawals({
            chamaId: req.params.id,
            memberId,
            status: req.query.status || null
        });

        res.status(200).json({ success: true, data: { withdrawals } });
    } catch (error) {
        next(error);
    }
};

// ========================================
// GET MY WITHDRAWALS
// ========================================

export const getMyWithdrawalsController = async (req, res, next) => {
    try {
        const withdrawals = await listWithdrawals({
            chamaId: req.params.id,
            memberId: req.membership._id,
            status: req.query.status || null
        });

        res.status(200).json({ success: true, data: { withdrawals } });
    } catch (error) {
        next(error);
    }
};

// ========================================
// GET SINGLE WITHDRAWAL
// ========================================

export const getWithdrawalController = async (req, res, next) => {
    try {
        const withdrawal = await getWithdrawalById(req.params.id, req.params.withdrawalId);
        res.status(200).json({ success: true, data: { withdrawal } });
    } catch (error) {
        next(error);
    }
};

// ========================================
// REQUEST A WITHDRAWAL
// MEMBER (own) OR CHAIRPERSON (on a member's behalf)
// ========================================
//
// Expected body:
//
// {
//   "contributionPlanId": "...",
//   "memberId": "...",   // optional — defaults to the caller's own membership
//   "amount": 5000,
//   "reason": "School fees"
// }
//
// ========================================

export const requestWithdrawalController = async (req, res, next) => {
    try {
        const { contributionPlanId, amount, reason } = req.body;
        const memberId = req.body.memberId || req.membership._id;

        const result = await requestWithdrawal({
            chamaId: req.params.id,
            contributionPlanId,
            memberId,
            requestedByMembershipId: req.membership._id,
            amount,
            reason,
            actorUserId: req.user._id
        });

        res.status(201).json({
            success: true,
            message: result.withdrawal.status === "approved"
                ? "Withdrawal requested and auto-approved by policy"
                : "Withdrawal request submitted for approval",
            data: result
        });
    } catch (error) {
        next(error);
    }
};

// ========================================
// APPROVE / REJECT A WITHDRAWAL
// CHAIRPERSON OR TREASURER (whoever the policy's eligible_roles allow —
// approvalService.submitSignoff enforces the actual role/self-action
// checks; this route just gets the caller in the door)
// ========================================
//
// Expected body: { "decision": "approved" | "rejected", "comment": "..." }
//
// ========================================

export const decideWithdrawalController = async (req, res, next) => {
    try {
        const { decision, comment } = req.body;

        const withdrawal = await decideWithdrawal({
            chamaId: req.params.id,
            withdrawalId: req.params.withdrawalId,
            approverMembershipId: req.membership._id,
            decision,
            comment,
            actorUserId: req.user._id
        });

        res.status(200).json({
            success: true,
            message: `Withdrawal ${decision === "approved" ? "sign-off recorded" : "rejected"}`,
            data: { withdrawal }
        });
    } catch (error) {
        next(error);
    }
};

// ========================================
// SETTLE (MARK PAID)
// TREASURER ONLY
// ========================================
//
// Expected body:
//
// {
//   "disbursement_method": "cash" | "bank" | "mpesa",
//   "external_reference": "QGH7XXXX" (optional)
// }
//
// ========================================

export const settleWithdrawalController = async (req, res, next) => {
    try {
        const { disbursement_method, external_reference } = req.body;

        const withdrawal = await settleWithdrawal({
            chamaId: req.params.id,
            withdrawalId: req.params.withdrawalId,
            disbursement_method,
            external_reference,
            actorUserId: req.user._id
        });

        res.status(200).json({
            success: true,
            message: "Withdrawal marked as paid",
            data: { withdrawal }
        });
    } catch (error) {
        next(error);
    }
};

// ========================================
// CANCEL A WITHDRAWAL
// REQUESTER (own, while pending) OR TREASURER/CHAIRPERSON
// ========================================

export const cancelWithdrawalController = async (req, res, next) => {
    try {
        const { reason } = req.body;

        const withdrawal = await cancelWithdrawal({
            chamaId: req.params.id,
            withdrawalId: req.params.withdrawalId,
            reason,
            actorMembershipId: req.membership._id,
            actorRole: req.membership.role,
            actorUserId: req.user._id
        });

        res.status(200).json({
            success: true,
            message: "Withdrawal cancelled",
            data: { withdrawal }
        });
    } catch (error) {
        next(error);
    }
};

// ============================================================
// WITHDRAWAL POLICY CONFIGURATION
// CHAIRPERSON / TREASURER ONLY
// ============================================================

export const listWithdrawalPoliciesController = async (req, res, next) => {
    try {
        const policies = await listWithdrawalPolicies({ chamaId: req.params.id });
        res.status(200).json({ success: true, data: { policies } });
    } catch (error) {
        next(error);
    }
};

export const getWithdrawalPolicyController = async (req, res, next) => {
    try {
        const policy = await getWithdrawalPolicyById(req.params.id, req.params.policyId);
        res.status(200).json({ success: true, data: { policy } });
    } catch (error) {
        next(error);
    }
};

export const createWithdrawalPolicyController = async (req, res, next) => {
    try {
        const {
            contributionPlanId,
            name,
            description,
            currency,
            eligibilityConditions,
            actionSpec,
            approvalRule,
            activate
        } = req.body;

        const policy = await createWithdrawalPolicy({
            chamaId: req.params.id,
            contributionPlanId: contributionPlanId || null,
            name,
            description,
            currency,
            eligibilityConditions,
            actionSpec,
            approvalRule,
            createdBy: req.user._id,
            activate: activate !== false
        });

        res.status(201).json({ success: true, message: "Withdrawal policy created", data: { policy } });
    } catch (error) {
        next(error);
    }
};

export const updateWithdrawalPolicyController = async (req, res, next) => {
    try {
        const policy = await updateWithdrawalPolicy({
            chamaId: req.params.id,
            policyId: req.params.policyId,
            updates: req.body
        });

        res.status(200).json({ success: true, message: "Withdrawal policy updated", data: { policy } });
    } catch (error) {
        next(error);
    }
};

export const activateWithdrawalPolicyController = async (req, res, next) => {
    try {
        const policy = await activateWithdrawalPolicy({ chamaId: req.params.id, policyId: req.params.policyId });
        res.status(200).json({ success: true, message: "Withdrawal policy activated", data: { policy } });
    } catch (error) {
        next(error);
    }
};

export const archiveWithdrawalPolicyController = async (req, res, next) => {
    try {
        const policy = await archiveWithdrawalPolicy({ chamaId: req.params.id, policyId: req.params.policyId });
        res.status(200).json({ success: true, message: "Withdrawal policy archived", data: { policy } });
    } catch (error) {
        next(error);
    }
};
