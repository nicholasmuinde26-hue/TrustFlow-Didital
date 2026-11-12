import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  contribution_group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ContributionGroup', required: true, index: true },
  reporter_key: { type: String, required: true },
  category: { type: String, enum: ['misleading', 'impersonation', 'payout_concern', 'harmful_or_illegal', 'other'], required: true },
  details: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: ['open', 'reviewed', 'dismissed'], default: 'open', index: true },
  reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewed_at: { type: Date, default: null },
  review_notes: { type: String, trim: true, maxlength: 1000, default: '' },
}, { timestamps: true });

schema.index({ contribution_group_id: 1, reporter_key: 1 }, { unique: true });

export default mongoose.models.PublicGivingReport || mongoose.model('PublicGivingReport', schema);
