import mongoose from 'mongoose';

// ========================================
// CHAIRPERSON LOAN SETTINGS
// ========================================
//
// Chairperson-specific loan policy settings that
// provide governance control while maintaining
// separation of duties from financial operations.
//
// Chairperson controls: Rules + Approvals
// Treasurer controls: Money operations
//
// One document per Chama.
//
// ========================================

const loanTypeConfigSchema = new mongoose.Schema({
  type_name: {
    type: String,
    required: true,
    enum: ['standard', 'emergency', 'business', 'education', 'medical', 'agriculture', 'housing']
  },
  enabled: {
    type: Boolean,
    default: true
  },
  max_amount: {
    type: Number,
    default: null
  },
  max_multiplier: {
    type: Number,
    default: null
  },
  interest_rate_override: {
    type: Number,
    default: null
  },
  description: {
    type: String,
    default: ''
  },
  required_documentation: {
    type: [String],
    default: []
  }
}, { _id: false });

const approvalWorkflowConfigSchema = new mongoose.Schema({
  workflow_type: {
    type: String,
    enum: ['chair_only', 'chair_treasurer', 'chair_treasurer_secretary', 'committee_vote'],
    default: 'chair_treasurer'
  },
  auto_approval_limit: {
    type: Number,
    default: 0,
    min: 0
  },
  auto_approval_enabled: {
    type: Boolean,
    default: false
  },
  required_committee_types: {
    type: [String],
    enum: ['finance', 'welfare', 'investment', 'discipline', 'general'],
    default: []
  },
  custom_form_fields: [{
    field_name: {
      type: String,
      required: true
    },
    field_type: {
      type: String,
      enum: ['text', 'number', 'date', 'select', 'textarea', 'file', 'boolean'],
      required: true
    },
    required: {
      type: Boolean,
      default: false
    },
    options: {
      type: [String],
      default: []
    },
    placeholder: {
      type: String,
      default: ''
    }
  }]
}, { _id: false });

const disbursementConfigSchema = new mongoose.Schema({
  default_method: {
    type: String,
    enum: ['mpesa', 'bank', 'cash', 'check'],
    default: 'mpesa'
  },
  require_meeting_disbursement: {
    type: Boolean,
    default: false
  },
  allow_member_preference: {
    type: Boolean,
    default: true
  },
  disbursement_approval_required: {
    type: Boolean,
    default: true
  }
}, { _id: false });

const chairpersonLoanSettingsSchema = new mongoose.Schema(
  {
    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chama',
      required: true,
      unique: true,
      index: true
    },

    // ========================================
    // 1. LOAN POLICY SETTINGS - "THE RULES"
    // ========================================
    // These are things Chairperson sets once per chama

    interest_rate_settings: {
      rate_percent: {
        type: Number,
        required: true,
        default: 10,
        min: 0,
        max: 50
      },
      rate_type: {
        type: String,
        enum: ['flat', 'reducing_balance'],
        default: 'flat'
      },
      rate_period: {
        type: String,
        enum: ['per_month', 'per_annum', 'flat_total'],
        default: 'per_month'
      }
    },

    max_loan_settings: {
      use_multiplier: {
        type: Boolean,
        default: true
      },
      multiplier: {
        type: Number,
        default: 3,
        min: 1,
        max: 10
      },
      absolute_limit: {
        type: Number,
        default: null,
        min: 0
      },
      min_loan_amount: {
        type: Number,
        default: 1000,
        min: 0
      }
    },

    repayment_settings: {
      allowed_periods_months: {
        type: [Number],
        default: [3, 6, 12],
        validate: {
          validator: function(periods) {
            return periods.every(p => p > 0 && p <= 60);
          },
          message: 'Repayment periods must be between 1 and 60 months'
        }
      },
      default_period_months: {
        type: Number,
        default: 6,
        min: 1
      },
      repayment_frequency: {
        type: String,
        enum: ['weekly', 'bi_weekly', 'monthly', 'quarterly'],
        default: 'monthly'
      }
    },

    eligibility_settings: {
      min_membership_months: {
        type: Number,
        default: 3,
        min: 0
      },
      min_savings_months: {
        type: Number,
        default: 3,
        min: 0
      },
      require_active_contributions: {
        type: Boolean,
        default: true
      },
      max_active_loans: {
        type: Number,
        default: 1,
        min: 1
      },
      no_pending_loan: {
        type: Boolean,
        default: true
      },
      no_overdue_loans: {
        type: Boolean,
        default: true
      }
    },

    guarantor_settings: {
      min_guarantors_required: {
        type: Number,
        default: 2,
        min: 0
      },
      max_guarantors_allowed: {
        type: Number,
        default: 5,
        min: 1
      },
      guarantor_capacity_ratio: {
        type: Number,
        default: 0.5,
        min: 0,
        max: 1
      },
      allow_spouse_guarantor: {
        type: Boolean,
        default: false
      },
      require_guarantor_savings: {
        type: Boolean,
        default: true
      }
    },

    penalty_settings: {
      enabled: {
        type: Boolean,
        default: true
      },
      grace_period_days: {
        type: Number,
        default: 7,
        min: 0
      },
      penalty_type: {
        type: String,
        enum: ['flat_per_week', 'percentage_of_due', 'percentage_of_outstanding'],
        default: 'flat_per_week'
      },
      penalty_amount: {
        type: Number,
        default: 100,
        min: 0
      },
      penalty_percentage: {
        type: Number,
        default: 2,
        min: 0,
        max: 100
      },
      max_penalty_days: {
        type: Number,
        default: 30,
        min: 0
      }
    },

    loan_types: {
      type: [loanTypeConfigSchema],
      default: [
        {
          type_name: 'standard',
          enabled: true,
          max_amount: null,
          max_multiplier: 3,
          interest_rate_override: null,
          description: 'Standard loan for general purposes',
          required_documentation: []
        },
        {
          type_name: 'emergency',
          enabled: true,
          max_amount: 5000,
          max_multiplier: 1,
          interest_rate_override: null,
          description: 'Emergency loan for urgent needs',
          required_documentation: ['emergency_reason']
        }
      ]
    },

    // ========================================
    // 2. LOAN APPROVAL SETTINGS - "THE PROCESS"
    // ========================================
    // This is where Chairperson + other officials come in

    approval_workflow: approvalWorkflowConfigSchema,

    // ========================================
    // 3. DISBURSEMENT SETTINGS
    // ========================================

    disbursement_config: disbursementConfigSchema,

    // ========================================
    // 4. SECURITY RESTRICTIONS
    // ========================================
    // These settings prevent chairperson from bypassing
    // separation of duties and committing fraud

    security_settings: {
      prevent_self_approval: {
        type: Boolean,
        default: true
      },
      prevent_interest_change_after_disbursement: {
        type: Boolean,
        default: true
      },
      prevent_deletion_of_active_loans: {
        type: Boolean,
        default: true
      },
      require_audit_for_large_changes: {
        type: Boolean,
        default: true
      },
      large_change_threshold: {
        type: Number,
        default: 50000,
        min: 0
      },
      settings_change_requires_approval: {
        type: Boolean,
        default: false
      },
      settings_change_approval_roles: {
        type: [String],
        enum: ['treasurer', 'secretary', 'auditor', 'committee_member'],
        default: []
      }
    },

    // ========================================
    // 5. AUDIT TRAIL
    // ========================================

    settings_history: [{
      changed_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChamaMembership',
        required: true
      },
      changed_by_role: {
        type: String,
        required: true
      },
      changed_at: {
        type: Date,
        default: Date.now
      },
      previous_settings: {
        type: mongoose.Schema.Types.Mixed,
        default: null
      },
      new_settings: {
        type: mongoose.Schema.Types.Mixed,
        default: null
      },
      change_reason: {
        type: String,
        default: ''
      },
      ip_address: {
        type: String,
        default: null
      },
      user_agent: {
        type: String,
        default: null
      }
    }],

    // ========================================
    // 6. METADATA
    // ========================================

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChamaMembership',
      required: true
    },

    last_modified_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChamaMembership',
      default: null
    },

    version: {
      type: Number,
      default: 1
    }
  },
  {
    timestamps: true
  }
);

// ========================================
// INDEXES
// ========================================

chairpersonLoanSettingsSchema.index({ chama_id: 1 }, { unique: true });
chairpersonLoanSettingsSchema.index({ created_by: 1 });
chairpersonLoanSettingsSchema.index({ last_modified_by: 1 });
chairpersonLoanSettingsSchema.index({ 'settings_history.changed_at': -1 });

// ========================================
// VALIDATION
// ========================================

chairpersonLoanSettingsSchema.pre('save', function(next) {
  // Validate that absolute limit is set if multiplier is not used
  if (!this.max_loan_settings.use_multiplier && !this.max_loan_settings.absolute_limit) {
    return next(new Error('Either multiplier or absolute limit must be set'));
  }

  // Validate that auto-approval limit is reasonable
  if (this.approval_workflow.auto_approval_enabled && 
      this.approval_workflow.auto_approval_limit <= 0) {
    return next(new Error('Auto-approval limit must be greater than 0'));
  }

  // Validate that required committee types are available
  if (this.approval_workflow.workflow_type === 'committee_vote' && 
      this.approval_workflow.required_committee_types.length === 0) {
    return next(new Error('Committee types must be specified for committee vote workflow'));
  }

  next();
});

// ========================================
// METHODS
// ========================================

chairpersonLoanSettingsSchema.methods.addToHistory = function(changeDetails) {
  this.settings_history.push({
    changed_by: changeDetails.changed_by,
    changed_by_role: changeDetails.changed_by_role,
    previous_settings: changeDetails.previous_settings,
    new_settings: changeDetails.new_settings,
    change_reason: changeDetails.change_reason,
    ip_address: changeDetails.ip_address,
    user_agent: changeDetails.user_agent
  });

  this.version += 1;
  this.last_modified_by = changeDetails.changed_by;
};

chairpersonLoanSettingsSchema.methods.getLoanTypeConfig = function(typeName) {
  return this.loan_types.find(lt => lt.type_name === typeName);
};

chairpersonLoanSettingsSchema.methods.isLoanTypeEnabled = function(typeName) {
  const loanType = this.getLoanTypeConfig(typeName);
  return loanType ? loanType.enabled : false;
};

chairpersonLoanSettingsSchema.methods.getMaxLoanAmount = function(memberSavings) {
  if (this.max_loan_settings.use_multiplier) {
    return memberSavings * this.max_loan_settings.multiplier;
  }
  return this.max_loan_settings.absolute_limit;
};

chairpersonLoanSettingsSchema.methods.requiresAutoApproval = function(loanAmount) {
  if (!this.approval_workflow.auto_approval_enabled) {
    return false;
  }
  return loanAmount <= this.approval_workflow.auto_approval_limit;
};

chairpersonLoanSettingsSchema.methods.getRequiredApprovalRoles = function(loanAmount) {
  // Check if auto-approval applies
  if (this.requiresAutoApproval(loanAmount)) {
    return [];
  }

  // Return roles based on workflow type
  switch (this.approval_workflow.workflow_type) {
    case 'chair_only':
      return ['chairperson'];
    case 'chair_treasurer':
      return ['chairperson', 'treasurer'];
    case 'chair_treasurer_secretary':
      return ['chairperson', 'treasurer', 'secretary'];
    case 'committee_vote':
      return ['committee_member'];
    default:
      return ['chairperson', 'treasurer'];
  }
};

// ========================================
// MODEL
// ========================================

const ChairpersonLoanSettings = mongoose.models.ChairpersonLoanSettings ||
  mongoose.model('ChairpersonLoanSettings', chairpersonLoanSettingsSchema);

export default ChairpersonLoanSettings;