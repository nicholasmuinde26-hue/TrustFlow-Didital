import mongoose from 'mongoose';

// ======================================================
// BENEFIT PLAN SCHEMA
// ======================================================
// This schema defines the benefit amounts and calculation
// rules for different beneficiary categories in a burial chama.
// ======================================================

const benefitPlanSchema = new mongoose.Schema(
  {
    // ---------------------------------------------------
    // Reference to the burial chama profile
    // ---------------------------------------------------
    burial_chama_profile_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BurialChamaProfile',
      required: true,
      unique: true
    },

    // ---------------------------------------------------
    // Benefit Configuration
    // ---------------------------------------------------
    benefit_rules: [
      {
        // ---------------------------------------------------
        // Beneficiary relationship this rule applies to
        // ---------------------------------------------------
        relationship: {
          type: String,
          enum: [
            'self',
            'spouse',
            'child',
            'parent',
            'sibling',
            'guardian',
            'grandparent',
            'dependant',
            'adopted_child',
            'custom'
          ],
          required: true
        },

        // ---------------------------------------------------
        // Age-based conditions (for children, etc.)
        // ---------------------------------------------------
        age_condition: {
          min_age: {
            type: Number,
            default: null
          },
          max_age: {
            type: Number,
            default: null
          },
          age_group: {
            type: String,
            enum: ['any', 'under_18', '18_25', 'over_25', 'custom'],
            default: 'any'
          }
        },

        // ---------------------------------------------------
        // Benefit calculation method
        // ---------------------------------------------------
        calculation_method: {
          type: String,
          enum: [
            'fixed_amount',
            'percentage',
            'contribution_multiple',
            'tiered_amount',
            'custom_formula',
            'committee_determined'
          ],
          required: true
        },

        // ---------------------------------------------------
        // Fixed benefit amount
        // ---------------------------------------------------
        fixed_amount: {
          type: mongoose.Schema.Types.Decimal128,
          default: null
        },

        // ---------------------------------------------------
        // Percentage-based calculation
        // ---------------------------------------------------
        percentage_config: {
          base: {
            type: String,
            enum: ['welfare_fund', 'total_contributions', 'member_balance', 'custom'],
            default: 'welfare_fund'
          },
          percentage: {
            type: Number,
            min: 0,
            max: 100
          }
        },

        // ---------------------------------------------------
        // Contribution multiple calculation
        // ---------------------------------------------------
        contribution_multiple: {
          multiple: {
            type: Number,
            min: 0
          },
          contribution_type: {
            type: String,
            enum: ['monthly', 'total', 'custom'],
            default: 'monthly'
          }
        },

        // ---------------------------------------------------
        // Tiered benefit calculation
        // ---------------------------------------------------
        tiered_benefits: [
          {
            min_amount: {
              type: mongoose.Schema.Types.Decimal128,
              required: true
            },
            max_amount: {
              type: mongoose.Schema.Types.Decimal128,
              default: null
            },
            benefit: {
              type: mongoose.Schema.Types.Decimal128,
              required: true
            }
          }
        ],

        // ---------------------------------------------------
        // Custom formula (expression string)
        // ---------------------------------------------------
        custom_formula: {
          type: String,
          trim: true,
          maxlength: 500
        },

        // ---------------------------------------------------
        // Maximum benefit cap
        // ---------------------------------------------------
        maximum_benefit: {
          type: mongoose.Schema.Types.Decimal128,
          default: null
        },

        // ---------------------------------------------------
        // Minimum benefit guarantee
        // ---------------------------------------------------
        minimum_benefit: {
          type: mongoose.Schema.Types.Decimal128,
          default: null
        },

        // ---------------------------------------------------
        // Special conditions
        // ---------------------------------------------------
        conditions: {
          disabled_dependant_multiplier: {
            type: Number,
            default: 1
          },
          student_status_bonus: {
            type: mongoose.Schema.Types.Decimal128,
            default: null
          },
          single_parent_bonus: {
            type: mongoose.Schema.Types.Decimal128,
            default: null
          }
        },

        // ---------------------------------------------------
        // Currency
        // ---------------------------------------------------
        currency: {
          type: String,
          default: 'KES',
          uppercase: true,
          trim: true,
          minlength: 3,
          maxlength: 3
        },

        // ---------------------------------------------------
        // Effective date range
        // ---------------------------------------------------
        effective_from: {
          type: Date,
          required: true,
          default: Date.now
        },
        effective_to: {
          type: Date,
          default: null
        }
      }
    ],

    // ---------------------------------------------------
    // Global benefit limits
    // ---------------------------------------------------
    global_limits: {
      maximum_total_benefit_per_case: {
        type: mongoose.Schema.Types.Decimal128,
        default: null
      },
      maximum_benefits_per_year: {
        type: Number,
        default: null
      },
      maximum_benefits_per_member: {
        type: Number,
        default: null
      }
    },

    // ---------------------------------------------------
    // Benefit approval requirements
    // ---------------------------------------------------
    approval_requirements: {
      auto_approve_below_amount: {
        type: mongoose.Schema.Types.Decimal128,
        default: null
      },
      committee_approval_required: {
        type: Boolean,
        default: true
      },
      minimum_committee_members: {
        type: Number,
        default: 3
      },
      chairperson_approval_required: {
        type: Boolean,
        default: true
      },
      treasurer_approval_required: {
        type: Boolean,
        default: true
      }
    },

    // ---------------------------------------------------
    // Payout configuration
    // ---------------------------------------------------
    payout_config: {
      default_payout_method: {
        type: String,
        enum: ['mpesa', 'bank_transfer', 'cash', 'check'],
        default: 'mpesa'
      },
      payout_timing: {
        type: String,
        enum: ['immediate', 'within_24h', 'within_48h', 'after_funeral', 'custom'],
        default: 'within_48h'
      },
      require_funeral_notice: {
        type: Boolean,
        default: true
      },
      minimum_payout_percentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 100
      }
    },

    // ---------------------------------------------------
    // Audit trail
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

// ======================================================
// INDEXES
// ======================================================

// Relationship-based lookup
benefitPlanSchema.index({
  burial_chama_profile_id: 1,
  'benefit_rules.relationship': 1
});

// Active benefit rules
benefitPlanSchema.index({
  burial_chama_profile_id: 1,
  'benefit_rules.effective_from': -1,
  'benefit_rules.effective_to': null
});

// ======================================================
// JSON TRANSFORMATION
// ======================================================

benefitPlanSchema.set('toJSON', {
  transform: (_doc, ret) => {
    // Convert Decimal128 fields to strings
    const decimalFields = [
      'fixed_amount',
      'maximum_benefit',
      'minimum_benefit',
      'maximum_total_benefit_per_case'
    ];
    
    decimalFields.forEach(field => {
      if (ret.benefit_rules) {
        ret.benefit_rules.forEach(rule => {
          if (rule[field] !== undefined && rule[field] !== null) {
            rule[field] = rule[field].toString();
          }
          if (rule.tiered_benefits) {
            rule.tiered_benefits.forEach(tier => {
              if (tier.min_amount !== undefined && tier.min_amount !== null) {
                tier.min_amount = tier.min_amount.toString();
              }
              if (tier.max_amount !== undefined && tier.max_amount !== null) {
                tier.max_amount = tier.max_amount.toString();
              }
              if (tier.benefit !== undefined && tier.benefit !== null) {
                tier.benefit = tier.benefit.toString();
              }
            });
          }
        });
      }
      
      if (ret.global_limits) {
        if (ret.global_limits.maximum_total_benefit_per_case !== undefined && ret.global_limits.maximum_total_benefit_per_case !== null) {
          ret.global_limits.maximum_total_benefit_per_case = ret.global_limits.maximum_total_benefit_per_case.toString();
        }
      }
      
      if (ret.approval_requirements) {
        if (ret.approval_requirements.auto_approve_below_amount !== undefined && ret.approval_requirements.auto_approve_below_amount !== null) {
          ret.approval_requirements.auto_approve_below_amount = ret.approval_requirements.auto_approve_below_amount.toString();
        }
      }
    });
    
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('BenefitPlan', benefitPlanSchema);