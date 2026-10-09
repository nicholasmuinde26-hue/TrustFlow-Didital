import mongoose from "mongoose";
const { Schema } = mongoose;

/**
 * ============================================================================
 * LEDGER ADJUSTMENT
 * ============================================================================
 *
 * A manual, human-initiated double-entry correction against the ledger —
 * e.g. fixing a misposted transaction, booking a bank fee/interest item
 * found during reconciliation, or writing off a small variance.
 *
 * Lifecycle:
 *
 *   pending   -> created, ApprovalRequest attached, nothing posted yet
 *   approved  -> ApprovalRequest resolved 'approved' (transient; the
 *                service posts immediately after this and moves to 'posted')
 *   posted    -> accountingService.post() has run; journal_id/transaction_id set
 *   rejected  -> ApprovalRequest resolved 'rejected'
 *   cancelled -> withdrawn by the initiator/chairperson while still pending
 *
 * This never bypasses the double-entry engine (accounting/accounting.service.js) -
 * it only supplies the DR/CR pair once approval clears. See
 * modules/finance/accounting/rules/adjustment.rule.js.
 * ============================================================================
 */

const ledgerAdjustmentSchema = new Schema(
  {
    owner_type: {
      type: String,
      enum: ["Chama", "ContributionGroup", "Business"],
      required: true,
      index: true
    },
    owner_id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true
    },

    debit_account_id: {
      type: Schema.Types.ObjectId,
      ref: "FinancialAccount",
      required: true
    },
    credit_account_id: {
      type: Schema.Types.ObjectId,
      ref: "FinancialAccount",
      required: true
    },

    amount: {
      type: Schema.Types.Decimal128,
      required: true
    },
    currency: {
      type: String,
      default: "KES",
      uppercase: true,
      trim: true
    },

    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    // Free-text supporting reference (e.g. a bank statement line ref, a
    // voucher number). Not validated against anything.
    reference: {
      type: String,
      trim: true,
      default: ""
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "posted", "cancelled"],
      default: "pending",
      index: true
    },

    // Where this adjustment came from - a plain manual correction, or
    // raised out of an unmatched bank-statement line while reconciling.
    source: {
      type: String,
      enum: ["manual", "bank_reconciliation"],
      default: "manual"
    },
    source_reconciliation_id: {
      type: Schema.Types.ObjectId,
      ref: "BankReconciliation",
      default: null
    },
    source_reconciliation_line_id: {
      type: Schema.Types.ObjectId,
      default: null
    },

    initiated_by: {
      type: Schema.Types.ObjectId,
      ref: "ChamaMembership",
      required: true
    },
    approval_request_id: {
      type: Schema.Types.ObjectId,
      ref: "ApprovalRequest",
      default: null
    },

    journal_id: {
      type: Schema.Types.ObjectId,
      ref: "Journal",
      default: null
    },
    transaction_id: {
      type: Schema.Types.ObjectId,
      ref: "FinancialTransaction",
      default: null
    },

    posted_at: { type: Date, default: null },
    rejected_at: { type: Date, default: null },
    rejection_reason: { type: String, default: null },
    cancelled_at: { type: Date, default: null },

    created_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  { timestamps: true }
);

ledgerAdjustmentSchema.pre("validate", function () {
  if (
    this.debit_account_id &&
    this.credit_account_id &&
    String(this.debit_account_id) === String(this.credit_account_id)
  ) {
    throw new Error("An adjustment cannot debit and credit the same account");
  }
  if (this.amount !== undefined && this.amount !== null && Number(this.amount) <= 0) {
    throw new Error("Adjustment amount must be positive");
  }
});

ledgerAdjustmentSchema.index({ owner_type: 1, owner_id: 1, status: 1, createdAt: -1 });

export default mongoose.model("LedgerAdjustment", ledgerAdjustmentSchema);