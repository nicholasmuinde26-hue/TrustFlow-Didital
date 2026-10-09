import mongoose from "mongoose";

const recipientSchema = new mongoose.Schema({
  member_id: { type: mongoose.Schema.Types.ObjectId, ref: "ChamaMembership", required: true },
  amount: { type: mongoose.Schema.Types.Decimal128, required: true },
  method: { type: String, enum: ["wallet", "mpesa"], required: true },
  phone_number: { type: String, default: null },
  response: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
  responded_at: { type: Date, default: null },
  payout_status: { type: String, enum: ["pending", "processing", "paid", "failed"], default: "pending" },
  mpesa_conversation_id: { type: String, default: null },
}, { _id: true });

const distributionSchema = new mongoose.Schema({
  chama_id: { type: mongoose.Schema.Types.ObjectId, ref: "Chama", required: true, index: true },
  asset_id: { type: mongoose.Schema.Types.ObjectId, ref: "ChamaAsset", required: true, index: true },
  recipients: { type: [recipientSchema], required: true },
  total_amount: { type: mongoose.Schema.Types.Decimal128, required: true },
  status: { type: String, enum: ["awaiting_acceptance", "scheduled", "processing", "completed", "rejected", "failed"], default: "awaiting_acceptance", index: true },
  scheduled_at: { type: Date, required: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

distributionSchema.index({ status: 1, scheduled_at: 1 });
distributionSchema.set("toJSON", { transform: (_doc, ret) => {
  if (ret.total_amount != null) ret.total_amount = ret.total_amount.toString();
  ret.recipients?.forEach((item) => { if (item.amount != null) item.amount = item.amount.toString(); });
  return ret;
} });

export default mongoose.models.ChamaAssetDistribution || mongoose.model("ChamaAssetDistribution", distributionSchema);
