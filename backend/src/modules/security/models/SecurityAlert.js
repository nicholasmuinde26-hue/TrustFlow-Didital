import mongoose from 'mongoose';

// A plain object literal with a `type` key inside an array — e.g.
// `[{ type: String, id: String, label: String }]` — is a Mongoose
// footgun: Mongoose treats `type` as its own reserved SchemaType
// keyword, so it reads the whole object as "this array holds plain
// Strings" and silently drops `id`/`label`. Every real
// { type, id, label } object saved into it then throws
// `Cast to [string] failed`. A named sub-schema sidesteps the
// ambiguity entirely.
const relatedEntitySchema = new mongoose.Schema(
  { type: { type: String }, id: { type: String }, label: { type: String } },
  { _id: false }
);

const securityAlertSchema = new mongoose.Schema({
  title: { type: String, required: true },
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], required: true, index: true },
  status: { type: String, enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'], default: 'OPEN', index: true },
  riskScore: { type: Number, required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'SecurityEvent', required: true },
  actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, index: true },
  explanation: { summary: String, signals: [{ code: String, label: String, contribution: Number, confidence: String }], recommendedControl: String },
  relatedEntities: [relatedEntitySchema],
  response: { action: String, performedAt: Date, performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } },
}, { timestamps: true });

securityAlertSchema.index({ status: 1, severity: 1, createdAt: -1 });
export default mongoose.model('SecurityAlert', securityAlertSchema);