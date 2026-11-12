import mongoose from "mongoose";
const schema = new mongoose.Schema({
  chama_id: { type: mongoose.Schema.Types.ObjectId, ref: "Chama", required: true, index: true },
  token: { type: String, required: true, unique: true },
  phone: { type: String, trim: true, default: null },
  role: { type: String, enum: ["member"], default: "member", required: true },
  invited_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  expires_at: { type: Date, required: true },
  max_uses: { type: Number, min: 1, max: 500, default: 100 },
  use_count: { type: Number, min: 0, default: 0 },
  revoked_at: { type: Date, default: null },
  accepted_at: Date,
  uses: [{ user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, membership_id: { type: mongoose.Schema.Types.ObjectId, ref: "ChamaMembership", required: true }, accepted_at: { type: Date, default: Date.now } }]
}, { timestamps: true });

schema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
schema.index({ chama_id: 1, revoked_at: 1, expires_at: 1 });
export default mongoose.models.ChamaInvitation || mongoose.model("ChamaInvitation", schema);
