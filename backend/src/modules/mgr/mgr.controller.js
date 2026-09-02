import mgrService from './mgr.service.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import MgrPolicy from '../../models/MgrPolicy.js';


export async function createPolicyController(req, res, next) {
  try {
    const { chamaId } = req.params;
    const userId = req.user._id || req.user.id;
    const policy = await mgrService.createPolicy({ chamaId, userId, policyData: req.body });
    return res.status(201).json({ success: true, data: policy });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function activatePolicyController(req, res, next) {
  try {
    const { chamaId, policyId } = req.params;
    const userId = req.user._id || req.user.id;
    const result = await mgrService.activatePolicy({ chamaId, policyId, userId });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function getDashboardOverviewController(req, res, next) {
  try {
    const { chamaId } = req.params;
    const overview = await mgrService.getDashboardOverview(chamaId);
    return res.status(200).json({ success: true, data: overview });
  } catch (error) {
    return next(error);
  }
}

export async function getChamaContributionsController(req, res, next) {
  try {
    const { chamaId } = req.params;
    const result = await mgrService.getChamaContributions(chamaId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
}

export async function proposePayoutController(req, res, next) {
  try {
    const { roundId } = req.params;
    const userId = req.user._id || req.user.id;
    const { amount, disbursementMethod, phoneNumber, notes } = req.body;
    const result = await mgrService.proposePayout({
      roundId,
      treasurerUserId: userId,
      amount,
      disbursementMethod,
      phoneNumber,
      notes,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function disbursePayoutController(req, res, next) {
  try {
    const { roundId } = req.params;
    const userId = req.user._id || req.user.id;
    const result = await mgrService.disbursePayout({ roundId, actorUserId: userId });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function recordPaymentController(req, res, next) {
  try {
    const { chamaId } = req.params;
    const userId = req.user._id || req.user.id;
    const { memberId, amount, paymentMethod, phoneNumber, reference } = req.body;
    const result = await mgrService.recordMemberPayment({ chamaId, memberId, amount, paymentMethod, phoneNumber, reference, actorUserId: userId });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function reorderRotationController(req, res, next) {
  try {
    const { chamaId, policyId } = req.params;
    const userId = req.user._id || req.user.id;
    const { newOrderArray } = req.body;
    const policy = await mgrService.reorderRotation({ chamaId, policyId, newOrderArray, userId });
    return res.status(200).json({ success: true, data: policy });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

// ============================================================
// GET CHAMA MEMBERS FOR MGR WIZARD
// ============================================================
// Open to any active Chama member so the wizard can render
// the participant selection list.
// ============================================================
export async function getChamaMgrMembersController(req, res, next) {
  try {
    const { chamaId } = req.params;
    const members = await ChamaMembership.find({
      chama_id: chamaId,
      status: 'active',
    }).populate('user_id', 'name phone email').sort({ createdAt: 1 });

    return res.status(200).json({ success: true, data: members });
  } catch (error) {
    return next(error);
  }
}

// ============================================================
// UPDATE (EDIT) MGR POLICY DRAFT
// ============================================================
// Treasurer-only: allows editing a DRAFT policy before it is
// activated. Active policies cannot be edited — create a new
// version instead.
// ============================================================
export async function updatePolicyController(req, res, next) {
  try {
    const { chamaId, policyId } = req.params;
    const userId = req.user._id || req.user.id;
    const policy = await mgrService.updatePolicy({ chamaId, policyId, userId, policyData: req.body });
    return res.status(200).json({ success: true, data: policy });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function sendRemindersController(req, res, next) {
  try {
    const { roundId } = req.params;
    const userId = req.user._id || req.user.id;
    const result = await mgrService.sendReminders({ roundId, actorUserId: userId });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}