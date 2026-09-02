import mongoose from 'mongoose';

/**
 * ============================================================================
 * MGR AUDIT LOG SCHEMA
 * ============================================================================
 *
 * Dedicated audit trail for all MGR setup, rotation, collection, eligibility,
 * approval, disbursement, and reconciliation events.
 * ============================================================================
 */

const mgrAuditLogSchema = new mongoose.Schema(
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
      default: null,
      index: true,
    },

    round_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MgrRound',
      default: null,
      index: true,
    },

    actor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    actor_role: {
      type: String,
      default: null,
    },

    event_type: {
      type: String,
      required: true,
      enum: [
        'POLICY_CREATED',
        'POLICY_ACTIVATED',
        'POLICY_UPDATED',
        'ROUNDS_GENERATED',
        'ROTATION_REORDERED',
        'CONTRIBUTION_RECEIVED',
        'ELIGIBILITY_CHECKED',
        'ELIGIBILITY_OVERRIDDEN',
        'PAYOUT_PROPOSED',
        'PAYOUT_SUBMITTED_FOR_APPROVAL',
        'PAYOUT_APPROVED',
        'PAYOUT_REJECTED',
        'DISBURSEMENT_INITIATED',
        'DISBURSEMENT_CONFIRMED',
        'FINANCE_POSTED',
        'ROUND_RECONCILED',
        'ROUND_COMPLETED',
        'CYCLE_COMPLETED',
        'MEMBER_REPLACED',
      ],
      index: true,
    },

    summary: {
      type: String,
      required: true,
    },

    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

mgrAuditLogSchema.index({ chama_id: 1, createdAt: -1 });

export default mongoose.models.MgrAuditLog || mongoose.model('MgrAuditLog', mgrAuditLogSchema);
