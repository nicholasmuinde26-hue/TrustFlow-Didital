import mongoose from 'mongoose';

const trustProfileSchema = new mongoose.Schema({
  entityType: { type: String, required: true, uppercase: true },
  entityId: { type: String, required: true },
  riskScore: { type: Number, default: 0, min: 0, max: 100 },
  trustState: { type: String, enum: ['NORMAL', 'MONITOR', 'ELEVATED', 'RESTRICTED'], default: 'NORMAL' },
  knownDevices: [String], knownIps: [String], normalActivity: { type: mongoose.Schema.Types.Mixed, default: {} },
  lastEventAt: Date,
}, { timestamps: true });
trustProfileSchema.index({ entityType: 1, entityId: 1 }, { unique: true });
export default mongoose.model('TrustProfile', trustProfileSchema);
