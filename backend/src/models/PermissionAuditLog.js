import mongoose from 'mongoose';

// ========================================
// PERMISSION AUDIT LOG SCHEMA
// ========================================
//
// Comprehensive audit trail for all permission-related
// activities including grants, revokes, role changes,
// committee assignments, and scope modifications.
//
// This ensures accountability and supports compliance
// requirements for chama governance.
//
// ========================================

const AUDIT_ACTIONS = [
  'permission_granted',
  'permission_revoked',
  'role_assigned',
  'role_changed',
  'committee_created',
  'committee_member_added',
  'committee_member_removed',
  'scope_changed',
  'approval_requirement_changed',
  'self_action_blocked',
  'permission_check_denied',
  'permission_check_granted'
];

const TARGET_TYPES = ['role', 'permission', 'committee', 'membership', 'resource'];

const permissionAuditLogSchema = new mongoose.Schema({
  chama_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chama',
    required: true,
    index: true
  },

  actor_membership_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChamaMembership',
    required: true,
    index: true
  },

  actor_role: {
    type: String,
    required: true
  },

  action: {
    type: String,
    enum: AUDIT_ACTIONS,
    required: true,
    index: true
  },

  target_type: {
    type: String,
    enum: TARGET_TYPES,
    required: true
  },

  target_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },

  target_description: {
    type: String,
    default: ''
  },

  // State changes
  before_state: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },

  after_state: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },

  // Additional context
  permission_key: {
    type: String,
    default: null
  },

  resource_type: {
    type: String,
    default: null
  },

  resource_id: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },

  // Reason for the action
  reason: {
    type: String,
    default: ''
  },

  // Request metadata
  ip_address: {
    type: String,
    default: null
  },

  user_agent: {
    type: String,
    default: null
  },

  // Result of permission check (for check actions)
  check_result: {
    type: String,
    enum: ['granted', 'denied', 'self_action_blocked', 'scope_denied', 'role_denied'],
    default: null
  },

  denial_reason: {
    type: String,
    default: null
  },

  created_at: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false // Only use created_at, not updated_at
});

// ========================================
// INDEXES
// ========================================

// Index for chama audit trails
permissionAuditLogSchema.index({ chama_id: 1, created_at: -1 });

// Index for actor-based audit trails
permissionAuditLogSchema.index({ actor_membership_id: 1, created_at: -1 });

// Index for action-based filtering
permissionAuditLogSchema.index({ chama_id: 1, action: 1, created_at: -1 });

// Index for target-based filtering
permissionAuditLogSchema.index({ target_type: 1, target_id: 1, created_at: -1 });

// Index for permission-specific audit trails
permissionAuditLogSchema.index({ chama_id: 1, permission_key: 1, created_at: -1 });

// Index for denial tracking (security monitoring)
permissionAuditLogSchema.index({ check_result: 1, created_at: -1 });

// ========================================
// IMMUTABILITY PROTECTION
// ========================================
//
// Audit records must never be modified or deleted
// to maintain historical integrity.
//
// ========================================

// Block all update operations
permissionAuditLogSchema.pre('findOneAndUpdate', function() {
  throw new Error('Permission audit logs are immutable and cannot be updated');
});

permissionAuditLogSchema.pre('updateOne', function() {
  throw new Error('Permission audit logs are immutable and cannot be updated');
});

permissionAuditLogSchema.pre('updateMany', function() {
  throw new Error('Permission audit logs are immutable and cannot be updated');
});

// Block all delete operations
permissionAuditLogSchema.pre('findOneAndDelete', function() {
  throw new Error('Permission audit logs are immutable and cannot be deleted');
});

permissionAuditLogSchema.pre('deleteOne', function() {
  throw new Error('Permission audit logs are immutable and cannot be deleted');
});

permissionAuditLogSchema.pre('deleteMany', function() {
  throw new Error('Permission audit logs are immutable and cannot be deleted');
});

// ========================================
// STATIC METHODS
// ========================================

// Get audit logs for a chama
permissionAuditLogSchema.statics.getChamaAuditLogs = function(chamaId, options = {}) {
  const {
    action,
    actorId,
    permissionKey,
    limit = 100,
    skip = 0,
    startDate,
    endDate
  } = options;

  const query = { chama_id: chamaId };

  if (action) query.action = action;
  if (actorId) query.actor_membership_id = actorId;
  if (permissionKey) query.permission_key = permissionKey;
  if (startDate) query.created_at = { $gte: new Date(startDate) };
  if (endDate) {
    if (query.created_at) {
      query.created_at.$lte = new Date(endDate);
    } else {
      query.created_at = { $lte: new Date(endDate) };
    }
  }

  return this.find(query)
    .populate('actor_membership_id')
    .sort({ created_at: -1 })
    .limit(limit)
    .skip(skip);
};

// Get security events (denials, blocks)
permissionAuditLogSchema.statics.getSecurityEvents = function(chamaId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    startDate
  } = options;

  const query = {
    chama_id: chamaId,
    check_result: { $in: ['denied', 'self_action_blocked', 'scope_denied', 'role_denied'] }
  };

  if (startDate) {
    query.created_at = { $gte: new Date(startDate) };
  }

  return this.find(query)
    .populate('actor_membership_id')
    .sort({ created_at: -1 })
    .limit(limit)
    .skip(skip);
};

// Get permission change history
permissionAuditLogSchema.statics.getPermissionHistory = function(chamaId, permissionKey) {
  return this.find({
    chama_id: chamaId,
    permission_key: permissionKey,
    action: { $in: ['permission_granted', 'permission_revoked', 'scope_changed'] }
  })
    .populate('actor_membership_id')
    .sort({ created_at: -1 });
};

// ========================================
// MODEL
// ========================================

const PermissionAuditLog = mongoose.models.PermissionAuditLog ||
  mongoose.model('PermissionAuditLog', permissionAuditLogSchema);

export default PermissionAuditLog;