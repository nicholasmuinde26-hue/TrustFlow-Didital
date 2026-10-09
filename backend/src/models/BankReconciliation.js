import mongoose from "mongoose";
const { Schema } = mongoose;

/**
 * ============================================================================
 * BANK RECONCILIATION
 * ============================================================================
 *
 * "Generic bank reconciliation": one session per statement period for a
 * registered ChamaBankAccount. The treasurer loads the bank statement's
 * lines in, the system auto-matches what it can against posted LedgerEntry
 * rows on that account's FinancialAccount, and the treasurer manually
 * matches/ignores the rest or raises a LedgerAdjustment for genuine
 * bank-only items (fees, interest) before closing the session out.
 *
 * "Generic" here means it works against ANY bank account/statement source -
 * lines are entered as plain {date, description, amount, direction} rows,
 * not tied to one bank's file format.
 * ============================================================================
 */

const statementLineSchema = new Schema(
  {
    date: { type: Date, required: true },
    description: { type: String, trim: true, default: "" },
    amount: { type: Schema.Types.Decimal128, required: true },
    // From the CHAMA's point of view: money the bank statement shows
    // landing in the account ('inflow') vs leaving it ('outflow'). This is
    // deliberately not "debit/credit" - bank statements use the customer's
    // own convention which is the mirror image of our ledger's asset-account
    // debit/credit, and that mismatch is a classic reconciliation bug.
    direction: { type: String, enum: ["inflow", "outflow"], required: true },
    external_ref: { type: String, trim: true, default: "" },

    status: { type: String, enum: ["unmatched", "matched", "ignored"], default: "unmatched" },
    matched_ledger_entry_id: { type: Schema.Types.ObjectId, ref: "LedgerEntry", default: null },
    matched_transaction_id: { type: Schema.Types.ObjectId, ref: "FinancialTransaction", default: null },
    match_type: { type: String, enum: ["auto", "manual", "adjustment", null], default: null },
    matched_at: { type: Date, default: null },
    matched_by: { type: Schema.Types.ObjectId, ref: "ChamaMembership", default: null },

    // Set when an unmatched line was resolved by raising a LedgerAdjustment
    // (modules/finance/adjustment.service.js) rather than being matched to
    // an existing ledger entry.
    adjustment_id: { type: Schema.Types.ObjectId, ref: "LedgerAdjustment", default: null },

    ignored_reason: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

const bankReconciliationSchema = new Schema(
  {
    owner_type: {
      type: String,
      enum: ["Chama", "ContributionGroup", "Business"],
      required: true,
      index: true
    },
    owner_id: { type: Schema.Types.ObjectId, required: true, index: true },

    bank_account_id: { type: Schema.Types.ObjectId, ref: "ChamaBankAccount", required: true },
    financial_account_id: { type: Schema.Types.ObjectId, ref: "FinancialAccount", required: true },

    period_start: { type: Date, required: true },
    period_end: { type: Date, required: true },

    opening_balance: { type: Schema.Types.Decimal128, required: true },
    closing_balance: { type: Schema.Types.Decimal128, required: true },

    status: { type: String, enum: ["in_progress", "completed"], default: "in_progress", index: true },

    lines: [statementLineSchema],

    notes: { type: String, trim: true, default: "" },

    created_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    completed_by: { type: Schema.Types.ObjectId, ref: "ChamaMembership", default: null },
    completed_at: { type: Date, default: null }
  },
  { timestamps: true }
);

bankReconciliationSchema.pre("validate", function () {
  if (this.period_start && this.period_end && this.period_start > this.period_end) {
    throw new Error("period_start must be before period_end");
  }
});

bankReconciliationSchema.index({ owner_type: 1, owner_id: 1, bank_account_id: 1, status: 1 });

// ========================================
// JSON TRANSFORM - decimals as strings, same convention as FinancialAccount
// ========================================
bankReconciliationSchema.set("toJSON", {
  transform: (_doc, ret) => {
    if (ret.opening_balance !== undefined) ret.opening_balance = ret.opening_balance?.toString?.() ?? ret.opening_balance;
    if (ret.closing_balance !== undefined) ret.closing_balance = ret.closing_balance?.toString?.() ?? ret.closing_balance;
    if (Array.isArray(ret.lines)) {
      ret.lines = ret.lines.map((line) => ({
        ...line,
        amount: line.amount?.toString?.() ?? line.amount
      }));
    }
    return ret;
  }
});

export default mongoose.model("BankReconciliation", bankReconciliationSchema);