import mongoose from 'mongoose';

// Durable reminder/outbox record. Provider delivery can be added later without
// changing lifecycle or idempotency semantics.
const contributionReminderSchema = new mongoose.Schema({
  contribution_group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ContributionGroup', required: true, index: true },
  pledge_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ContributionPledge', default: null },
  obligation_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ContributionObligation', default: null },
  recipient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind: { type: String, enum: ['payment_due', 'deadline', 'close_review', 'archival_warning', 'arrears_summary'], required: true },
  channel: { type: String, enum: ['in_app', 'sms', 'whatsapp'], default: 'in_app' },
  message: { type: String, required: true, trim: true, maxlength: 1000 },
  scheduled_for: { type: Date, default: Date.now, index: true },
  sent_at: { type: Date, default: null },
  status: { type: String, enum: ['queued', 'sent', 'failed'], default: 'queued', index: true },
  idempotency_key: { type: String, required: true },
  provider_message_id: { type: String, default: null },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

contributionReminderSchema.index({ idempotency_key: 1 }, { unique: true });
export default mongoose.models.ContributionReminder || mongoose.model('ContributionReminder', contributionReminderSchema);
