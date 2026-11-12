import mongoose from 'mongoose';

const authHandoffSchema = new mongoose.Schema({
  codeHash: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

authHandoffSchema.index({ codeHash: 1, expiresAt: 1 });

export default mongoose.models.AuthHandoff || mongoose.model('AuthHandoff', authHandoffSchema);
