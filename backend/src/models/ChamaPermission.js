import mongoose from 'mongoose';

// ========================================
// CHAMA PERMISSION SCHEMA
// ========================================
//
// Central permission definitions for Chama-level
// access control following the architecture:
// ROLE + PERMISSION + RESOURCE + ACTION + SCOPE + APPROVAL
//
// ========================================

const PERMISSION_KEYS = [
  // Member permissions
  'members.view',
  'members.view_sensitive',
  'members.create',
  'members.update',
  'members.suspend',
  'members.remove',

  // Meeting permissions
  'meetings.view',
  'meetings.create',
  'meetings.manage',
  'meetings.close',

  // Minutes permissions
  'minutes.create',
  'minutes.edit',
  'minutes.publish',

  // Contribution permissions
  'contributions.view',
  'contributions.record',
  'contributions.reconcile',
  'contributions.adjust',

  // Loan permissions
  'loans.view',
  'loans.apply',
  'loans.review',
  'loans.approve',
  'loans.reject',
  'loans.disburse',
  'loans.restructure',

  // Expense permissions
  'expenses.view',
  'expenses.create',
  'expenses.approve',
  'expenses.reject',
  'expenses.pay',

  // Finance permissions
  'finance.summary.view',
  'finance.transactions.view',
  'finance.transactions.create',
  'finance.transactions.reverse',
  'finance.accounts.view',
  'finance.reconcile',

  // Welfare permissions
  'welfare.view',
  'welfare.apply',
  'welfare.review',
  'welfare.approve',
  'welfare.disburse',

  // Report permissions
  'reports.view',
  'reports.generate',
  'reports.export',

  // Audit permissions
  'audit.view',
  'audit.investigate',
  'audit.report',

  // Role permissions
  'roles.view',
  'roles.assign',
  'roles.remove',

  // Settings permissions
  'settings.view',
  'settings.manage'
];

const SCOPE_TYPES = ['all', 'own', 'committee', 'none', 'limited'];

const chamaPermissionSchema = new mongoose.Schema({
  chama_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chama',
    required: true,
    index: true
  },

  // Permission definition
  permission_key: {
    type: String,
    required: true,
    enum: PERMISSION_KEYS,
    index: true
  },

  description: {
    type: String,
    required: true
  },

  // Scope restrictions
  scope: {
    type: String,
    enum: SCOPE_TYPES,
    default: 'all'
  },

  // Approval requirement
  requires_approval: {
    type: Boolean,
    default: false
  },

  // Which roles can approve this permission action
  approval_roles: {
    type: [String],
    default: []
  },

  // Separation of duties
  self_action_blocked: {
    type: Boolean,
    default: true
  },

  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },

  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChamaMembership'
  },

  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// ========================================
// INDEXES
// ========================================

// Composite index for quick permission lookups
chamaPermissionSchema.index({ chama_id: 1, permission_key: 1, status: 1 });

// Index for active permissions by chama
chamaPermissionSchema.index({ chama_id: 1, status: 1 });

// Index for permission key lookups across chamas
chamaPermissionSchema.index({ permission_key: 1, status: 1 });

// ========================================
// VALIDATION
// ========================================

chamaPermissionSchema.pre('save', function(next) {
  // Ensure scope is valid for the permission key
  if (this.scope === 'none' && this.status === 'active') {
    this.status = 'inactive';
  }

  // If permission requires approval, ensure approval roles are specified
  if (this.requires_approval && this.approval_roles.length === 0) {
    return next(new Error('Permissions requiring approval must specify approval roles'));
  }

  next();
});

// ========================================
// MODEL
// ========================================

const ChamaPermission = mongoose.models.ChamaPermission ||
  mongoose.model('ChamaPermission', chamaPermissionSchema);

export default ChamaPermission;