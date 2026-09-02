import mongoose from 'mongoose';

// ======================================================
// ENHANCED BURIAL CHAMA PROFILE SCHEMA
// ------------------------------------------------------
// This schema captures the comprehensive configurable rule set
// for a burial (or welfare) chama. All rules are defined per‑chama
// and can be interpreted by the rules engine at runtime.
// ======================================================

const burialChamaProfileSchema = new mongoose.Schema(
  {
    // ---------------------------------------------------
    // Reference to the Chama this profile belongs to
    // ---------------------------------------------------
    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chama',
      required: true,
      unique: true,
    },

    // ---------------------------------------------------
    // Profile status
    // ---------------------------------------------------
    status: {
      type: String,
      enum: ['draft', 'active', 'suspended', 'inactive'],
      default: 'draft',
    },

    // ---------------------------------------------------
    // CHAMA INFORMATION
    // ---------------------------------------------------
    chama_info: {
      registration_number: {
        type: String,
        trim: true,
        maxlength: 100
      },
      registration_date: {
        type: Date,
        default: null
      },
      physical_address: {
        type: String,
        trim: true,
        maxlength: 300
      },
      county: {
        type: String,
        trim: true,
        maxlength: 100
      },
      sub_county: {
        type: String,
        trim: true,
        maxlength: 100
      },
      ward: {
        type: String,
        trim: true,
        maxlength: 100
      },
      village: {
        type: String,
        trim: true,
        maxlength: 100
      },
      contact_phone: {
        type: String,
        trim: true,
        maxlength: 20
      },
      contact_email: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 100
      }
    },

    // ---------------------------------------------------
    // MEMBERSHIP MODEL
    // ---------------------------------------------------
    membership_model: {
      type: String,
      enum: ['individual', 'household', 'hybrid'],
      default: 'individual',
    },

    // ---------------------------------------------------
    // MEMBERSHIP CLASSES
    // ---------------------------------------------------
    membership_classes: [
      {
        name: { type: String, required: true }, // e.g. "ordinary"
        description: { type: String, trim: true, maxlength: 200 },
        contribution_amount: { type: mongoose.Schema.Types.Decimal128, required: true },
        frequency: {
          type: String,
          enum: [
            'daily',
            'weekly',
            'biweekly',
            'monthly',
            'quarterly',
            'annually',
            'one-time',
            'event',
            'custom',
          ],
          default: 'monthly',
        },
        currency: {
          type: String,
          default: 'KES',
          uppercase: true,
          trim: true,
          minlength: 3,
          maxlength: 3
        },
        minimum_age: { type: Number, default: null },
        maximum_age: { type: Number, default: null },
        permissions: {
          can_vote: { type: Boolean, default: true },
          can_hold_office: { type: Boolean, default: true },
          can_borrow: { type: Boolean, default: true }
        },
        // Optional custom logic expressed as a stringified mini‑DSL
        custom_rule: { type: String },
        is_active: { type: Boolean, default: true }
      },
    ],

    // ---------------------------------------------------
    // CONTRIBUTION COMPONENTS
    // ---------------------------------------------------
    contribution_components: [
      {
        name: { type: String, required: true }, // e.g. "Welfare"
        code: { type: String, trim: true, maxlength: 20 },
        amount: { type: mongoose.Schema.Types.Decimal128, required: true },
        frequency: {
          type: String,
          enum: [
            'daily',
            'weekly',
            'biweekly',
            'monthly',
            'quarterly',
            'annually',
            'one-time',
            'event',
            'custom',
          ],
          default: 'monthly',
        },
        currency: {
          type: String,
          default: 'KES',
          uppercase: true,
          trim: true,
          minlength: 3,
          maxlength: 3
        },
        description: { type: String, trim: true, maxlength: 500 },
        is_mandatory: { type: Boolean, default: true },
        is_active: { type: Boolean, default: true },
        effective_from: { type: Date, default: Date.now },
        effective_to: { type: Date, default: null }
      },
    ],

    // ---------------------------------------------------
    // JOINING RULES
    // ---------------------------------------------------
    joining_rules: {
      joining_fee: {
        type: mongoose.Schema.Types.Decimal128,
        default: null
      },
      joining_fee_currency: {
        type: String,
        default: 'KES',
        uppercase: true,
        trim: true
      },
      proration_rule: {
        type: String,
        enum: ['full_month', 'prorated', 'next_month', 'custom'],
        default: 'full_month'
      },
      proration_method: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'custom'],
        default: 'daily'
      },
      require_approvals: {
        type: Boolean,
        default: true
      },
      approval_roles: [
        {
          type: String,
          enum: ['chairperson', 'treasurer', 'secretary', 'committee_member', 'custom']
        }
      ],
      minimum_approvals: {
        type: Number,
        default: 1
      }
    },

    // ---------------------------------------------------
    // WAITING PERIOD RULES
    // ---------------------------------------------------
    waiting_period_rules: {
      waiting_period_days: { type: Number, default: 90 },
      waiting_period_type: {
        type: String,
        enum: ['fixed_days', 'contributions_based', 'custom'],
        default: 'fixed_days'
      },
      required_contributions: {
        type: Number,
        default: null
      },
      partial_coverage_during_waiting: {
        type: Boolean,
        default: false
      },
      partial_coverage_percentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
      },
      exceptions: [
        {
          condition: { type: String, trim: true },
          waiver_type: {
            type: String,
            enum: ['full_waiver', 'reduced_period', 'immediate']
          },
          waiver_value: { type: mongoose.Schema.Types.Mixed }
        }
      ]
    },

    // ---------------------------------------------------
    // BENEFICIARY CATEGORIES
    // ---------------------------------------------------
    beneficiary_categories: [
      {
        relationship: { type: String, required: true }, // e.g. "spouse"
        display_name: { type: String, trim: true, maxlength: 100 },
        max_age: { type: Number, default: null },
        min_age: { type: Number, default: null },
        age_condition: {
          type: String,
          enum: ['any', 'under_18', '18_25', 'over_25', 'custom'],
          default: 'any'
        },
        eligibility_criteria: { type: mongoose.Schema.Types.Mixed },
        required_documents: [
          {
            type: String,
            enum: ['birth_certificate', 'id_copy', 'marriage_certificate', 'other']
          }
        ],
        is_active: { type: Boolean, default: true },
        max_beneficiaries: { type: Number, default: null }
      },
    ],

    // ---------------------------------------------------
    // GRACE PERIOD RULES
    // ---------------------------------------------------
    grace_period_rules: {
      default_grace_days: { type: Number, default: 7 },
      payment_method_grace_periods: [
        {
          payment_method: {
            type: String,
            enum: ['mpesa', 'bank', 'cash', 'other']
          },
          grace_days: { type: Number }
        }
      ],
      membership_class_grace_periods: [
        {
          membership_class: { type: String },
          grace_days: { type: Number }
        }
      ]
    },

    // ---------------------------------------------------
    // PENALTY POLICY
    // ---------------------------------------------------
    penalty_policy: {
      method: {
        type: String,
        enum: ['fixed', 'percentage', 'per_day', 'per_missed', 'none'],
        default: 'fixed'
      },
      value: { type: mongoose.Schema.Types.Decimal128, default: null },
      currency: {
        type: String,
        default: 'KES',
        uppercase: true,
        trim: true
      },
      daily_cap: { type: mongoose.Schema.Types.Decimal128, default: null },
      penalty_start_days: { type: Number, default: 0 },
      max_penalty_percentage: { type: Number, default: null },
      compound_penalty: { type: Boolean, default: false },
      penalty_becomes_obligation: { type: Boolean, default: true }
    },

    // ---------------------------------------------------
    // ARREARS POLICY
    // ---------------------------------------------------
    arrears_policy: {
      effect: {
        type: String,
        enum: ['no_effect', 'deduct_arrears', 'reduce_benefit', 'suspend', 'committee_review', 'custom'],
        default: 'no_effect',
      },
      arrears_threshold: {
        type: mongoose.Schema.Types.Decimal128,
        default: null
      },
      arrears_threshold_type: {
        type: String,
        enum: ['amount', 'months', 'percentage'],
        default: 'months'
      },
      suspension_threshold_months: { type: Number, default: 3 },
      reduction_formula: { type: String, trim: true },
      notification_intervals: [Number] // e.g., [30, 60, 90] days
    },

    // ---------------------------------------------------
    // CONTRIBUTION RULES
    // ---------------------------------------------------
    contribution_rules: {
      allow_partial_payments: { type: Boolean, default: true },
      allow_overpayments: { type: Boolean, default: true },
      overpayment_handling: {
        type: String,
        enum: ['credit_future', 'refund', 'donation', 'custom'],
        default: 'credit_future'
      },
      minimum_payment_percentage: { type: Number, min: 0, max: 100, default: 0 },
      payment_allocation_order: [String], // Priority order for components
      backdating_allowed: { type: Boolean, default: false },
      max_backdating_months: { type: Number, default: 0 },
      auto_payment_allocation: { type: Boolean, default: true }
    },

    // ---------------------------------------------------
    // ELIGIBILITY RULES
    // ---------------------------------------------------
    eligibility_rules: {
      minimum_membership_months: { type: Number, default: 0 },
      minimum_contributions: { type: Number, default: 0 },
      good_standing_required: { type: Boolean, default: true },
      good_standing_definition: {
        type: String,
        enum: ['no_arrears', 'below_threshold', 'custom'],
        default: 'no_arrears'
      },
      attendance_requirements: {
        type: Boolean,
        default: false
      },
      minimum_meeting_attendance: {
        type: Number,
        default: null
      },
      review_period: {
        type: String,
        enum: ['none', 'monthly', 'quarterly', 'annually'],
        default: 'none'
      }
    },

    // ---------------------------------------------------
    // CLAIM RULES
    // ---------------------------------------------------
    claim_rules: {
      reporting_deadline_hours: { type: Number, default: 72 },
      required_documents: [
        {
          document_type: {
            type: String,
            enum: [
              'death_certificate',
              'death_notification',
              'member_id',
              'national_id',
              'relationship_proof',
              'chiefs_letter',
              'hospital_document',
              'burial_permit',
              'other'
            ]
          },
          is_required: { type: Boolean, default: true },
          description: { type: String, trim: true }
        }
      ],
      verification_process: {
        type: String,
        enum: ['automatic', 'manual', 'committee', 'custom'],
        default: 'manual'
      },
      allowed_claimants: [
        {
          relationship: { type: String },
          requires_authorization: { type: Boolean, default: false }
        }
      ],
      maximum_claims_per_year: { type: Number, default: null }
    },

    // ---------------------------------------------------
    // APPROVAL RULES
    // ---------------------------------------------------
    approval_rules: {
      new_member_approval: {
        required_roles: [String],
        minimum_approvals: { type: Number, default: 1 }
      },
      claim_approval: {
        required_roles: [String],
        minimum_approvals: { type: Number, default: 2 }
      },
      benefit_thresholds: [
        {
          max_amount: { type: mongoose.Schema.Types.Decimal128 },
          required_roles: [String],
          minimum_approvals: { type: Number },
          requires_committee_vote: { type: Boolean, default: false }
        }
      ],
      emergency_approval: {
        allowed_roles: [String],
        requires_ratification: { type: Boolean, default: true },
        ratification_deadline_days: { type: Number, default: 7 }
      }
    },

    // ---------------------------------------------------
    // COMMITTEE RULES
    // ---------------------------------------------------
    committee_rules: {
      structure: [
        {
          role: {
            type: String,
            enum: [
              'chairperson',
              'vice_chairperson',
              'secretary',
              'treasurer',
              'organizing_secretary',
              'committee_member',
              'elder',
              'patron',
              'custom'
            ]
          },
          title: { type: String, trim: true },
          count: { type: Number, default: 1 },
          responsibilities: [String]
        }
      ],
      quorum_requirements: {
        type: String,
        enum: ['simple_majority', 'two_thirds', 'three_quarters', 'custom'],
        default: 'simple_majority'
      },
      custom_quorum_percentage: { type: Number, default: null },
      voting_method: {
        type: String,
        enum: ['simple_majority', 'two_thirds', 'unanimous', 'custom'],
        default: 'simple_majority'
      },
      meeting_frequency: {
        type: String,
        enum: ['weekly', 'monthly', 'quarterly', 'as_needed', 'custom'],
        default: 'monthly'
      },
      term_length_months: { type: Number, default: 12 }
    },

    // ---------------------------------------------------
    // MEETING RULES
    // ---------------------------------------------------
    meeting_rules: {
      regular_meetings: {
        frequency: {
          type: String,
          enum: ['weekly', 'biweekly', 'monthly', 'quarterly', 'custom']
        },
        day_of_week: { type: String },
        day_of_month: { type: Number },
        location: { type: String, trim: true },
        default_start_time: { type: String }
      },
      attendance_tracking: {
        type: Boolean,
        default: true
      },
      minimum_quorum_for_business: {
        type: Number,
        default: null
      },
      contribution_meeting_required: {
        type: Boolean,
        default: false
      }
    },

    // ---------------------------------------------------
    // FUNDRAISING RULES
    // ---------------------------------------------------
    fundraising_rules: {
      enabled: { type: Boolean, default: true },
      allow_external_contributions: { type: Boolean, default: true },
      require_chama_approval: { type: Boolean, default: true },
      default_campaign_duration_days: { type: Number, default: 30 },
      minimum_contribution_amount: {
        type: mongoose.Schema.Types.Decimal128,
        default: null
      },
      allow_anonymous_contributions: { type: Boolean, default: true }
    },

    // ---------------------------------------------------
    // PAYMENT RULES
    // ---------------------------------------------------
    payment_rules: {
      accepted_methods: [
        {
          type: String,
          enum: ['mpesa', 'bank', 'cash', 'card', 'mobile_money', 'other']
        }
      ],
      mpesa_config: {
        paybill_number: { type: String, trim: true },
        till_number: { type: String, trim: true },
        account_number_format: { type: String, trim: true }
      },
      bank_config: {
        bank_name: { type: String, trim: true },
        account_number: { type: String, trim: true },
        account_name: { type: String, trim: true }
      },
      ussd_enabled: { type: Boolean, default: true },
      ussd_shortcode: { type: String, trim: true },
      auto_reconciliation: { type: Boolean, default: true },
      payment_confirmation_required: { type: Boolean, default: false }
    },

    // ---------------------------------------------------
    // COMMUNICATION RULES
    // ---------------------------------------------------
    communication_rules: {
      primary_channel: {
        type: String,
        enum: ['sms', 'whatsapp', 'app', 'email'],
        default: 'sms'
      },
      enabled_channels: {
        type: [String],
        default: ['sms', 'whatsapp', 'app']
      },
      supported_languages: {
        type: [String],
        default: ['en', 'sw']
      },
      default_language: {
        type: String,
        default: 'en'
      },
      reminder_schedule: {
        contribution_reminders: [Number], // Days before/after due date
        arrears_reminders: [Number], // Days after due date
        meeting_reminders: [Number] // Days before meeting
      },
      reminder_templates: {
        type: mongoose.Schema.Types.Mixed
      },
      ussd_menu_language: {
        type: String,
        default: 'sw'
      }
    },

    // ---------------------------------------------------
    // CUSTOM FORMULAS
    // ---------------------------------------------------
    custom_formulas: [
      {
        name: { type: String, required: true },
        formula: { type: String, required: true },
        description: { type: String, trim: true },
        applies_to: {
          type: String,
          enum: ['benefit_calculation', 'penalty_calculation', 'eligibility', 'custom']
        }
      }
    ],

    // ---------------------------------------------------
    // REPORTING RULES
    // ---------------------------------------------------
    reporting_rules: {
      financial_reporting_frequency: {
        type: String,
        enum: ['weekly', 'monthly', 'quarterly', 'annually'],
        default: 'monthly'
      },
      member_statement_access: {
        type: String,
        enum: ['app', 'ussd', 'sms', 'all'],
        default: 'all'
      },
      audit_trail_retention_months: { type: Number, default: 12 },
      automatic_report_generation: { type: Boolean, default: true }
    },

    // ---------------------------------------------------
    // ACTIVATION
    // ---------------------------------------------------
    activated_at: {
      type: Date,
      default: null
    },
    activated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    // ---------------------------------------------------
    // AUDIT TRAIL
    // ---------------------------------------------------
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    version: {
      type: Number,
      default: 1
    }
  },
  { timestamps: true }
);

// Status lookup
burialChamaProfileSchema.index({ status: 1 });

// ======================================================
// JSON TRANSFORMATION
// ======================================================

burialChamaProfileSchema.set('toJSON', {
  transform: (_doc, ret) => {
    // Convert Decimal128 fields to strings
    const decimalFields = [
      'membership_classes.contribution_amount',
      'contribution_components.amount',
      'joining_rules.joining_fee',
      'waiting_period_rules.exceptions.waiver_value',
      'penalty_policy.value',
      'penalty_policy.daily_cap',
      'arrears_policy.arrears_threshold',
      'approval_rules.benefit_thresholds.max_amount',
      'fundraising_rules.minimum_contribution_amount'
    ];
    
    decimalFields.forEach(field => {
      const parts = field.split('.');
      let obj = ret;
      for (let i = 0; i < parts.length - 1; i++) {
        if (obj[parts[i]]) {
          obj = obj[parts[i]];
        } else {
          return;
        }
      }
      if (obj[parts[parts.length - 1]] !== undefined && obj[parts[parts.length - 1]] !== null) {
        obj[parts[parts.length - 1]] = obj[parts[parts.length - 1]].toString();
      }
    });

    // Handle nested Decimal128 in arrays
    if (ret.membership_classes) {
      ret.membership_classes.forEach(mc => {
        if (mc.contribution_amount !== undefined && mc.contribution_amount !== null) {
          mc.contribution_amount = mc.contribution_amount.toString();
        }
      });
    }

    if (ret.contribution_components) {
      ret.contribution_components.forEach(cc => {
        if (cc.amount !== undefined && cc.amount !== null) {
          cc.amount = cc.amount.toString();
        }
      });
    }

    if (ret.approval_rules && ret.approval_rules.benefit_thresholds) {
      ret.approval_rules.benefit_thresholds.forEach(bt => {
        if (bt.max_amount !== undefined && bt.max_amount !== null) {
          bt.max_amount = bt.max_amount.toString();
        }
      });
    }

    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('BurialChamaProfile', burialChamaProfileSchema);