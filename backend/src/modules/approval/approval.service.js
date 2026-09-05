import ApprovalRequest from '../../models/ApprovalRequest.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import Committee from '../../models/Committee.js';
import permissionService from '../../services/permission.service.js';

class ApprovalService {
  /**
   * Create a new approval request with enhanced permission context
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
    permissionKey = null,
    requiredCommittee = null,
    workflowStages = [],
    expiresAt = null,
    metadata = {}
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
      permission_key: permissionKey,
      committee_context: {
        required_committee: requiredCommittee,
        committee_approvals: requiredCommittee ? await this.setupCommitteeApprovals(chamaId, requiredCommittee) : []
      },
      workflow_stages: workflowStages,
      current_stage: workflowStages.length > 0 ? 0 : 0,
      expires_at: expiresAt,
      metadata,
      status: 'pending',
    });

    // Perform self-action checks
    await this.performSelfActionChecks(request, initiatedByMembershipId);

    // Detect conflicts of interest
    await this.detectConflicts(request, chamaId, initiatedByMembershipId);

    return request;
  }

  /**
   * Setup committee approval configuration
   */
  async setupCommitteeApprovals(chamaId, committeeType) {
    try {
      const committee = await Committee.getCommitteeByType(chamaId, committeeType);
      if (!committee) {
        return [];
      }

      return [{
        committee_id: committee._id,
        committee_type: committeeType,
        required_votes: Math.ceil(committee.members.length * committee.settings.decision_threshold),
        current_votes: 0,
        status: 'pending'
      }];
    } catch (error) {
      console.error('Setup committee approvals error:', error);
      return [];
    }
  }

  /**
   * Perform self-action prevention checks
   */
  async performSelfActionChecks(request, initiatorId) {
    const initiator = await ChamaMembership.findById(initiatorId);
    if (!initiator) return;

    // Check if this is a self-initiated action that should be blocked
    const selfActionCheckTypes = [
      {
        type: 'initiator_approval',
        shouldBlock: !request.allow_initiator_approval
      },
      {
        type: 'financial_benefit',
        shouldBlock: ['LOAN_DISBURSEMENT', 'MGR_PAYOUT', 'WITHDRAWAL'].includes(request.resource_type)
      }
    ];

    for (const checkType of selfActionCheckTypes) {
      if (checkType.shouldBlock) {
        await request.addSelfActionCheck({
          check_type: checkType.type,
          membership_id: initiatorId,
          role: initiator.role,
          blocked: true,
          reason: `Self-action prevention: ${checkType.type}`
        });
      }
    }
  }

  /**
   * Detect conflicts of interest
   */
  async detectConflicts(request, chamaId, initiatorId) {
    const initiator = await ChamaMembership.findById(initiatorId);
    if (!initiator) return;

    // Check for self-initiated financial benefit
    if (['LOAN_DISBURSEMENT', 'MGR_PAYOUT', 'WITHDRAWAL'].includes(request.resource_type)) {
      await request.addConflict({
        membership_id: initiatorId,
        role: initiator.role,
        conflict_type: 'self_initiated',
        resolution: 'pending'
      });
    }

    // Check for committee membership conflicts
    if (request.committee_context.required_committee) {
      const committee = await Committee.getCommitteeByType(chamaId, request.committee_context.required_committee);
      if (committee && committee.isMember(initiatorId)) {
        await request.addConflict({
          membership_id: initiatorId,
          role: initiator.role,
          conflict_type: 'financial_interest',
          resolution: 'pending'
        });
      }
    }
  }

  /**
   * Submit sign-off (approve or reject) for an approval request with enhanced checks
   */
  async submitSignoff({ requestId, approverMembershipId, status, comment = '', ipAddress, userAgent }) {
    const request = await ApprovalRequest.findById(requestId);
    if (!request) throw new Error('Approval request not found');
    if (request.status !== 'pending') throw new Error(`Request is already ${request.status}`);

    // Check expiration
    if (request.isExpired()) {
      throw new Error('This approval request has expired');
    }

    const membership = await ChamaMembership.findById(approverMembershipId);
    if (!membership) throw new Error('Approver membership not found');

    // Check if initiator is trying to approve their own request
    if (
      !request.allow_initiator_approval &&
      String(request.initiated_by) === String(approverMembershipId)
    ) {
      await request.logPermissionCheck({
        check_type: 'self_action_prevention',
        membership_id: approverMembershipId,
        role: membership.role,
        permission_key: request.permission_key,
        result: 'self_action_blocked',
        reason: 'Initiator cannot approve their own request'
      });

      throw new Error('Initiator is not permitted to approve their own request under Chama separation-of-duties policy.');
    }

    // Check if role is eligible
    const userRole = membership.role?.toLowerCase();
    if (!request.eligible_roles.map((r) => r.toLowerCase()).includes(userRole)) {
      await request.logPermissionCheck({
        check_type: 'role_eligibility',
        membership_id: approverMembershipId,
        role: membership.role,
        permission_key: request.permission_key,
        result: 'denied',
        reason: `Role '${membership.role}' is not eligible to sign off on this request`
      });

      throw new Error(`Role '${membership.role}' is not eligible to sign off on this request.`);
    }

    // Check for conflicts of interest
    if (request.conflict_management.has_conflicts) {
      const conflict = request.conflict_management.detected_conflicts.find(
        c => String(c.membership_id) === String(approverMembershipId)
      );

      if (conflict && conflict.resolution !== 'waived') {
        await request.logPermissionCheck({
          check_type: 'conflict_of_interest',
          membership_id: approverMembershipId,
          role: membership.role,
          permission_key: request.permission_key,
          result: 'denied',
          reason: 'Conflict of interest detected'
        });

        throw new Error('Cannot approve due to conflict of interest');
      }
    }

    // Check committee requirement
    if (request.committee_context.required_committee) {
      const committee = await Committee.getCommitteeByType(request.chama_id, request.committee_context.required_committee);
      if (committee && !committee.isMember(approverMembershipId) && membership.role !== 'chairperson') {
        await request.logPermissionCheck({
          check_type: 'committee_membership',
          membership_id: approverMembershipId,
          role: membership.role,
          permission_key: request.permission_key,
          result: 'denied',
          reason: `Must be a member of ${request.committee_context.required_committee} committee`
        });

        throw new Error(`Must be a member of ${request.committee_context.required_committee} committee to approve`);
      }
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

    // Log the permission check
    await request.logPermissionCheck({
      check_type: 'approval',
      membership_id: approverMembershipId,
      role: membership.role,
      permission_key: request.permission_key,
      result: status === 'approved' ? 'granted' : 'denied',
      reason: comment
    });

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

  /**
   * Get pending approvals for a specific membership
   */
  async getPendingApprovalsForMembership(membershipId) {
    const membership = await ChamaMembership.findById(membershipId);
    if (!membership) {
      throw new Error('Membership not found');
    }

    const query = {
      status: 'pending',
      eligible_roles: membership.role
    };

    // Exclude requests already approved by this member
    const requests = await ApprovalRequest.find(query)
      .populate('initiated_by')
      .populate('approvals.approver_id')
      .sort({ createdAt: -1 });

    // Filter out requests where this member has already approved
    return requests.filter(request =>
      !request.approvals.some(approval =>
        String(approval.approver_id) === String(membershipId)
      )
    );
  }

  /**
   * Resolve conflict for a specific membership
   */
  async resolveConflict(requestId, membershipId, resolution) {
    const request = await ApprovalRequest.findById(requestId);
    if (!request) {
      throw new Error('Approval request not found');
    }

    await request.resolveConflict(membershipId, resolution);
    return request;
  }

  /**
   * Escalate workflow to next stage
   */
  async escalateWorkflow(requestId, fromStage, toStage, escalatedBy, reason) {
    const request = await ApprovalRequest.findById(requestId);
    if (!request) {
      throw new Error('Approval request not found');
    }

    await request.escalateWorkflow(fromStage, toStage, escalatedBy, reason);
    return request;
  }

  /**
   * Add workflow stage to approval request
   */
  async addWorkflowStage(requestId, stageData) {
    const request = await ApprovalRequest.findById(requestId);
    if (!request) {
      throw new Error('Approval request not found');
    }

    await request.addWorkflowStage(stageData);
    return request;
  }

  /**
   * Process committee approval
   */
  async processCommitteeApproval(requestId, committeeId, decision, voterMembershipId) {
    const request = await ApprovalRequest.findById(requestId);
    if (!request) {
      throw new Error('Approval request not found');
    }

    const committeeApproval = request.committee_context.committee_approvals.find(
      ca => String(ca.committee_id) === String(committeeId)
    );

    if (!committeeApproval) {
      throw new Error('Committee approval not found for this request');
    }

    // Update committee approval status
    if (decision === 'approved') {
      committeeApproval.current_votes++;
    } else if (decision === 'rejected') {
      committeeApproval.status = 'rejected';
    }

    // Check if committee approval is complete
    if (committeeApproval.current_votes >= committeeApproval.required_votes) {
      committeeApproval.status = 'approved';
    }

    await request.save();
    return request;
  }

  /**
   * Check and cleanup expired approval requests
   */
  async cleanupExpiredRequests() {
    return await ApprovalRequest.cleanupExpired();
  }

  /**
   * Get conflicted approval requests for a chama
   */
  async getConflictedRequests(chamaId) {
    return await ApprovalRequest.getConflictedRequests(chamaId);
  }

  /**
   * Get approval requests by permission key
   */
  async getRequestsByPermission(chamaId, permissionKey) {
    return await ApprovalRequest.getByPermissionKey(chamaId, permissionKey);
  }

  /**
   * Cancel approval request
   */
  async cancelRequest(requestId, cancelledBy, reason = '') {
    const request = await ApprovalRequest.findById(requestId);
    if (!request) {
      throw new Error('Approval request not found');
    }

    if (request.status !== 'pending') {
      throw new Error(`Cannot cancel request in ${request.status} status`);
    }

    request.status = 'cancelled';
    request.resolved_at = new Date();

    // Log the cancellation
    await request.logPermissionCheck({
      check_type: 'cancellation',
      membership_id: cancelledBy,
      role: 'unknown', // Would need to fetch membership
      permission_key: request.permission_key,
      result: 'denied',
      reason: reason || 'Request cancelled'
    });

    await request.save();
    return request;
  }

  /**
   * Add alternative approver for conflict resolution
   */
  async addAlternativeApprover(requestId, originalRole, alternativeMembershipId) {
    const request = await ApprovalRequest.findById(requestId);
    if (!request) {
      throw new Error('Approval request not found');
    }

    request.conflict_management.alternative_approvers.push({
      original_role: originalRole,
      alternative_membership_id: alternativeMembershipId,
      assigned_at: new Date()
    });

    await request.save();
    return request;
  }
}

export default new ApprovalService();
