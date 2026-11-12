import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChamaMembership', required: true },
  amount: { type: mongoose.Schema.Types.Decimal128, required: true },
  share_percentage_applied: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  disbursement_method: { type: String, enum: ['cash', 'bank', 'mpesa', 'wallet', null], default: null },
  external_reference: { type: String, trim: true, default: null },
  financial_transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialTransaction', default: null },
  paid_at: { type: Date, default: null },
}, { _id: true });

const fineShareoutSchema = new mongoose.Schema({
  chama_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chama', required: true, index: true },
  contribution_plan_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ContributionPlan', required: true },
  period_label: { type: String, trim: true, maxlength: 150, default: '' },
  distribution_basis: { type: String, enum: ['equal', 'fines_paid'], default: 'equal' },
  as_of_date: { type: Date, required: true, default: Date.now },
  total_amount: { type: mongoose.Schema.Types.Decimal128, required: true },
  currency: { type: String, default: 'KES', uppercase: true },
  status: { type: String, enum: ['pending_approval', 'approved', 'completed', 'cancelled'], default: 'pending_approval', index: true },
  items: { type: [itemSchema], default: [] },
  approvals: [{ approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'ChamaMembership' }, approved_at: { type: Date, default: Date.now } }],
  obligation_transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialTransaction', default: null },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cancelled_at: { type: Date, default: null },
}, { timestamps: true });

fineShareoutSchema.index({ chama_id: 1, status: 1, createdAt: -1 });
fineShareoutSchema.set('toJSON', { transform: (_doc, ret) => {
  if (ret.total_amount != null) ret.total_amount = ret.total_amount.toString();
  ret.items = (ret.items || []).map((item) => ({ ...item, amount: item.amount?.toString?.() ?? item.amount }));
  return ret;
} });

export default mongoose.models.FineShareout || mongoose.model('FineShareout', fineShareoutSchema);
