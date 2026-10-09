import WithdrawalPolicy from "../../models/Withdrawalpolicy.js";
import AppError from "../../utils/AppError.js";

// ============================================================
// WITHDRAWAL POLICY SERVICE
// ============================================================
//
// Lets a chairperson/treasurer configure the eligibility conditions and
// approval requirements a withdrawal request must clear — see
// WithdrawalPolicy.js for the shape and withdrawal.service.js for where
// it's evaluated (policyEngine.service.js#evaluatePolicyAction).
//
// Versioning mirrors MgrPolicy / SavingsSharePolicy: creating a new
// policy for a plan that already has an active one supersedes the old
// one rather than editing it in place, so historical Withdrawal
// documents keep an honest policy_id snapshot of what applied to them.
//
// ============================================================

export const createWithdrawalPolicy = async ({
    chamaId,
    contributionPlanId = null,
    name,
    description = "",
    currency = "KES",
    eligibilityConditions = [],
    actionSpec = null,
    approvalRule = null,
    createdBy,
    activate = true,
}) => {
    if (!name) throw new AppError("Policy name is required", 400);

    const existingActive = await WithdrawalPolicy.findOne({
        chama_id: chamaId,
        contribution_plan_id: contributionPlanId,
        status: "active",
    }).sort({ version: -1 });

    const policy = await WithdrawalPolicy.create({
        chama_id: chamaId,
        contribution_plan_id: contributionPlanId,
        version: existingActive ? existingActive.version + 1 : 1,
        name,
        description,
        currency,
        eligibility_conditions: eligibilityConditions,
        action_spec: actionSpec || undefined,
        approval_rule: approvalRule || undefined,
        status: activate ? "active" : "draft",
        created_by: createdBy,
    });

    if (activate && existingActive) {
        existingActive.status = "superseded";
        await existingActive.save();
    }

    return policy;
};

export const updateWithdrawalPolicy = async ({ chamaId, policyId, updates }) => {
    const policy = await WithdrawalPolicy.findOne({ _id: policyId, chama_id: chamaId });
    if (!policy) throw new AppError("Withdrawal policy not found", 404);
    if (policy.status === "archived") throw new AppError("Cannot edit an archived policy", 400);

    const editable = ["name", "description", "eligibility_conditions", "action_spec", "approval_rule"];
    for (const key of editable) {
        if (updates[key] !== undefined) policy[key] = updates[key];
    }

    await policy.save();
    return policy;
};

export const activateWithdrawalPolicy = async ({ chamaId, policyId }) => {
    const policy = await WithdrawalPolicy.findOne({ _id: policyId, chama_id: chamaId });
    if (!policy) throw new AppError("Withdrawal policy not found", 404);

    const currentlyActive = await WithdrawalPolicy.findOne({
        chama_id: chamaId,
        contribution_plan_id: policy.contribution_plan_id,
        status: "active",
    });

    if (currentlyActive && String(currentlyActive._id) !== String(policy._id)) {
        currentlyActive.status = "superseded";
        await currentlyActive.save();
    }

    policy.status = "active";
    await policy.save();
    return policy;
};

export const archiveWithdrawalPolicy = async ({ chamaId, policyId }) => {
    const policy = await WithdrawalPolicy.findOne({ _id: policyId, chama_id: chamaId });
    if (!policy) throw new AppError("Withdrawal policy not found", 404);

    policy.status = "archived";
    await policy.save();
    return policy;
};

export const listWithdrawalPolicies = async ({ chamaId, contributionPlanId = undefined }) => {
    const query = { chama_id: chamaId };
    if (contributionPlanId !== undefined) query.contribution_plan_id = contributionPlanId;
    return WithdrawalPolicy.find(query).sort({ contribution_plan_id: 1, version: -1 });
};

export const getWithdrawalPolicyById = async (chamaId, policyId) => {
    const policy = await WithdrawalPolicy.findOne({ _id: policyId, chama_id: chamaId });
    if (!policy) throw new AppError("Withdrawal policy not found", 404);
    return policy;
};
