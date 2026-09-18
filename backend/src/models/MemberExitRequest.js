import mongoose from 'mongoose';

const memberExitRequestSchema = new mongoose.Schema({
  chama_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chama', required: true, index: true },
  membership_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChamaMembership', required: true, index: true },
  initiated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, trim: true, maxlength: 1000, default: '' },
  savings_amount: { type: mongoose.Schema.Types.Decimal128, required: true, min: 0 },
  currency: { type: String, default: 'KES', uppercase: true },
  status: { type: String, enum: ['pending_approval','approved','disbursed','rejected','cancelled'], default: 'pending_approval', index: true },
  approval_request_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalRequest', default: null },
  obligation_transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialTransaction', default: null },
  settlement_transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialTransaction', default: null },
  disbursement_method: { type: String, enum: ['cash','bank','mpesa'], default: null },
  external_reference: { type: String, trim: true, default: null },
  approved_at: { type: Date, default: null },
  disbursed_at: { type: Date, default: null },
  completed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

memberExitRequestSchema.index({ chama_id: 1, membership_id: 1, status: 1 });
memberExitRequestSchema.set('toJSON', { transform: (_doc, ret) => {
  if (ret.savings_amount != null) ret.savings_amount = ret.savings_amount.toString();
  return ret;
}});

export default mongoose.models.MemberExitRequest || mongoose.model('MemberExitRequest', memberExitRequestSchema);
