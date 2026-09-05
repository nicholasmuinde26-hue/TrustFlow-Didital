import mongoose from 'mongoose';

/**
 * ============================================================================
 * APPROVAL REQUEST SCHEMA
 * ============================================================================
 *
 * Generic, reusable approval workflow service for ChamaManager.
 * Supports multi-role sign-offs (Treasurer initiates, Secretary reviews,
 * Chairperson approves) and enforces separation of financial custody & authority.
 * Can be reused for MGR Payouts, Loan Disbursements, Withdrawals, Expenses, etc.
 * ============================================================================
 */

const approvalRequestSchema = new mongoose.Schema(
  {
    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chama',
      required: true,
      index: true,
    },

    resource_type: {
      type: String,
      enum: ['MGR_PAYOUT', 'LOAN_DISBURSEMENT', 'WITHDRAWAL', 'EXPENSE', 'INVESTMENT', 'POLICY_CHANGE'],
      required: true,
      index: true,
    },

    resource_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    action: {
      type: String,
      required: true,
      default: 'DISBURSE',
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: '',
    },

    amount: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },

    initiated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChamaMembership',
      required: true,
    },

    required_approvals: {
      type: Number,
      default: 2,
      min: 1,
    },

    eligible_roles: {
      type: [String],
      enum: ['chairperson', 'secretary', 'treasurer', 'vice_chairperson', 'member'],
      default: ['chairperson', 'secretary', 'treasurer'],
    },

    allow_initiator_approval: {
      type: Boolean,
      default: false,
    },

    approvals: [
      {
        approver_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ChamaMembership',
          required: true,
        },
        role: {
          type: String,
          required: true,
        },
        status: {
          type: String,
          enum: ['approved', 'rejected', 'reviewed'],
          required: true,
        },
        comment: {
          type: String,
          default: '',
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },

    resolved_at: {
      type: Date,
      default: null,
    },

    // ========================================
    // ENHANCED PERMISSION CONTEXT
    // ========================================
    
    permission_key: {
      type: String,
      default: null,
    },

    // Self-action prevention
    self_action_prevented: {
      type: Boolean,
      default: false,
    },

    self_action_checks: [{
      check_type: {
        type: String,
        enum: ['initiator_approval', 'financial_benefit', 'role_change', 'other']
      },
      membership_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChamaMembership'
      },
      role: String,
      blocked: {
        type: Boolean,
        default: true
      },
      reason: String,
      checked_at: {
        type: Date,
        default: Date.now
      }
    }],

    // Conflict of interest handling
    conflict_management: {
      has_conflicts: {
        type: Boolean,
        default: false
      },
      detected_conflicts: [{
        membership_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ChamaMembership'
        },
        role: String,
        conflict_type: {
          type: String,
          enum: ['self_initiated', 'financial_interest', 'family_relation', 'other']
        },
        detected_at: {
          type: Date,
          default: Date.now
        },
        resolution: {
          type: String,
          enum: ['recused', 'alternative_approver', 'waived', 'pending'],
          default: 'pending'
        }
      }],
      alternative_approvers: [{
        original_role: String,
        alternative_membership_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ChamaMembership'
        },
        assigned_at: {
          type: Date,
          default: Date.now
        }
      }]
    },

    // Committee context for committee-based approvals
    committee_context: {
      required_committee: {
        type: String,
        enum: ['finance', 'welfare', 'investment', 'discipline', 'general', null],
        default: null
      },
      committee_approvals: [{
        committee_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Committee'
        },
        committee_type: String,
        required_votes: Number,
        current_votes: Number,
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending'
        }
      }]
    },

    // Permission check audit trail
    permission_check_log: [{
      check_type: String,
      membership_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChamaMembership'
      },
      role: String,
      permission_key: String,
      result: {
        type: String,
        enum: ['granted', 'denied', 'self_action_blocked', 'scope_denied']
      },
      reason: String,
      checked_at: {
        type: Date,
        default: Date.now
      }
    }],

    // Workflow stage tracking for multi-stage approvals
    workflow_stages: [{
      stage_name: String,
      stage_order: Number,
      required_roles: [String],
      required_committee: String,
      required_approvals: Number,
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'skipped', 'failed'],
        default: 'pending'
      },
      started_at: Date,
      completed_at: Date,
      approvals: [{
        approver_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ChamaMembership'
        },
        role: String,
        decision: {
          type: String,
          enum: ['approved', 'rejected', 'abstained', 'recused']
        },
        comment: String,
        decided_at: {
          type: Date,
          default: Date.now
        }
      }]
    }],

    current_stage: {
      type: Number,
      default: 0
    },

    // Escalation tracking
    escalations: [{
      from_stage: Number,
      to_stage: Number,
      escalated_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChamaMembership'
      },
      reason: String,
      escalated_at: {
        type: Date,
        default: Date.now
      }
    }],

    // Expiration for time-sensitive approvals
    expires_at: {
      type: Date,
      default: null
    },

    // Request metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

// ========================================
// INDEXES FOR ENHANCED APPROVAL SYSTEM
// ========================================

// Index for permission-based lookups
approvalRequestSchema.index({ chama_id: 1, permission_key: 1, status: 1 });

// Index for committee-based approvals
approvalRequestSchema.index({ 'committee_context.required_committee': 1, status: 1 });

// Index for conflict tracking
approvalRequestSchema.index({ 'conflict_management.has_conflicts': 1, status: 1 });

// Index for self-action prevention tracking
approvalRequestSchema.index({ self_action_prevented: 1, status: 1 });

// Index for expiration tracking
approvalRequestSchema.index({ expires_at: 1, status: 1 });

// Index for workflow stage tracking
approvalRequestSchema.index({ current_stage: 1, status: 1 });

// Index for committee approval tracking
approvalRequestSchema.index({ 'committee_context.committee_approvals.committee_id': 1, status: 1 });

// ========================================
// VALIDATION HOOKS
// ========================================

approvalRequestSchema.pre('save', function(next) {
  // Check expiration
  if (this.expires_at && this.expires_at < new Date() && this.status === 'pending') {
    this.status = 'cancelled';
    this.resolved_at = new Date();
  }

  // Validate committee approval requirements
  if (this.committee_context.required_committee && !this.committee_context.committee_approvals.length) {
    return next(new Error('Committee approval requires committee_approvals configuration'));
  }

  // Ensure workflow stages are properly ordered
  if (this.workflow_stages.length > 0) {
    this.workflow_stages.sort((a, b) => a.stage_order - b.stage_order);
  }

  next();
});

// ========================================
// INSTANCE METHODS
// ========================================

// Check if approval request has expired
approvalRequestSchema.methods.isExpired = function() {
  if (!this.expires_at) return false;
  return this.expires_at < new Date();
};

// Check if specific membership can approve
approvalRequestSchema.methods.canApprove = function(membershipId, membershipRole) {
  // Check if self-action is prevented
  if (this.self_action_prevented) {
    const selfActionCheck = this.self_action_checks.find(
      check => String(check.membership_id) === String(membershipId)
    );
    if (selfActionCheck && selfActionCheck.blocked) {
      return { canApprove: false, reason: selfActionCheck.reason };
    }
  }

  // Check conflict of interest
  if (this.conflict_management.has_conflicts) {
    const conflict = this.conflict_management.detected_conflicts.find(
      c => String(c.membership_id) === String(membershipId)
    );
    if (conflict && conflict.resolution !== 'waived') {
      return { canApprove: false, reason: 'Conflict of interest detected' };
    }
  }

  // Check if role is eligible
  if (!this.eligible_roles.includes(membershipRole)) {
    return { canApprove: false, reason: 'Role is not eligible for approval' };
  }

  // Check if already approved
  const alreadyApproved = this.approvals.some(
    approval => String(approval.approver_id) === String(membershipId)
  );
  if (alreadyApproved) {
    return { canApprove: false, reason: 'Already approved this request' };
  }

  return { canApprove: true };
};

// Add approval to request
approvalRequestSchema.methods.addApproval = function(membershipId, role, status, comment = '') {
  this.approvals.push({
    approver_id: membershipId,
    role,
    status,
    comment,
    timestamp: new Date()
  });

  // Log permission check
  this.permission_check_log.push({
    check_type: 'approval',
    membership_id: membershipId,
    role,
    permission_key: this.permission_key,
    result: status === 'approved' ? 'granted' : 'denied',
    reason: comment,
    checked_at: new Date()
  });

  return this.save();
};

// Check if required approvals are met
approvalRequestSchema.methods.checkApprovalCompletion = function() {
  const approvedCount = this.approvals.filter(
    approval => approval.status === 'approved'
  ).length;

  if (approvedCount >= this.required_approvals) {
    this.status = 'approved';
    this.resolved_at = new Date();
    return this.save();
  }

  return this;
};

// Check committee approval status
approvalRequestSchema.methods.checkCommitteeApproval = function() {
  if (!this.committee_context.committee_approvals.length) {
    return { completed: true, reason: 'No committee approval required' };
  }

  const allApproved = this.committee_context.committee_approvals.every(
    committee => committee.status === 'approved'
  );

  if (allApproved) {
    return { completed: true, reason: 'All committee approvals completed' };
  }

  const anyRejected = this.committee_context.committee_approvals.some(
    committee => committee.status === 'rejected'
  );

  if (anyRejected) {
    return { completed: false, reason: 'Committee approval rejected' };
  }

  return { completed: false, reason: 'Pending committee approvals' };
};

// Log permission check
approvalRequestSchema.methods.logPermissionCheck = function(checkData) {
  this.permission_check_log.push({
    ...checkData,
    checked_at: new Date()
  });
  return this.save();
};

// Add self-action check
approvalRequestSchema.methods.addSelfActionCheck = function(checkData) {
  this.self_action_checks.push({
    ...checkData,
    checked_at: new Date()
  });

  if (checkData.blocked) {
    this.self_action_prevented = true;
  }

  return this.save();
};

// Add conflict detection
approvalRequestSchema.methods.addConflict = function(conflictData) {
  this.conflict_management.detected_conflicts.push({
    ...conflictData,
    detected_at: new Date()
  });

  this.conflict_management.has_conflicts = true;
  return this.save();
};

// Resolve conflict
approvalRequestSchema.methods.resolveConflict = function(membershipId, resolution) {
  const conflict = this.conflict_management.detected_conflicts.find(
    c => String(c.membership_id) === String(membershipId)
  );

  if (conflict) {
    conflict.resolution = resolution;
  }

  // Check if all conflicts are resolved
  const allResolved = this.conflict_management.detected_conflicts.every(
    c => c.resolution !== 'pending'
  );

  if (allResolved) {
    this.conflict_management.has_conflicts = false;
  }

  return this.save();
};

// Add workflow stage
approvalRequestSchema.methods.addWorkflowStage = function(stageData) {
  this.workflow_stages.push({
    ...stageData,
    status: 'pending'
  });
  return this.save();
};

// Advance to next workflow stage
approvalRequestSchema.methods.advanceWorkflowStage = function() {
  if (this.current_stage < this.workflow_stages.length - 1) {
    this.workflow_stages[this.current_stage].status = 'completed';
    this.workflow_stages[this.current_stage].completed_at = new Date();
    this.current_stage++;
    this.workflow_stages[this.current_stage].status = 'in_progress';
    this.workflow_stages[this.current_stage].started_at = new Date();
    return this.save();
  }
  return this;
};

// Escalate workflow
approvalRequestSchema.methods.escalateWorkflow = function(fromStage, toStage, escalatedBy, reason) {
  this.escalations.push({
    from_stage: fromStage,
    to_stage: toStage,
    escalated_by: escalatedBy,
    reason,
    escalated_at: new Date()
  });

  this.current_stage = toStage;
  this.workflow_stages[toStage].status = 'in_progress';
  this.workflow_stages[toStage].started_at = new Date();

  return this.save();
};

// ========================================
// STATIC METHODS
// ========================================

// Get pending approvals for a membership
approvalRequestSchema.statics.getPendingApprovals = function(membershipId) {
  return this.find({
    status: 'pending',
    eligible_roles: { $in: ['*'] }, // Would need to be populated with role
    'approvals.approver_id': { $ne: membershipId }
  }).sort({ created_at: -1 });
};

// Get approval requests by permission key
approvalRequestSchema.statics.getByPermissionKey = function(chamaId, permissionKey) {
  return this.find({
    chama_id: chamaId,
    permission_key: permissionKey
  }).sort({ created_at: -1 });
};

// Get conflicted approval requests
approvalRequestSchema.statics.getConflictedRequests = function(chamaId) {
  return this.find({
    chama_id: chamaId,
    'conflict_management.has_conflicts': true,
    status: 'pending'
  }).sort({ created_at: -1 });
};

// Get expired approval requests
approvalRequestSchema.statics.getExpiredRequests = function() {
  return this.find({
    expires_at: { $lt: new Date() },
    status: 'pending'
  });
};

// Cleanup expired requests
approvalRequestSchema.statics.cleanupExpired = async function() {
  const expired = await this.getExpiredRequests();
  const results = [];

  for (const request of expired) {
    request.status = 'cancelled';
    request.resolved_at = new Date();
    await request.save();
    results.push(request._id);
  }

  return results;
};

approvalRequestSchema.set('toJSON', {
  transform: (_doc, ret) => {
    if (ret.amount !== undefined && ret.amount !== null) {
      ret.amount = ret.amount.toString();
    }
    return ret;
  },
});

export default mongoose.models.ApprovalRequest || mongoose.model('ApprovalRequest', approvalRequestSchema);
