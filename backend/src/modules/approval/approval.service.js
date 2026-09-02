import ApprovalRequest from '../../models/ApprovalRequest.js';
import ChamaMembership from '../../models/ChamaMembership.js';

class ApprovalService {
  /**
   * Create a new approval request
   */
  async createRequest({
    chamaId,
    resourceType,
    resourceId,
    action = 'DISBURSE',
    title,
    description = '',
    amount = null,
    initiatedByMembershipId,
    requiredApprovals = 2,
    eligibleRoles = ['chairperson', 'secretary', 'treasurer'],
    allowInitiatorApproval = false,
  }) {
    const request = await ApprovalRequest.create({
      chama_id: chamaId,
      resource_type: resourceType,
      resource_id: resourceId,
      action,
      title,
      description,
      amount,
      initiated_by: initiatedByMembershipId,
      required_approvals: requiredApprovals,
      eligible_roles: eligibleRoles,
      allow_initiator_approval: allowInitiatorApproval,
      status: 'pending',
    });

    return request;
  }

  /**
   * Submit sign-off (approve or reject) for an approval request
   */
  async submitSignoff({ requestId, approverMembershipId, status, comment = '' }) {
    const request = await ApprovalRequest.findById(requestId);
    if (!request) throw new Error('Approval request not found');
    if (request.status !== 'pending') throw new Error(`Request is already ${request.status}`);

    const membership = await ChamaMembership.findById(approverMembershipId);
    if (!membership) throw new Error('Approver membership not found');

    // Check if initiator is trying to approve their own request
    if (
      !request.allow_initiator_approval &&
      String(request.initiated_by) === String(approverMembershipId)
    ) {
      throw new Error('Initiator is not permitted to approve their own request under Chama separation-of-duties policy.');
    }

    // Check if role is eligible
    const userRole = membership.role?.toLowerCase();
    if (!request.eligible_roles.map((r) => r.toLowerCase()).includes(userRole)) {
      throw new Error(`Role '${membership.role}' is not eligible to sign off on this request.`);
    }

    // Check if already signed off by this member
    const existingIndex = request.approvals.findIndex(
      (a) => String(a.approver_id) === String(approverMembershipId)
    );

    if (existingIndex >= 0) {
      request.approvals[existingIndex].status = status;
      request.approvals[existingIndex].comment = comment;
      request.approvals[existingIndex].timestamp = new Date();
    } else {
      request.approvals.push({
        approver_id: approverMembershipId,
        role: membership.role,
        status,
        comment,
        timestamp: new Date(),
      });
    }

    // Evaluate overall status
    if (status === 'rejected') {
      request.status = 'rejected';
      request.resolved_at = new Date();
    } else {
      const validApprovedCount = request.approvals.filter((a) => a.status === 'approved').length;
      if (validApprovedCount >= request.required_approvals) {
        request.status = 'approved';
        request.resolved_at = new Date();
      }
    }

    await request.save();
    return request;
  }

  /**
   * Get approval request by ID
   */
  async getRequestById(requestId) {
    return ApprovalRequest.findById(requestId)
      .populate('initiated_by')
      .populate('approvals.approver_id');
  }

  /**
   * Get approval requests for a Chama
   */
  async getChamaRequests(chamaId, status = null) {
    const query = { chama_id: chamaId };
    if (status) query.status = status;

    return ApprovalRequest.find(query)
      .populate('initiated_by')
      .populate('approvals.approver_id')
      .sort({ createdAt: -1 });
  }
}

export default new ApprovalService();
