import mongoose from 'mongoose';

/**
 * ============================================================================
 * SAVINGS SHARE POLICY SCHEMA
 * ============================================================================
 *
 * Stores the versioned rule configuration for distributing member SAVINGS
 * (free_will contributions) back to members — e.g. a year-end "share-out",
 * separate from an MGR payout (which distributes the ROTATIONAL pool) and
 * from a loan disbursement (which pays out borrowed money).
 *
 * Mirrors the shape of MgrPolicy so the two settings screens feel the same
 * to a chairperson/treasurer, and so historical SavingsShareout batches can
 * reference policy_id for auditability even if the policy changes later.
 *
 * Savings stay FLEXIBLE at deposit time (contribution_type: 'free_will' on
 * ContributionPlan — each member deposits any amount, any time). This policy
 * only governs the SHARE-OUT side: when it happens, who gets paid, and what
 * percentage of each member's balance is safe to release without leaving
 * the chama unable to cover outstanding/likely loans.
 * ============================================================================
 */

const savingsSharePolicySchema = new mongoose.Schema(
  {
    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chama',
      required: true,
      index: true,
    },

    // The savings contribution plan this policy governs. That plan's
    // owner_type may be 'Chama' (savings collected directly under the
    // chama) or 'ContributionGroup' (a fund nested inside the chama) —
    // either way this policy just needs to know which pool to share out.
    contribution_plan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContributionPlan',
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

    // ========================================================================
    // TRIGGER — how a share-out gets created
    // ========================================================================
    //
    // manual    → only created when an officer explicitly starts one
    // scheduled → the scheduler job creates one automatically
    // both      → whichever happens first; officers can still trigger one
    //             early even though a schedule also exists
    //
    // ========================================================================

    trigger_rule: {
      mode: {
        type: String,
        enum: ['manual', 'scheduled', 'both'],
        default: 'both',
        required: true,
      },

      // Only used when mode is 'scheduled' or 'both'.
      schedule: {
        frequency: {
          type: String,
          enum: ['yearly', 'quarterly', 'monthly', 'custom'],
          default: 'yearly',
        },
        // Day/month the share-out should fall on. For 'yearly', both are
        // used (e.g. run_month=12, run_day=31). For 'monthly', only
        // run_day is used. For 'custom', run_every_days is used instead.
        run_month: { type: Number, min: 1, max: 12, default: 12 },
        run_day: { type: Number, min: 1, max: 31, default: 31 },
        run_every_days: { type: Number, min: 1, default: null },
        // Advanced automatically by the scheduler job after each run.
        next_run_at: { type: Date, default: null },
      },
    },

    // ========================================================================
    // SHARE RULE — how much of each member's balance is released
    // ========================================================================
    //
    // The whole point of capping this below 100% is so the chama doesn't
    // run out of money and can keep funding loans against member savings.
    //
    // ========================================================================

    share_rule: {
      basis: {
        type: String,
        enum: ['percentage_of_balance', 'fixed_amount'],
        default: 'percentage_of_balance',
      },

      // % of each member's net savings balance to release. Capped hard at
      // 100 in the pre-save hook below — but a policy is expected to set
      // this well under 100 (e.g. 60-80%) to keep a buffer for loans.
      share_percentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 70,
      },

      // Used only when basis === 'fixed_amount'.
      fixed_amount_per_member: {
        type: mongoose.Schema.Types.Decimal128,
        default: null,
      },

      // Hard safety floor — regardless of share_percentage, never let a
      // share-out push a member's remaining balance below this amount.
      min_retained_balance: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0,
      },
    },

    // ========================================================================
    // RECIPIENTS RULE — who gets paid
    // ========================================================================

    recipients_rule: {
      scope: {
        type: String,
        enum: ['all_contributors', 'specific_members'],
        default: 'all_contributors',
      },

      // Only used when scope === 'specific_members'.
      member_ids: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ChamaMembership',
        },
      ],

      require_active_membership: { type: Boolean, default: true },
      exclude_members_with_overdue_loans: { type: Boolean, default: false },
    },

    // ========================================================================
    // APPROVAL ENGINE POLICY — same shape as MgrPolicy.approval_rule
    // ========================================================================

    approval_rule: {
      required_approvals: { type: Number, default: 1, min: 1 },
      eligible_roles: {
        type: [String],
        enum: ['chairperson', 'secretary', 'treasurer', 'vice_chairperson', 'member'],
        default: ['chairperson', 'treasurer'],
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

savingsSharePolicySchema.pre('validate', function guardPercentage(next) {
  if (this.share_rule?.share_percentage > 100) {
    this.share_rule.share_percentage = 100;
  }
  if (this.share_rule?.share_percentage < 0) {
    this.share_rule.share_percentage = 0;
  }
  next();
});

savingsSharePolicySchema.set('toJSON', {
  transform: (_doc, ret) => {
    if (ret.share_rule?.fixed_amount_per_member) {
      ret.share_rule.fixed_amount_per_member = ret.share_rule.fixed_amount_per_member.toString();
    }
    if (ret.share_rule?.min_retained_balance !== undefined && ret.share_rule?.min_retained_balance !== null) {
      ret.share_rule.min_retained_balance = ret.share_rule.min_retained_balance.toString();
    }
    return ret;
  },
});

savingsSharePolicySchema.index({ chama_id: 1, contribution_plan_id: 1, status: 1 });

export default mongoose.models.SavingsSharePolicy || mongoose.model('SavingsSharePolicy', savingsSharePolicySchema);