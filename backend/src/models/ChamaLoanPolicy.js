import mongoose from 'mongoose';

// ========================================
// CHAMA LOAN POLICY
// ========================================
//
// Every configurable rule the Loan Engine
// depends on lives here so that nothing in
// the engine hardcodes multipliers, approval
// chains, penalty amounts, or default windows.
//
// One document per Chama.
//
// ========================================

const approvalTierSchema = new mongoose.Schema(
  {
    // Upper bound (inclusive) for this tier, in KES.
    // null = no upper bound (catch-all tier).
    max_amount: { type: Number, default: null, min: 0 },

    // Membership roles that must each independently
    // approve a loan whose amount falls in this tier.
    required_roles: {
      type: [String],
      enum: ['treasurer', 'chairperson', 'secretary', 'auditor'],
      default: ['treasurer'],
    },
  },
  { _id: false }
);

const chamaLoanPolicySchema = new mongoose.Schema(
  {
    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chama',
      required: true,
      unique: true,
      index: true,
    },

    // Loan Limit = Eligible Savings x multiplier
    loan_multiplier: { type: Number, required: true, default: 3, min: 0 },

    // Interest applied over the full repayment period.
    interest_rate_percent: { type: Number, required: true, default: 10, min: 0 },
    interest_type: { type: String, enum: ['flat', 'reducing_balance'], default: 'flat' },

    min_membership_months: { type: Number, default: 3, min: 0 },
    max_active_loans_per_member: { type: Number, default: 1, min: 1 },

    allowed_purposes: { type: [String], default: [] }, // empty = any purpose allowed
    allowed_repayment_periods_months: { type: [Number], default: [1, 2, 3, 6, 12] },
    allowed_repayment_frequencies: {
      type: [String],
      default: ['weekly', 'monthly'],
    },

    // Days after due date before a schedule item is "overdue" (grace),
    // and total days past due before the loan is declared in "default".
    grace_period_days: { type: Number, default: 7, min: 0 },
    default_after_days: { type: Number, default: 30, min: 0 },

    penalty_type: { type: String, enum: ['flat_per_week', 'percentage_of_due'], default: 'flat_per_week' },
    penalty_amount: { type: Number, default: 100, min: 0 }, // flat KES/week, or % if percentage_of_due

    // Waterfall order used when allocating an incoming repayment.
    repayment_waterfall: {
      type: [String],
      enum: ['penalty', 'interest', 'principal'],
      default: ['penalty', 'interest', 'principal'],
    },

    // Fraction of a guarantor's own savings they may commit in total
    // guarantees at any one time.
    guarantor_capacity_ratio: { type: Number, default: 0.5, min: 0, max: 1 },
    allow_guarantor_recovery: { type: Boolean, default: true },
    min_guarantors_required: { type: Number, default: 0, min: 0 },

    approval_matrix: {
      type: [approvalTierSchema],
      default: [
        { max_amount: null, required_roles: ['chairperson', 'treasurer'] },
      ],
    },

    // Conflict-of-interest recusal: when the applicant themself holds one
    // of the required_roles above, that seat can't be filled by them. This
    // is how many OTHER independent officials (any of treasurer,
    // chairperson, secretary, auditor, committee_member — excluding the
    // applicant) must approve in its place.
    recusal_quorum_size: { type: Number, default: 2, min: 1 },

    emergency_loan_enabled: { type: Boolean, default: true },
    emergency_loan_limit: { type: Number, default: 5000, min: 0 },
    emergency_loan_approval_roles: { type: [String], default: ['treasurer'] },

    topup_enabled: { type: Boolean, default: true },
    group_loans_enabled: { type: Boolean, default: true },

    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export default mongoose.models.ChamaLoanPolicy ||
  mongoose.model('ChamaLoanPolicy', chamaLoanPolicySchema);