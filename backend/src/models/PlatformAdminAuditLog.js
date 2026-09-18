import mongoose from 'mongoose';

// Central administrative history. These rows are append-only so the Super
// Admin can always reconstruct appointments, scope changes, and removals.
const schema = new mongoose.Schema({
  actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  action: { type: String, required: true, uppercase: true, trim: true, index: true },
  category: { type: String, default: null, index: true },
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

for (const hook of ['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete']) {
  schema.pre(hook, function () { throw new Error('Platform admin audit logs are immutable and cannot be changed or deleted'); });
}
schema.index({ createdAt: -1 });
export default mongoose.models.PlatformAdminAuditLog || mongoose.model('PlatformAdminAuditLog', schema);
