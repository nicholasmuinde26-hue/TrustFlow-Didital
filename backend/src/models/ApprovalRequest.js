import mongoose from 'mongoose';

/**
 * ============================================================================
 * APPROVAL REQUEST SCHEMA
 * ============================================================================
 *
 * Generic, reusable approval workflow service for ChamaManager.
 * Supports multi-role sign-offs (Treasurer initiates, Secretary reviews,
 * Chairperson approves) and enforces separation of financial custody & authority.
 * Can be reused for MGR Payouts, Loan Disbursements, Withdrawals, Expenses, etc.
 * ============================================================================
 */

const approvalRequestSchema = new mongoose.Schema(
  {
    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chama',
      required: true,
      index: true,
    },

    resource_type: {
      type: String,
      enum: ['MGR_PAYOUT', 'LOAN_DISBURSEMENT', 'WITHDRAWAL', 'EXPENSE', 'INVESTMENT', 'POLICY_CHANGE'],
      required: true,
      index: true,
    },

    resource_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    action: {
      type: String,
      required: true,
      default: 'DISBURSE',
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: '',
    },

    amount: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },

    initiated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChamaMembership',
      required: true,
    },

    required_approvals: {
      type: Number,
      default: 2,
      min: 1,
    },

    eligible_roles: {
      type: [String],
      enum: ['chairperson', 'secretary', 'treasurer', 'vice_chairperson', 'member'],
      default: ['chairperson', 'secretary', 'treasurer'],
    },

    allow_initiator_approval: {
      type: Boolean,
      default: false,
    },

    approvals: [
      {
        approver_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ChamaMembership',
          required: true,
        },
        role: {
          type: String,
          required: true,
        },
        status: {
          type: String,
          enum: ['approved', 'rejected', 'reviewed'],
          required: true,
        },
        comment: {
          type: String,
          default: '',
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },

    resolved_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

approvalRequestSchema.set('toJSON', {
  transform: (_doc, ret) => {
    if (ret.amount !== undefined && ret.amount !== null) {
      ret.amount = ret.amount.toString();
    }
    return ret;
  },
});

export default mongoose.models.ApprovalRequest || mongoose.model('ApprovalRequest', approvalRequestSchema);
