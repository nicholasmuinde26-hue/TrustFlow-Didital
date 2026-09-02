import mongoose from 'mongoose';

/**
 * ============================================================================
 * MGR POLICY SCHEMA
 * ============================================================================
 *
 * Stores the versioned rule configuration for a Merry-Go-Round (MGR) in a Chama.
 * Historical rounds reference policy_id to guarantee auditability even if rules
 * change in subsequent cycles.
 * ============================================================================
 */

const mgrPolicySchema = new mongoose.Schema(
  {
    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chama',
      required: true,
      index: true,
    },

    version: {
      type: Number,
      default: 1,
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },

    currency: {
      type: String,
      default: 'KES',
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      required: true,
    },

    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly'],
      default: 'monthly',
      required: true,
    },

    start_date: {
      type: Date,
      required: true,
      default: Date.now,
    },

    contribution_deadline_day: {
      type: Number,
      min: 1,
      max: 31,
      default: 5,
    },

    grace_period_days: {
      type: Number,
      default: 3,
      min: 0,
      max: 30,
    },

    // Selected participants (subset of Chama members)
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChamaMembership',
        required: true,
      },
    ],

    // Contribution Rules
    contribution_rule: {
      type: {
        type: String,
        enum: ['uniform', 'custom_member', 'tiered'],
        default: 'uniform',
      },
      uniform_amount: {
        type: mongoose.Schema.Types.Decimal128,
        default: null,
      },
      member_amounts: [
        {
          member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChamaMembership' },
          amount: { type: mongoose.Schema.Types.Decimal128 },
        },
      ],
    },

    // Rotation & Payout Order
    rotation_rule: {
      order_type: {
        type: String,
        enum: ['fixed', 'randomized', 'member_selected', 'committee_selected', 'custom'],
        default: 'fixed',
      },
      lock_on_activation: {
        type: Boolean,
        default: true,
      },
    },

    // Payout Rules
    payout_rule: {
      calculation: {
        type: String,
        enum: ['actual_collected', 'expected_pool', 'fixed_amount'],
        default: 'actual_collected',
      },
      allow_payout_before_100_pct: {
        type: Boolean,
        default: false,
      },
      min_collection_threshold_pct: {
        type: Number,
        default: 100,
        min: 0,
        max: 100,
      },
      unpaid_handling: {
        type: String,
        enum: ['carry_forward', 'recover_before_next', 'deduct_from_entitlement', 'committee_decision', 'skip_payout'],
        default: 'carry_forward',
      },
    },

    // Member Eligibility Requirements
    eligibility_rule: {
      require_active_membership: { type: Boolean, default: true },
      require_full_contributions: { type: Boolean, default: true },
      check_overdue_loans: { type: Boolean, default: false },
      check_outstanding_penalties: { type: Boolean, default: false },
      check_minimum_savings: { type: Boolean, default: false },
    },

    // Missed Payment Rules
    penalty_rule: {
      penalty_type: { type: String, enum: ['none', 'fixed', 'percentage'], default: 'fixed' },
      penalty_amount: { type: mongoose.Schema.Types.Decimal128, default: 0 },
      grace_days: { type: Number, default: 3 },
      default_action: { type: String, enum: ['keep_schedule', 'delay_round', 'use_chama_funds', 'committee_decides'], default: 'keep_schedule' },
    },

    // Approval Engine Policy
    approval_rule: {
      required_approvals: { type: Number, default: 2, min: 1 },
      eligible_roles: {
        type: [String],
        enum: ['chairperson', 'secretary', 'treasurer', 'vice_chairperson', 'member'],
        default: ['chairperson', 'secretary', 'treasurer'],
      },
      allow_initiator_approval: { type: Boolean, default: false },
    },

    status: {
      type: String,
      enum: ['draft', 'active', 'archived', 'superseded'],
      default: 'draft',
      index: true,
    },

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

mgrPolicySchema.set('toJSON', {
  transform: (_doc, ret) => {
    if (ret.contribution_rule?.uniform_amount) {
      ret.contribution_rule.uniform_amount = ret.contribution_rule.uniform_amount.toString();
    }
    if (ret.penalty_rule?.penalty_amount) {
      ret.penalty_rule.penalty_amount = ret.penalty_rule.penalty_amount.toString();
    }
    if (Array.isArray(ret.contribution_rule?.member_amounts)) {
      ret.contribution_rule.member_amounts = ret.contribution_rule.member_amounts.map((ma) => ({
        ...ma,
        amount: ma.amount ? ma.amount.toString() : '0',
      }));
    }
    return ret;
  },
});

export default mongoose.models.MgrPolicy || mongoose.model('MgrPolicy', mgrPolicySchema);
