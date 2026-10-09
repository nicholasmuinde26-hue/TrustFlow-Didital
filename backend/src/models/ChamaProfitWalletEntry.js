import mongoose from "mongoose";

const schema = new mongoose.Schema({
  chama_id: { type: mongoose.Schema.Types.ObjectId, ref: "Chama", required: true, index: true },
  member_id: { type: mongoose.Schema.Types.ObjectId, ref: "ChamaMembership", required: true, index: true },
  distribution_id: { type: mongoose.Schema.Types.ObjectId, ref: "ChamaAssetDistribution", required: true },
  amount: { type: mongoose.Schema.Types.Decimal128, required: true },
  type: { type: String, enum: ["credit", "withdrawal"], required: true },
  status: { type: String, enum: ["pending", "completed", "failed"], default: "completed", index: true },
  mpesa_conversation_id: { type: String, default: null, index: true },
  mpesa_receipt: { type: String, default: null },
  description: { type: String, default: "" },
}, { timestamps: true });

export default mongoose.models.ChamaProfitWalletEntry || mongoose.model("ChamaProfitWalletEntry", schema);
