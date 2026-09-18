import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  deviceId: { type: String, required: true },
  ip: { type: String, default: null },
  userAgent: { type: String, default: null },
  status: { type: String, enum: ['ACTIVE', 'REVOKED'], default: 'ACTIVE', index: true },
  lastSeenAt: { type: Date, default: Date.now },
  revokedAt: { type: Date, default: null },
}, { timestamps: true });
schema.index({ userId: 1, deviceId: 1 }, { unique: true });
export default mongoose.models.AdminAccessSession || mongoose.model('AdminAccessSession', schema);
