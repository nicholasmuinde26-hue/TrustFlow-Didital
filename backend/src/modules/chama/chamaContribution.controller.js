import * as chamaContributionService from "./chamaContribution.service.js";

// ========================================
// CREATE
// ========================================
// Any active member may propose one. It stays `pending_approval` until an
// official signs off (see approveController below).
export const createController = async (req, res, next) => {
  try {
    const contribution = await chamaContributionService.createContribution({
      chamaId: req.params.id,
      membership: req.membership,
      data: req.body,
    });
    res.status(201).json({ success: true, data: { contribution } });
  } catch (error) {
    next(error);
  }
};

// ========================================
// LIST / GET
// ========================================

export const listController = async (req, res, next) => {
  try {
    const contributions = await chamaContributionService.listContributions(req.params.id, {
      status: req.query.status || null,
    });
    res.status(200).json({ success: true, data: { contributions } });
  } catch (error) {
    next(error);
  }
};

export const getController = async (req, res, next) => {
  try {
    const contribution = await chamaContributionService.getContribution(req.params.id, req.params.contributionId);
    res.status(200).json({ success: true, data: { contribution } });
  } catch (error) {
    next(error);
  }
};

// ========================================
// APPROVE / REJECT (officials only)
// ========================================

export const approveController = async (req, res, next) => {
  try {
    const contribution = await chamaContributionService.approveContribution({
      chamaId: req.params.id,
      contributionId: req.params.contributionId,
      approverMembership: req.membership,
    });
    res.status(200).json({ success: true, data: { contribution } });
  } catch (error) {
    next(error);
  }
};

export const rejectController = async (req, res, next) => {
  try {
    const contribution = await chamaContributionService.rejectContribution({
      chamaId: req.params.id,
      contributionId: req.params.contributionId,
      approverMembership: req.membership,
      reason: req.body?.reason,
    });
    res.status(200).json({ success: true, data: { contribution } });
  } catch (error) {
    next(error);
  }
};

// ========================================
// CHIP IN (any active member, free-form amount, M-Pesa)
// ========================================

export const contributeController = async (req, res, next) => {
  try {
    const result = await chamaContributionService.contribute({
      chamaId: req.params.id,
      contributionId: req.params.contributionId,
      membership: req.membership,
      amount: req.body?.amount,
      phoneNumber: req.body?.phone_number || req.body?.phoneNumber,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// ========================================
// RECORD CASH CHIP-IN ON BEHALF OF A MEMBER (officials only)
// ========================================

export const recordCashController = async (req, res, next) => {
  try {
    const result = await chamaContributionService.recordCashContribution({
      chamaId: req.params.id,
      contributionId: req.params.contributionId,
      actorMembership: req.membership,
      memberId: req.body?.member_id,
      amount: req.body?.amount,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// ========================================
// CLOSE COLLECTION (officials only)
// ========================================

export const closeCollectionController = async (req, res, next) => {
  try {
    const contribution = await chamaContributionService.closeCollection({
      chamaId: req.params.id,
      contributionId: req.params.contributionId,
      actorMembership: req.membership,
    });
    res.status(200).json({ success: true, data: { contribution } });
  } catch (error) {
    next(error);
  }
};

// ========================================
// PROPOSE PAYOUT (officials only) -> multi-role ApprovalRequest
// ========================================

export const proposePayoutController = async (req, res, next) => {
  try {
    const result = await chamaContributionService.proposePayout({
      chamaId: req.params.id,
      contributionId: req.params.contributionId,
      actorMembership: req.membership,
      disbursementMethod: req.body?.disbursement_method,
      phoneNumber: req.body?.phone_number,
      notes: req.body?.notes,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// ========================================
// DISBURSE (officials only, once approved)
// ========================================

export const disburseController = async (req, res, next) => {
  try {
    const contribution = await chamaContributionService.disburse({
      chamaId: req.params.id,
      contributionId: req.params.contributionId,
      actorMembership: req.membership,
    });
    res.status(200).json({ success: true, data: { contribution } });
  } catch (error) {
    next(error);
  }
};

// ========================================
// CANCEL (officials only)
// ========================================

export const cancelController = async (req, res, next) => {
  try {
    const contribution = await chamaContributionService.cancelContribution({
      chamaId: req.params.id,
      contributionId: req.params.contributionId,
      actorMembership: req.membership,
      reason: req.body?.reason,
    });
    res.status(200).json({ success: true, data: { contribution } });
  } catch (error) {
    next(error);
  }
};
