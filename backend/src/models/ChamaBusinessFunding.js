import mongoose from "mongoose";

const chamaBusinessFundingSchema = new mongoose.Schema({
  chama_id: { type: mongoose.Schema.Types.ObjectId, ref: "Chama", required: true, index: true },
  asset_id: { type: mongoose.Schema.Types.ObjectId, ref: "ChamaAsset", required: true, index: true },
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
  amount: { type: mongoose.Schema.Types.Decimal128, required: true, min: 0.01 },
  source_account: { type: String, enum: ["cash", "bank", "mpesa"], required: true },
  external_reference: { type: String, trim: true, default: "" },
  chama_transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: "FinancialTransaction", default: null },
  business_transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: "FinancialTransaction", default: null },
  status: { type: String, enum: ["pending", "posted", "failed"], default: "pending", index: true },
  failure_reason: { type: String, default: "" },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

chamaBusinessFundingSchema.set("toJSON", { transform: (_doc, ret) => {
  if (ret.amount != null) ret.amount = ret.amount.toString();
  return ret;
} });

export default mongoose.models.ChamaBusinessFunding || mongoose.model("ChamaBusinessFunding", chamaBusinessFundingSchema);
