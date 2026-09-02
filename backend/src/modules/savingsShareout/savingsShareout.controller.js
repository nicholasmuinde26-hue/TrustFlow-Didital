import {
  listSavingsSharePolicies,
  createSavingsSharePolicy,
  updateSavingsSharePolicy,
  activateSavingsSharePolicy,
  archiveSavingsSharePolicy,
} from './savingsSharePolicy.service.js';

import {
  previewShareout,
  createShareout,
  approveShareout,
  payShareoutItem,
  cancelShareout,
  listShareouts,
  getShareoutById,
} from './savingsShareout.service.js';

// ========================================
// POLICIES
// ========================================

export const listPoliciesController = async (req, res, next) => {
  try {
    const policies = await listSavingsSharePolicies(req.params.id, {
      contributionPlanId: req.query.contributionPlanId || null,
    });
    res.status(200).json({ success: true, data: { policies } });
  } catch (error) {
    next(error);
  }
};

export const createPolicyController = async (req, res, next) => {
  try {
    const policy = await createSavingsSharePolicy({
      chamaId: req.params.id,
      contributionPlanId: req.body.contribution_plan_id,
      created_by: req.user._id,
      name: req.body.name,
      description: req.body.description,
      currency: req.body.currency,
      trigger_rule: req.body.trigger_rule,
      share_rule: req.body.share_rule,
      recipients_rule: req.body.recipients_rule,
      approval_rule: req.body.approval_rule,
      activate: req.body.activate !== false,
    });
    res.status(201).json({ success: true, data: { policy } });
  } catch (error) {
    next(error);
  }
};

export const updatePolicyController = async (req, res, next) => {
  try {
    const policy = await updateSavingsSharePolicy(req.params.id, req.params.policyId, req.body);
    res.status(200).json({ success: true, data: { policy } });
  } catch (error) {
    next(error);
  }
};

export const activatePolicyController = async (req, res, next) => {
  try {
    const policy = await activateSavingsSharePolicy(req.params.id, req.params.policyId);
    res.status(200).json({ success: true, data: { policy } });
  } catch (error) {
    next(error);
  }
};

export const archivePolicyController = async (req, res, next) => {
  try {
    const policy = await archiveSavingsSharePolicy(req.params.id, req.params.policyId);
    res.status(200).json({ success: true, data: { policy } });
  } catch (error) {
    next(error);
  }
};

// ========================================
// SHARE-OUTS
// ========================================

export const previewShareoutController = async (req, res, next) => {
  try {
    const preview = await previewShareout({
      chamaId: req.params.id,
      policyId: req.query.policyId,
    });
    res.status(200).json({ success: true, data: preview });
  } catch (error) {
    next(error);
  }
};

export const createShareoutController = async (req, res, next) => {
  try {
    const shareout = await createShareout({
      chamaId: req.params.id,
      policyId: req.body.policy_id,
      created_by: req.user._id,
      triggerType: 'manual',
      periodLabel: req.body.period_label || '',
      asOfDate: req.body.as_of_date || null,
    });
    res.status(201).json({ success: true, data: { shareout } });
  } catch (error) {
    next(error);
  }
};

export const listShareoutsController = async (req, res, next) => {
  try {
    const shareouts = await listShareouts(req.params.id, { status: req.query.status || null });
    res.status(200).json({ success: true, data: { shareouts } });
  } catch (error) {
    next(error);
  }
};

export const getShareoutController = async (req, res, next) => {
  try {
    const shareout = await getShareoutById(req.params.id, req.params.shareoutId);
    res.status(200).json({ success: true, data: { shareout } });
  } catch (error) {
    next(error);
  }
};

export const approveShareoutController = async (req, res, next) => {
  try {
    const shareout = await approveShareout({
      chamaId: req.params.id,
      shareoutId: req.params.shareoutId,
      approved_by: req.membership._id,
      approverMembership: req.membership,
    });
    res.status(200).json({ success: true, data: { shareout } });
  } catch (error) {
    next(error);
  }
};

export const payShareoutItemController = async (req, res, next) => {
  try {
    const shareout = await payShareoutItem({
      chamaId: req.params.id,
      shareoutId: req.params.shareoutId,
      itemId: req.params.itemId,
      disbursement_method: req.body.disbursement_method,
      external_reference: req.body.external_reference || null,
      posted_by: req.user._id,
    });
    res.status(200).json({ success: true, data: { shareout } });
  } catch (error) {
    next(error);
  }
};

export const cancelShareoutController = async (req, res, next) => {
  try {
    const shareout = await cancelShareout({
      chamaId: req.params.id,
      shareoutId: req.params.shareoutId,
      cancelled_by: req.user._id,
    });
    res.status(200).json({ success: true, data: { shareout } });
  } catch (error) {
    next(error);
  }
};