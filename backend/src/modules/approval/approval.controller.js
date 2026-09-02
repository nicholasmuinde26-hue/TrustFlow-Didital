import approvalService from './approval.service.js';
import ChamaMembership from '../../models/ChamaMembership.js';

export async function getChamaApprovals(req, res, next) {
  try {
    const { chamaId } = req.params;
    const { status } = req.query;
    const requests = await approvalService.getChamaRequests(chamaId, status);
    return res.status(200).json({ success: true, data: requests });
  } catch (error) {
    return next(error);
  }
}

export async function getApprovalById(req, res, next) {
  try {
    const { requestId } = req.params;
    const request = await approvalService.getRequestById(requestId);
    if (!request) return res.status(404).json({ success: false, message: 'Approval request not found' });
    return res.status(200).json({ success: true, data: request });
  } catch (error) {
    return next(error);
  }
}

export async function submitSignoff(req, res, next) {
  try {
    const { requestId } = req.params;
    const { status, comment } = req.body;
    const userId = req.user._id || req.user.id;

    // Resolve user's ChamaMembership for this request
    const request = await approvalService.getRequestById(requestId);
    if (!request) return res.status(404).json({ success: false, message: 'Approval request not found' });

    const membership = await ChamaMembership.findOne({
      chama_id: request.chama_id,
      user_id: userId,
    });

    if (!membership) {
      return res.status(403).json({ success: false, message: 'You are not a member of this Chama' });
    }

    const updated = await approvalService.submitSignoff({
      requestId,
      approverMembershipId: membership._id,
      status,
      comment,
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}
