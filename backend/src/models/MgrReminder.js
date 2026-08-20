import mongoose from 'mongoose';

const mgrReminderSchema = new mongoose.Schema({
  chama_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chama', required: true, index: true },
  obligation_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ContributionObligation', required: true, index: true },
  participant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChamaMembership', required: true },
  channel: { type: String, enum: ['sms', 'whatsapp'], required: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true, maxlength: 500 },
}, { timestamps: true });

mgrReminderSchema.index({ obligation_id: 1, createdAt: -1 });

export default mongoose.model('MgrReminder', mgrReminderSchema);