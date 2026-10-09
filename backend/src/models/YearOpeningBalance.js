import mongoose from 'mongoose';
const { Decimal128, ObjectId } = mongoose.Schema.Types;

// Opening balance of a financial year for one account, seeded from the
// previous year's SEALED close. Only retained money is ever written here.
// FinancialAccount.current_balance is continuous and is never reset; this
// collection is what year-scoped reporting reads as "opening".
const yearOpeningBalanceSchema = new mongoose.Schema(
  {
    chama_id: { type: ObjectId, ref: 'Chama', required: true, index: true },
    year_id: { type: ObjectId, ref: 'ChamaFinancialYear', required: true },
    account_id: { type: ObjectId, ref: 'FinancialAccount', required: true },
    amount: { type: Decimal128, required: true },
    source_year_id: { type: ObjectId, ref: 'ChamaFinancialYear', required: true },
    source_close_id: { type: ObjectId, ref: 'YearEndClose', required: true },
    source_snapshot_hash: { type: String, required: true },
    seeded_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

yearOpeningBalanceSchema.index({ year_id: 1, account_id: 1 }, { unique: true });

yearOpeningBalanceSchema.set('toJSON', {
  transform: (_doc, ret) => {
    if (ret.amount !== undefined && ret.amount !== null) ret.amount = ret.amount.toString();
    return ret;
  },
});

export default mongoose.models.YearOpeningBalance || mongoose.model('YearOpeningBalance', yearOpeningBalanceSchema);
