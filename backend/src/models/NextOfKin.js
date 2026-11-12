import mongoose from 'mongoose';

const nextOfKinSchema = new mongoose.Schema({
  chama_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chama', required: true, index: true },
  membership_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChamaMembership', required: true, index: true },
  full_name: { type: String, required: true, trim: true, maxlength: 200 },
  relationship: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  national_id_encrypted: { type: String, required: true, select: false },
  national_id_last4: { type: String, required: true },
  share_percentage: { type: Number, required: true, min: 0.01, max: 100 },
  is_primary: { type: Boolean, default: false },
  is_active: { type: Boolean, default: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

nextOfKinSchema.index({ membership_id: 1, is_active: 1 });
nextOfKinSchema.set('toJSON', { transform: (_doc, ret) => { delete ret.national_id_encrypted; delete ret.__v; return ret; } });

export default mongoose.model('NextOfKin', nextOfKinSchema);
