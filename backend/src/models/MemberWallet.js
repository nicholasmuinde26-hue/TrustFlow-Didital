import mongoose from "mongoose";

const entrySchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["deposit", "withdrawal", "disbursement"], required: true },
  amount: { type: mongoose.Schema.Types.Decimal128, required: true },
  status: { type: String, enum: ["pending", "completed", "failed"], default: "pending", index: true },
  source_type: { type: String, default: null },
  source_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  phone_number: { type: String, default: null },
  checkout_request_id: { type: String, default: null, index: true },
  conversation_id: { type: String, default: null, index: true },
  external_reference: { type: String, default: null },
  failure_reason: { type: String, default: null },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  completed_at: { type: Date, default: null },
}, { timestamps: true });

entrySchema.index({ source_type: 1, source_id: 1, type: 1 }, { unique: true, partialFilterExpression: { source_id: { $type: "objectId" }, type: "disbursement" } });

const walletSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  balance: { type: mongoose.Schema.Types.Decimal128, default: "0.00" },
  reserved_balance: { type: mongoose.Schema.Types.Decimal128, default: "0.00" },
  wallet_pin_hash: { type: String, select: false, default: null },
  wallet_pin_failed_attempts: { type: Number, default: 0, select: false },
  wallet_pin_locked_until: { type: Date, default: null, select: false },
}, { timestamps: true });

const MemberWallet = mongoose.models.MemberWallet || mongoose.model("MemberWallet", walletSchema);
export const MemberWalletEntry = mongoose.models.MemberWalletEntry || mongoose.model("MemberWalletEntry", entrySchema);
export default MemberWallet;
