import mongoose from 'mongoose';
const { Decimal128, ObjectId } = mongoose.Schema.Types;

const money = { type: Decimal128, required: true, default: '0' };

// One row per account per close run. Buckets are signed in the account's own
// normal-balance direction, so: closing = opening + contributions + income
// + expenses + payouts + other (expenses/payouts are negative where they
// reduce the account).
const yearEndSnapshotSchema = new mongoose.Schema(
  {
    close_id: { type: ObjectId, ref: 'YearEndClose', required: true, index: true },
    chama_id: { type: ObjectId, ref: 'Chama', required: true, index: true },
    year_id: { type: ObjectId, ref: 'ChamaFinancialYear', required: true, index: true },

    account_id: { type: ObjectId, ref: 'FinancialAccount', required: true },
    account_code: { type: String, default: null },
    name: { type: String, required: true },
    account_type: { type: String, required: true },
    account_category: { type: String, default: 'other' },

    settlement: { type: String, enum: ['retained', 'cleared', 'distributed'], required: true },

    opening: money,
    contributions: money,
    income: money,
    expenses: money,
    payouts: money,
    other: money,
    closing: money,

    // What the next year's opening seeder may carry: closing if retained, else 0.
    carry_forward: money,

    // Pure ledger view, independent of any seeded opening.
    ledger_closing: money,
    // Live FinancialAccount.current_balance at snapshot time, and the gap to
    // the full-history ledger sum. Non-zero drift is surfaced to approvers.
    current_balance_at_snapshot: money,
    drift: money,
  },
  { timestamps: true }
);

yearEndSnapshotSchema.index({ close_id: 1, account_id: 1 }, { unique: true });

yearEndSnapshotSchema.set('toJSON', {
  transform: (_doc, ret) => {
    for (const k of ['opening', 'contributions', 'income', 'expenses', 'payouts', 'other',
      'closing', 'carry_forward', 'ledger_closing', 'current_balance_at_snapshot', 'drift']) {
      if (ret[k] !== undefined && ret[k] !== null) ret[k] = ret[k].toString();
    }
    return ret;
  },
});

export default mongoose.models.YearEndSnapshot || mongoose.model('YearEndSnapshot', yearEndSnapshotSchema);
