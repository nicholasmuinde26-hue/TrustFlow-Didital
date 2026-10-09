import mongoose from 'mongoose';

/**
 * ============================================================================
 * WITHDRAWAL SCHEMA
 * ============================================================================
 *
 * A Withdrawal is the OPERATIONAL record of a member taking money out of
 * their own SAVINGS balance while remaining a member — distinct from
 * MemberExitRequest (which pays out a member's full savings as part of
 * leaving the chama entirely) and distinct from a treasurer's internal
 * cash-to-bank move via POST /finance/operations.
 *
 * Mirrors Payout's lifecycle:
 *
 * Withdrawal (this model)
 *       │
 *       │  status: pending
 *       │  (policy engine evaluates the request — see withdrawal.service.js)
 *       ▼
 * ApprovalRequest (resource_type: 'WITHDRAWAL') — unless the policy says
 * AUTO_APPROVE, in which case this step is skipped entirely.
 *       │
 *       │  required approvers sign off
 *       │  status: approved
 *       ▼
 * FinancialAccount.reserveFunds() on MEMBER_SAVINGS, then
 * FinancialTransaction (transaction_type: 'withdrawal_obligation')
 *       │
 *       ├── DR Member Savings
 *       └── CR Withdrawal Clearing
 *       │
 *       │  treasurer confirms disbursement
 *       │  status: paid
 *       ▼
 * FinancialTransaction (transaction_type: 'withdrawal_settlement')
 *       │
 *       ├── DR Withdrawal Clearing
 *       └── CR Cash / Bank / Mpesa
 *
 * IMPORTANT — NON-CUSTODIAL, same as Payout: settlement records that the
 * treasurer has ALREADY disbursed the funds themselves (cash handover,
 * bank transfer, M-Pesa send); it does not trigger any transfer itself.
 *
 * ============================================================================
 */

const withdrawalSchema = new mongoose.Schema(
  {
    // ========================================
    // CHAMA
    // ========================================

    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chama',
      required: true,
      index: true,
    },

    // Which savings pool this draws down. Required — a withdrawal must
    // come from a specific free_will savings plan so balance checks and
    // the WithdrawalPolicy that governs it are unambiguous.
    contribution_plan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContributionPlan',
      required: true,
      index: true,
    },

    // ========================================
    // MEMBER (the one withdrawing — references ChamaMembership, same
    // reasoning as Payout.member_id: role/identity is scoped to THIS
    // chama, not the global user account)
    // ========================================

    member_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChamaMembership',
      required: true,
      index: true,
    },

    // Who actually submitted the request. Usually === member_id's own
    // membership (self-service), but a chairperson can initiate on a
    // member's behalf — kept separate so self-action prevention in
    // ApprovalRequest has an honest initiator to check against.
    requested_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChamaMembership',
      required: true,
    },

    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },

    // ========================================
    // AMOUNT — Decimal128, matching every other money field in the
    // finance engine.
    // ========================================

    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
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

    // ========================================
    // STATUS
    // ========================================
    //
    // pending    → created, awaiting approval (or briefly, mid auto-approve)
    // approved   → cleared approval; obligation posted, funds no longer
    //              part of the member's available savings
    // paid       → treasurer has disbursed and confirmed it
    // rejected   → an approver declined it (from pending only)
    // cancelled  → withdrawn before disbursement (from pending OR approved)
    //
    // ========================================

    status: {
      type: String,
      enum: ['pending', 'approved', 'paid', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },

    // ========================================
    // POLICY ENGINE DECISION SNAPSHOT
    // ========================================
    //
    // What WithdrawalPolicy (if any) was evaluated and what it decided, at
    // the moment the request was made — kept even if the policy changes
    // later, for auditability.
    //
    // ========================================

    policy_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WithdrawalPolicy',
      default: null,
    },

    policy_decision: {
      action: { type: String, default: null }, // AUTO_APPROVE | REQUIRE_APPROVAL | AUTO_REJECT | FLAG_FOR_REVIEW
      passed: { type: Boolean, default: null },
      reasons: { type: [String], default: [] },
    },

    // ========================================
    // APPROVAL
    // ========================================
    //
    // Null when the policy engine auto-approved the request (no human
    // sign-off needed). Otherwise points at the ApprovalRequest that
    // carries the actual approve/reject sign-offs — see
    // approval.service.js. Withdrawal.status is kept in sync with it by
    // withdrawal.service.js#syncWithApprovalRequest.
    //
    // ========================================

    approval_request_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApprovalRequest',
      default: null,
    },

    approved_at: {
      type: Date,
      default: null,
    },

    rejected_at: {
      type: Date,
      default: null,
    },

    rejection_reason: {
      type: String,
      trim: true,
      default: null,
    },

    cancelled_at: {
      type: Date,
      default: null,
    },

    cancellation_reason: {
      type: String,
      trim: true,
      default: null,
    },

    // ========================================
    // RESERVATION — mirrors the "reserve" step the withdrawal lifecycle
    // is meant to have and Payout is missing. Tracked here so releasing
    // it (on cancellation, or once the obligation is posted) is
    // idempotent even under retries.
    // ========================================

    reservation: {
      account_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FinancialAccount',
        default: null,
      },
      reserved_at: {
        type: Date,
        default: null,
      },
      released_at: {
        type: Date,
        default: null,
      },
    },

    // ========================================
    // DISBURSEMENT METHOD — only set once paid. Must stay in sync with
    // withdrawal.rule.js#resolveDisbursementAccount.
    // ========================================

    disbursement_method: {
      type: String,
      enum: ['cash', 'bank', 'mpesa', 'wallet'],
      default: null,
    },

    external_reference: {
      type: String,
      trim: true,
      default: null,
    },

    // ========================================
    // LEDGER LINKS
    // ========================================

    obligation_transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FinancialTransaction',
      default: null,
    },

    financial_transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FinancialTransaction',
      default: null,
    },

    paid_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ========================================
// LOOK UP A MEMBER'S OPEN REQUESTS / RECENT HISTORY QUICKLY
// ========================================

withdrawalSchema.index({ chama_id: 1, member_id: 1, status: 1 });
withdrawalSchema.index({ chama_id: 1, contribution_plan_id: 1, status: 1 });

// ========================================
// JSON TRANSFORM — same Decimal128-serialization fix as Payout.
// ========================================

withdrawalSchema.set('toJSON', {
  transform: (_doc, ret) => {
    if (ret.amount !== undefined && ret.amount !== null) {
      ret.amount = ret.amount.toString();
    }
    return ret;
  },
});

export default mongoose.models.Withdrawal || mongoose.model('Withdrawal', withdrawalSchema);
