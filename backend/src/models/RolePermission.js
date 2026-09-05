import mongoose from 'mongoose';

// ========================================
// ROLE PERMISSION SCHEMA
// ========================================
//
// Maps roles to permissions with scope overrides
// and committee-specific assignments.
//
// This enables:
// - Role-based permission assignment
// - Scope overrides per role
// - Committee-specific permission delegation
// - Temporary permission grants with expiration
//
// ========================================

const ROLE_TYPES = ['member', 'treasurer', 'secretary', 'auditor', 'chairperson', 'committee_member', 'patron'];

const COMMITTEE_TYPES = ['finance', 'welfare', 'investment', 'discipline', 'general', null];

const SCOPE_TYPES = ['all', 'own', 'committee', 'none', 'limited'];

const rolePermissionSchema = new mongoose.Schema({
  chama_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chama',
    required: true,
    index: true
  },

  role: {
    type: String,
    enum: ROLE_TYPES,
    required: true,
    index: true
  },

  permission_key: {
    type: String,
    required: true,
    index: true
  },

  // Scope override for this role (overrides default permission scope)
  scope_override: {
    type: String,
    enum: SCOPE_TYPES,
    default: null
  },

  // Committee-specific assignment
  committee_type: {
    type: String,
    enum: COMMITTEE_TYPES,
    default: null
  },

  granted_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChamaMembership'
  },

  granted_at: {
    type: Date,
    default: Date.now
  },

  expires_at: {
    type: Date,
    default: null
  },

  status: {
    type: String,
    enum: ['active', 'revoked', 'expired'],
    default: 'active'
  }
}, {
  timestamps: true
});

// ========================================
// INDEXES
// ========================================

// Unique constraint: one role-permission mapping per chama
rolePermissionSchema.index(
  { chama_id: 1, role: 1, permission_key: 1 },
  { unique: true, name: 'unique_role_permission_mapping' }
);

// Index for active role permissions by chama
rolePermissionSchema.index({ chama_id: 1, role: 1, status: 1 });

// Index for committee-specific permissions
rolePermissionSchema.index({ chama_id: 1, committee_type: 1, status: 1 });

// Index for expired permissions cleanup
rolePermissionSchema.index({ expires_at: 1, status: 1 });

// ========================================
// VALIDATION
// ========================================

rolePermissionSchema.pre('save', function(next) {
  // Check expiration
  if (this.expires_at && this.expires_at < new Date() && this.status === 'active') {
    this.status = 'expired';
  }

  // If committee_type is specified, ensure role is committee_member or compatible
  if (this.committee_type && this.role !== 'committee_member' && this.role !== 'chairperson') {
    if (typeof next === 'function') {
      return next(new Error('Committee-specific permissions can only be assigned to committee members or chairperson'));
    } else {
      throw new Error('Committee-specific permissions can only be assigned to committee members or chairperson');
    }
  }

  // Validate scope override compatibility with permission
  if (this.scope_override === 'none' && this.status === 'active') {
    this.status = 'revoked';
  }

  if (typeof next === 'function') {
    next();
  }
});

// ========================================
// METHODS
// ========================================

// Check if permission is currently valid
rolePermissionSchema.methods.isValid = function() {
  if (this.status !== 'active') return false;
  if (this.expires_at && this.expires_at < new Date()) return false;
  return true;
};

// Check if permission matches committee type
rolePermissionSchema.methods.matchesCommittee = function(committeeType) {
  if (!this.committee_type) return true; // Not committee-specific
  return this.committee_type === committeeType;
};

// ========================================
// MODEL
// ========================================

const RolePermission = mongoose.models.RolePermission ||
  mongoose.model('RolePermission', rolePermissionSchema);

export default RolePermission;