import mongoose from 'mongoose';

/**
 * ============================================================================
 * WITHDRAWAL POLICY SCHEMA
 * ============================================================================
 *
 * Lets a chama configure the rules a member withdrawal request must clear —
 * min-balance, max-per-request, max-per-month, cooling-period, dual-approval
 * — instead of every withdrawal being either fully manual or hard-coded.
 *
 * Unlike MgrPolicy / SavingsSharePolicy (which predate this engine and keep
 * their own hand-rolled boolean rule shapes), this policy is built directly
 * on the shared vocabulary in policyEngine.constants.js and evaluated via
 * policyEngine.service.js#evaluatePolicyAction — the engine's first real
 * caller. See withdrawal.service.js#requestWithdrawal.
 *
 * Scope: one policy applies to one savings pool (contribution_plan_id) in
 * one chama. A chama with several savings plans can give each its own
 * rules; contribution_plan_id: null means "applies to every plan that
 * doesn't have its own active policy".
 * ============================================================================
 */

const withdrawalPolicySchema = new mongoose.Schema(
  {
    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chama',
      required: true,
      index: true,
    },

    contribution_plan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContributionPlan',
      default: null,
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
    // ELIGIBILITY CONDITIONS
    // ========================================================================
    //
    // Evaluated in order by conditionEvaluator.service.js. Each entry:
    //   { type: CONDITION_TYPES.*, params: {...}, blocking: true|false }
    // A failed non-blocking condition is advisory only (surfaced to the
    // approver, doesn't change the decision); a failed blocking condition
    // fails the whole evaluation.
    //
    // Typical set for "section 20"-style rules:
    //   MIN_SAVINGS_BALANCE   { amount }        — don't let balance go negative
    //   MAX_AMOUNT_PER_REQUEST{ amount }        — single-request ceiling
    //   MAX_AMOUNT_PER_PERIOD { amount, days }  — e.g. max per rolling 30 days
    //   MIN_DAYS_SINCE_LAST   { days }          — cooling-period
    //   TRUST_SCORE_MIN       { score }         — gate on chama trust score
    //
    // ========================================================================

    eligibility_conditions: [
      {
        type: {
          type: String,
          required: true,
        },
        params: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
        blocking: {
          type: Boolean,
          default: true,
        },
      },
    ],

    // ========================================================================
    // ACTION SPEC
    // ========================================================================
    //
    // What the policy engine's decision does once conditions are evaluated.
    // on_pass / on_fail: { type: ACTION_TYPES.*, params: {} }
    //
    // Defaults are conservative: even a request that clears every condition
    // still requires manual approval unless the chama explicitly opts into
    // AUTO_APPROVE.
    //
    // ========================================================================

    action_spec: {
      on_pass: {
        type: {
          type: String,
          default: 'REQUIRE_APPROVAL',
        },
        params: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
      },
      on_fail: {
        type: {
          type: String,
          default: 'AUTO_REJECT',
        },
        params: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
      },
    },

    // ========================================================================
    // APPROVAL RULE — used to build the ApprovalRequest when the policy's
    // decision is REQUIRE_APPROVAL / FLAG_FOR_REVIEW. Same shape as
    // MgrPolicy.approval_rule / SavingsSharePolicy.approval_rule so it looks
    // consistent across settings screens.
    // ========================================================================

    approval_rule: {
      required_approvals: { type: Number, default: 1, min: 1 },
      eligible_roles: {
        type: [String],
        enum: ['chairperson', 'secretary', 'treasurer', 'vice_chairperson', 'member'],
        default: ['chairperson', 'treasurer'],
      },
      // Deliberately no allow_initiator_approval override here — a member
      // withdrawing their own money must never be able to approve their
      // own request. withdrawal.service.js always passes false.
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

withdrawalPolicySchema.index({ chama_id: 1, contribution_plan_id: 1, status: 1 });

export default mongoose.models.WithdrawalPolicy || mongoose.model('WithdrawalPolicy', withdrawalPolicySchema);