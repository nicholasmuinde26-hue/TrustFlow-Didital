import mongoose from 'mongoose';

// A support case: one tracked problem for one user or one chama. Notes hang
// off it (SupportNote.case_id); status changes are logged there as events.
const supportCaseSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    subject_type: { type: String, enum: ['user', 'chama'], required: true, index: true },
    subject_id: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    subject_label: { type: String, default: '' }, // name at time of opening, so lists need no populate
    title: { type: String, required: true, trim: true, maxlength: 140 },
    category: {
      type: String,
      enum: ['billing', 'payment', 'account_access', 'verification', 'data_issue', 'how_to', 'other'],
      default: 'other',
      index: true,
    },
    priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal', index: true },
    status: { type: String, enum: ['open', 'pending', 'resolved', 'closed'], default: 'open', index: true },
    assignee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    invoice_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
    resolution: { type: String, default: '', maxlength: 1000 },
    resolved_at: { type: Date, default: null },
  },
  { timestamps: true }
);

supportCaseSchema.index({ status: 1, priority: 1, updatedAt: -1 });

export default mongoose.models.SupportCase || mongoose.model('SupportCase', supportCaseSchema);
