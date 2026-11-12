import mongoose from 'mongoose';

const chamaFineSchema = new mongoose.Schema({
  chama_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chama', required: true, index: true },
  member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChamaMembership', required: true, index: true },
  reason_type: { type: String, enum: ['late_payment', 'meeting_absence', 'custom'], required: true },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  amount: { type: Number, required: true, min: 0.01 },
  paid_amount: { type: Number, default: 0, min: 0 },
  obligation_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ContributionObligation', default: null },
  due_date: { type: Date, default: null },
  status: { type: String, enum: ['outstanding', 'paid', 'waived'], default: 'outstanding', index: true },
  issued_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  settled_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  settled_at: { type: Date, default: null },
  reminder_count: { type: Number, default: 0 },
  last_reminded_at: { type: Date, default: null },
}, { timestamps: true });

chamaFineSchema.index({ chama_id: 1, member_id: 1, status: 1, createdAt: -1 });
chamaFineSchema.index({ obligation_id: 1 }, { unique: true, partialFilterExpression: { obligation_id: { $type: 'objectId' } } });

export default mongoose.models.ChamaFine || mongoose.model('ChamaFine', chamaFineSchema);
