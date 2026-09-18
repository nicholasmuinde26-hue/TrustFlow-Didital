import mongoose from 'mongoose';

const securityEventSchema = new mongoose.Schema({
  eventType: { type: String, required: true, uppercase: true, trim: true, index: true },
  actor: { userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, role: String },
  workspace: { type: { type: String, uppercase: true }, id: { type: mongoose.Schema.Types.ObjectId, index: true } },
  transaction: { amount: Number, currency: { type: String, default: 'KES' }, recipientId: String },
  device: { deviceId: { type: String, index: true }, firstSeen: Boolean },
  session: { sessionId: String, age: String },
  network: { ip: String, country: String },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  decision: { type: String, enum: ['ALLOW', 'MONITOR', 'HOLD', 'BLOCK'], default: 'ALLOW', index: true },
  riskScore: { type: Number, min: 0, max: 100, default: 0 },
  signals: [{ code: String, label: String, contribution: Number, confidence: String }],
}, { timestamps: true });

securityEventSchema.index({ 'actor.userId': 1, createdAt: -1 });
securityEventSchema.index({ 'workspace.id': 1, createdAt: -1 });
export default mongoose.model('SecurityEvent', securityEventSchema);
