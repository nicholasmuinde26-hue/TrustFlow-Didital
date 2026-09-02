import SavingsSharePolicy from '../../models/SavingsSharePolicy.js';
import ContributionPlan from '../../models/ContributionPlan.js';
import AppError from '../../utils/AppError.js';

// ============================================================
// SAVINGS SHARE POLICY SERVICE
// ============================================================
//
// CRUD + lifecycle for the settings that govern a savings
// share-out: trigger (manual/scheduled/both), how much of each
// member's balance is released, and who receives it.
//
// Mirrors mgr.service.js's policy handling — a chama can only
// have ONE active policy per contribution plan at a time;
// creating a new one archives the previous version.
//
// ============================================================

const assertFreeWillPlan = async (chamaId, planId) => {
  const plan = await ContributionPlan.findById(planId);

  if (!plan) {
    throw new AppError('Contribution plan not found', 404);
  }

  const belongsToChama =
    (plan.owner_type === 'Chama' && String(plan.owner_id) === String(chamaId)) ||
    plan.owner_type === 'ContributionGroup'; // nested group under this chama — trusted by caller

  if (!belongsToChama) {
    throw new AppError('Contribution plan does not belong to this chama', 400);
  }

  if (plan.contribution_type !== 'free_will') {
    throw new AppError(
      'Savings share policies can only be attached to a free-will (flexible savings) contribution plan',
      400
    );
  }

  return plan;
};

export const listSavingsSharePolicies = async (chamaId, { contributionPlanId = null } = {}) => {
  const filter = { chama_id: chamaId };
  if (contributionPlanId) filter.contribution_plan_id = contributionPlanId;

  return SavingsSharePolicy.find(filter).sort({ createdAt: -1 });
};

export const getActiveSavingsSharePolicy = async (chamaId, contributionPlanId) => {
  return SavingsSharePolicy.findOne({
    chama_id: chamaId,
    contribution_plan_id: contributionPlanId,
    status: 'active',
  });
};

export const createSavingsSharePolicy = async ({
  chamaId,
  contributionPlanId,
  created_by,
  name,
  description,
  currency,
  trigger_rule,
  share_rule,
  recipients_rule,
  approval_rule,
  activate = true,
}) => {
  if (!created_by) {
    throw new AppError('Policy creator is required', 400);
  }

  await assertFreeWillPlan(chamaId, contributionPlanId);

  const previousActive = await getActiveSavingsSharePolicy(chamaId, contributionPlanId);
  const nextVersion = previousActive ? previousActive.version + 1 : 1;

  const policy = await SavingsSharePolicy.create({
    chama_id: chamaId,
    contribution_plan_id: contributionPlanId,
    version: nextVersion,
    name,
    description,
    currency,
    trigger_rule,
    share_rule,
    recipients_rule,
    approval_rule,
    status: activate ? 'active' : 'draft',
    created_by,
  });

  if (activate && previousActive) {
    previousActive.status = 'superseded';
    await previousActive.save();
  }

  return policy;
};

export const updateSavingsSharePolicy = async (chamaId, policyId, updates) => {
  const policy = await SavingsSharePolicy.findOne({ _id: policyId, chama_id: chamaId });

  if (!policy) {
    throw new AppError('Savings share policy not found', 404);
  }

  const editableFields = ['name', 'description', 'currency', 'trigger_rule', 'share_rule', 'recipients_rule', 'approval_rule'];

  for (const field of editableFields) {
    if (updates[field] !== undefined) {
      policy[field] = updates[field];
    }
  }

  await policy.save();
  return policy;
};

export const activateSavingsSharePolicy = async (chamaId, policyId) => {
  const policy = await SavingsSharePolicy.findOne({ _id: policyId, chama_id: chamaId });

  if (!policy) {
    throw new AppError('Savings share policy not found', 404);
  }

  const previousActive = await getActiveSavingsSharePolicy(chamaId, policy.contribution_plan_id);
  if (previousActive && String(previousActive._id) !== String(policy._id)) {
    previousActive.status = 'superseded';
    await previousActive.save();
  }

  policy.status = 'active';
  await policy.save();
  return policy;
};

export const archiveSavingsSharePolicy = async (chamaId, policyId) => {
  const policy = await SavingsSharePolicy.findOne({ _id: policyId, chama_id: chamaId });

  if (!policy) {
    throw new AppError('Savings share policy not found', 404);
  }

  policy.status = 'archived';
  await policy.save();
  return policy;
};

export default {
  listSavingsSharePolicies,
  getActiveSavingsSharePolicy,
  createSavingsSharePolicy,
  updateSavingsSharePolicy,
  activateSavingsSharePolicy,
  archiveSavingsSharePolicy,
};