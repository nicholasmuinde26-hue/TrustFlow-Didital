import mongoose from 'mongoose';

/**
 * ============================================================================
 * MGR ROUND SCHEMA
 * ============================================================================
 *
 * Represents an individual rotation turn/round within an active MGR Policy.
 * Tracks status, obligations, eligibility evaluation, payout proposals,
 * approval requests, disbursements, and reconciliation status.
 * ============================================================================
 */

const mgrRoundSchema = new mongoose.Schema(
  {
    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chama',
      required: true,
      index: true,
    },

    policy_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MgrPolicy',
      required: true,
      index: true,
    },

    round_number: {
      type: Number,
      required: true,
      index: true,
    },

    recipient_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChamaMembership',
      required: true,
    },

    due_date: {
      type: Date,
      required: true,
    },

    expected_amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },

    collected_amount: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },

    payout_amount: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },

    status: {
      type: String,
      enum: [
        'upcoming',
        'collecting',
        'target_reached',
        'eligibility_checking',
        'payout_proposed',
        'pending_approval',
        'approved',
        'disbursing',
        'paid',
        'reconciled',
        'completed',
        'on_hold',
      ],
      default: 'upcoming',
      index: true,
    },

    // Reference to generated contribution plan / obligations for this round
    contribution_plan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContributionPlan',
      default: null,
    },

    // Eligibility check results snapshot
    eligibility_result: {
      passed: { type: Boolean, default: null },
      evaluated_at: { type: Date, default: null },
      reasons: [{ type: String }],
      override_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      override_reason: { type: String, default: null },
    },

    // Payout Proposal details
    payout_proposal: {
      proposed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      proposed_at: { type: Date, default: null },
      amount: { type: mongoose.Schema.Types.Decimal128, default: null },
      disbursement_method: { type: String, enum: ['mpesa', 'bank', 'cash'], default: 'mpesa' },
      phone_number: { type: String, default: null },
      notes: { type: String, default: null },
    },

    // Approval Request reference
    approval_request_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApprovalRequest',
      default: null,
    },

    // Payout Record reference
    payout_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payout',
      default: null,
    },

    disbursement_method: {
      type: String,
      enum: ['mpesa', 'bank', 'cash'],
      default: null,
    },

    external_reference: {
      type: String,
      trim: true,
      default: null,
    },

    paid_at: {
      type: Date,
      default: null,
    },

    reconciled_at: {
      type: Date,
      default: null,
    },

    completed_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

mgrRoundSchema.index({ chama_id: 1, round_number: 1 }, { unique: true });

mgrRoundSchema.set('toJSON', {
  transform: (_doc, ret) => {
    if (ret.expected_amount !== undefined && ret.expected_amount !== null) {
      ret.expected_amount = ret.expected_amount.toString();
    }
    if (ret.collected_amount !== undefined && ret.collected_amount !== null) {
      ret.collected_amount = ret.collected_amount.toString();
    }
    if (ret.payout_amount !== undefined && ret.payout_amount !== null) {
      ret.payout_amount = ret.payout_amount.toString();
    }
    if (ret.payout_proposal?.amount !== undefined && ret.payout_proposal?.amount !== null) {
      ret.payout_proposal.amount = ret.payout_proposal.amount.toString();
    }
    return ret;
  },
});

export default mongoose.models.MgrRound || mongoose.model('MgrRound', mgrRoundSchema);
